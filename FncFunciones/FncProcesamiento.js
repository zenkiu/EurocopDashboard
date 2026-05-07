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

/** Convierte un valor numérico (posiblemente float como 62.0) a string entero limpio */
function _safeInt(val) {
    if (val === null || val === undefined || val === "") return "";
    const n = parseFloat(String(val));
    if (isNaN(n)) return safeStr(val);
    return String(Math.round(n));
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
    locManual: getVal('map-localidad'),
    suma:      getVal('map-suma'),
    sumaIsTime: false // Forzamos siempre a falso para evitar conversiones a Hh Mm
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
            let registrosSinCategoriaRefs = [];
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
                    const rNum  = _safeInt(row['REFNUM'])  || _safeInt(row['refnum'])  || "";
                    const rAnno = _safeInt(row['REFANNO']) || _safeInt(row['refanno']) || "";
                    const refLabel = (rNum && rAnno)
                        ? `REF: ${rAnno}-${rNum}`
                        : (rNum || rAnno)
                            ? `REF: ${rAnno || rNum}`
                            : "";
                    registrosSinFecha.push(
                        refLabel
                            ? `Fila ${rowIndex + 2} — ${refLabel}`
                            : `Fila ${rowIndex + 2}`
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
                // Si existe REFANNO válido, usarlo como año del registro
                // (ej: FECHA=30/12/2025 con REFANNO=2026 → pertenece a 2026)
                const refAnnoVal = parseInt(_safeInt(row['REFANNO']) || _safeInt(row['refanno']));
                const yearFromFecha = d.getFullYear();
                const recordYear = (!isNaN(refAnnoVal) && refAnnoVal > 1900)
                    ? refAnnoVal
                    : yearFromFecha;
                // Si el año de REFANNO difiere del año de la fecha, el mes real
                // pertenece al año anterior → usamos mes 1 para que encaje siempre
                // dentro del año de referencia al filtrar
                const recordMonth = (recordYear !== yearFromFecha)
                    ? 1
                    : d.getMonth() + 1;

                const baseRow = {
                    exp:       safeStr(row[config.exp]) || "N/A",
                    date:      new Date(d),
                    year:      recordYear,
                    month:     recordMonth,
                    hour:      d.getHours(),
                    lat,
                    lon,
                    hasGeo:    tieneGeo,
                    calle:     safeStr(row[config.calle]).toUpperCase() || "SIN CALLE / GPS",
                    locManual: config.locManual,
                    sumaVal:   config.suma ? (parseFloat(String(row[config.suma]).replace(',','.')) || 0) : null,
                    sumaIsTime: config.sumaIsTime || false,
                    refnum:    _safeInt(row['REFNUM']),
                    refanno:   _safeInt(row['REFANNO'])
                };

                if (colFiltro1) baseRow[colFiltro1] = safeStr(row[colFiltro1]);
                if (colFiltro2) baseRow[colFiltro2] = safeStr(row[colFiltro2]);

                // ── NIVEL IDs para filtro Motivos (TablaHechos) ──
                const n1 = row['NIVEL1ID'] != null ? parseInt(row['NIVEL1ID']) : null;
                const n2 = row['NIVEL2ID'] != null ? parseInt(row['NIVEL2ID']) : null;
                const n3 = row['NIVEL3ID'] != null ? parseInt(row['NIVEL3ID']) : null;
                if (!isNaN(n1) && n1 > 0) baseRow.nivel1id = n1;
                if (!isNaN(n2) && n2 > 0) baseRow.nivel2id = n2;
                if (!isNaN(n3) && n3 > 0) baseRow.nivel3id = n3;

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
                    if (!catVal) {
                        // Sin categoría → registrar aviso con REF y NO incluir en el dataset
                        const rNum  = _safeInt(row['REFNUM'])  || _safeInt(row['refnum'])  || "";
                        const rAnno = _safeInt(row['REFANNO']) || _safeInt(row['refanno']) || "";
                        const refLabel = (rNum && rAnno) ? `REF: ${rAnno}-${rNum}` : (rNum || rAnno ? `REF: ${rAnno || rNum}` : "");
                        registrosSinCategoria++;
                        registrosSinCategoriaRefs.push(
                            refLabel ? `Fila ${rowIndex + 2} — ${refLabel}` : `Fila ${rowIndex + 2}`
                        );
                        return; // saltar este registro
                    }
                    baseRow.cat = catVal;
                    finalData.push(baseRow);
                }
            });

            // ── AVISO SI NO HAY DATOS ──
            if (finalData.length === 0) {
                const _t3 = (typeof translations !== 'undefined' && translations[currentLang]) || {};
                const colCat = config.cat || "(sin columna)";
                const hint = registrosSinCategoria > 0
                    ? (_t3.err_no_records_cat || 'Todos los registros ({n}) tienen la columna "{col}" vacía.\nVerifica que has seleccionado la columna correcta en CATEGORÍA / TIPO.')
                        .replace('{n}', registrosSinCategoria).replace('{col}', colCat)
                    : (_t3.err_no_records || 'No se encontraron registros válidos. Verifica el archivo y el mapeo de columnas.');
                if (loadingEl) loadingEl.classList.remove('active');
                alert(hint);
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

            // ── FILTRO MOTIVOS: construir árbol desde los datos reales ──
            if (typeof FncTablaHechos !== 'undefined') {
                const hasNivelIds = finalData.some(r => r.nivel1id || r.nivel2id || r.nivel3id);
                // Mostrar botón TablaHechos solo si el archivo tiene NIVEL IDs
                if (typeof FncGestionTablaHechos !== 'undefined') {
                    FncGestionTablaHechos.mostrarBoton(hasNivelIds);
                }
                if (hasNivelIds) {
                    if (window.TABLA_HECHOS_TREE && window.TABLA_HECHOS_TREE.length) {
                        FncTablaHechos.init(finalData);
                    } else {
                        // Sin tabla cargada: resetear árbol y mostrar aviso
                        FncTablaHechos.reset();
                        if (typeof FncGestionTablaHechos !== 'undefined') {
                            FncGestionTablaHechos.mostrarAvisoSinTabla();
                        }
                    }
                } else {
                    FncTablaHechos.reset();
                }
            }

            initMap();

            setTimeout(() => {
                if (typeof map !== 'undefined' && map) map.resize();
                updateUI();
            }, 600);

            // ── MODAL DE AVISOS (fechas vacías / sin categoría) ──
            const listaAvisos = [];
            const _t2 = (typeof translations !== 'undefined' && translations[currentLang]) || {};
            if (registrosSinFecha.length > 0) {
                const msg = (_t2.warn_no_date || '{n} registros sin fecha válida → asignados al 01/01/{year}')
                    .replace('{n}', registrosSinFecha.length).replace('{year}', fallbackYear);
                listaAvisos.push(`⚠️ ${msg}`);
                registrosSinFecha.forEach(r => listaAvisos.push(r));
            }
            if (registrosSinCategoria > 0) {
                const msg = (_t2.warn_no_cat || '{n} registros sin categoría → excluidos del análisis')
                    .replace('{n}', registrosSinCategoria);
                listaAvisos.push(`⚠️ ${msg}`);
                registrosSinCategoriaRefs.forEach(r => listaAvisos.push(r));
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
