/**
 * EUROCOP ANALYTICS — FncAtestadosPJ.js
 * ─────────────────────────────────────────────────────────────
 * Coordinación de UI para el módulo de Estadística PJ.
 * Delega toda la lógica de negocio en FncEstadisticaGVpj.js.
 */

const FncAtestadosPJ = (() => {

    const E = FncEstadisticaGVpj;
    let _municipio = '---';

    // ============================================================
    // RENDER PRINCIPAL
    // ============================================================
    function render() {
        const lang     = typeof currentLang !== 'undefined' ? currentLang : 'es';
        const meses    = E.getMeses(lang);
        const añoSel   = E.getAñoSel();
        const mesSel   = E.getMesSel();
        const años     = E.getAños();
        const stats    = E.calcular(añoSel, mesSel);
        const t        = E.t.bind(E);

        const optsAño = años.map(a =>
            `<option value="${a}" ${a === añoSel ? 'selected' : ''}>${a}</option>`
        ).join('');
        const optsMes = meses.map((m, i) =>
            `<option value="${i+1}" ${(i+1) === mesSel ? 'selected' : ''}>${m}</option>`
        ).join('');

        // Función de celda numérica con resaltado
        function hlTd(v, cls='') {
            const hi = v > 0 ? ' pj-hi' : '';
            return `<td class="pj-num${cls}${hi}">${v}</td>`;
        }

        // Construir filas de la tabla
        let tableRows = '';
        stats.cats.forEach(cat => {
            const catData = stats.resultado[cat.key];
            // Fila de categoría
            const catHasData = (catData.nroInf+catData.detV+catData.detM+catData.invV+catData.invM) > 0;
            tableRows += `
            <tr class="pj-cat-row">
                <td class="pj-cat-label${catHasData?' pj-label-hi':''}" colspan="6">${cat.label}</td>
            </tr>`;
            // Subcategorías — mostrar siempre todas
            cat.subs.forEach(sub => {
                const s = catData.subs[sub.key] || {nroInf:0,detV:0,detM:0,invV:0,invM:0};
                tableRows += `
            <tr class="pj-sub-row">
                <td class="pj-sub-label${(s.nroInf+s.detV+s.detM+s.invV+s.invM)>0?' pj-label-hi':''}">${s.label}</td>
                ${hlTd(s.nroInf)}${hlTd(s.detV)}${hlTd(s.detM)}${hlTd(s.invV)}${hlTd(s.invM)}
            </tr>`;
            });
        });

        // Fila total
        const tot = stats.totales;
        tableRows += `
            <tr class="pj-total-row">
                <td class="pj-total-label">${t('total')}</td>
                ${hlTd(tot.nroInf,' pj-grand')}
                ${hlTd(tot.detV,  ' pj-grand')}
                ${hlTd(tot.detM,  ' pj-grand')}
                ${hlTd(tot.invV,  ' pj-grand')}
                ${hlTd(tot.invM,  ' pj-grand')}
            </tr>`;

        const html = `
<div class="pj-wrapper">
    <div class="pj-breadcrumb">
        <span class="pj-bc-home"><i class="fa-solid fa-house"></i> ${t('inicio')}</span>
        <span class="pj-bc-sep">›</span>
        <span class="pj-bc-active">${t('actualizar')}</span>
    </div>

    <h2 class="pj-main-title">${t('actualizar')}</h2>

    <!-- Filtros centrados -->
    <div class="pj-filterbar">
        <div class="pj-filter-item">
            <label>
                ${t('municipio')}
                <a href="./ArchivosPdf/ATESTADOS_PJ_GOBIERNO_VASCO_REQUISITOS.pdf"
                   target="_blank" class="at-help-link" title="Ver requisitos PJ">
                    <i class="fa-solid fa-circle-question"></i>
                </a>
            </label>
            <input class="pj-input" value="${_municipio}" readonly style="width:80px;">
        </div>
        <div class="pj-filter-item">
            <label>${t('introducir_anyo')}</label>
            <select class="pj-select" onchange="FncAtestadosPJ._onAñoChange(this.value); FncAtestadosPJ._onMostrar();">
                ${optsAño}
            </select>
        </div>
        <div class="pj-filter-item">
            <label>${t('selecciona_mes')}</label>
            <select class="pj-select" onchange="FncAtestadosPJ._onMesChange(this.value); FncAtestadosPJ._onMostrar();">
                ${optsMes}
            </select>
        </div>
        <div class="pj-filter-item" style="flex-direction:row;gap:6px;align-items:center;border-left:1px solid #e2e8f0;padding-left:10px;margin-left:4px;">
            <button class="pj-btn-pdf"  onclick="FncAtestadosPJ.exportarPdf()"  title="${t('exportar_pdf')}">
                <i class="fa-solid fa-file-pdf"></i>
            </button>
            <button class="pj-btn-docx" onclick="FncAtestadosPJ.exportarDocx()" title="${t('exportar_docx')}">
                <i class="fa-solid fa-file-word"></i>
            </button>
            <button class="pj-btn-print" onclick="FncAtestadosPJ.imprimirVista()" title="${t('imprimir')}">
                <i class="fa-solid fa-print"></i>
            </button>
        </div>
    </div>


    <!-- Tabla principal -->
    <div class="pj-section">
        <!-- Cabecera de sección -->
        <div class="pj-section-header">
            <span>${t('delitos')}</span>
            <button class="pj-btn-ver-ats" onclick="FncAtestadosPJ.verAtestados()">
                <i class="fa-solid fa-list-ul"></i> ${t('ver_atestados')}
            </button>
        </div>
        <!-- Buscador de delitos -->
        <div class="pj-search-bar">
            <i class="fa-solid fa-magnifying-glass pj-search-icon"></i>
            <input type="text" id="pj-search-input" class="pj-search-input"
                placeholder="${t('buscar_delito') || 'Buscar delito...'}"
                oninput="FncAtestadosPJ._onSearchInput(this.value)">
            <button class="pj-search-clear" id="pj-search-clear"
                onclick="FncAtestadosPJ._onSearchClear()" style="display:none;" title="Limpiar">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        <!-- Cabecera de tabla fija (no entra en el scroll) -->
        <div class="pj-table-head">
            <table>
                <colgroup>
                    <col style="width:42%">
                    <col style="width:13%">
                    <col style="width:11%"><col style="width:11%">
                    <col style="width:11%"><col style="width:11%">
                </colgroup>
                <thead>
                    <tr>
                        <th class="pj-th-delitos">${t('delitos')}</th>
                        <th>${t('nro_inf')}</th>
                        <th colspan="2">${t('detenciones')}</th>
                        <th colspan="2">${t('investigaciones')}</th>
                    </tr>
                    <tr>
                        <th></th><th></th>
                        <th>${t('varon')}</th><th>${t('mujer')}</th>
                        <th>${t('varon')}</th><th>${t('mujer')}</th>
                    </tr>
                </thead>
            </table>
        </div>
        <!-- Cuerpo con scroll vertical -->
        <div class="pj-table-scroll">
            <table class="pj-table">
                <colgroup>
                    <col style="width:42%">
                    <col style="width:13%">
                    <col style="width:11%"><col style="width:11%">
                    <col style="width:11%"><col style="width:11%">
                </colgroup>
                <!-- thead oculto en pantalla, visible solo en impresión -->
                <thead style="display:none;">
                    <tr>
                        <th class="pj-th-delitos">${t('delitos')}</th>
                        <th>${t('nro_inf')}</th>
                        <th colspan="2">${t('detenciones')}</th>
                        <th colspan="2">${t('investigaciones')}</th>
                    </tr>
                    <tr>
                        <th></th><th></th>
                        <th>${t('varon')}</th><th>${t('mujer')}</th>
                        <th>${t('varon')}</th><th>${t('mujer')}</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
        </div>
    </div>

    <!-- Notas -->
    <div class="pj-notas">
        <p><strong>${t('notas')}:</strong></p>
        <ul>
            <li>(1) ${t('nota1')}</li>
            <li>(2) ${t('nota2')}</li>
        </ul>
    </div>

    <!-- Cabecera solo para impresión -->
    <div class="pj-print-header">
        <div>
            <div class="pj-print-title">EUROCOP ANALYTICS</div>
            <div class="pj-print-sub">${t('actualizar')}</div>
        </div>
        <div class="pj-print-date">
            ${meses[mesSel-1] || mesSel} ${añoSel} · ${new Date().toLocaleDateString('es-ES')}
        </div>
    </div>


</div>`;

        const view = document.getElementById('atestados-view');
        if (view) { view.innerHTML = html; view.classList.add('active'); }
    }

    // ============================================================
    // CICLO DE VIDA
    // ============================================================
    function init(data, filename) {
        if (!E.esArchivoPJ(filename)) return false;
        E.parsearDatos(data);
        ['upload-view','mapping-view','dashboard-view'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('active');
        });
        const loader = document.getElementById('loading-overlay');
        if (loader) loader.classList.remove('active');
        document.body.classList.add('pj-active');
        render();
        return true;
    }

    function salir() {
        document.body.classList.remove('pj-active');
        const view = document.getElementById('atestados-view');
        if (view) view.classList.remove('active');
        location.reload();
    }

    // ============================================================
    // MODAL — VER ATESTADOS INDIVIDUALES
    // ============================================================
    function verAtestados() {
        const lang       = typeof currentLang !== 'undefined' ? currentLang : 'es';
        const meses      = E.getMeses(lang);
        const añoSel     = E.getAñoSel();
        const mesSel     = E.getMesSel();
        const nombreMes  = meses[mesSel - 1] || mesSel;
        const t          = E.t.bind(E);
        const atestados  = E.getAtestadosDelMes(añoSel, mesSel);

        if (atestados.length === 0) {
            if (typeof showToast === 'function') showToast(t('sin_datos'));
            return;
        }

        // Función resaltado
        function num(v) {
            const hi = v > 0 ? ' class="atd-hi"' : '';
            return `<td${hi}>${v}</td>`;
        }

        // Agrupar filas por referencia de atestado
        const byRef = {};
        atestados.forEach(r => {
            if (!byRef[r.ref]) byRef[r.ref] = { ref: r.ref, fecha: r.fecha, filas: [] };
            byRef[r.ref].filas.push(r);
        });

        const cards = Object.values(byRef).map(at => {
            // Totales del atestado
            let totNro=0, totDV=0, totDM=0, totIV=0, totIM=0;
            at.filas.forEach(r => {
                totNro += r.nroInf; totDV += r.detV; totDM += r.detM;
                totIV  += r.invV;   totIM  += r.invM;
            });
            const tieneDetenidos    = totDV + totDM > 0;
            const tieneInvestigados = totIV + totIM > 0;
            let badge = '';
            if (tieneDetenidos && tieneInvestigados) {
                badge = `<span class="atd-badge atd-badge-cv">${t('badge_det') || 'Detenidos'}</span>
                         <span class="atd-badge atd-badge-inv">${t('badge_inv') || 'Investigados'}</span>`;
            } else if (tieneDetenidos) {
                badge = `<span class="atd-badge atd-badge-cv">${t('badge_det') || 'Detenidos'}</span>`;
            } else if (tieneInvestigados) {
                badge = `<span class="atd-badge atd-badge-inv">${t('badge_inv') || 'Investigados'}</span>`;
            }

            const filaRows = at.filas.map(r => `
                <tr>
                    <td class="atd-estado">${r.delito || '---'}</td>
                    ${num(r.nroInf)}${num(r.detV)}${num(r.detM)}${num(r.invV)}${num(r.invM)}
                </tr>`).join('');

            return `
            <div class="atd-card">
                <div class="atd-card-header">
                    <div class="atd-card-title">
                        <i class="fa-solid fa-file-alt"></i>
                        <strong>${at.ref}</strong>
                        <span class="atd-fecha">${at.fecha}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        ${badge}
                        ${totNro > 0 ? `<span class="atd-total-badge">${totNro} inf.</span>` : ''}
                    ${totDV+totDM > 0 ? `<span class="atd-total-badge" style="background:#ffe0e6;color:#c0002a;">${totDV+totDM} det.</span>` : ''}
                    ${totIV+totIM > 0 ? `<span class="atd-total-badge" style="background:#efe0ff;color:#6a00c0;">${totIV+totIM} inv.</span>` : ''}
                    </div>
                </div>
                <div class="atd-table-wrap">
                <table class="atd-table">
                    <thead>
                        <tr>
                            <th style="text-align:left;">${t('delitos')}</th>
                            <th>${t('nro_inf')}</th>
                            <th>${t('varon')}</th><th>${t('mujer')}</th>
                            <th>${t('varon')}</th><th>${t('mujer')}</th>
                        </tr>
                        <tr style="background:#4a5cc7;">
                            <th style="text-align:left;background:#4a5cc7;"></th>
                            <th style="background:#4a5cc7;"></th>
                            <th colspan="2" style="background:#5e72e4;font-size:0.65rem;">${t('detenciones')}</th>
                            <th colspan="2" style="background:#5e72e4;font-size:0.65rem;">${t('investigaciones')}</th>
                        </tr>
                    </thead>
                    <tbody>${filaRows}</tbody>
                    <tfoot>
                        <tr class="atd-tfoot">
                            <td style="text-align:left;">TOTAL</td>
                            ${num(totNro)}${num(totDV)}${num(totDM)}${num(totIV)}${num(totIM)}
                        </tr>
                    </tfoot>
                </table>
                </div>
            </div>`;
        }).join('');

        // Totales generales del mes
        let totalDet = 0, totalInv = 0;
        atestados.forEach(r => { totalDet += r.detV + r.detM; totalInv += r.invV + r.invM; });

        const resumen = `
        <div class="atd-resumen">
            <div class="atd-res-item">
                <span>${Object.keys(byRef).length}</span>
                <small>${(t('atestados') || t('atestados') || 'ATESTADOS').toUpperCase()}</small>
            </div>
            <div class="atd-res-item atd-res-cv">
                <span>${totalDet}</span>
                <small>${(t('total_detenidos') || 'DETENIDOS').toUpperCase()}</small>
            </div>
            <div class="atd-res-item atd-res-sv" style="--res-color:#8965e0;">
                <span style="color:#8965e0;">${totalInv}</span>
                <small>${(t('total_investigados') || 'INVESTIGADOS').toUpperCase()}</small>
            </div>
        </div>`;

        // Construir modal
        const modal = document.createElement('div');
        modal.id = 'atd-modal';
        modal.className = 'atd-modal-overlay';
        modal.innerHTML = `
        <div class="atd-modal">
            <div class="atd-modal-header">
                <div class="atd-modal-title">
                    <i class="fa-solid fa-shield-halved"></i>
                    ${t('atestados') || 'Atestados'} · ${nombreMes} ${añoSel}
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                    <button class="atd-btn-print" onclick="FncAtestadosPJ._printAtestados('${nombreMes} ${añoSel}')">
                        <i class="fa-solid fa-print"></i> ${t('imprimir') || 'Imprimir'}
                    </button>
                    <button class="atd-btn-close" onclick="FncAtestadosPJ._closeAtestados()">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
            <div class="atd-modal-body" id="atd-print-area">
                <div class="atd-print-header">
                    <div>
                        <div style="font-size:1.1rem;font-weight:800;color:#5e72e4;">EUROCOP ANALYTICS</div>
                        <div style="font-size:0.85rem;color:#525f7f;">${t('detalle_title') || 'Detalle'} · ${nombreMes} ${añoSel}</div>
                    </div>
                    <div style="font-size:0.78rem;color:#8898aa;">${new Date().toLocaleDateString('es-ES')}</div>
                </div>
                ${resumen}
                ${cards}
            </div>
        </div>`;

        document.body.appendChild(modal);
        modal.addEventListener('click', e => {
            if (e.target === modal) FncAtestadosPJ._closeAtestados();
        });
    }

    function _closeAtestados()  {
        const m = document.getElementById('atd-modal');
        if (m) m.remove();
    }
    function _printAtestados(titulo) {
        const area = document.getElementById('atd-print-area');
        if (!area) { window.print(); return; }

        const w = window.open('', '_blank', 'width=900,height=700');
        w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
        <title>${titulo || 'Atestados'}</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family:Arial,sans-serif; font-size:10px; color:#32325d; padding:14px; background:white; }
            .atd-print-header { display:flex !important; justify-content:space-between; align-items:flex-start;
                padding-bottom:10px; border-bottom:2px solid #5e72e4; margin-bottom:14px; }
            .atd-resumen { display:flex; gap:12px; margin-bottom:14px; }
            .atd-res-item { flex:1; background:#f8f9ff; border-radius:8px; padding:10px;
                text-align:center; border:1px solid #e2e8f0; }
            .atd-res-item span { display:block; font-size:18px; font-weight:900; color:#5e72e4; }
            .atd-res-item small { font-size:7px; color:#8898aa; font-weight:600; text-transform:uppercase; }
            .atd-res-cv span { color:#f5365c; }
            .atd-res-sv span { color:#8965e0; }
            .atd-card { background:white; border:1px solid #e2e8f0; border-radius:8px;
                margin-bottom:10px; overflow:hidden; page-break-inside:avoid; }
            .atd-card-header { display:flex; justify-content:space-between; align-items:center;
                padding:7px 12px; background:#f0f2ff; border-bottom:1px solid #dde0f5; }
            .atd-card-title { display:flex; align-items:center; gap:8px; font-size:10px; color:#32325d; }
            .atd-fecha { font-size:9px; color:#8898aa; }
            .atd-badge { padding:2px 8px; border-radius:20px; font-size:8px; font-weight:700; }
            .atd-badge-cv { background:#ffe0e6; color:#c0002a; }
            .atd-badge-inv { background:#efe0ff; color:#6a00c0; }
            .atd-total-badge { background:#eef0ff; color:#5e72e4; padding:2px 7px;
                border-radius:20px; font-size:8px; font-weight:800; }
            .atd-table { width:100%; border-collapse:collapse; font-size:9px; }
            .atd-table thead th { background:#5e72e4; color:white; padding:4px 8px;
                text-align:center; font-size:8.5px; }
            .atd-table thead tr:nth-child(2) th { background:#4a5cc7; font-size:7.5px; }
            .atd-table thead th:first-child { text-align:left; }
            .atd-estado { text-align:left; padding:3px 8px; color:#32325d; }
            .atd-table td { padding:3px 8px; text-align:center; border-bottom:1px solid #f0f1f8; }
            .atd-hi { background:#fff8e1 !important; color:#b45309 !important; font-weight:900 !important;
                box-shadow:inset 0 0 0 1px #f59e0b; border-radius:3px; }
            .atd-tfoot td { background:#e8ebff; font-weight:800; color:#3d4db7;
                border-top:2px solid #c5caf0; }
            .atd-tfoot td:first-child { text-align:left; }
            @media print { @page { size:A4 portrait; margin:1cm; } }
        </style></head><body>
        ${area.innerHTML}
        <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script>
        </body></html>`);
        w.document.close();
    }

    // ============================================================
    // IMPRIMIR — ventana nueva con tabla completa sin restricciones
    // ============================================================
    function imprimirVista() {
        const lang     = typeof currentLang !== 'undefined' ? currentLang : 'es';
        const meses    = E.getMeses(lang);
        const añoSel   = E.getAñoSel();
        const mesSel   = E.getMesSel();
        const nombreMes = meses[mesSel - 1] || mesSel;
        const stats    = E.calcular(añoSel, mesSel);
        const t        = E.t.bind(E);
        const fecha    = new Date().toLocaleDateString('es-ES');

        function hlTd(v, cls='') {
            const hi = v > 0 ? ' style="background:#fff8e1;color:#b45309;font-weight:900;box-shadow:inset 0 0 0 1.5px #f59e0b;border-radius:3px;"' : '';
            return `<td class="num${cls}"${hi}>${v}</td>`;
        }

        let rows = '';
        stats.cats.forEach(cat => {
            const c = stats.resultado[cat.key];
            const catHasData2 = c.nroInf+c.detV+c.detM+c.invV+c.invM > 0;
            rows += `<tr class="cat${catHasData2?' cat-hi':''}">
                <td colspan="6" style="font-weight:800;padding:5px 10px;
                    background:${catHasData2?'#fff3cd':'#eef0ff'};
                    color:${catHasData2?'#856404':'#3d4db7'};
                    border-top:2px solid ${catHasData2?'#f59e0b':'#c5caf0'};">
                    ${cat.label.toUpperCase()}
                </td>
            </tr>`;
            cat.subs.forEach(sub => {
                const s = c.subs[sub.key] || {nroInf:0,detV:0,detM:0,invV:0,invM:0};
                rows += `<tr class="sub">
                    <td class="sub-label">${s.label}</td>
                    ${hlTd(s.nroInf)}${hlTd(s.detV)}${hlTd(s.detM)}${hlTd(s.invV)}${hlTd(s.invM)}
                </tr>`;
            });
        });
        const tot = stats.totales;
        rows += `<tr class="total">
            <td>TOTAL</td>
            ${hlTd(tot.nroInf,' t')}${hlTd(tot.detV,' t')}${hlTd(tot.detM,' t')}${hlTd(tot.invV,' t')}${hlTd(tot.invM,' t')}
        </tr>`;

        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
        <title>Estadística PJ · ${nombreMes} ${añoSel}</title>
        <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family: Arial, sans-serif; font-size: 10px; color: #32325d; padding: 12px; }
            .header { display:flex; justify-content:space-between; align-items:flex-start;
                border-bottom: 2px solid #5e72e4; padding-bottom: 8px; margin-bottom: 12px; }
            .header-title { font-size:14px; font-weight:800; color:#5e72e4; }
            .header-sub { font-size:10px; color:#525f7f; margin-top:2px; }
            .header-date { font-size:9px; color:#8898aa; text-align:right; }
            table { width:100%; border-collapse:collapse; }
            colgroup col:first-child { width:42%; }
            colgroup col:nth-child(2) { width:13%; }
            colgroup col:nth-child(n+3) { width:11%; }
            thead tr:first-child th { background:#5e72e4; color:white; padding:5px 8px;
                font-size:9px; text-align:center; }
            thead tr:first-child th:first-child { text-align:left; }
            thead tr:nth-child(2) th { background:#4a5cc7; color:white; padding:4px 8px;
                font-size:8.5px; text-align:center; }
            td { padding:3px 8px; border-bottom:1px solid #f0f1f8; }
            tr.cat td { background:#eef0ff; font-weight:800; color:#3d4db7;
                border-top:2px solid #c5caf0; font-size:9px; }
            tr.sub td.sub-label { padding-left:18px; color:#525f7f; font-size:8.5px; }
            tr.total td { background:#3d4db7; color:white; font-weight:900;
                border-top:3px solid #2d3a8c; }
            td.num { text-align:right; font-weight:700; color:#5e72e4; }
            td.num.cat { color:#3d4db7; }
            td.num.t { color:white; }
            .notas { margin-top:10px; font-size:8px; color:#8898aa; }
            .notas ul { margin-left:14px; }
            .footer { margin-top:10px; font-size:8px; color:#aaaacc;
                border-top:1px solid #e2e8f0; padding-top:6px; }
            @media print { @page { size: A4 landscape; margin: 1cm; } }
        </style></head><body>
        <div class="header">
            <div>
                <div class="header-title">EUROCOP ANALYTICS</div>
                <div class="header-sub">${t('actualizar')}</div>
            </div>
            <div class="header-date">${nombreMes} ${añoSel}<br>${fecha}</div>
        </div>
        <table>
            <colgroup>
                <col><col><col><col><col><col>
            </colgroup>
            <thead>
                <tr>
                    <th style="text-align:left;">${t('delitos')}</th>
                    <th>${t('nro_inf')}</th>
                    <th colspan="2">${t('detenciones')}</th>
                    <th colspan="2">${t('investigaciones')}</th>
                </tr>
                <tr>
                    <th></th><th></th>
                    <th>${t('varon')}</th><th>${t('mujer')}</th>
                    <th>${t('varon')}</th><th>${t('mujer')}</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        <div class="notas"><strong>${t('notas')}:</strong>
            <ul><li>(1) ${t('nota1')}</li><li>(2) ${t('nota2')}</li></ul>
        </div>
        <div class="footer">Generado por Eurocop Analytics · zzenkiu.com</div>
        <script>window.onload = function(){ window.print(); window.onafterprint = function(){ window.close(); }; }<\/script>
        </body></html>`;

        const w = window.open('', '_blank', 'width=900,height=700');
        w.document.write(html);
        w.document.close();
    }

    // ── Buscador de delitos ────────────────────────────────────────────────────
    let _searchTerm = '';

    function _onSearchInput(val) {
        _searchTerm = val.trim().toLowerCase();
        const clearBtn = document.getElementById('pj-search-clear');
        if (clearBtn) clearBtn.style.display = _searchTerm ? 'flex' : 'none';
        _applySearch();
    }

    function _onSearchClear() {
        _searchTerm = '';
        const input = document.getElementById('pj-search-input');
        if (input) input.value = '';
        const clearBtn = document.getElementById('pj-search-clear');
        if (clearBtn) clearBtn.style.display = 'none';
        _applySearch();
    }

    function _applySearch() {
        const tbody = document.querySelector('.pj-table tbody');
        if (!tbody) return;
        const rows = tbody.querySelectorAll('tr');
        let lastCatVisible = false;
        let lastCatRow = null;

        rows.forEach(row => {
            if (row.classList.contains('pj-cat-row')) {
                // Categoría: se decide después de ver sus subcategorías
                lastCatRow = row;
                lastCatVisible = false;
                row.style.display = ''; // provisional
            } else if (row.classList.contains('pj-sub-row')) {
                const label = row.querySelector('.pj-sub-label');
                const text  = label ? label.textContent.toLowerCase() : '';
                const match = !_searchTerm || text.includes(_searchTerm);
                row.style.display = match ? '' : 'none';
                if (match) lastCatVisible = true;
            } else if (row.classList.contains('pj-total-row')) {
                row.style.display = '';
            }
        });

        // Segunda pasada: ocultar categorías sin subcategorías visibles
        rows.forEach(row => {
            if (row.classList.contains('pj-cat-row')) {
                // Buscar si alguna sub siguiente está visible
                let hasVisible = false;
                let next = row.nextElementSibling;
                while (next && !next.classList.contains('pj-cat-row') && !next.classList.contains('pj-total-row')) {
                    if (next.classList.contains('pj-sub-row') && next.style.display !== 'none') {
                        hasVisible = true; break;
                    }
                    next = next.nextElementSibling;
                }
                // Si hay búsqueda activa y la categoría también coincide, mostrarla con sus subs
                const catLabel = row.querySelector('.pj-cat-label');
                const catText  = catLabel ? catLabel.textContent.toLowerCase() : '';
                const catMatch = _searchTerm && catText.includes(_searchTerm);
                if (catMatch) {
                    // Mostrar también todas las subs de esta categoría
                    let s = row.nextElementSibling;
                    while (s && !s.classList.contains('pj-cat-row') && !s.classList.contains('pj-total-row')) {
                        if (s.classList.contains('pj-sub-row')) s.style.display = '';
                        s = s.nextElementSibling;
                    }
                    hasVisible = true;
                }
                row.style.display = (!_searchTerm || hasVisible) ? '' : 'none';
            }
        });
    }

    function _onAñoChange(val)  { E.setAñoSel(val); }
    function _onMesChange(val)  { E.setMesSel(val); }
    function _onMostrar()       { render(); }
    function exportarPdf()      { E.exportarPdf(E.getAñoSel(), E.getMesSel()); }
    function exportarDocx()     { E.exportarDocx(E.getAñoSel(), E.getMesSel()); }

    return {
        init, salir,
        esArchivoPJ : E.esArchivoPJ.bind(E),
        verAtestados, _closeAtestados, _printAtestados,
        imprimirVista,
        exportarPdf, exportarDocx,
        _onAñoChange, _onMesChange, _onMostrar,
        _onSearchInput, _onSearchClear,
    };

})();
