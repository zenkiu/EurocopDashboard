/**
 * EUROCOP ANALYTICS - PROCESAMIENTO DE DATOS
 */

// ============================================================
// CONECTAR BOTÓN "VISUALIZAR"
// ============================================================
function initProcesamiento() {
    const btn = document.getElementById('btn-visualizar');
    if (btn) btn.onclick = generarDashboard;
}

// ============================================================
// FUNCIÓN PRINCIPAL: GENERAR DASHBOARD
// ============================================================
function generarDashboard() {
    const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value : "";

    const config = {
        exp:      getVal('map-expediente'),
        fecha:    getVal('map-fecha'),
        hora:     getVal('map-hora'),
        lat:      getVal('map-lat'),
        lon:      getVal('map-lon'),
        cat:      getVal('map-categoria'),
        calle:    getVal('map-calle'),
        locManual: document.getElementById('map-localidad') ? document.getElementById('map-localidad').value.trim() : ""
    };

    // CAPTURA DE FILTROS DINÁMICOS EXTRA
    const colFiltro1 = getVal('map-filtro-1');
    const colFiltro2 = getVal('map-filtro-2');

    if (!config.fecha) {
        alert("Por favor, selecciona al menos la columna de FECHA.");
        return;
    }

    document.getElementById('loading-overlay').classList.add('active');

    setTimeout(() => {
        try {
            let registrosSinFecha = [];
            finalData = []; 

            const useMultiColumn = (config.cat === "***MULTI_COLUMN***");
            let columnsForCategories = [];

            if (useMultiColumn) {
                const headers = Object.keys(rawData[0]);
                const mappedColumns = [
                    config.exp, config.fecha, config.hora, 
                    config.lat, config.lon, config.calle,
                    colFiltro1, colFiltro2
                ].filter(v => v);

                columnsForCategories = headers.filter(h => {
                    if (mappedColumns.includes(h)) return false;
                    return rawData.some(row => {
                        const val = row[h];
                        return val !== "" && val !== null && val !== undefined && !isNaN(Number(val)) && Number(val) > 0;
                    });
                });
            }

            rawData.forEach(row => {
                let valFecha = row[config.fecha];
                let d;

                if (valFecha instanceof Date) {
                    d = new Date(valFecha);
                } else if (typeof valFecha === 'string' && valFecha.includes('/')) {
                    const parts = valFecha.split('/');
                    if (parts.length >= 3) {
                        d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
                    } else {
                        d = new Date(valFecha);
                    }
                } else {
                    d = new Date(valFecha);
                }

                if (isNaN(d.getTime())) {
                    const keyNum = Object.keys(row).find(k => k.toUpperCase().includes('REFNUM') || k.toUpperCase().includes('NUMERO'));
                    registrosSinFecha.push(`REF: ${row[keyNum] || 'S/N'}`);
                    return;
                }

                if (config.hora && row[config.hora]) {
                    const t = String(row[config.hora]).trim();
                    if (t.includes(':')) {
                        const p = t.split(':');
                        d.setHours(parseInt(p[0]) || 0, parseInt(p[1]) || 0, 0);
                    }
                }

                let lat = 0, lon = 0, tieneGeo = false;
                if (config.lat && config.lon && row[config.lat] && row[config.lon]) {
                    lat = parseFloat(String(row[config.lat]).replace(',', '.'));
                    lon = parseFloat(String(row[config.lon]).replace(',', '.'));
                    if (!isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0)) {
                        tieneGeo = true;
                    }
                }

                let baseRow = {
                    exp:       row[config.exp] || "N/A",
                    date:      new Date(d),
                    year:      d.getFullYear(),
                    month:     d.getMonth() + 1,
                    hour:      d.getHours(),
                    lat:       lat, 
                    lon:       lon,
                    hasGeo:    tieneGeo,
                    calle:     row[config.calle] ? String(row[config.calle]).toUpperCase().trim() : "SIN CALLE / GPS",
                    locManual: config.locManual,
                    refnum:    row['REFNUM'] || "",
                    refanno:   row['REFANNO'] || ""
                };

                // GUARDAR DATOS DE FILTROS EXTRA
                if (colFiltro1) baseRow[colFiltro1] = row[colFiltro1] || "";
                if (colFiltro2) baseRow[colFiltro2] = row[colFiltro2] || "";

                if (useMultiColumn) {
                    columnsForCategories.forEach(colName => {
                        const numValue = Number(row[colName]);
                        if (!isNaN(numValue) && numValue > 0) {
                            for (let i = 0; i < numValue; i++) {
                                finalData.push({ ...baseRow, cat: colName });
                            }
                        }
                    });
                } else {
                    baseRow.cat = row[config.cat] || "General";
                    finalData.push(baseRow);
                }
            });

            hasHourData = config.hora && config.hora !== "" && finalData.some(d => d.hour !== 0);
            const hoursContainer = document.getElementById('container-hours');
            if (hoursContainer) hoursContainer.style.display = hasHourData ? 'flex' : 'none';

            document.getElementById('mapping-view').classList.remove('active');
            document.getElementById('dashboard-view').classList.add('active');
            window.scrollTo(0, 0);

            // CONFIGURAR EL MÓDULO MULTISELECT (Solo llamamos a la función)
            if (typeof FncMultiselect !== 'undefined') {
                const filtrosConfig = [];
                if (colFiltro1) filtrosConfig.push(colFiltro1);
                if (colFiltro2) filtrosConfig.push(colFiltro2);
                FncMultiselect.setConfig(filtrosConfig);
            }

            setupFilters();
            initMap();

            setTimeout(() => {
                if (map) map.resize();
                updateUI();
            }, 600);

            if (registrosSinFecha.length > 0) {
                showRejectedModal(registrosSinFecha);
            }

        } catch (err) {
            console.error("Error en procesamiento:", err);
            alert("Hubo un error al generar el dashboard.");
        } finally {
            document.getElementById('loading-overlay').classList.remove('active');
        }
    }, 150);
}