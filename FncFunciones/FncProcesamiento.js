/**
 * EUROCOP ANALYTICS - PROCESAMIENTO DE DATOS
 * Versión blindada: control exhaustivo de valores null/vacíos del Excel.
 */

// ============================================================
// UTILIDADES DE SEGURIDAD (null-safe)
// ============================================================

/** Convierte cualquier valor a string seguro, nunca null/undefined */
function safeStr(val) {
    if (val === null || val === undefined) return "";
    return String(val).trim();
}

/** Convierte cualquier valor a float seguro, devuelve 0 si no es número */
function safeFloat(val) {
    if (val === null || val === undefined || val === "") return 0;
    const n = parseFloat(String(val).replace(',', '.'));
    return isNaN(n) ? 0 : n;
}

/** Intenta parsear una fecha desde cualquier tipo de valor.
 *  Devuelve un Date válido o null si no es posible. */
function safeParseFecha(val) {
    if (val === null || val === undefined || val === "") return null;

    // Ya es un objeto Date (XLSX con cellDates:true)
    if (val instanceof Date) {
        return isNaN(val.getTime()) ? null : new Date(val);
    }

    const str = String(val).trim();
    if (str === "") return null;

    // Formato DD/MM/YYYY o DD/MM/YY
    if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length >= 3) {
            const day   = parseInt(parts[0], 10);
            let   year  = parseInt(parts[2], 10);
            const month = parseInt(parts[1], 10);
            if (year < 100) year += 2000;
            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                const d = new Date(year, month - 1, day);
                return isNaN(d.getTime()) ? null : d;
            }
        }
    }

    // Formato YYYY-MM-DD
    if (str.includes('-')) {
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    }

    // Número serial de Excel
    const num = Number(str);
    if (!isNaN(num) && num > 1000 && num < 100000) {
        const excelEpoch = new Date(1899, 11, 30);
        const d = new Date(excelEpoch.getTime() + num * 86400000);
        return isNaN(d.getTime()) ? null : d;
    }

    // Intento genérico
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

/** Aplica hora (HH:MM o HH:MM:SS) sobre un objeto Date existente */
function safeApplyHora(d, val) {
    if (!d || val === null || val === undefined || val === "") return;
    const str = safeStr(val);
    if (!str.includes(':')) return;
    const parts = str.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) {
        d.setHours(h, m, 0, 0);
    }
}

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
    const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? safeStr(el.value) : "";
    };

    const config = {
        exp:       getVal('map-expediente'),
        fecha:     getVal('map-fecha'),
        hora:      getVal('map-hora'),
        lat:       getVal('map-lat'),
        lon:       getVal('map-lon'),
        cat:       getVal('map-categoria'),
        calle:     getVal('map-calle'),
        locManual: getVal('map-localidad')
    };

    const colFiltro1 = getVal('map-filtro-1');
    const colFiltro2 = getVal('map-filtro-2');

    if (!config.fecha) {
        alert("Por favor, selecciona al menos la columna de FECHA.");
        return;
    }

    if (!rawData || rawData.length === 0) {
        alert("No hay datos cargados. Por favor, sube un archivo primero.");
        return;
    }

    const loadingEl = document.getElementById('loading-overlay');
    if (loadingEl) loadingEl.classList.add('active');

    setTimeout(() => {
        try {
            let registrosSinFecha     = [];
            let registrosSinCategoria = 0;
            finalData = [];

            // ── MODO MULTICOLUMNA ──────────────────────────────────
            const useMultiColumn = (config.cat === "***MULTI_COLUMN***");
            let columnsForCategories = [];

            if (useMultiColumn) {
                const headers = Object.keys(rawData[0] || {});
                const mappedColumns = [
                    config.exp, config.fecha, config.hora,
                    config.lat, config.lon, config.calle,
                    colFiltro1, colFiltro2
                ].filter(v => v);

                columnsForCategories = headers.filter(h => {
                    if (mappedColumns.includes(h)) return false;
                    return rawData.some(row => {
                        if (!row) return false;
                        const val = row[h];
                        return val !== "" && val !== null && val !== undefined
                            && !isNaN(Number(val)) && Number(val) > 0;
                    });
                });
            }

            // ── FECHA DE FALLBACK: año más frecuente del dataset o año actual ──
            const yearCounts = {};
            rawData.forEach(row => {
                if (!row) return;
                const d = safeParseFecha(row[config.fecha]);
                if (d) { const y = d.getFullYear(); yearCounts[y] = (yearCounts[y] || 0) + 1; }
            });
            const fallbackYear = Object.keys(yearCounts).length > 0
                ? parseInt(Object.entries(yearCounts).sort((a,b) => b[1]-a[1])[0][0])
                : new Date().getFullYear();
            const FECHA_FALLBACK = new Date(fallbackYear, 0, 1); // 01/01/año más frecuente

            // ── ITERACIÓN FILA A FILA ──────────────────────────────
            rawData.forEach((row, rowIndex) => {
                if (!row || typeof row !== 'object') return;

                // ── FECHA ──
                let d = safeParseFecha(row[config.fecha]);

                if (!d) {
                    // Registrar aviso pero NO descartar — usar fecha de fallback
                    const keyRef = Object.keys(row).find(k => {
                        const ku = k.toUpperCase();
                        return ku.includes('REFNUM') || ku.includes('NUMERO') || ku.includes('EXP');
                    });
                    const refVal = keyRef ? safeStr(row[keyRef]) : "";
                    registrosSinFecha.push(
                        refVal ? `Fila ${rowIndex + 2} — REF: ${refVal}` : `Fila ${rowIndex + 2}`
                    );
                    d = new Date(FECHA_FALLBACK); // Usar fallback en lugar de descartar
                }

                // ── HORA (opcional) ──
                if (config.hora) safeApplyHora(d, row[config.hora]);

                // ── COORDENADAS (opcional) ──
                let lat = 0, lon = 0, tieneGeo = false;
                if (config.lat && config.lon) {
                    lat = safeFloat(row[config.lat]);
                    lon = safeFloat(row[config.lon]);
                    if (lat !== 0 && lon !== 0 && !isNaN(lat) && !isNaN(lon)) {
                        tieneGeo = true;
                    } else {
                        lat = 0; lon = 0;
                    }
                }

                // ── REGISTRO BASE ──
                const baseRow = {
                    exp:       safeStr(row[config.exp]) || "N/A",
                    date:      new Date(d),
                    year:      d.getFullYear(),
                    month:     d.getMonth() + 1,
                    hour:      d.getHours(),
                    lat,
                    lon,
                    hasGeo:    tieneGeo,
                    calle:     safeStr(row[config.calle]).toUpperCase() || "SIN CALLE / GPS",
                    locManual: config.locManual,
                    refnum:    safeStr(row['REFNUM']),
                    refanno:   safeStr(row['REFANNO'])
                };

                if (colFiltro1) baseRow[colFiltro1] = safeStr(row[colFiltro1]);
                if (colFiltro2) baseRow[colFiltro2] = safeStr(row[colFiltro2]);

                // ── PUSH ──
                if (useMultiColumn) {
                    columnsForCategories.forEach(colName => {
                        const numValue = Number(row[colName]);
                        if (!isNaN(numValue) && numValue > 0) {
                            for (let i = 0; i < numValue; i++) {
                                finalData.push({ ...baseRow, cat: safeStr(colName) || "General" });
                            }
                        }
                    });
                } else {
                    const catVal = safeStr(row[config.cat]);
                    if (!catVal) registrosSinCategoria++;
                    baseRow.cat = catVal || "General";
                    finalData.push(baseRow);
                }
            });

            // ── AVISO SI NO HAY DATOS ──
            if (finalData.length === 0) {
                alert("No se han encontrado registros para procesar. Verifica el archivo.");
                if (loadingEl) loadingEl.classList.remove('active');
                return;
            }

            // ── HORAS ──
            hasHourData = config.hora !== "" && finalData.some(d => d.hour !== 0);
            const hoursContainer = document.getElementById('container-hours');
            if (hoursContainer) hoursContainer.style.display = hasHourData ? 'flex' : 'none';

            // ── CAMBIO DE VISTA ──
            const mappingView   = document.getElementById('mapping-view');
            const dashboardView = document.getElementById('dashboard-view');
            if (mappingView)   mappingView.classList.remove('active');
            if (dashboardView) dashboardView.classList.add('active');
            window.scrollTo(0, 0);

            // ── MULTISELECT ──
            if (typeof FncMultiselect !== 'undefined') {
                const filtrosConfig = [colFiltro1, colFiltro2].filter(Boolean);
                FncMultiselect.setConfig(filtrosConfig);
            }

            setupFilters();
            initMap();

            setTimeout(() => {
                if (typeof map !== 'undefined' && map) map.resize();
                updateUI();
            }, 600);

            // ── MODAL DE AVISOS (fechas vacías / sin categoría) ──
            const listaAvisos = [];
            if (registrosSinFecha.length > 0) {
                listaAvisos.push(`⚠️ ${registrosSinFecha.length} registros sin fecha válida → asignados al 01/01/${fallbackYear}`);
                registrosSinFecha.forEach(r => listaAvisos.push(r));
            }
            if (registrosSinCategoria > 0) {
                listaAvisos.push(`⚠️ ${registrosSinCategoria} registros sin categoría → asignados a "General"`);
            }
            if (listaAvisos.length > 0) {
                showRejectedModal(listaAvisos);
            }

        } catch (err) {
            console.error("Error en procesamiento:", err);
            alert(`Error al generar el dashboard:\n${err.message}`);
        } finally {
            if (loadingEl) loadingEl.classList.remove('active');
        }
    }, 150);
}
