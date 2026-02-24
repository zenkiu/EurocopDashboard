/**
 * EUROCOP ANALYTICS - GRÁFICOS (Chart.js)
 * Timeline (bar/line con stacked), Categorías (doughnut top-5),
 * Horas (line 24h). Incluye cache para tablas integradas.
 */

// ============================================================
// CAMBIAR VISTA TEMPORAL (year | month | quarter | day | daily)
// ============================================================
function changeTemporalView(v) {
    runWithLoader(() => {
        temporalView = v;
        // Mostrar/ocultar barra de clima según vista
        if (typeof initMeteoUI === 'function' && typeof hideMeteoUI === 'function') {
            if (v === 'daily') { initMeteoUI(); }
            else              { hideMeteoUI(); }
        }
        updateUI();
    });
}

// ============================================================
// ALTERNAR TIPO DE GRÁFICO TIMELINE (bar ↔ line)
// ============================================================
function toggleTimelineType() {
    runWithLoader(() => {
        chartTimelineType = (chartTimelineType === 'bar') ? 'line' : 'bar';
        const btnIcon = document.querySelector('#btn-toggle-chart-type i');
        const btn     = document.getElementById('btn-toggle-chart-type');

        if (chartTimelineType === 'line') {
            btnIcon.className = 'fa-solid fa-chart-simple';
            btn.title = "Volver a Barras";
        } else {
            btnIcon.className = 'fa-solid fa-chart-line';
            btn.title = "Cambiar a Líneas";
        }
        updateUI();
    });
}

// ============================================================
// ACTUALIZAR LOS 3 GRÁFICOS
// ============================================================
function updateCharts(data, selYears) {
    const t = translations[currentLang];

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: window.innerWidth < 769 ? 'bottom' : 'top',
                labels: { boxWidth: 12, font: { size: 10 } }
            }
        }
    };

    // --------------------------------------------------------
    // GRÁFICO TIMELINE
    // --------------------------------------------------------
    const ctxTimeline = document.getElementById('chart-timeline');
    if (ctxTimeline) {

        // Mostrar u ocultar barra meteorología según vista
        if (temporalView === 'daily') {
            if (typeof initMeteoUI === 'function') initMeteoUI();
        } else {
            if (typeof hideMeteoUI === 'function') hideMeteoUI();
        }
        const activeCategories = [...new Set(data.map(d => d.cat))].sort();

        // Años activos según vista
        let activeYears = [];
        if (temporalView === 'year') {
            activeYears = [...new Set(data.map(d => d.year))].sort((a, b) => a - b);
        } else {
            activeYears = [...selYears].sort((a, b) => a - b);
        }

        // Etiquetas base según vista temporal
        let baseLabelTexts = [];
        if (temporalView === 'year')    baseLabelTexts = activeYears.map(y => y.toString());
        else if (temporalView === 'month')   baseLabelTexts = t.months_abbr;
        else if (temporalView === 'quarter') baseLabelTexts = t.quarters;
        else if (temporalView === 'day')     baseLabelTexts = t.days_abbr.map(l => l.substring(0, 3));
        else if (temporalView === 'daily') {
            // Abreviaturas de día de semana según idioma (L-D)
            const weekDayAbbr = t.days_abbr
                ? t.days_abbr.map(l => l.split('-')[0])   // ['L','M','X','J','V','S','D']
                : ['L','M','X','J','V','S','D'];

            // Generar lista de fechas únicas con día de semana, ordenadas
            const uniqueDates = [...new Set(data.map(d => {
                const dd = String(d.date.getDate()).padStart(2, '0');
                const mm = String(d.date.getMonth() + 1).padStart(2, '0');
                const yy = String(d.date.getFullYear()).slice(-2);
                return `${dd}/${mm}/${yy}`;
            }))].sort((a, b) => {
                const [ad, am, ay] = a.split('/').map(Number);
                const [bd, bm, by] = b.split('/').map(Number);
                return new Date(2000 + ay, am - 1, ad) - new Date(2000 + by, bm - 1, bd);
            });

            // Añadir abreviatura del día de la semana a cada etiqueta
            baseLabelTexts = uniqueDates.map(label => {
                const [dd, mm, yy] = label.split('/').map(Number);
                const dateObj = new Date(2000 + yy, mm - 1, dd);
                const jsDay  = dateObj.getDay(); // 0=Dom, 1=Lun ... 6=Sáb
                const idx    = jsDay === 0 ? 6 : jsDay - 1; // 0=Lun ... 6=Dom
                return `${label} ${weekDayAbbr[idx]}`;
            });
        }

        // Paleta de categorías
        const getCategoryColor = (index) => {
            const palette = ['#5e72e4','#2dce89','#fb6340','#11cdef','#f5365c','#8965e0','#ffd600','#32325d','#adb5bd','#f3a4b5','#2bffc6','#8898aa'];
            return palette[index % palette.length];
        };

        // Datasets por categoría
        const datasets = activeCategories.map((catName, index) => {
            let catData = [];

            if (temporalView === 'year') {
                catData = activeYears.map(y => data.filter(d => d.year === y && d.cat === catName).length);
            } else if (temporalView === 'month') {
                catData = Array(12).fill(0);
                data.filter(d => d.cat === catName).forEach(d => { catData[d.month - 1]++; });
            } else if (temporalView === 'quarter') {
                catData = Array(4).fill(0);
                data.filter(d => d.cat === catName).forEach(d => {
                    catData[Math.floor((d.month - 1) / 3)]++;
                });
            } else if (temporalView === 'day') {
                catData = Array(7).fill(0);
                data.filter(d => d.cat === catName).forEach(d => {
                    let idx = d.date.getDay();
                    catData[idx === 0 ? 6 : idx - 1]++;
                });
            } else if (temporalView === 'daily') {
                catData = baseLabelTexts.map(label => {
                    const dateKey = label.substring(0, 8); // Extraer solo "DD/MM/YY"
                    return data.filter(d => d.cat === catName).filter(d => {
                        const dd = String(d.date.getDate()).padStart(2, '0');
                        const mm = String(d.date.getMonth() + 1).padStart(2, '0');
                        const yy = String(d.date.getFullYear()).slice(-2);
                        return `${dd}/${mm}/${yy}` === dateKey;
                    }).length;
                });
            }

            return {
                label: catName,
                data: catData,
                backgroundColor: getCategoryColor(index),
                borderColor: getCategoryColor(index),
                borderWidth: chartTimelineType === 'line' ? 2 : 0,
                fill: false,
                tension: 0.3,
                pointRadius: chartTimelineType === 'line' ? 3 : 0,
                pointHoverRadius: 6,
                stack: 'combined'
            };
        });

        // Totales por columna para etiquetas
        const columnTotals = baseLabelTexts.map((_, index) => {
            return datasets.reduce((sum, ds) => sum + (ds.data[index] || 0), 0);
        });

        // Etiquetas finales con totales
        const labels = baseLabelTexts.map((label, index) => {
            const total = columnTotals[index];
            return total > 0 ? `${label} (${total})` : label;
        });

        // Actualizar cache de tabla timeline
        tableDataCache = [];
        labels.forEach((lbl, index) => {
            let row = { label: lbl, index: index };
            datasets.forEach(ds => { row[ds.label] = ds.data[index]; });
            row['TOTAL'] = datasets.reduce((sum, ds) => sum + (ds.data[index] || 0), 0);
            tableDataCache.push(row);
        });
        if (isTableView) renderTimelineTable();

        // Auto-sincronizar datos meteo si el rango de fechas ha cambiado
        if (typeof syncMeteoIfActive === 'function') {
            syncMeteoIfActive(); // async, no bloqueante
        }

        // Inyectar datos climáticos si vista Diario y clima activo
        let allDatasets = [...datasets];
        let extraScales = {};
        if (temporalView === 'daily' && typeof getMeteoOverlayConfig === 'function') {
            const meteoConfig = getMeteoOverlayConfig(baseLabelTexts);
            if (meteoConfig.datasets.length > 0) {
                allDatasets = [...datasets, ...meteoConfig.datasets];
                extraScales = meteoConfig.yAxis || {};
            }
        }

        // Crear / recrear gráfico
        if (chartTimeline) chartTimeline.destroy();
        chartTimeline = new Chart(ctxTimeline, {
            type: chartTimelineType,
            data: { labels, datasets: allDatasets },
            options: {
                ...commonOptions,
                onClick: (e, activeEls) => {
                    if (activeEls.length > 0) {
                        const ds = allDatasets[activeEls[0].datasetIndex];
                        // Solo abrir detalle si es dataset de incidencias (no clima)
                        if (!ds.yAxisID || ds.yAxisID !== 'yMeteo') {
                            showDetailedRecords(labels[activeEls[0].index], ds.label);
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        mode: 'nearest',
                        intersect: true,
                        itemSort: (a, b) => b.raw - a.raw,
                        filter: (tooltipItem) => tooltipItem.raw !== null && tooltipItem.raw > 0
                    }
                },
                scales: {
                    x: {
                        stacked: chartTimelineType === 'bar',
                        grid: { display: false },
                        ticks: {
                            color: function(ctx) {
                                if (temporalView !== 'daily') return '#525f7f';
                                const label = ctx.chart.data.labels[ctx.index] || '';
                                const parts = label.split(' ');
                                const [dd, mm, yy] = parts[0] ? parts[0].split('/').map(Number) : [0,0,0];
                                if (dd && mm && yy) {
                                    const dow = new Date(2000 + yy, mm - 1, dd).getDay();
                                    if (dow === 5) return '#2dce89'; // Viernes → verde
                                    if (dow === 6) return '#f5365c'; // Sábado  → rojo
                                    if (dow === 0) return '#5e72e4'; // Domingo → azul
                                }
                                return '#525f7f';
                            },
                            font: function(ctx) {
                                if (temporalView !== 'daily') return {};
                                const label = ctx.chart.data.labels[ctx.index] || '';
                                const parts = label.split(' ');
                                const [dd, mm, yy] = parts[0] ? parts[0].split('/').map(Number) : [0,0,0];
                                if (dd && mm && yy) {
                                    const dow = new Date(2000 + yy, mm - 1, dd).getDay();
                                    if (dow === 0 || dow === 5 || dow === 6) return { weight: 'bold' };
                                }
                                return {};
                            }
                        }
                    },
                    y: { stacked: chartTimelineType === 'bar', beginAtZero: true, ticks: { precision: 0 } },
                    ...extraScales
                }
            }
        });

        // Si modo panel separado, renderizar gráfico de clima debajo
        if (temporalView === 'daily' && typeof _meteoRenderPanel === 'function') {
            const modeEl = document.getElementById('meteo-mode-select');
            if (modeEl && modeEl.value === 'panel' && typeof meteoEnabled !== 'undefined' && meteoEnabled) {
                setTimeout(() => _meteoRenderPanel(), 50);
            }
        }
    }

    // --------------------------------------------------------
    // GRÁFICO CATEGORÍAS (Doughnut Top-5)
    // --------------------------------------------------------
    const ctxCat = document.getElementById('chart-category');
    if (ctxCat) {
        const container    = document.getElementById('container-category');
        const isFullscreen = container.classList.contains('fullscreen');

        const catData = {};
        data.forEach(d => { catData[d.cat] = (catData[d.cat] || 0) + 1; });
        const sorted = Object.entries(catData).sort((a, b) => b[1] - a[1]);
        const top5   = sorted.slice(0, 5);
        const total  = sorted.reduce((sum, item) => sum + item[1], 0);

        const fullLabels  = top5.map(s => s[0]);
        const shortLabels = top5.map(s => s[0].length > 20 ? s[0].substring(0, 20) + '...' : s[0]);
        const activeLabels = isFullscreen ? fullLabels : shortLabels;

        // Cache para tabla categorías
        tableCatDataCache = sorted.map(item => ({
            cat: item[0],
            count: item[1],
            percent: ((item[1] / total) * 100).toFixed(1)
        }));
        if (isTableCatView) renderCategoryTable();

        if (chartCategory) chartCategory.destroy();
        chartCategory = new Chart(ctxCat, {
            type: 'doughnut',
            data: {
                labels: activeLabels,
                datasets: [{
                    data: top5.map(s => s[1]),
                    backgroundColor: yearColors.map(c => c.bg),
                    borderColor: '#ffffff',
                    borderWidth: 2
                }]
            },
            options: {
                ...commonOptions,
                maintainAspectRatio: false,
                cutout: '60%',
                scales: { x: { display: false }, y: { display: false } },
                layout: { padding: { top: 10, bottom: 20, left: 10, right: 10 } },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = fullLabels[context.dataIndex] || '';
                                let value = context.parsed;
                                let totalVal = context.chart._metasets[context.datasetIndex].total;
                                return ` ${label}: ${value} (${((value / totalVal) * 100).toFixed(1)}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // --------------------------------------------------------
    // GRÁFICO HORAS (Line 24h)
    // --------------------------------------------------------
// --------------------------------------------------------
    // GRÁFICO HORAS (Line 24h) - CORREGIDO
    // --------------------------------------------------------
    const ctxHours = document.getElementById('chart-hours');
    if (ctxHours) {
        const hC = Array(24).fill(0);
        data.forEach(d => { hC[d.hour]++; });
        const totalReg = data.length;

        // Cache para tabla horas
        tableHoursDataCache = hC.map((count, index) => ({
            hour: index,
            hourLabel: String(index).padStart(2, '0') + ":00",
            count: count,
            percent: totalReg > 0 ? ((count / totalReg) * 100).toFixed(1) : "0.0"
        }));
        if (isTableHoursView) renderHoursTable();

        // ── Franjas horarias ──────────────────────────────────────────────
        // Noche  00-06  gris claro   | Mañana 06-14  azul  | Tarde 14-22  marrón | Noche 22-24
        const FRANJA_COLORS = {
            manana: { border: '#11cdef', bg: 'rgba(17,205,239,0.18)',  label: '☀️ Mañana',  range: [6, 14] },
            tarde:  { border: '#c8916a', bg: 'rgba(200,145,106,0.18)', label: '🌤️ Tarde',   range: [14, 22] },
            noche:  { border: '#adb5bd', bg: 'rgba(173,181,189,0.18)', label: '🌙 Noche',   range: [22, 30] } // 30 = wrap 0-6
        };

        // Función: devuelve franja para hora h
        function getFranja(h) {
            if (h >= 6  && h < 14) return 'manana';
            if (h >= 14 && h < 22) return 'tarde';
            return 'noche';
        }

        // Colores por punto (borde y fondo del punto)
        const pointColors = Array.from({length: 24}, (_, h) => {
            const f = getFranja(h);
            return FRANJA_COLORS[f].border;
        });

        // Plugin: fondo de franja (annotation manual con beforeDraw)
        const franjaPlugin = {
            id: 'franjasBg',
            beforeDraw(chart) {
                const { ctx, chartArea: ca, scales: { x, y } } = chart;
                if (!ca) return;
                ctx.save();
                // Noche 0-6
                ctx.fillStyle = FRANJA_COLORS.noche.bg;
                ctx.fillRect(x.getPixelForValue(0), ca.top, x.getPixelForValue(6) - x.getPixelForValue(0), ca.height);
                // Mañana 6-14
                ctx.fillStyle = FRANJA_COLORS.manana.bg;
                ctx.fillRect(x.getPixelForValue(6), ca.top, x.getPixelForValue(14) - x.getPixelForValue(6), ca.height);
                // Tarde 14-22
                ctx.fillStyle = FRANJA_COLORS.tarde.bg;
                ctx.fillRect(x.getPixelForValue(14), ca.top, x.getPixelForValue(22) - x.getPixelForValue(14), ca.height);
                // Noche 22-23
                ctx.fillStyle = FRANJA_COLORS.noche.bg;
                ctx.fillRect(x.getPixelForValue(22), ca.top, x.getPixelForValue(23) - x.getPixelForValue(22) + 2, ca.height);
                ctx.restore();
            },
            afterDraw(chart) {
                const { ctx, chartArea: ca, scales: { x } } = chart;
                if (!ca) return;
                ctx.save();
                const _t = (typeof translations !== 'undefined' && translations[currentLang]) || {};
                const franjas = [
                    { emoji: '🌙', text: _t.shift_night     || 'Noche',   from: 0,  to: 6  },
                    { emoji: '☀️', text: _t.shift_morning   || 'Mañana',  from: 6,  to: 14 },
                    { emoji: '🌤️', text: _t.shift_afternoon || 'Tarde',   from: 14, to: 22 },
                    { emoji: '🌙', text: _t.shift_night     || 'Noche',   from: 22, to: 23 },
                ];
                franjas.forEach(f => {
                    const xFrom = x.getPixelForValue(f.from);
                    const xTo   = x.getPixelForValue(f.to);
                    const xMid  = (xFrom + xTo) / 2;
                    const width = xTo - xFrom;
                    if (width < 30) return; // No cabe
                    // Emoji en una llamada separada (mejora nitidez)
                    ctx.font = '13px sans-serif';
                    ctx.textAlign = 'right';
                    ctx.textBaseline = 'top';
                    ctx.globalAlpha = 0.85;
                    ctx.fillStyle = '#333';
                    ctx.fillText(f.emoji, xMid - 1, ca.top + 4);
                    // Texto del turno en otra llamada (fuente del sistema, nítida)
                    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
                    ctx.textAlign = 'left';
                    ctx.fillStyle = '#444';
                    ctx.globalAlpha = 0.75;
                    ctx.fillText(f.text, xMid + 2, ca.top + 5);
                });
                ctx.globalAlpha = 1;
                ctx.restore();
            }
        };

        if (chartHours) chartHours.destroy();
        chartHours = new Chart(ctxHours, {
            type: 'line',
            plugins: [franjaPlugin],
            data: {
                labels: Array.from({ length: 24 }, (_, i) => i),
                datasets: [{
                    label: 'Actividad',
                    data: hC,
                    borderColor: '#525f7f',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBackgroundColor: pointColors,
                    pointBorderColor: pointColors,
                    segment: {
                        borderColor: ctx2 => {
                            const h = ctx2.p0DataIndex;
                            return FRANJA_COLORS[getFranja(h)].border;
                        }
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: (items) => {
                                const h = parseInt(items[0].label);
                                const t = (typeof translations !== 'undefined' && translations[currentLang]) || {};
                                const f = getFranja(h);
                                const fLabel = f === 'manana' ? (t.shift_morning || 'Mañana') :
                                               f === 'tarde'  ? (t.shift_afternoon || 'Tarde') :
                                                                (t.shift_night || 'Noche');
                                return `${String(h).padStart(2,'0')}:00 — ${fLabel}`;
                            }
                        }
                    }
                },
                layout: { padding: { bottom: 10, left: 10, right: 15, top: window.innerWidth < 500 ? 22 : 28 } },
                scales: {
                    x: {
                        ticks: {
                            maxTicksLimit: window.innerWidth < 500 ? 6 : 12,
                            font: { size: window.innerWidth < 500 ? 9 : 11 }
                        },
                        grid: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0,
                            font: { size: window.innerWidth < 500 ? 9 : 11 }
                        }
                    }
                }
            }
        });
        // Forzar recálculo de dimensiones en móvil (chart puede crearse antes del layout)
        requestAnimationFrame(() => {
            if (chartHours) chartHours.resize();
        });
    }
}
/**
 * Genera el relato narrativo basado en el gráfico de evolución actual
 */
function generateTimelineNarrative() {
    // 1. Obtener la instancia del gráfico
    const chart = Chart.getChart("chart-timeline");
    if (!chart) {
        console.error("Gráfico no encontrado");
        return;
    }

    // 2. Variables para cálculos
    const labels = chart.data.labels; // ["Ene (887)", "Feb..."]
    const datasets = chart.data.datasets;
    let periodData = []; // Array para guardar {label, total}
    let grandTotal = 0;

    // 3. Recorrer cada columna (mes/año/día) y sumar los datasets apilados
    // Se asume que datasets ocultos (!ds.hidden) se suman, o podemos sumar todos si es stacked.
    // Usaremos chart.isDatasetVisible(i) para respetar filtros de leyenda.
    
    for (let i = 0; i < labels.length; i++) {
        let sum = 0;
        datasets.forEach((ds, dsIndex) => {
            // Solo sumar si el dataset es visible y tiene dato
            if (chart.isDatasetVisible(dsIndex)) {
                let val = ds.data[i];
                if (typeof val === 'number') sum += val;
            }
        });

        // Limpiar la etiqueta (Quitar paréntesis con totales antiguos si existen)
        // Ej: "Ene (887)" -> "Ene"
        let cleanLabel = labels[i];
        if (typeof cleanLabel === 'string' && cleanLabel.includes('(')) {
            cleanLabel = cleanLabel.split('(')[0].trim();
        }

        periodData.push({ label: cleanLabel, value: sum });
        grandTotal += sum;
    }

    // 4. Calcular Estadísticas (Min, Max, Avg)
    if (periodData.length === 0) return;

    // Ordenar por valor para encontrar min/max facilmente
    const sortedByValue = [...periodData].sort((a, b) => b.value - a.value);
    
    const maxItem = sortedByValue[0];
    const minItem = sortedByValue[sortedByValue.length - 1];
    const avgVal = Math.round(grandTotal / periodData.length);

    // 5. Rellenar el Modal (Resumen)
    document.getElementById('narrative-max-val').textContent = maxItem.value.toLocaleString();
    document.getElementById('narrative-max-lbl').textContent = maxItem.label;
    
    document.getElementById('narrative-min-val').textContent = minItem.value.toLocaleString();
    document.getElementById('narrative-min-lbl').textContent = minItem.label;

    document.getElementById('narrative-avg-val').textContent = avgVal.toLocaleString();

    // 6. Rellenar la Lista Cronológica
    const listContainer = document.getElementById('narrative-list-container');
    listContainer.innerHTML = '';

    // Obtener traducción para "registros"
    const lang = (typeof currentLang !== 'undefined') ? currentLang : 'es';
    const txtRecords = (typeof translations !== 'undefined') ? translations[lang].narrative_records : 'registros';

    // Crear tabla simple o lista
    const ul = document.createElement('ul');
    ul.style.listStyle = 'none';
    ul.style.padding = '0';
    ul.style.margin = '0';

    periodData.forEach(item => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.style.padding = '10px 15px';
        li.style.borderBottom = '1px solid #f0f0f0';
        li.style.fontSize = '0.9rem';

        // Barra visual de porcentaje relativo al máximo
        const percent = Math.round((item.value / maxItem.value) * 100);
        
        li.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; flex:1;">
                <div style="font-weight:700; color:#525f7f; width:80px;">${item.label}</div>
                <div style="flex:1; background:#e9ecef; height:6px; border-radius:3px; max-width:150px;">
                    <div style="width:${percent}%; background:#5e72e4; height:100%; border-radius:3px;"></div>
                </div>
            </div>
            <div style="font-weight:600; color:#32325d;">
                ${item.value.toLocaleString()} <span style="font-size:0.75rem; color:#8898aa; font-weight:400;">${txtRecords}</span>
            </div>
        `;
        ul.appendChild(li);
    });

    listContainer.appendChild(ul);

    // 7. Mostrar Modal
    const modal = document.getElementById('narrative-modal');
    modal.classList.add('active');

    // Aplicar traducciones a los títulos estáticos del modal
    if (typeof applyLanguage === 'function') applyLanguage(lang);
}