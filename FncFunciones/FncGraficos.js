/**
 * EUROCOP ANALYTICS - GRÁFICOS (Chart.js)
 * Timeline (bar/line con stacked), Categorías (doughnut top-5),
 * Horas (line 24h). Incluye cache para tablas integradas.
 */

// ============================================================
// CAMBIAR VISTA TEMPORAL (year | month | quarter | day)
// ============================================================
function changeTemporalView(v) {
    runWithLoader(() => {
        temporalView = v;
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
                position: window.innerWidth < 768 ? 'bottom' : 'top',
                labels: { boxWidth: 12, font: { size: 10 } }
            }
        }
    };

    // --------------------------------------------------------
    // GRÁFICO TIMELINE
    // --------------------------------------------------------
    const ctxTimeline = document.getElementById('chart-timeline');
    if (ctxTimeline) {
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

        // Crear / recrear gráfico
        if (chartTimeline) chartTimeline.destroy();
        chartTimeline = new Chart(ctxTimeline, {
            type: chartTimelineType,
            data: { labels, datasets },
            options: {
                ...commonOptions,
                onClick: (e, activeEls) => {
                    if (activeEls.length > 0) {
                        showDetailedRecords(labels[activeEls[0].index], datasets[activeEls[0].datasetIndex].label);
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        mode: 'nearest',
                        intersect: true,
                        itemSort: (a, b) => b.raw - a.raw,
                        filter: (tooltipItem) => tooltipItem.raw > 0
                    }
                },
                scales: {
                    x: { stacked: chartTimelineType === 'bar', grid: { display: false } },
                    y: { stacked: chartTimelineType === 'bar', beginAtZero: true, ticks: { precision: 0 } }
                }
            }
        });
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

        if (chartHours) chartHours.destroy();
        chartHours = new Chart(ctxHours, {
            type: 'line',
            data: {
                labels: Array.from({ length: 24 }, (_, i) => i), // Genera 0, 1, 2... 23
                datasets: [{
                    label: 'Actividad',
                    data: hC, // Los datos que calculamos arriba
                    borderColor: '#11cdef',
                    fill: true,
                    backgroundColor: 'rgba(17,205,239,0.1)',
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#11cdef'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // CLAVE para que se estire
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: (items) => `Hora: ${items[0].label}:00`
                        }
                    }
                },
                layout: {
                    padding: { bottom: 10, left: 10, right: 15, top: 10 }
                },
                scales: {
                    x: { 
                        ticks: { maxTicksLimit: 12 },
                        grid: { display: false } 
                    },
                    y: { 
                        beginAtZero: true, 
                        ticks: { precision: 0 }
                    }
                }
            }
        });
    }
}
