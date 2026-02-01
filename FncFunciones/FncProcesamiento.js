/**
 * EUROCOP ANALYTICS - PROCESAMIENTO DE DATOS
 * Lectura de la configuración de mapeo, parseo de fechas/horas/coordenadas,
 * modo multi-columna y transición al dashboard.
 * Se conecta al botón #btn-visualizar desde initProcesamiento().
 */

// ============================================================
// CONECTAR BOTÓN "VISUALIZAR"
// Llamada desde el DOMContentLoaded central en script.js
// ============================================================
function initProcesamiento() {
    const btn = document.getElementById('btn-visualizar');
    if (btn) btn.onclick = generarDashboard;
}

// ============================================================
// FUNCIÓN PRINCIPAL: GENERAR DASHBOARD
// ============================================================
function generarDashboard() {
    // 1. VALIDACIÓN INICIAL Y CAPTURA DE CONFIGURACIÓN
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

    if (!config.fecha) {
        alert("Por favor, selecciona al menos la columna de FECHA.");
        return;
    }

    // 2. MOSTRAR PANTALLA DE CARGA
    document.getElementById('loading-overlay').classList.add('active');

    // Pequeño delay para que el navegador pinte el spinner
    setTimeout(() => {
        try {
            let registrosSinFecha = [];
            finalData = [];

            // 3. VERIFICAR SI SE USARÁ MODO MULTI-COLUMNA
            const useMultiColumn = (config.cat === "***MULTI_COLUMN***");
            let columnsForCategories = [];

            if (useMultiColumn) {
                const headers = Object.keys(rawData[0]);
                const mappedColumns = [config.exp, config.fecha, config.hora, config.lat, config.lon, config.calle].filter(v => v);

                columnsForCategories = headers.filter(h => {
                    if (mappedColumns.includes(h)) return false;
                    // Solo columnas con al menos un valor numérico > 0
                    return rawData.some(row => {
                        const val = row[h];
                        return val !== "" && val !== null && val !== undefined && !isNaN(Number(val)) && Number(val) > 0;
                    });
                });
            }

            // 4. PROCESAMIENTO ROW BY ROW
            rawData.forEach(row => {
                let valFecha = row[config.fecha];
                let d;

                // --- PARSEO DE FECHA ---
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

                // Fecha inválida → guardar para modal de errores
                if (isNaN(d.getTime())) {
                    const keyNum = Object.keys(row).find(k =>
                        k.toUpperCase().includes('REFNUM') || k.toUpperCase().includes('NUMERO')
                    );
                    registrosSinFecha.push(`REF: ${row[keyNum] || 'S/N'}`);
                    return;
                }

                // --- PARSEO DE HORA ---
                if (config.hora && row[config.hora]) {
                    const t = String(row[config.hora]).trim();
                    if (t.includes(':')) {
                        const p = t.split(':');
                        d.setHours(parseInt(p[0]) || 0, parseInt(p[1]) || 0, 0);
                    }
                }

                // --- PARSEO DE COORDENADAS ---
                let lat = 0, lon = 0, tieneGeo = false;
                if (config.lat && config.lon && row[config.lat] && row[config.lon]) {
                    lat = parseFloat(String(row[config.lat]).replace(',', '.'));
                    lon = parseFloat(String(row[config.lon]).replace(',', '.'));
                    if (!isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0)) {
                        tieneGeo = true;
                    }
                }

                // --- MODO MULTI-COLUMNA ---
                if (useMultiColumn) {
                    columnsForCategories.forEach(colName => {
                        const numValue = Number(row[colName]);
                        if (!isNaN(numValue) && numValue > 0) {
                            for (let i = 0; i < numValue; i++) {
                                finalData.push({
                                    exp:       row[config.exp] || "N/A",
                                    date:      new Date(d),
                                    year:      d.getFullYear(),
                                    month:     d.getMonth() + 1,
                                    hour:      d.getHours(),
                                    lat, lon,
                                    hasGeo:    tieneGeo,
                                    cat:       colName,
                                    calle:     row[config.calle] ? String(row[config.calle]).toUpperCase().trim() : "SIN CALLE / GPS",
                                    locManual: config.locManual,
                                    refnum:    row['REFNUM'] || "",
                                    refanno:   row['REFANNO'] || ""
                                });
                            }
                        }
                    });
                } else {
                    // --- MODO NORMAL ---
                    finalData.push({
                        exp:       row[config.exp] || "N/A",
                        date:      d,
                        year:      d.getFullYear(),
                        month:     d.getMonth() + 1,
                        hour:      d.getHours(),
                        lat, lon,
                        hasGeo:    tieneGeo,
                        cat:       row[config.cat] || "General",
                        calle:     row[config.calle] ? String(row[config.calle]).toUpperCase().trim() : "SIN CALLE / GPS",
                        locManual: config.locManual,
                        refnum:    row['REFNUM'] || "",
                        refanno:   row['REFANNO'] || ""
                    });
                }
            });

            // 5. DETECTAR SI HAY DATOS DE HORA VÁLIDOS
            hasHourData = config.hora && config.hora !== "" && finalData.some(d => d.hour !== 0);

            const hoursContainer = document.getElementById('container-hours');
            if (hoursContainer) {
                hoursContainer.style.display = hasHourData ? 'flex' : 'none';
            }

            // 6. TRANSICIÓN DE VISTAS
            document.getElementById('mapping-view').classList.remove('active');
            document.getElementById('dashboard-view').classList.add('active');
            window.scrollTo(0, 0);

            // 7. INICIALIZAR COMPONENTES
            setupFilters();
            initMap();

            // 8. FIX CRÍTICO: esperar a que la animación termine para que el mapa detecte su tamaño
            setTimeout(() => {
                if (map) map.resize();
                updateUI();
            }, 600);

            // 9. MOSTRAR ERRORES DE FECHA si existen
            if (registrosSinFecha.length > 0) {
                showRejectedModal(registrosSinFecha);
            }

        } catch (err) {
            console.error("Error en procesamiento:", err);
            alert("Hubo un error al generar el dashboard. Revisa el formato de tus datos.");
        } finally {
            document.getElementById('loading-overlay').classList.remove('active');
        }
    }, 150);
}
