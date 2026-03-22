/**
 * EUROCOP ANALYTICS — FncEstadisticaGVdsv.js
 * ─────────────────────────────────────────────────────────────
 * Lógica de negocio para el módulo de Accidentalidad/Lesividad
 * del formato DSV-GV (Dirección de Seguridad Vial - Gobierno Vasco).
 *
 * Responsabilidades:
 *   · Detección del archivo por nombre
 *   · Parseo y normalización de columnas del Excel
 *   · Cálculo de estadísticas de accidentalidad y lesividad
 *   · Exportación a PDF (jsPDF) y DOCX (nativo)
 *
 * NO contiene HTML ni lógica de render —
 * eso es responsabilidad de FncAtestados.js.
 *
 * Columnas soportadas del Excel:
 *   FECHASUCESO | FECHAAPERTURA  → fecha del suceso
 *   NUMEROATESTADO                → número del atestado
 *   ANYOATESTADO                  → año
 *   CBMOTIVOAPERTURA              → motivo (opcional)
 *   ESTADO_LESION                 → tipo de lesión
 *   COND_VARON, COND_MUJER        → conductores
 *   OCUP_VARON, OCUP_MUJER        → ocupantes
 *   PEAT_VARON, PEAT_MUJER        → peatones
 */

const FncEstadisticaGVdsv = (() => {

    // ── Meses en los 4 idiomas ───────────────────────────────────────────────
    const MESES = {
        es: ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
             'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
        eu: ['Urtarrila','Otsaila','Martxoa','Apirila','Maiatza','Ekaina',
             'Uztaila','Abuztua','Iraila','Urria','Azaroa','Abendua'],
        ca: ['Gener','Febrer','Març','Abril','Maig','Juny',
             'Juliol','Agost','Setembre','Octubre','Novembre','Desembre'],
        gl: ['Xaneiro','Febreiro','Marzo','Abril','Maio','Xuño',
             'Xullo','Agosto','Setembro','Outubro','Novembro','Decembro']
    };

    // ── Helper de traducción (claves at_ de languages.js) ───────────────────
    function t(key) {
        const atKey = 'at_' + key;
        const tr  = typeof translations !== 'undefined' ? translations : null;
        const lng = typeof currentLang  !== 'undefined' ? currentLang  : 'es';
        if (tr && tr[lng]  && tr[lng][atKey])  return tr[lng][atKey];
        if (tr && tr['es'] && tr['es'][atKey]) return tr['es'][atKey];
        const fb = {
            municipio:'Municipio', introducir_anyo:'Introduce año',
            selecciona_mes:'Selecciona mes', mostrar:'Mostrar',
            accidentalidad:'Accidentalidad', lesividad:'Lesividad',
            num_accidentes:'Número accidentes',
            con_victimas:'Accidentes con víctimas',
            sin_victimas:'Accidentes sin víctimas', total:'TOTAL',
            conductores:'Conductores', ocupantes:'Ocupantes', peatones:'Peatones',
            varon:'Varón', mujer:'Mujer', inicio:'Inicio',
            actualizar:'Actualizar estadísticas de accidentalidad/lesividad',
            exportar_pdf:'Exportar PDF', exportar_docx:'Exportar Word',
            sin_datos:'Sin datos para el periodo seleccionado',
            ver_atestados:'Ver atestados', imprimir:'Imprimir',
            con_victimas_badge:'Con víctimas', sin_victimas_badge:'Sin víctimas',
            pers:'pers.', atestados:'Atestados',
            detalle_title:'Detalle de Atestados', estado_lesion:'Estado Lesión'
        };
        return fb[key] || key;
    }

    // ── Estado del módulo ────────────────────────────────────────────────────
    let _rawData       = [];
    let _años          = [];
    let _estadosUnicos = [];
    let _añoSel        = null;
    let _mesSel        = null;

    // ============================================================
    // DETECCIÓN DEL ARCHIVO
    // ============================================================
    function esArchivoAtestados(filename) {
        if (!filename) return false;
        const up = filename.toUpperCase();
        return up.includes('01-ATESTADOS_DSV-GV') ||
               up.includes('01_ATESTADOS_DSV_GV') ||
               up.includes('ATESTADOS_DSV');
    }

    // ============================================================
    // PARSEO Y NORMALIZACIÓN
    // ============================================================
    function parsearDatos(data) {
        _rawData = data.map(row => {
            // Normalizar nombres de columna (case-insensitive)
            const r = {};
            Object.keys(row).forEach(k => { r[k.toUpperCase()] = row[k]; });

            // Fecha: acepta FECHASUCESO (v1) o FECHAAPERTURA (v2)
            const fechaRaw = r['FECHASUCESO'] || r['FECHAAPERTURA'] || '';
            const fecha = String(fechaRaw);
            let dia = 0, mes = 0, anyo = 0;
            if (fecha.includes('/')) {
                const p = fecha.split('/');
                dia  = parseInt(p[0]) || 0;
                mes  = parseInt(p[1]) || 0;
                anyo = parseInt(p[2]) || parseInt(r['ANYOATESTADO']) || 0;
            } else {
                anyo = parseInt(r['ANYOATESTADO']) || 0;
            }

            // Columnas numéricas — tolerante a variantes de nombre
            function nc(k) {
                return parseFloat(r[k] || r[k.replace('_', '')] || 0) || 0;
            }

            return {
                fecha,
                dia, mes, anyo,
                numAtestado : parseInt(r['NUMEROATESTADO'])   || 0,
                estado      : String(r['ESTADO_LESION'] || '').trim().toUpperCase(),
                motivo      : String(r['CBMOTIVOAPERTURA'] || ''),
                cv: nc('COND_VARON'),
                cm: nc('COND_MUJER'),
                ov: nc('OCUP_VARON'),
                om: nc('OCUP_MUJER'),
                pv: nc('PEAT_VARON'),
                pm: nc('PEAT_MUJER'),
            };
        }).filter(r => r.anyo > 0);

        // Años disponibles (descendente)
        _años = [...new Set(_rawData.map(r => r.anyo))].sort((a, b) => b - a);

        // Seleccionar año más reciente sin ser futuro
        const hoy       = new Date();
        const añoActual = hoy.getFullYear();
        _añoSel = _años.find(a => a <= añoActual) || _años[0] || añoActual;

        // Seleccionar mes más reciente con datos (priorizar mes actual)
        const mesesConDatos = [...new Set(
            _rawData.filter(r => r.anyo === _añoSel).map(r => r.mes)
        )].filter(Boolean).sort((a, b) => b - a);
        const mesActual = hoy.getMonth() + 1;
        _mesSel = mesesConDatos.includes(mesActual)
            ? mesActual
            : (mesesConDatos[0] || mesActual);

        // Estados únicos — el prefijo numérico garantiza orden correcto
        _estadosUnicos = [...new Set(
            _rawData.map(r => r.estado).filter(Boolean)
        )].sort();
    }

    // ============================================================
    // CÁLCULO DE ESTADÍSTICAS
    // ============================================================
    function calcular(anyo, mes) {
        const filas = _rawData.filter(r => r.anyo === anyo && r.mes === mes);

        // ── Accidentalidad ───────────────────────────────────────
        const byAtestado = {};
        filas.forEach(r => {
            if (!byAtestado[r.numAtestado]) byAtestado[r.numAtestado] = [];
            byAtestado[r.numAtestado].push(r);
        });

        let conVictimas = 0, sinVictimas = 0;
        Object.values(byAtestado).forEach(rows => {
            // Con víctimas: ≥1 fila con total>0 y estado ≠ ILESOS
            const tieneGravedad = rows.some(r => {
                const tot = r.cv + r.cm + r.ov + r.om + r.pv + r.pm;
                return tot > 0 && !r.estado.includes('ILESOS');
            });
            tieneGravedad ? conVictimas++ : sinVictimas++;
        });

        // ── Lesividad ────────────────────────────────────────────
        const estados = _estadosUnicos.length > 0
            ? _estadosUnicos
            : ['1. MUERTOS', '2. HERIDOS GRAVES', '3. HERIDOS LEVES', '4. ILESOS'];

        const lesividad = {};
        estados.forEach(e => {
            lesividad[e] = { cv: 0, cm: 0, ov: 0, om: 0, pv: 0, pm: 0 };
        });

        filas.forEach(r => {
            // Comparación exacta primero
            const key = estados.find(e => r.estado === e)
                     || estados.find(e => r.estado.includes(e));
            if (key) {
                lesividad[key].cv += r.cv;
                lesividad[key].cm += r.cm;
                lesividad[key].ov += r.ov;
                lesividad[key].om += r.om;
                lesividad[key].pv += r.pv;
                lesividad[key].pm += r.pm;
            }
        });

        return {
            conVictimas,
            sinVictimas,
            total: conVictimas + sinVictimas,
            lesividad,
            estados,
        };
    }

    // ============================================================
    // DATOS DE ATESTADOS INDIVIDUALES (para el modal)
    // ============================================================
    function getAtestadosDelMes(anyo, mes) {
        const filas = _rawData.filter(r => r.anyo === anyo && r.mes === mes);
        const byAtestado = {};
        filas.forEach(r => {
            const k = r.numAtestado;
            if (!byAtestado[k]) {
                byAtestado[k] = {
                    num   : r.numAtestado,
                    anyo  : r.anyo,
                    fecha : r.fecha,
                    motivo: r.motivo || '',
                    filas : []
                };
            }
            byAtestado[k].filas.push(r);
        });
        return Object.values(byAtestado).sort((a, b) => a.num - b.num);
    }

    // ============================================================
    // EXPORTAR A PDF
    // ============================================================
    function exportarPdf(añoSel, mesSel) {
        const lang     = typeof currentLang !== 'undefined' ? currentLang : 'es';
        const meses    = MESES[lang] || MESES.es;
        const stats    = calcular(añoSel, mesSel);
        const nombreMes = meses[mesSel - 1] || mesSel;
        const fecha    = new Date().toLocaleDateString('es-ES',
            { day: '2-digit', month: '2-digit', year: 'numeric' });

        const { jsPDF } = window.jspdf;
        const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const mL = 15, mR = 15, contW = pageW - mL - mR;

        // ── Cabecera ──────────────────────────────────────────────
        doc.setFillColor(94, 114, 228);
        doc.rect(0, 0, pageW, 28, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text('EUROCOP ANALYTICS', mL, 11);
        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
        doc.text(t('actualizar'), mL, 18);
        doc.text(fecha, pageW - mR, 11, { align: 'right' });
        doc.text(`${nombreMes} ${añoSel}`, pageW - mR, 18, { align: 'right' });

        // ── Accidentalidad ────────────────────────────────────────
        let y = 34;
        doc.setFillColor(240, 242, 255);
        doc.rect(mL, y, contW, 7, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.setTextColor(61, 77, 183);
        doc.text(t('accidentalidad').toUpperCase(), mL + 2, y + 5);
        y += 9;

        const accRows = [
            [t('con_victimas'), stats.conVictimas],
            [t('sin_victimas'), stats.sinVictimas],
            [t('total'),        stats.total],
        ];
        accRows.forEach((row, i) => {
            const isTot = i === 2;
            if (isTot) {
                doc.setFillColor(224, 228, 252); doc.rect(mL, y, contW, 6.5, 'F');
            } else if (i % 2 === 0) {
                doc.setFillColor(248, 249, 255); doc.rect(mL, y, contW, 6.5, 'F');
            }
            doc.setDrawColor(225, 228, 245);
            doc.line(mL, y + 6.5, mL + contW, y + 6.5);
            doc.setFont('helvetica', isTot ? 'bold' : 'normal');
            doc.setFontSize(8);
            doc.setTextColor(isTot ? 61 : 50, isTot ? 77 : 50, isTot ? 183 : 80);
            doc.text(row[0], mL + 3, y + 4.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(94, 114, 228);
            doc.text(String(row[1]), mL + contW - 3, y + 4.5, { align: 'right' });
            y += 6.5;
        });

        // ── Lesividad ─────────────────────────────────────────────
        y += 6;
        doc.setFillColor(240, 242, 255);
        doc.rect(mL, y, contW, 7, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.setTextColor(61, 77, 183);
        doc.text(t('lesividad').toUpperCase(), mL + 2, y + 5);
        y += 9;

        // Cabecera fila 1 (grupos)
        const CW = [38, 13, 13, 13, 13, 13, 13, 13, 13, 15];
        doc.setFillColor(94, 114, 228);
        doc.rect(mL, y, contW, 6, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        let x = mL + CW[0];
        doc.text(t('conductores'), x + CW[1] - 1, y + 4.2, { align: 'center' }); x += CW[1] + CW[2];
        doc.text(t('ocupantes'),   x + CW[3] - 1, y + 4.2, { align: 'center' }); x += CW[3] + CW[4];
        doc.text(t('peatones'),    x + CW[5] - 1, y + 4.2, { align: 'center' }); x += CW[5] + CW[6];
        doc.text(t('total'),       x + CW[7] - 1, y + 4.2, { align: 'center' });
        y += 6;

        // Cabecera fila 2 (varón/mujer)
        doc.setFillColor(61, 77, 183);
        doc.rect(mL, y, contW, 5.5, 'F');
        x = mL + CW[0];
        [t('varon'),t('mujer'),t('varon'),t('mujer'),
         t('varon'),t('mujer'),t('varon'),t('mujer'),'TOTAL'].forEach((lbl, i) => {
            const w = CW[i + 1] || 15;
            doc.text(lbl.substring(0, 5), x + w / 2, y + 3.8, { align: 'center' });
            x += w;
        });
        y += 5.5;

        // Filas de datos
        function labelEstadoPdf(e) { return e.replace(/^\d+\.\s*/, ''); }
        const rowLabels = [
            ...stats.estados.map(e => [labelEstadoPdf(e), e]),
            [t('total'), 'TOTAL']
        ];
        let totCV=0,totCM=0,totOV=0,totOM=0,totPV=0,totPM=0;
        const totals = {};
        rowLabels.slice(0, rowLabels.length - 1).forEach(([, key]) => {
            const d = stats.lesividad[key] || { cv:0,cm:0,ov:0,om:0,pv:0,pm:0 };
            totals[key] = d;
            totCV+=d.cv; totCM+=d.cm; totOV+=d.ov;
            totOM+=d.om; totPV+=d.pv; totPM+=d.pm;
        });
        totals['TOTAL'] = { cv:totCV,cm:totCM,ov:totOV,om:totOM,pv:totPV,pm:totPM };

        rowLabels.forEach(([label, key], ri) => {
            const d     = totals[key] || { cv:0,cm:0,ov:0,om:0,pv:0,pm:0 };
            const isTot = key === 'TOTAL';
            if (isTot) {
                doc.setFillColor(224, 228, 252); doc.rect(mL, y, contW, 6, 'F');
            } else if (ri % 2 === 0) {
                doc.setFillColor(248, 249, 255); doc.rect(mL, y, contW, 6, 'F');
            }
            doc.setDrawColor(225, 228, 245);
            doc.line(mL, y + 6, mL + contW, y + 6);
            doc.setFont('helvetica', isTot ? 'bold' : 'normal');
            doc.setFontSize(7.2);
            doc.setTextColor(isTot ? 61 : 50, isTot ? 77 : 50, isTot ? 183 : 80);
            doc.text(label, mL + 2, y + 4.2);

            const vals = [
                d.cv, d.cm, d.ov, d.om, d.pv, d.pm,
                d.cv+d.ov+d.pv, d.cm+d.om+d.pm,
                d.cv+d.cm+d.ov+d.om+d.pv+d.pm
            ];
            x = mL + CW[0];
            vals.forEach((v, vi) => {
                const w = CW[vi + 1] || 15;
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(94, 114, 228);
                doc.text(String(v), x + w - 1.5, y + 4.2, { align: 'right' });
                x += w;
            });
            y += 6;
        });

        // ── Footer ────────────────────────────────────────────────
        doc.setFillColor(240, 242, 255);
        doc.rect(0, pageH - 9, pageW, 9, 'F');
        doc.setFontSize(7); doc.setFont('helvetica', 'normal');
        doc.setTextColor(130, 130, 160);
        doc.text('Generado por Eurocop Analytics · zzenkiu.com', mL, pageH - 3);
        doc.text(fecha, pageW - mR, pageH - 3, { align: 'right' });

        doc.save(`Atestados_${añoSel}_${String(mesSel).padStart(2, '0')}.pdf`);
    }

    // ============================================================
    // EXPORTAR A DOCX
    // ============================================================
    function exportarDocx(añoSel, mesSel) {
        const lang      = typeof currentLang !== 'undefined' ? currentLang : 'es';
        const meses     = MESES[lang] || MESES.es;
        const stats     = calcular(añoSel, mesSel);
        const nombreMes = meses[mesSel - 1] || mesSel;
        const fecha     = new Date().toLocaleDateString('es-ES',
            { day: '2-digit', month: '2-digit', year: 'numeric' });

        function esc(s) {
            return String(s || '')
                .replace(/&/g, '&amp;').replace(/</g, '&lt;')
                .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }
        function cell(text, w, fill='FFFFFF', bold=false, align='left', color='32325D') {
            return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>
              <w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>
              <w:tcMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>
            </w:tcPr>
            <w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:before="60" w:after="60"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="17"/>
                ${bold ? '<w:b/>' : ''}<w:color w:val="${color}"/>
              </w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>
            </w:p></w:tc>`;
        }
        function headerCell(text, w, span=1) {
            return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>
              ${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''}
              <w:shd w:val="clear" w:color="auto" w:fill="5E72E4"/>
            </w:tcPr>
            <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="60" w:after="60"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
                <w:sz w:val="16"/><w:b/><w:color w:val="FFFFFF"/>
              </w:rPr><w:t>${esc(text)}</w:t></w:r>
            </w:p></w:tc>`;
        }

        // ── Tabla accidentalidad ──────────────────────────────────
        const accW = 6000, numW = 2860;
        const accRows = [
            [t('con_victimas'), stats.conVictimas, 'F0F2FF'],
            [t('sin_victimas'), stats.sinVictimas, 'FFFFFF'],
            [t('total'),        stats.total,       'C8CEF5'],
        ];
        const accTableRows = accRows.map(([label, val, bg]) =>
            `<w:tr>
              ${cell(label, accW, bg, val === stats.total)}
              ${cell(String(val), numW, bg, true, 'right', '5E72E4')}
            </w:tr>`
        ).join('');

        // ── Tabla lesividad ───────────────────────────────────────
        const lW0=3200, lWn=700, lWtot=800;
        const totalDxa = lW0 + lWn * 8 + lWtot;

        function labelEstadoDocx(e) { return e.replace(/^\d+\.\s*/, ''); }
        const rowLabels = stats.estados.map(e => [labelEstadoDocx(e), e]);
        let totCV=0,totCM=0,totOV=0,totOM=0,totPV=0,totPM=0;
        rowLabels.forEach(([, key]) => {
            const d = stats.lesividad[key] || { cv:0,cm:0,ov:0,om:0,pv:0,pm:0 };
            totCV+=d.cv; totCM+=d.cm; totOV+=d.ov;
            totOM+=d.om; totPV+=d.pv; totPM+=d.pm;
        });

        function lesRow(label, d, bg, isTot=false) {
            const tV = d.cv+d.ov+d.pv, tM = d.cm+d.om+d.pm;
            const c = (v) => v > 0 && !isTot
                ? cell(String(v), lWn, 'FFF3CD', true, 'right', '856404')
                : cell(String(v), lWn, bg, isTot, 'right', '5E72E4');
            const cTot = (v, color) => v > 0 && !isTot
                ? cell(String(v), lWtot, 'FFF3CD', true, 'right', '856404')
                : cell(String(v), lWtot, bg, true, 'right', color);
            return `<w:tr>
              ${cell(label, lW0, bg, isTot)}
              ${c(d.cv)}${c(d.cm)}${c(d.ov)}${c(d.om)}${c(d.pv)}${c(d.pm)}
              ${c(tV)}${c(tM)}
              ${cTot(tV+tM, isTot ? '3D4DB7' : '5E72E4')}
            </w:tr>`;
        }

        let lesTableRows = rowLabels.map(([label, key], i) =>
            lesRow(
                label,
                stats.lesividad[key] || { cv:0,cm:0,ov:0,om:0,pv:0,pm:0 },
                i % 2 === 0 ? 'F0F2FF' : 'FFFFFF'
            )
        ).join('');
        lesTableRows += lesRow(
            t('total'),
            { cv:totCV,cm:totCM,ov:totOV,om:totOM,pv:totPV,pm:totPM },
            'C8CEF5', true
        );

        const gridCols = `<w:gridCol w:w="${lW0}"/>` +
            Array(8).fill(`<w:gridCol w:w="${lWn}"/>`).join('') +
            `<w:gridCol w:w="${lWtot}"/>`;

        const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
  <w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="5E72E4"/></w:pBdr>
    <w:spacing w:before="0" w:after="120"/></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="32"/><w:b/><w:color w:val="5E72E4"/></w:rPr>
      <w:t>EUROCOP ANALYTICS</w:t></w:r>
  </w:p>
  <w:p><w:pPr><w:spacing w:before="0" w:after="60"/></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="20"/><w:color w:val="525F7F"/></w:rPr>
      <w:t>${esc(t('actualizar'))}</w:t></w:r>
  </w:p>
  <w:p><w:pPr><w:spacing w:before="0" w:after="240"/></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="18"/><w:color w:val="8898AA"/></w:rPr>
      <w:t xml:space="preserve">${esc(nombreMes)} ${añoSel}   ·   Fecha: ${fecha}</w:t></w:r>
  </w:p>

  <!-- Accidentalidad -->
  <w:p><w:pPr><w:spacing w:before="160" w:after="80"/></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="20"/><w:b/><w:color w:val="3D4DB7"/></w:rPr>
      <w:t>${esc(t('accidentalidad').toUpperCase())}</w:t></w:r>
  </w:p>
  <w:tbl>
    <w:tblPr><w:tblW w:w="${accW+numW}" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:color="D0D5F0"/>
        <w:left w:val="single" w:sz="4" w:color="D0D5F0"/>
        <w:bottom w:val="single" w:sz="4" w:color="D0D5F0"/>
        <w:right w:val="single" w:sz="4" w:color="D0D5F0"/>
        <w:insideH w:val="single" w:sz="4" w:color="D0D5F0"/>
        <w:insideV w:val="single" w:sz="4" w:color="D0D5F0"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid><w:gridCol w:w="${accW}"/><w:gridCol w:w="${numW}"/></w:tblGrid>
    <w:tr>
      ${headerCell(t('accidentalidad'), accW)}
      ${headerCell(t('num_accidentes'), numW)}
    </w:tr>
    ${accTableRows}
  </w:tbl>

  <!-- Lesividad -->
  <w:p><w:pPr><w:spacing w:before="240" w:after="80"/></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="20"/><w:b/><w:color w:val="3D4DB7"/></w:rPr>
      <w:t>${esc(t('lesividad').toUpperCase())}</w:t></w:r>
  </w:p>
  <w:tbl>
    <w:tblPr><w:tblW w:w="${totalDxa}" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:color="D0D5F0"/>
        <w:left w:val="single" w:sz="4" w:color="D0D5F0"/>
        <w:bottom w:val="single" w:sz="4" w:color="D0D5F0"/>
        <w:right w:val="single" w:sz="4" w:color="D0D5F0"/>
        <w:insideH w:val="single" w:sz="4" w:color="D0D5F0"/>
        <w:insideV w:val="single" w:sz="4" w:color="D0D5F0"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid>${gridCols}</w:tblGrid>
    <w:tr>
      ${headerCell('', lW0)}
      ${headerCell(t('conductores'), lWn*2, 2)}
      ${headerCell(t('ocupantes'),   lWn*2, 2)}
      ${headerCell(t('peatones'),    lWn*2, 2)}
      ${headerCell(t('total'),       lWn*2, 2)}
      ${headerCell('TOT', lWtot)}
    </w:tr>
    <w:tr>
      ${headerCell('', lW0)}
      ${[t('varon'),t('mujer'),t('varon'),t('mujer'),
         t('varon'),t('mujer'),t('varon'),t('mujer')]
        .map(h => headerCell(h, lWn)).join('')}
      ${headerCell('', lWtot)}
    </w:tr>
    ${lesTableRows}
  </w:tbl>

  <w:p><w:pPr><w:spacing w:before="300" w:after="0"/></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="16"/><w:color w:val="AAAACC"/></w:rPr>
      <w:t>Generado por Eurocop Analytics · zzenkiu.com</w:t></w:r>
  </w:p>
  <w:sectPr>
    <w:pgSz w:w="11906" w:h="16838"/>
    <w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900"/>
  </w:sectPr>
</w:body>
</w:document>`;

        if (typeof _buildAndDownloadDocx === 'function') {
            _buildAndDownloadDocx(
                docXml,
                `Atestados_${añoSel}_${String(mesSel).padStart(2, '0')}.docx`
            );
        } else {
            if (typeof showToast === 'function') showToast('Función DOCX no disponible.');
        }
    }

    // ── API pública ──────────────────────────────────────────────────────────
    return {
        // Identificación
        esArchivoAtestados,
        // Ciclo de vida
        parsearDatos,
        // Acceso a estado
        getAños       : ()        => _años,
        getAñoSel     : ()        => _añoSel,
        getMesSel     : ()        => _mesSel,
        setAñoSel     : (v)       => { _añoSel = parseInt(v); },
        setMesSel     : (v)       => { _mesSel = parseInt(v); },
        getMeses      : (lang)    => MESES[lang] || MESES.es,
        // Cálculo
        calcular,
        getAtestadosDelMes,
        // Traducciones
        t,
        // Exportaciones
        exportarPdf,
        exportarDocx,
    };

})();
