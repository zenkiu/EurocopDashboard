/**
 * EUROCOP ANALYTICS — FncEvolucionGV.js
 * ─────────────────────────────────────────────────────────────
 * Ventana emergente con gráfica de líneas (Chart.js) para ver la
 * evolución mensual de las estadísticas GV (DSV y PJ).
 *
 * Módulo genérico e independiente: NO conoce DSV ni PJ. Recibe la
 * configuración desde FncAtestados / FncAtestadosPJ:
 *
 *   FncEvolucionGV.abrir({
 *       titulo      : string,
 *       meses       : string[12]            // nombres completos
 *       indicadores : [{ key, label, color?, hidden? }],
 *       años        : number[]              // ascendente
 *       valores     : { [año]: { [key]: number[12] } },
 *       sinMes      : { [año]: number }     // opcional
 *       añoInicial  : number
 *   });
 *
 * Modos:
 *   · "Todos los indicadores" → una línea por indicador (año elegido)
 *   · Un indicador concreto   → una línea por año (comparativa)
 */

const FncEvolucionGV = (() => {

    const PALETTE = ['#5e72e4', '#f5365c', '#2dce89', '#fb6340',
                     '#11cdef', '#8965e0', '#ffd600', '#8898aa'];

    let _chart = null;
    let _cfg   = null;
    let _st    = null;   // { año, ind, hidden:{} }
    let _onKey = null;

    // ── Traducciones (claves evo_ de languages.js) ───────────────────────────
    function t(key) {
        const k   = 'evo_' + key;
        const tr  = typeof translations !== 'undefined' ? translations : null;
        const lng = typeof currentLang  !== 'undefined' ? currentLang  : 'es';
        if (tr && tr[lng]  && tr[lng][k])  return tr[lng][k];
        if (tr && tr['es'] && tr['es'][k]) return tr['es'][k];
        const fb = {
            boton: 'Evolución', titulo_acc: 'Evolución mensual', titulo_pj: 'Evolución mensual',
            anyo: 'Año', indicador: 'Indicador', todos: 'Todos los indicadores',
            acc_total: 'Accidentes (total)', comparativa: 'Comparativa entre años',
            sin_datos: 'Sin datos para representar',
            delito: 'Tipo de delito', todos_delitos: 'Todos los delitos',
            sin_mes: 'registros sin mes (no incluidos en la gráfica)'
        };
        return fb[key] || key;
    }

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Valores {key: number[12]} del año (y del filtro elegido si hay selector)
    function _vals(año) {
        if (_cfg.selector) return _cfg.selector.valores(año, _st.sel) || {};
        return _cfg.valores[año] || {};
    }

    // Opciones del selector (solo las que tienen datos en el año consultado)
    function _optsSelector() {
        const S = _cfg.selector;
        let h = `<option value="all"${_st.sel === 'all' ? ' selected' : ''}>${esc(S.todos)}</option>`;
        S.opciones(_st.año).forEach(c => {
            h += `<option value="${esc(c.key)}" style="font-weight:700"${_st.sel === c.key ? ' selected' : ''}>${esc(c.label)}</option>`;
            c.subs.forEach(sb => {
                h += `<option value="${esc(sb.key)}"${_st.sel === sb.key ? ' selected' : ''}>&nbsp;&nbsp;&nbsp;– ${esc(sb.label)}</option>`;
            });
        });
        return h;
    }

    function _labelSel() {
        const S = _cfg.selector;
        if (_st.sel === 'all') return S.todos;
        let out = '';
        S.opciones(_st.año).forEach(c => {
            if (c.key === _st.sel) out = c.label;
            c.subs.forEach(sb => { if (sb.key === _st.sel) out = sb.label; });
        });
        return out || S.todos;
    }

    // Último mes (0-11) con algún dato en el año; los meses posteriores se
    // dibujan como hueco (null) para no mostrar una caída falsa a 0.
    function _lastMonth(año) {
        const v = _vals(año);
        let last = -1;
        _cfg.indicadores.forEach(ind => {
            const arr = v[ind.key] || [];
            for (let i = 11; i > last; i--) { if ((arr[i] || 0) > 0) { last = i; break; } }
        });
        return last;
    }

    function _serie(año, key) {
        const arr  = _vals(año)[key] || [];
        const last = _lastMonth(año);
        return Array.from({ length: 12 }, (_, i) => (i <= last ? (arr[i] || 0) : null));
    }

    function _sum(data) { return data.reduce((a, v) => a + (v || 0), 0); }

    // ── Datasets según modo ─────────────────────────────────────────────────
    function _datasets() {
        const all = !!_cfg.selector || _st.ind === 'all';
        const base = (label, key, color, data, hiddenDefault) => ({
            label, data, _key: key,
            borderColor: color, backgroundColor: color + '22',
            pointBackgroundColor: color, pointRadius: 3, pointHoverRadius: 5,
            borderWidth: 2, tension: 0.3, spanGaps: false,
            hidden: (key in _st.hidden) ? _st.hidden[key] : !!hiddenDefault
        });
        if (all) {
            return _cfg.indicadores.map(ind =>
                base(ind.label, 'i:' + ind.key, ind.color, _serie(_st.año, ind.key), ind.hidden));
        }
        const ind = _cfg.indicadores.find(i => i.key === _st.ind);
        return _cfg.años.map((a, i) =>
            base(String(a), 'y:' + a, PALETTE[i % PALETTE.length], _serie(a, ind.key), false));
    }

    // ── Dibujo ──────────────────────────────────────────────────────────────
    function _draw() {
        const canvas = document.getElementById('evo-canvas');
        if (!canvas) return;
        if (_chart) { _chart.destroy(); _chart = null; }

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const tick   = isDark ? '#7d8590' : '#525f7f';
        const grid   = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
        const datasets = _datasets();
        const cortos = _cfg.meses.map(m => String(m).substring(0, 3));

        _chart = new Chart(canvas, {
            type: 'line',
            data: { labels: cortos, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: tick, usePointStyle: true, boxWidth: 8, font: { size: 11 } },
                        onClick: (e, item, legend) => {
                            const ch  = legend.chart;
                            const idx = item.datasetIndex;
                            const vis = ch.isDatasetVisible(idx);
                            ch.setDatasetVisibility(idx, !vis);
                            _st.hidden[ch.data.datasets[idx]._key] = vis;   // vis→pasa a oculto
                            ch.update();
                        }
                    },
                    tooltip: {
                        callbacks: {
                            title: items => (_cfg.meses[items[0].dataIndex] || '')
                        }
                    }
                },
                scales: {
                    x: { ticks: { color: tick }, grid: { color: grid } },
                    y: { beginAtZero: true, ticks: { color: tick, precision: 0 }, grid: { color: grid } }
                }
            }
        });

        _renderChips(datasets);
    }

    function _renderChips(datasets) {
        const box = document.getElementById('evo-chips');
        if (!box) return;
        box.innerHTML = datasets.map(ds =>
            `<span class="evo-chip"><i style="background:${ds.borderColor}"></i>${esc(ds.label)}: <b>${_sum(ds.data)}</b></span>`
        ).join('');

        const sub = document.getElementById('evo-sub');
        if (sub) {
            if (_cfg.selector) sub.textContent = _st.año + ' · ' + _labelSel();
            else if (_st.ind === 'all') sub.textContent = String(_st.año);
            else {
                const ind = _cfg.indicadores.find(i => i.key === _st.ind);
                sub.textContent = t('comparativa') + ' · ' + (ind ? ind.label : '');
            }
        }

        const note = document.getElementById('evo-note');
        if (note) {
            const todo = _cfg.selector ? _st.sel === 'all' : _st.ind === 'all';
            const n = (_cfg.sinMes && todo) ? (_cfg.sinMes[_st.año] || 0) : 0;
            note.textContent = n > 0 ? `${n} ${t('sin_mes')}` : '';
        }
    }

    // ── Apertura / cierre ───────────────────────────────────────────────────
    function abrir(cfg) {
        cerrar();
        if (typeof Chart === 'undefined') {
            if (typeof showToast === 'function') showToast('Chart.js no disponible.');
            return;
        }
        if (!cfg || !cfg.años || !cfg.años.length) {
            if (typeof showToast === 'function') showToast(t('sin_datos'));
            return;
        }
        cfg.indicadores.forEach((ind, i) => { ind.color = ind.color || PALETTE[i % PALETTE.length]; });
        _cfg = cfg;
        _st  = {
            año: cfg.años.includes(cfg.añoInicial) ? cfg.añoInicial : cfg.años[cfg.años.length - 1],
            ind: 'all',
            sel: 'all',
            hidden: {}
        };

        const optsAño = [...cfg.años].reverse().map(a =>
            `<option value="${a}" ${a === _st.año ? 'selected' : ''}>${a}</option>`).join('');
        const optsInd = cfg.selector ? _optsSelector() : `<option value="all">${esc(t('todos'))}</option>` +
            cfg.indicadores.map(i => `<option value="${esc(i.key)}">${esc(i.label)}</option>`).join('');

        const modal = document.createElement('div');
        modal.id = 'evo-modal';
        // atd-modal-overlay: reutiliza el overlay y evita que body.kpi-active lo oculte
        modal.className = 'atd-modal-overlay evo-overlay';
        modal.innerHTML = `
        <div class="atd-modal evo-modal">
            <div class="atd-modal-header">
                <div class="atd-modal-title">
                    <i class="fa-solid fa-chart-line"></i> ${esc(cfg.titulo)}
                </div>
                <button class="atd-btn-close" id="evo-close"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="evo-body">
                <div class="evo-controls">
                    <label class="evo-ctl">${esc(t('anyo'))}
                        <select id="evo-año" class="at-select">${optsAño}</select>
                    </label>
                    <label class="evo-ctl">${esc(cfg.selector ? cfg.selector.label : t('indicador'))}
                        <select id="evo-ind" class="at-select">${optsInd}</select>
                    </label>
                </div>
                <div class="evo-sub" id="evo-sub"></div>
                <div class="evo-chart-wrap"><canvas id="evo-canvas"></canvas></div>
                <div class="evo-chips" id="evo-chips"></div>
                <div class="evo-note" id="evo-note"></div>
            </div>
        </div>`;
        document.body.appendChild(modal);

        modal.addEventListener('click', e => { if (e.target === modal) cerrar(); });
        document.getElementById('evo-close').addEventListener('click', cerrar);
        document.getElementById('evo-año').addEventListener('change', e => {
            _st.año = parseInt(e.target.value);
            if (_cfg.selector) {
                const ok = new Set(['all']);
                _cfg.selector.opciones(_st.año).forEach(c => { ok.add(c.key); c.subs.forEach(sb => ok.add(sb.key)); });
                if (!ok.has(_st.sel)) _st.sel = 'all';
                document.getElementById('evo-ind').innerHTML = _optsSelector();
            }
            _draw();
        });
        document.getElementById('evo-ind').addEventListener('change', e => {
            if (_cfg.selector) { _st.sel = e.target.value; _draw(); return; }
            _st.ind = e.target.value;
            document.getElementById('evo-año').disabled = (_st.ind !== 'all');
            _draw();
        });
        _onKey = ev => { if (ev.key === 'Escape') cerrar(); };
        document.addEventListener('keydown', _onKey);

        _draw();
    }

    function cerrar() {
        if (_chart) { _chart.destroy(); _chart = null; }
        if (_onKey) { document.removeEventListener('keydown', _onKey); _onKey = null; }
        const m = document.getElementById('evo-modal');
        if (m) m.remove();
    }

    return { abrir, cerrar, t };

})();
