/**
 * EUROCOP ANALYTICS — FncEstadisticaGVpj.js
 * ─────────────────────────────────────────────────────────────
 * Lógica de negocio para el módulo de Estadística PJ
 * del formato DSV-GV (Policía Judicial - Gobierno Vasco).
 *
 * Responsabilidades:
 *   · Detección del archivo por nombre
 *   · Parseo y normalización del Excel
 *   · Agrupación jerárquica de delitos (categoría → subcategoría)
 *   · Cálculo de infracciones, detenciones e investigaciones
 *   · Exportación a PDF (jsPDF) y DOCX (nativo)
 *
 * Columnas del Excel:
 *   REFERENCIA_ATS        → referencia del atestado
 *   FECHA                 → DD/MM/YYYY
 *   DELITOS               → tipo de delito
 *   NRO_INFRACCIONES      → número de infracciones
 *   DETENCIONES_VARON     → detenidos varones
 *   DETENCIONES_MUJER     → detenidas mujeres
 *   INVESTIGACIONES_VARON → investigados varones
 *   INVESTIGACIONES_MUJER → investigadas mujeres
 */

const FncEstadisticaGVpj = (() => {

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

    // ── Traducciones (claves pj_ en languages.js) ───────────────────────────
    function t(key) {
        const pjKey = 'pj_' + key;
        const tr  = typeof translations !== 'undefined' ? translations : null;
        const lng = typeof currentLang  !== 'undefined' ? currentLang  : 'es';
        if (tr && tr[lng]  && tr[lng][pjKey])  return tr[lng][pjKey];
        if (tr && tr['es'] && tr['es'][pjKey]) return tr['es'][pjKey];
        const fb = {
            titulo:       'Estadística Policial (PJ)',
            actualizar:   'Actualizar estadísticas de criminalidad',
            municipio:    'Municipio',
            introducir_anyo: 'Introduce año',
            selecciona_mes:  'Selecciona mes',
            mostrar:      'Mostrar',
            delitos:      'DELITOS',
            nro_inf:      'Nro. Infracciones',
            detenciones:  'Nro. Detenciones',
            investigaciones: 'Nro. Investigaciones',
            varon:        'Varón',
            mujer:        'Mujer',
            total:        'TOTAL',
            inicio:       'Inicio',
            exportar_pdf: 'Exportar PDF',
            exportar_docx:'Exportar Word',
            sin_datos:    'Sin datos para el periodo seleccionado',
            imprimir:     'Imprimir',
            notas:        'NOTAS',
            nota1:        'La tipología "Robo con fuerza en las cosas en vivienda" se subdivide en: robos en domicilio y robos en "otras dependencias/anexos de vivienda".',
            nota2:        'A partir del 1 de julio de 2015, con la entrada en vigor de la reforma del Código Penal, han desaparecido las faltas.',
            // Categorías de delitos
            cat_homicidio:    'Homicidio y sus formas',
            cat_lesiones:     'Lesiones',
            cat_tortura:      'Tortura y contra la integridad',
            cat_libertad_sex: 'Contra la libertad sexual',
            cat_patrimonio:   'Contra el patrimonio y el orden socioeconómico',
            cat_seg_colectiva:'Contra la seguridad colectiva',
            cat_orden_publico:'Contra el orden público',
            cat_informatica:  'Delitos informáticos',
            cat_otras:        'Otras infracciones penales',
            cat_requisitorias:'Requisitorias judiciales',
            cat_no_delito:    'Otras diligencias',
        };
        return fb[key] || key;
    }

    // ── Estructura jerárquica de categorías ─────────────────────────────────
    // Cada categoría tiene subcategorías con patrones de matching
    // El orden aquí determina el orden en pantalla
    function getCategorias() {
        return [
            {
                key: 'homicidio', label: t('cat_homicidio'),
                subs: [
                    { key: 'hom_doloso',    label: 'Homicidio doloso / asesinato consumado',
                      match: ['homicidio doloso', 'asesinato consumado'] },
                    { key: 'hom_tentativa', label: 'Homicidio / asesinato tentativa',
                      match: ['asesinato tentativa', 'homicidio tentativa'] },
                    { key: 'hom_otras',     label: 'Otras infracciones de homicidio y sus formas',
                      match: ['homicidio'] },
                ]
            },
            {
                key: 'lesiones', label: t('cat_lesiones'),
                subs: [
                    { key: 'les_familiar', label: 'Malos tratos en el ámbito familiar',
                      match: ['malos tratos en el ámbito familiar', 'lesiones(malos tratos'] },
                    { key: 'les_lesiones', label: 'Lesiones',
                      match: ['lesiones (peleas)', 'lesiones (otras'] },
                    { key: 'les_otras',    label: 'Otras infracciones de lesiones',
                      match: ['lesiones'] },
                ]
            },
            {
                key: 'tortura', label: t('cat_tortura'),
                subs: [
                    { key: 'tor_habitual', label: 'Malos tratos habituales en el ámbito familiar',
                      match: ['malos tratos habituales'] },
                    { key: 'tor_otras',    label: 'Otras infracciones de tortura y contra la integridad',
                      match: ['tortura', 'otras infracciones de tortura'] },
                ]
            },
            {
                key: 'libertad_sexual', label: t('cat_libertad_sex'),
                subs: [
                    { key: 'lsx_agresion', label: 'Agresión sexual',
                      match: ['agresión sexual'] },
                    { key: 'lsx_otras',    label: 'Otras infracciones contra la libertad sexual',
                      match: ['libertad sexual'] },
                ]
            },
            {
                key: 'patrimonio', label: t('cat_patrimonio'),
                subs: [
                    { key: 'pat_hurto',     label: 'Hurto',
                      match: ['hurto'] },
                    { key: 'pat_rob_dom',   label: 'Robo con fuerza en las cosas en domicilio',
                      match: ['robo con fuerza en las cosas en domicilio'] },
                    { key: 'pat_rob_dep',   label: 'Robo con fuerza en otras dependencias/anexos vivienda',
                      match: ['robo con fuerza en otras dependencias'] },
                    { key: 'pat_rob_emp',   label: 'Robo con fuerza en empresas',
                      match: ['robo con fuerza en empresas'] },
                    { key: 'pat_rob_com',   label: 'Robo con fuerza en comercios y otros esp. cerrados',
                      match: ['robo con fuerza en comercios'] },
                    { key: 'pat_rob_otros', label: 'Robo con fuerza en las cosas en otros lugares',
                      match: ['robo con fuerza en las cosas en otros lugares'] },
                    { key: 'pat_rob_viol',  label: 'Robo con violencia o intimidación',
                      match: ['robo con violencia'] },
                    { key: 'pat_danos',     label: 'Daños',
                      match: ['daños'] },
                    { key: 'pat_vehiculos', label: 'Sustracción de vehículos a motor',
                      match: ['sustracción de vehículos', 'sustracci'] },
                    { key: 'pat_estafa',    label: 'Estafa',
                      match: ['estafa'] },
                    { key: 'pat_otras',     label: 'Otras infracciones contra el patrimonio',
                      match: ['otras infracc. patrimonio', 'otras infracciones contra el patrimonio'] },
                ]
            },
            {
                key: 'seg_colectiva', label: t('cat_seg_colectiva'),
                subs: [
                    { key: 'sc_drogas',  label: 'Salud pública: Tráfico de drogas',
                      match: ['tráfico de drogas', 'salud pública'] },
                    { key: 'sc_alcohol', label: 'Conducir bajo la influencia de alcohol, drogas, etc.',
                      match: ['conducir bajo la influencia', 'dsv conducir'] },
                    { key: 'sc_otras',   label: 'Otras infracciones contra la seguridad colectiva',
                      match: ['seguridad colectiva', 'dsv (otros)', 'dsv accidente', 'dsv contra'] },
                ]
            },
            {
                key: 'orden_publico', label: t('cat_orden_publico'),
                subs: [
                    { key: 'op_terr_bienes', label: 'Terrorismo contra bienes materiales',
                      match: ['terrorismo contra bienes'] },
                    { key: 'op_terr_pers',   label: 'Terrorismo contra las personas',
                      match: ['terrorismo contra las personas'] },
                    { key: 'op_terr_otros',  label: 'Otros actos de terrorismo',
                      match: ['terrorismo'] },
                    { key: 'op_otras',       label: 'Otras infracciones contra el orden público',
                      match: ['orden público'] },
                ]
            },
            {
                key: 'informatica', label: t('cat_informatica'),
                subs: [
                    { key: 'inf_estafa',   label: 'Estafas informáticas',
                      match: ['estafas informáticas', 'di estafas'] },
                    { key: 'inf_amenazas', label: 'Ciberamenazas y cibercoacciones',
                      match: ['ciberamenazas', 'di cibera'] },
                    { key: 'inf_otras',    label: 'Otros delitos informáticos',
                      match: ['delitos informáticos', 'di otros'] },
                ]
            },
            {
                key: 'otras', label: t('cat_otras'),
                subs: [
                    { key: 'otr_penales', label: 'Otras infracciones penales',
                      match: ['otras infracciones penales'] },
                ]
            },
            {
                key: 'requisitorias', label: t('cat_requisitorias'),
                subs: [
                    { key: 'req_jud', label: 'Requisitorias judiciales',
                      match: ['requisitorias'] },
                ]
            },
            {
                key: 'no_delito', label: t('cat_no_delito'),
                hidden: true,
                subs: [
                    { key: 'nd_informe',  label: 'Informe judicial',
                      match: ['informe judicial'] },
                    { key: 'nd_perdida',  label: 'Pérdida documentación/objetos',
                      match: ['perdida documentación', 'perdida documentacion'] },
                    { key: 'nd_nodelito', label: 'No delito',
                      match: ['no delito'] },
                    { key: 'nd_expte',    label: 'Expediente administrativo',
                      match: ['expediente administrativo'] },
                ]
            },
        ];
    }

    // ── Clasificar un delito en su subcategoría ──────────────────────────────
    function clasificarDelito(delito) {
        if (!delito) return null;
        const dl = delito.toLowerCase().trim();
        const cats = getCategorias();
        for (const cat of cats) {
            for (const sub of cat.subs) {
                const matches = sub.match.some(m => dl.includes(m.toLowerCase()));
                if (!matches) continue;
                // Verificar exclusiones
                if (sub.exclude && sub.exclude.some(e => dl.includes(e.toLowerCase()))) continue;
                return { catKey: cat.key, subKey: sub.key };
            }
        }
        // Sin clasificar → otras penales
        return { catKey: 'otras', subKey: 'otr_penales' };
    }

    // ── Estado del módulo ────────────────────────────────────────────────────
    let _rawData       = [];
    let _años          = [];
    let _añoSel        = null;
    let _mesSel        = null;

    // ============================================================
    // DETECCIÓN DEL ARCHIVO
    // ============================================================
    function esArchivoPJ(filename) {
        if (!filename) return false;
        const up = filename.toUpperCase();
        return up.includes('01-ATESTADOS_GV_PJ') ||
               up.includes('01_ATESTADOS_GV_PJ') ||
               up.includes('ATESTADOS_GV_PJ');
    }

    // ============================================================
    // PARSEO Y NORMALIZACIÓN
    // ============================================================
    function parsearDatos(data) {
        _rawData = data.map(row => {
            const r = {};
            Object.keys(row).forEach(k => { r[k.toUpperCase()] = row[k]; });

            const fecha = String(r['FECHA'] || '');
            let dia = 0, mes = 0, anyo = 0;
            if (fecha.includes('/')) {
                const p = fecha.split('/');
                dia  = parseInt(p[0]) || 0;
                mes  = parseInt(p[1]) || 0;
                anyo = parseInt(p[2]) || 0;
            }
            // Extraer año de REFERENCIA_ATS como fallback (ATS2022-107)
            if (!anyo) {
                const refMatch = String(r['REFERENCIA_ATS'] || '').match(/ATS(\d{4})/);
                if (refMatch) anyo = parseInt(refMatch[1]);
            }

            return {
                ref:    String(r['REFERENCIA_ATS'] || ''),
                fecha, dia, mes, anyo,
                delito: String(r['DELITOS'] || '').trim(),
                nroInf: parseFloat(r['NRO_INFRACCIONES'])   || 0,
                detV:   parseFloat(r['DETENCIONES_VARON'])  || 0,
                detM:   parseFloat(r['DETENCIONES_MUJER'])  || 0,
                invV:   parseFloat(r['INVESTIGACIONES_VARON']) || 0,
                invM:   parseFloat(r['INVESTIGACIONES_MUJER']) || 0,
            };
        }).filter(r => r.anyo > 0);

        _años = [...new Set(_rawData.map(r => r.anyo))].sort((a, b) => b - a);
        const hoy       = new Date();
        const añoActual = hoy.getFullYear();
        _añoSel = _años.find(a => a <= añoActual) || _años[0] || añoActual;

        const mesesConDatos = [...new Set(
            _rawData.filter(r => r.anyo === _añoSel).map(r => r.mes)
        )].filter(Boolean).sort((a, b) => b - a);
        const mesActual = hoy.getMonth() + 1;
        // Si el mes actual tiene datos → usarlo. Si no → TODOS (0)
        _mesSel = mesesConDatos.includes(mesActual) ? mesActual : 0;
    }

    // ============================================================
    // CÁLCULO DE ESTADÍSTICAS
    // ============================================================
    function calcular(anyo, mes) {
        // mes=0 → TODOS los meses del año (incluye registros sin fecha mes=0)
        const filas = mes === 0
            ? _rawData.filter(r => r.anyo === anyo)
            : _rawData.filter(r => r.anyo === anyo && r.mes === mes);
        const cats  = getCategorias();

        // Inicializar estructura de resultados
        const resultado = {};
        cats.forEach(cat => {
            resultado[cat.key] = { label: cat.label, subs: {} };
            cat.subs.forEach(sub => {
                resultado[cat.key].subs[sub.key] = {
                    label: sub.label,
                    nroInf: 0, detV: 0, detM: 0, invV: 0, invM: 0
                };
            });
        });

        // Acumular datos
        filas.forEach(r => {
            const cl = clasificarDelito(r.delito);
            if (!cl) return;
            const catData = resultado[cl.catKey];
            if (!catData) return;
            const subData = catData.subs[cl.subKey];
            if (!subData) return;
            subData.nroInf += r.nroInf;
            subData.detV   += r.detV;
            subData.detM   += r.detM;
            subData.invV   += r.invV;
            subData.invM   += r.invM;
        });

        // Calcular totales por categoría
        cats.forEach(cat => {
            const catData = resultado[cat.key];
            catData.nroInf = 0; catData.detV = 0; catData.detM = 0;
            catData.invV   = 0; catData.invM  = 0;
            Object.values(catData.subs).forEach(s => {
                catData.nroInf += s.nroInf;
                catData.detV   += s.detV;
                catData.detM   += s.detM;
                catData.invV   += s.invV;
                catData.invM   += s.invM;
            });
        });

        // Total general
        const totales = { nroInf:0, detV:0, detM:0, invV:0, invM:0 };
        cats.forEach(cat => {
            const c = resultado[cat.key];
            totales.nroInf += c.nroInf; totales.detV += c.detV;
            totales.detM   += c.detM;   totales.invV += c.invV;
            totales.invM   += c.invM;
        });

        // Mapa de subcategorías que tienen datos en el dataset COMPLETO (no solo el periodo)
        // Sirve para ocultar filas que nunca tendrán datos en este archivo
        const subHasData = {};
        _rawData.forEach(r => {
            const cl = clasificarDelito(r.delito);
            if (!cl) return;
            const key = cl.catKey + '_' + cl.subKey;
            if (r.nroInf > 0 || r.detV > 0 || r.detM > 0 || r.invV > 0 || r.invM > 0) {
                subHasData[key] = true;
            }
            // También marcar si simplemente aparece en el dataset (nroInf puede ser 0 pero existe)
            if (!subHasData[key]) subHasData[key] = false; // inicializar sin sobreescribir true
        });

        // Filtrar categorías ocultas del resultado visible
        const visibleCats = cats.filter(c => !c.hidden);
        return { resultado, cats: visibleCats, totales, nFilas: filas.length, subHasData };
    }

    // ============================================================
    // EXPORTAR A PDF
    // ============================================================
    function exportarPdf(añoSel, mesSel) {
        const lang      = typeof currentLang !== 'undefined' ? currentLang : 'es';
        const meses     = MESES[lang] || MESES.es;
        const stats     = calcular(añoSel, mesSel);
        const nombreMes = mesSel === 0 ? (t('todos_meses') || 'TODOS') : (meses[mesSel - 1] || mesSel);
        const fecha     = new Date().toLocaleDateString('es-ES',
            { day: '2-digit', month: '2-digit', year: 'numeric' });

        const { jsPDF } = window.jspdf;
        const isLandscape = true;
        const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const mL = 12, mR = 12, contW = pageW - mL - mR;

        // Anchos de columna (landscape A4 = 297mm, contW ≈ 273)
        const CW = { label: 90, nro: 25, detV: 20, detM: 20, invV: 20, invM: 20 };
        const totalCW = CW.label + CW.nro + CW.detV + CW.detM + CW.invV + CW.invM;

        // Cabecera
        doc.setFillColor(94, 114, 228);
        doc.rect(0, 0, pageW, 22, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(13); doc.setFont('helvetica', 'bold');
        doc.text('EUROCOP ANALYTICS', mL, 10);
        doc.setFontSize(8); doc.setFont('helvetica', 'normal');
        doc.text(t('actualizar'), mL, 16);
        doc.text(fecha, pageW - mR, 10, { align: 'right' });
        doc.text(`${nombreMes} ${añoSel}`, pageW - mR, 16, { align: 'right' });

        let y = 28;

        function drawTableHeader(yp) {
            // Fila 1: grupos
            doc.setFillColor(94, 114, 228);
            doc.rect(mL, yp, totalCW, 5.5, 'F');
            doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
            doc.setTextColor(255, 255, 255);
            let x = mL + CW.label + CW.nro;
            doc.text(t('detenciones'), x + CW.detV - 1, yp + 3.8, { align: 'center' });
            x += CW.detV + CW.detM;
            doc.text(t('investigaciones'), x + CW.invV - 1, yp + 3.8, { align: 'center' });
            yp += 5.5;
            // Fila 2: subcolumnas
            doc.setFillColor(61, 77, 183);
            doc.rect(mL, yp, totalCW, 5, 'F');
            doc.setFont('helvetica', 'bold'); doc.setFontSize(6);
            doc.setTextColor(255, 255, 255);
            x = mL;
            doc.text(t('delitos'), x + 2, yp + 3.5); x += CW.label;
            doc.text(t('nro_inf'), x + CW.nro - 1, yp + 3.5, { align: 'right' }); x += CW.nro;
            doc.text(t('varon'),   x + CW.detV/2, yp + 3.5, { align: 'center' }); x += CW.detV;
            doc.text(t('mujer'),   x + CW.detM/2, yp + 3.5, { align: 'center' }); x += CW.detM;
            doc.text(t('varon'),   x + CW.invV/2, yp + 3.5, { align: 'center' }); x += CW.invV;
            doc.text(t('mujer'),   x + CW.invM/2, yp + 3.5, { align: 'center' });
            return yp + 5;
        }

        function newPage() {
            doc.addPage();
            doc.setFillColor(94, 114, 228);
            doc.rect(0, 0, pageW, 10, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
            doc.text(`EUROCOP ANALYTICS · ${t('actualizar')} (cont.) · ${nombreMes} ${añoSel}`, mL, 7);
            y = drawTableHeader(13);
        }

        y = drawTableHeader(y);

        function numCell(v, x, w, yp, isHi) {
            if (isHi) { doc.setTextColor(180, 80, 0); doc.setFont('helvetica', 'bold'); }
            else       { doc.setTextColor(94, 114, 228); doc.setFont('helvetica', 'normal'); }
            doc.text(String(v), x + w - 1.5, yp + 4, { align: 'right' });
        }

        // Dibujar filas
        stats.cats.forEach(cat => {
            const catData = stats.resultado[cat.key] || { nroInf:0,detV:0,detM:0,invV:0,invM:0, subs:{} };
            const rowH = 5.5;

            if (y + rowH > pageH - 14) newPage();

            // Fila de categoría — solo título, sin valores numéricos
            const catHasData = catData.nroInf+catData.detV+catData.detM+catData.invV+catData.invM > 0;
            doc.setFillColor(catHasData ? 255 : 224, catHasData ? 243 : 228, catHasData ? 205 : 252);
            doc.rect(mL, y, totalCW, rowH, 'F');
            doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8);
            doc.setTextColor(catHasData ? 133 : 61, catHasData ? 100 : 77, catHasData ? 4 : 183);
            doc.text(cat.label.toUpperCase(), mL + 2, y + 3.8);
            doc.setDrawColor(200, 205, 230);
            doc.line(mL, y + rowH, mL + totalCW, y + rowH);
            y += rowH;

            // Subcategorías
            cat.subs.forEach(sub => {
                const s = catData.subs[sub.key] || { label: sub.label, nroInf:0,detV:0,detM:0,invV:0,invM:0 };
                const rH = 5;
                if (y + rH > pageH - 14) newPage();

                if (cat.subs.indexOf(sub) % 2 === 0) {
                    doc.setFillColor(248, 249, 255);
                    doc.rect(mL, y, totalCW, rH, 'F');
                }
                doc.setDrawColor(235, 237, 250);
                doc.line(mL, y + rH, mL + totalCW, y + rH);
                doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2);
                doc.setTextColor(80, 90, 120);
                // Sangría para subcategoría
                const lbl = s.label.length > 48 ? s.label.substring(0, 46) + '..' : s.label;
                doc.text(lbl, mL + 5, y + 3.5);
                let xSub = mL + CW.label;
                [s.nroInf, s.detV, s.detM, s.invV, s.invM].forEach((v, i) => {
                    const w = [CW.nro, CW.detV, CW.detM, CW.invV, CW.invM][i];
                    numCell(v, xSub, w, y, v > 0);
                    xSub += w;
                });
                y += rH;
            });
        });

        // Fila TOTAL
        if (y + 6 > pageH - 14) newPage();
        doc.setFillColor(61, 77, 183);
        doc.rect(mL, y, totalCW, 6, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text('TOTAL', mL + 2, y + 4.2);
        let x = mL + CW.label;
        [stats.totales.nroInf, stats.totales.detV, stats.totales.detM,
         stats.totales.invV, stats.totales.invM].forEach((v, i) => {
            const w = [CW.nro, CW.detV, CW.detM, CW.invV, CW.invM][i];
            doc.text(String(v), x + w - 1.5, y + 4.2, { align: 'right' });
            x += w;
        });
        y += 8;

        // Notas
        if (y + 16 > pageH - 8) { doc.addPage(); y = 14; }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(80, 90, 120);
        doc.text(t('notas') + ':', mL, y); y += 4;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
        const nota1Lines = doc.splitTextToSize('(1) ' + t('nota1'), contW - 5);
        const nota2Lines = doc.splitTextToSize('(2) ' + t('nota2'), contW - 5);
        [...nota1Lines, ...nota2Lines].forEach(line => {
            doc.text(line, mL + 2, y); y += 3.5;
        });

        // Footer
        const totalPags = doc.getNumberOfPages();
        for (let p = 1; p <= totalPags; p++) {
            doc.setPage(p);
            doc.setFillColor(240, 242, 255);
            doc.rect(0, pageH - 8, pageW, 8, 'F');
            doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(130, 130, 160);
            doc.text('Generado por Eurocop Analytics · zzenkiu.com', mL, pageH - 2.5);
            doc.text(`Pág. ${p} / ${totalPags}`, pageW - mR, pageH - 2.5, { align: 'right' });
        }

        doc.save(`PJ_${añoSel}_${String(mesSel).padStart(2, '0')}.pdf`);
    }

    // ============================================================
    // EXPORTAR A DOCX
    // ============================================================
    function exportarDocx(añoSel, mesSel) {
        const lang      = typeof currentLang !== 'undefined' ? currentLang : 'es';
        const meses     = MESES[lang] || MESES.es;
        const stats     = calcular(añoSel, mesSel);
        const nombreMes = mesSel === 0 ? (t('todos_meses') || 'TODOS') : (meses[mesSel - 1] || mesSel);
        const fecha     = new Date().toLocaleDateString('es-ES',
            { day: '2-digit', month: '2-digit', year: 'numeric' });

        function esc(s) {
            return String(s || '')
                .replace(/&/g,'&amp;').replace(/</g,'&lt;')
                .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        }
        function cell(text, w, fill='FFFFFF', bold=false, align='left', color='32325D') {
            return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>
              <w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>
              <w:tcMar><w:left w:w="60" w:type="dxa"/><w:right w:w="60" w:type="dxa"/></w:tcMar>
            </w:tcPr>
            <w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:before="40" w:after="40"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="15"/>
                ${bold ? '<w:b/>' : ''}<w:color w:val="${color}"/>
              </w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>
            </w:p></w:tc>`;
        }

        // Columnas DOCX (landscape A4 total ≈ 14400 DXA)
        const lW = 4200, nW = 1100, dV = 900, dM = 900, iV = 900, iM = 900;
        const totalW = lW + nW + dV + dM + iV + iM;
        const gridCols = `<w:gridCol w:w="${lW}"/>
            <w:gridCol w:w="${nW}"/>
            <w:gridCol w:w="${dV}"/>
            <w:gridCol w:w="${dM}"/>
            <w:gridCol w:w="${iV}"/>
            <w:gridCol w:w="${iM}"/>`;

        function hCell(text, w, span=1) {
            return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>
              ${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''}
              <w:shd w:val="clear" w:color="auto" w:fill="5E72E4"/>
            </w:tcPr>
            <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="40" w:after="40"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
                <w:sz w:val="15"/><w:b/><w:color w:val="FFFFFF"/>
              </w:rPr><w:t>${esc(text)}</w:t></w:r>
            </w:p></w:tc>`;
        }

        // Cabecera de tabla
        const tableHeader = `
        <w:tr>
          ${hCell(t('delitos'), lW + nW, 2)}
          ${hCell(t('detenciones'), dV + dM, 2)}
          ${hCell(t('investigaciones'), iV + iM, 2)}
        </w:tr>
        <w:tr>
          ${hCell(t('delitos'), lW)}
          ${hCell(t('nro_inf'), nW)}
          ${hCell(t('varon'), dV)}${hCell(t('mujer'), dM)}
          ${hCell(t('varon'), iV)}${hCell(t('mujer'), iM)}
        </w:tr>`;

        // Filas de datos
        let dataRows = '';
        stats.cats.forEach(cat => {
            const catData = stats.resultado[cat.key] || { nroInf:0,detV:0,detM:0,invV:0,invM:0, subs:{} };
            // Fila de categoría — solo título (colspan 6)
            const catHasDataD = catData.nroInf+catData.detV+catData.detM+catData.invV+catData.invM > 0;
            const catFill = catHasDataD ? 'FFF3CD' : 'E0E4FF';
            const catColor = catHasDataD ? '856404' : '3D4DB7';
            dataRows += `<w:tr>
              <w:tc><w:tcPr><w:tcW w:w="${lW+nW+dV+dM+iV+iM}" w:type="dxa"/>
                <w:gridSpan w:val="6"/>
                <w:shd w:val="clear" w:color="auto" w:fill="${catFill}"/>
                <w:tcMar><w:left w:w="120" w:type="dxa"/></w:tcMar>
              </w:tcPr>
              <w:p><w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr>
                <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="16"/><w:b/>
                  <w:color w:val="${catColor}"/>
                </w:rPr><w:t>${esc(cat.label.toUpperCase())}</w:t></w:r>
              </w:p></w:tc>
            </w:tr>`;
            // Subcategorías
            cat.subs.forEach((sub, si) => {
                const s = catData.subs[sub.key] || {nroInf:0,detV:0,detM:0,invV:0,invM:0};
                const bg = si % 2 === 0 ? 'F0F2FF' : 'FFFFFF';
                const hi = (v) => v > 0;
                dataRows += `<w:tr>
                  ${cell('  ' + (s.label || sub.label), lW, bg, false, 'left', '525F7F')}
                  ${cell(String(s.nroInf), nW, bg, hi(s.nroInf), 'right', hi(s.nroInf)?'856404':'5E72E4')}
                  ${cell(String(s.detV),   dV, bg, hi(s.detV),   'right', hi(s.detV)?'856404':'5E72E4')}
                  ${cell(String(s.detM),   dM, bg, hi(s.detM),   'right', hi(s.detM)?'856404':'5E72E4')}
                  ${cell(String(s.invV),   iV, bg, hi(s.invV),   'right', hi(s.invV)?'856404':'5E72E4')}
                  ${cell(String(s.invM),   iM, bg, hi(s.invM),   'right', hi(s.invM)?'856404':'5E72E4')}
                </w:tr>`;
            });
        });

        // Fila total
        const tot = stats.totales;
        dataRows += `<w:tr>
          ${cell('TOTAL', lW, '3D4DB7', true, 'left', 'FFFFFF')}
          ${cell(String(tot.nroInf), nW, '3D4DB7', true, 'right', 'FFFFFF')}
          ${cell(String(tot.detV),   dV, '3D4DB7', true, 'right', 'FFFFFF')}
          ${cell(String(tot.detM),   dM, '3D4DB7', true, 'right', 'FFFFFF')}
          ${cell(String(tot.invV),   iV, '3D4DB7', true, 'right', 'FFFFFF')}
          ${cell(String(tot.invM),   iM, '3D4DB7', true, 'right', 'FFFFFF')}
        </w:tr>`;

        const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
  <w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="5E72E4"/></w:pBdr>
    <w:spacing w:before="0" w:after="100"/></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="30"/><w:b/><w:color w:val="5E72E4"/></w:rPr>
      <w:t>EUROCOP ANALYTICS</w:t></w:r>
  </w:p>
  <w:p><w:pPr><w:spacing w:before="0" w:after="60"/></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="19"/><w:color w:val="525F7F"/></w:rPr>
      <w:t>${esc(t('actualizar'))}</w:t></w:r>
  </w:p>
  <w:p><w:pPr><w:spacing w:before="0" w:after="200"/></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="17"/><w:color w:val="8898AA"/></w:rPr>
      <w:t xml:space="preserve">${esc(nombreMes)} ${añoSel}   ·   Fecha: ${fecha}</w:t></w:r>
  </w:p>
  <w:tbl>
    <w:tblPr><w:tblW w:w="${totalW}" w:type="dxa"/>
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
    ${tableHeader}
    ${dataRows}
  </w:tbl>
  <w:p><w:pPr><w:spacing w:before="200" w:after="60"/></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="16"/><w:b/><w:color w:val="525F7F"/></w:rPr>
      <w:t>${esc(t('notas'))}:</w:t></w:r>
  </w:p>
  <w:p><w:pPr><w:spacing w:before="0" w:after="40"/></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="15"/><w:color w:val="8898AA"/></w:rPr>
      <w:t xml:space="preserve">(1) ${esc(t('nota1'))}</w:t></w:r>
  </w:p>
  <w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="15"/><w:color w:val="8898AA"/></w:rPr>
      <w:t xml:space="preserve">(2) ${esc(t('nota2'))}</w:t></w:r>
  </w:p>
  <w:p><w:pPr><w:spacing w:before="200" w:after="0"/></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="15"/><w:color w:val="AAAACC"/></w:rPr>
      <w:t>Generado por Eurocop Analytics · zzenkiu.com</w:t></w:r>
  </w:p>
  <w:sectPr>
    <w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>
    <w:pgMar w:top="800" w:right="800" w:bottom="800" w:left="800"/>
  </w:sectPr>
</w:body>
</w:document>`;

        if (typeof _buildAndDownloadDocx === 'function') {
            _buildAndDownloadDocx(docXml, `PJ_${añoSel}_${String(mesSel).padStart(2,'0')}.docx`);
        } else {
            if (typeof showToast === 'function') showToast('Función DOCX no disponible.');
        }
    }

    // ── Datos individuales por atestado (para el modal) ────────────────────────
    function getAtestadosDelMes(anyo, mes) {
        return _rawData
            .filter(r => r.anyo === anyo && (mes === 0 || r.mes === mes) && r.delito)
            .sort((a, b) => {
                // Ordenar por referencia ATS (numérico)
                const numA = parseInt(a.ref.replace(/\D/g, '')) || 0;
                const numB = parseInt(b.ref.replace(/\D/g, '')) || 0;
                return numA - numB;
            });
    }

    // ============================================================
    // VALIDACIÓN DE DATOS AL CARGAR
    // Detecta atestados erróneos:
    //   1. Sin fecha (vacía o "Sin Fecha")
    //   2. NRO_INFRACCIONES = 0 en todas las filas del atestado
    // ============================================================
    function validarDatos() {
        // Agrupar por referencia (ya viene como ATS2026-5)
        const byRef = {};
        _rawData.forEach(r => {
            if (!byRef[r.ref]) {
                byRef[r.ref] = {
                    ref    : r.ref,
                    fecha  : r.fecha,
                    filas  : []
                };
            }
            byRef[r.ref].filas.push(r);
        });

        const errores = [];
        Object.values(byRef).forEach(at => {
            const sinFecha = !at.fecha ||
                at.fecha.trim() === '' ||
                at.fecha.trim().toLowerCase() === 'sin fecha' ||
                at.fecha.trim() === '0' ||
                at.fecha.includes('1900');

            // PJ: solo se considera error la falta de fecha
            if (!sinFecha) return;

            const delito = at.filas.map(f => f.delito).find(d => d && d.trim()) || '—';
            errores.push({
                ref   : at.ref,
                fecha : at.fecha || '—',
                delito,
                causas: ['sin_fecha'],
                filas : at.filas
            });
        });

        // Ordenar: sin fecha primero, luego por referencia descendente
        // Extraer año y número de la referencia ATS2025-98 → {anyo:2025, num:98}
        const parseRef = (ref) => {
            const m = String(ref).match(/ATS(\d{4})-(\d+)/i);
            return m ? { anyo: parseInt(m[1]), num: parseInt(m[2]) } : { anyo: 0, num: 0 };
        };
        errores.sort((a, b) => {
            const ra = parseRef(a.ref), rb = parseRef(b.ref);
            if (rb.anyo !== ra.anyo) return rb.anyo - ra.anyo; // año descendente
            return rb.num - ra.num;                             // número descendente
        });

        return errores;
    }

    // ── API pública ──────────────────────────────────────────────────────────
    return {
        esArchivoPJ,
        parsearDatos,
        validarDatos,
        getAños    : ()     => _años,
        getAñoSel  : ()     => _añoSel,
        getMesSel  : ()     => _mesSel,
        setAñoSel  : (v)    => { _añoSel = parseInt(v); },
        setMesSel  : (v)    => { _mesSel = parseInt(v); },
        getMeses   : (lang) => MESES[lang] || MESES.es,
        calcular,
        getAtestadosDelMes,
        t,
        exportarPdf,
        exportarDocx,
    };

})();
