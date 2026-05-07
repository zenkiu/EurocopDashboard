/**
 * EUROCOP ANALYTICS — FncAtestados.js
 * ─────────────────────────────────────────────────────────────
 * Coordinación de UI para el módulo de Accidentalidad/Lesividad.
 *
 * Responsabilidades:
 *   · Detección del archivo y entrada al módulo
 *   · Render HTML de la vista principal (filtros, tablas)
 *   · Modal de detalle de atestados individuales
 *   · Gestión del ciclo de vida (init, salir, cambio idioma)
 *
 * Delega en FncEstadisticaGVdsv.js:
 *   · Parseo y normalización del Excel
 *   · Cálculo de accidentalidad y lesividad
 *   · Exportación a PDF y DOCX
 *   · Traducciones (t)
 */

const FncAtestados = (() => {

    // Alias corto al módulo de lógica de negocio
    const E = FncEstadisticaGVdsv;

    // ── Estado de UI ─────────────────────────────────────────────────────────
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

        // Opciones de año
        const optsAño = años.map(a =>
            `<option value="${a}" ${a === añoSel ? 'selected' : ''}>${a}</option>`
        ).join('');

        // Opciones de mes
        const optsMes = meses.map((m, i) =>
            `<option value="${i+1}" ${(i+1) === mesSel ? 'selected' : ''}>${m}</option>`
        ).join('');

        // Filas de lesividad (dinámicas)
        function labelEstado(e) { return e.replace(/^\d+\.\s*/, ''); }
        const rowLabels = stats.estados.map(e => [labelEstado(e), e]);

        let lesivRows = '';
        let totCV=0,totCM=0,totOV=0,totOM=0,totPV=0,totPM=0;
        const hl = (v, extra='') =>
            `<td class="at-num${extra}${v > 0 ? ' at-highlight' : ''}">${v}</td>`;

        rowLabels.forEach(([label, key]) => {
            const d = stats.lesividad[key] || {cv:0,cm:0,ov:0,om:0,pv:0,pm:0};
            totCV+=d.cv; totCM+=d.cm; totOV+=d.ov; totOM+=d.om; totPV+=d.pv; totPM+=d.pm;
            const tV = d.cv+d.ov+d.pv, tM = d.cm+d.om+d.pm;
            lesivRows += `
            <tr>
                <td class="at-row-label">${label}</td>
                ${hl(d.cv)}${hl(d.cm)}
                ${hl(d.ov)}${hl(d.om)}
                ${hl(d.pv)}${hl(d.pm)}
                ${hl(tV,' at-total')}${hl(tM,' at-total')}
                ${hl(tV+tM,' at-grand')}
            </tr>`;
        });

        const totV=totCV+totOV+totPV, totM=totCM+totOM+totPM;
        lesivRows += `
            <tr class="at-total-row">
                <td class="at-row-label">${t('total')}</td>
                <td class="at-num">${totCV}</td><td class="at-num">${totCM}</td>
                <td class="at-num">${totOV}</td><td class="at-num">${totOM}</td>
                <td class="at-num">${totPV}</td><td class="at-num">${totPM}</td>
                <td class="at-num">${totV}</td><td class="at-num">${totM}</td>
                <td class="at-num at-grand">${totV+totM}</td>
            </tr>`;

        const html = `
<div class="at-wrapper">
    <div class="at-breadcrumb">
        <span class="at-bc-item at-bc-home"><i class="fa-solid fa-house"></i> ${t('inicio')}</span>
        <span class="at-bc-sep">›</span>
        <span class="at-bc-item at-bc-active">${t('actualizar')}</span>
    </div>

    <div class="at-title-row">
        <h2 class="at-main-title">${t('actualizar')}</h2>
        <a href="./ArchivosPdf/ATESTADOS_DSV_GOBIERNO_VASCO_REQUISITOS.pdf"
           target="_blank" class="help-link-title" title="Ver requisitos DSV">
            <i class="fa-solid fa-circle-info"></i>
        </a>
    </div>

    <!-- Filtros -->
    <div class="at-filterbar">
        <div class="at-filter-item">
            <label>${t('municipio')}</label>
            <input id="at-municipio" class="at-input" value="${_municipio}" readonly>
        </div>
        <div class="at-filter-item">
            <label>${t('introducir_anyo')}</label>
            <select id="at-año" class="at-select" onchange="FncAtestados._onAñoChange(this.value); FncAtestados._onMostrar();">
                ${optsAño}
            </select>
        </div>
        <div class="at-filter-item">
            <label>${t('selecciona_mes')}</label>
            <select id="at-mes" class="at-select" onchange="FncAtestados._onMesChange(this.value); FncAtestados._onMostrar();">
                ${optsMes}
            </select>
        </div>
        <div class="at-filter-item at-filter-btn-group">
            <button class="at-btn-pdf" onclick="FncAtestados.exportarPdf()" title="${t('exportar_pdf')}">
                <i class="fa-solid fa-file-pdf"></i>
            </button>
            <button class="at-btn-docx" onclick="FncAtestados.exportarDocx()" title="${t('exportar_docx')}">
                <i class="fa-solid fa-file-word"></i>
            </button>
        </div>
    </div>

    <!-- Accidentalidad -->
    <div class="at-section">
        <div class="at-section-title" style="display:flex;align-items:center;justify-content:space-between;">
            <span>${t('accidentalidad')}</span>
            <button class="at-btn-ver-atestados" onclick="FncAtestados.verAtestados()">
                <i class="fa-solid fa-list-ul"></i> ${t('ver_atestados')}
            </button>
        </div>
        <table class="at-table at-acc-table">
            <thead>
                <tr><th></th><th>${t('num_accidentes')}</th></tr>
            </thead>
            <tbody>
                <tr>
                    <td class="at-row-label">${t('con_victimas')}</td>
                    <td class="at-num">${stats.conVictimas}</td>
                </tr>
                <tr>
                    <td class="at-row-label">${t('sin_victimas')}</td>
                    <td class="at-num">${stats.sinVictimas}</td>
                </tr>
                <tr class="at-total-row">
                    <td class="at-row-label">${t('total')}</td>
                    <td class="at-num">${stats.total}</td>
                </tr>
            </tbody>
        </table>
    </div>

    <!-- Lesividad -->
    <div class="at-section">
        <div class="at-section-title">${t('lesividad')}</div>
        <div class="at-table-scroll">
        <table class="at-table at-les-table">
            <thead>
                <tr>
                    <th rowspan="2"></th>
                    <th colspan="2">${t('conductores')}</th>
                    <th colspan="2">${t('ocupantes')}</th>
                    <th colspan="2">${t('peatones')}</th>
                    <th colspan="2">${t('total')}</th>
                    <th rowspan="2">${t('total')}</th>
                </tr>
                <tr>
                    <th>${t('varon')}</th><th>${t('mujer')}</th>
                    <th>${t('varon')}</th><th>${t('mujer')}</th>
                    <th>${t('varon')}</th><th>${t('mujer')}</th>
                    <th>${t('varon')}</th><th>${t('mujer')}</th>
                </tr>
            </thead>
            <tbody>${lesivRows}</tbody>
        </table>
        </div>
    </div>


</div>`;

        const view = document.getElementById('atestados-view');
        if (view) { view.innerHTML = html; view.classList.add('active'); }
    }

    // ============================================================
    // MODAL — VER ATESTADOS INDIVIDUALES
    // ============================================================
    function verAtestados() {
        const lang      = typeof currentLang !== 'undefined' ? currentLang : 'es';
        const meses     = E.getMeses(lang);
        const añoSel    = E.getAñoSel();
        const mesSel    = E.getMesSel();
        const nombreMes = meses[mesSel - 1] || mesSel;
        const stats     = E.calcular(añoSel, mesSel);
        const atestados = E.getAtestadosDelMes(añoSel, mesSel);
        const t         = E.t.bind(E);

        if (atestados.length === 0) {
            if (typeof showToast === 'function') showToast(t('sin_datos'));
            return;
        }

        function num(v) {
            const hi = v > 0 ? ' class="atd-hi"' : '';
            return `<td${hi}>${v}</td>`;
        }

        const cards = atestados.map(at => {
            let totCV=0,totCM=0,totOV=0,totOM=0,totPV=0,totPM=0;
            at.filas.forEach(r => {
                totCV+=r.cv; totCM+=r.cm; totOV+=r.ov;
                totOM+=r.om; totPV+=r.pv; totPM+=r.pm;
            });
            const grandTotal = totCV+totCM+totOV+totOM+totPV+totPM;
            const conVict = at.filas.some(r =>
                (r.cv+r.cm+r.ov+r.om+r.pv+r.pm) > 0 && !r.estado.includes('ILESOS')
            );
            const badge = conVict
                ? `<span class="atd-badge atd-badge-cv">${t('con_victimas_badge')}</span>`
                : `<span class="atd-badge atd-badge-sv">${t('sin_victimas_badge')}</span>`;

            const filaRows = at.filas.map(r => {
                const tot   = r.cv+r.cm+r.ov+r.om+r.pv+r.pm;
                const label = r.estado.replace(/^\d+\.\s*/, '');
                return `<tr>
                    <td class="atd-estado">${label}</td>
                    ${num(r.cv)}${num(r.cm)}${num(r.ov)}${num(r.om)}${num(r.pv)}${num(r.pm)}
                    ${num(tot)}
                </tr>`;
            }).join('');

            return `
            <div class="atd-card">
                <div class="atd-card-header">
                    <div class="atd-card-title">
                        <i class="fa-solid fa-file-alt"></i>
                        <strong>ATS${at.anyo}-${at.num}</strong>
                        <span class="atd-fecha">${at.fecha}</span>
                        ${at.motivo ? `<span class="atd-motivo"><strong>${at.motivo}</strong></span>` : ''}
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        ${badge}
                        ${grandTotal > 0
                            ? `<span class="atd-total-badge">${grandTotal} ${t('pers')}</span>`
                            : ''}
                    </div>
                </div>
                <div class="atd-table-wrap">
                <table class="atd-table">
                    <thead>
                        <tr>
                            <th>${t('estado_lesion')}</th>
                            <th>Cond.V</th><th>Cond.M</th>
                            <th>Ocup.V</th><th>Ocup.M</th>
                            <th>Peat.V</th><th>Peat.M</th>
                            <th>TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>${filaRows}</tbody>
                    <tfoot>
                        <tr class="atd-tfoot">
                            <td>TOTAL</td>
                            ${num(totCV)}${num(totCM)}${num(totOV)}
                            ${num(totOM)}${num(totPV)}${num(totPM)}
                            ${num(grandTotal)}
                        </tr>
                    </tfoot>
                </table>
                </div>
            </div>`;
        }).join('');

        const resumen = `
        <div class="atd-resumen">
            <div class="atd-res-item">
                <span>${atestados.length}</span>
                <small>${t('atestados').toUpperCase()}</small>
            </div>
            <div class="atd-res-item atd-res-cv">
                <span>${stats.conVictimas}</span>
                <small>${t('con_victimas_badge').toUpperCase()}</small>
            </div>
            <div class="atd-res-item atd-res-sv">
                <span>${stats.sinVictimas}</span>
                <small>${t('sin_victimas_badge').toUpperCase()}</small>
            </div>
        </div>`;

        const modal = document.createElement('div');
        modal.id = 'atd-modal';
        modal.className = 'atd-modal-overlay';
        modal.innerHTML = `
        <div class="atd-modal">
            <div class="atd-modal-header">
                <div class="atd-modal-title">
                    <i class="fa-solid fa-shield-halved"></i>
                    ${t('atestados')} · ${nombreMes} ${añoSel}
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                    <button class="atd-btn-print" onclick="FncAtestados._printAtestados()">
                        <i class="fa-solid fa-print"></i> ${t('imprimir')}
                    </button>
                    <button class="atd-btn-close" onclick="FncAtestados._closeAtestados()">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
            <div class="atd-modal-body" id="atd-print-area">
                <div class="atd-print-header">
                    <div>
                        <div style="font-size:1.1rem;font-weight:800;color:#5e72e4;">
                            EUROCOP ANALYTICS
                        </div>
                        <div style="font-size:0.85rem;color:#525f7f;">
                            ${t('detalle_title')} · ${nombreMes} ${añoSel}
                        </div>
                    </div>
                    <div style="font-size:0.78rem;color:#8898aa;">
                        ${new Date().toLocaleDateString('es-ES')}
                    </div>
                </div>
                ${resumen}
                ${cards}
            </div>
        </div>`;

        document.body.appendChild(modal);
        modal.addEventListener('click', e => {
            if (e.target === modal) FncAtestados._closeAtestados();
        });
    }

    // ============================================================
    // CICLO DE VIDA
    // ============================================================
    function init(data, filename) {
        if (!E.esArchivoAtestados(filename)) return false;

        E.parsearDatos(data);

        // Ocultar vistas normales
        ['upload-view', 'mapping-view', 'dashboard-view'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('active');
        });

        const loader = document.getElementById('loading-overlay');
        if (loader) loader.classList.remove('active');

        render();

        // Validar datos y mostrar modal si hay errores
        const errores = E.validarDatos();
        if (errores.length > 0) {
            setTimeout(() => mostrarModalErrores(errores), 400);
        }

        return true;
    }

    // ============================================================
    // MODAL DE PREVISUALIZACIÓN DE ATESTADOS ERRÓNEOS
    // ============================================================
    function mostrarModalErrores(errores) {
        const lang = typeof currentLang !== 'undefined' ? currentLang : 'es';
        const tr   = (typeof translations !== 'undefined' && translations[lang]) || {};
        const _s   = (key, vars={}) => {
            let t = tr[key] || key;
            Object.entries(vars).forEach(([k,v]) => { t = t.replace(`{${k}}`, v); });
            return t;
        };

        const sinFechaCount  = errores.filter(e => e.causas.includes('sin_fecha')).length;
        const totalCeroCount = errores.filter(e => e.causas.includes('total_cero')).length;

        const filas = errores.map(e => {
            const esSinFecha = e.causas.includes('sin_fecha');
            const esSinPers  = e.causas.includes('total_cero');
            const fechaHtml  = esSinFecha
                ? `<span style="color:#fb6340;font-weight:700;">${_s('atd_pj_sin_fecha')}</span>`
                : `<span>${e.fecha}</span>`;
            const causaHtml = [
                esSinFecha ? `<span class="atd-err-badge atd-err-fecha"><i class="fa-solid fa-calendar-xmark"></i> ${_s('atd_err_badge_fecha')}</span>` : '',
                esSinPers  ? `<span class="atd-err-badge atd-err-cero"><i class="fa-solid fa-user-slash"></i> ${_s('atd_err_badge_personas')}</span>` : '',
            ].filter(Boolean).join(' ');

            return `<tr class="atd-err-tr">
                <td class="atd-err-td-ref">${e.ref}</td>
                <td class="atd-err-td-fecha">${fechaHtml}</td>
                <td class="atd-err-td-motivo">${e.motivo || '—'}</td>
                <td class="atd-err-td-causa">${causaHtml}</td>
            </tr>`;
        }).join('');

        const titulo = _s('atd_err_title', {
            n: errores.length,
            s: errores.length !== 1 ? 's' : ''
        });

        const modal = document.createElement('div');
        modal.id = 'atd-err-modal';
        modal.className = 'atd-modal-overlay';
        modal.innerHTML = `
        <div class="atd-modal atd-err-modal-wide">
            <div class="atd-modal-header" style="background:linear-gradient(135deg,#f5365c,#d32f7d);">
                <div class="atd-modal-title">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    ${titulo}
                </div>
                <button class="atd-btn-close" onclick="FncAtestados._closeErrores()" style="color:white;">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="atd-modal-body">
                <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
                    <div class="atd-err-stat">
                        <span style="font-size:1.6rem;font-weight:900;color:#f5365c;">${errores.length}</span>
                        <small>${_s('atd_err_total')}</small>
                    </div>
                    ${sinFechaCount > 0 ? `<div class="atd-err-stat">
                        <span style="font-size:1.6rem;font-weight:900;color:#fb6340;">${sinFechaCount}</span>
                        <small>${_s('atd_err_sin_fecha')}</small>
                    </div>` : ''}
                    ${totalCeroCount > 0 ? `<div class="atd-err-stat">
                        <span style="font-size:1.6rem;font-weight:900;color:#8965e0;">${totalCeroCount}</span>
                        <small>${_s('atd_err_sin_personas')}</small>
                    </div>` : ''}
                </div>
                <div class="atd-err-info-box">
                    <i class="fa-solid fa-circle-info"></i>
                    ${_s('atd_err_aviso')}
                </div>
                <div class="atd-err-table-wrap">
                    <table class="atd-err-table">
                        <thead>
                            <tr>
                                <th>${_s('atd_err_col_ref')}</th>
                                <th>${_s('atd_err_col_fecha')}</th>
                                <th>${_s('atd_err_col_motivo')}</th>
                                <th>${_s('atd_err_col_incidencia')}</th>
                            </tr>
                        </thead>
                        <tbody>${filas}</tbody>
                    </table>
                </div>
            </div>
            <div class="atd-err-footer">
                <button onclick="FncAtestados._closeErrores()" class="atd-err-btn-ok">
                    ${_s('atd_err_entendido')}
                </button>
            </div>
        </div>`;

        document.body.appendChild(modal);
        modal.addEventListener('click', ev => { if (ev.target === modal) FncAtestados._closeErrores(); });
    }

    function salir() {
        const view = document.getElementById('atestados-view');
        if (view) view.classList.remove('active');
        location.reload();
    }

    // ── Handlers de UI ───────────────────────────────────────────
    function _onAñoChange(val)  { E.setAñoSel(val); }
    function _onMesChange(val)  { E.setMesSel(val); }
    function _onMostrar()       { render(); }
    function exportarPdf()      { E.exportarPdf(E.getAñoSel(), E.getMesSel()); }
    function exportarDocx()     { E.exportarDocx(E.getAñoSel(), E.getMesSel()); }
    function _closeAtestados()  {
        const m = document.getElementById('atd-modal');
        if (m) m.remove();
    }
    function _printAtestados()  { window.print(); }

    // ── API pública ──────────────────────────────────────────────
    return {
        init, salir,
        esArchivoAtestados : E.esArchivoAtestados.bind(E),
        verAtestados,
        exportarPdf, exportarDocx,
        _onAñoChange, _onMesChange, _onMostrar,
        _closeAtestados, _printAtestados,
        _closeErrores: () => { const m = document.getElementById('atd-err-modal'); if(m) m.remove(); },
    };

})();
