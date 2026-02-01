/**
 * EUROCOP ANALYTICS - FILTROS Y updateUI
 * Genera los filtros (años, meses, categorías), buscador con debounce,
 * modo fecha día/mes, filtro espacial con Turf.js, y la función central updateUI
 * que orquesta KPIs + gráficos + mapa.
 */

// ============================================================
// INICIALIZAR FILTROS (tras procesar datos)
// ============================================================
function setupFilters() {
    const years = [...new Set(finalData.map(d => d.year))].sort((a, b) => b - a);
    const cats  = [...new Set(finalData.map(d => d.cat))].sort();

    renderCheckboxes('items-year',     years,         years[0]);
    renderCheckboxes('items-month',    monthsConfig,  'all');
    renderCheckboxes('items-category', cats,          'all');
}

// ============================================================
// RENDERIZAR CHECKBOXES DINÁMICOS
// ============================================================
function renderCheckboxes(containerId, items, defaultValue) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const t = translations[currentLang];

    items.forEach(item => {
        let val, label;
        if (typeof item === 'object') {
            val = item.id;
            label = (containerId === 'items-month') ? t.months_abbr[item.id - 1] : (item.name || item.id);
        } else {
            val = item;
            label = item;
        }

        const div = document.createElement('div');
        div.className = 'checkbox-item';
        const isChecked = (defaultValue === 'all' || val == defaultValue) ? 'checked' : '';
        div.innerHTML = `<input type="checkbox" value="${val}" ${isChecked} onchange="triggerUpdateWithLoader()"> <span>${label}</span>`;
        container.appendChild(div);
    });
}

// ============================================================
// ACTUALIZAR LABELS DE MESES (cuando cambia el idioma)
// ============================================================
function updateMonthLabels() {
    const container = document.getElementById('items-month');
    if (!container) return;

    const t = translations[currentLang];
    if (!t || !t.months_abbr) return;

    container.querySelectorAll('.checkbox-item').forEach(item => {
        const input = item.querySelector('input');
        const span  = item.querySelector('span');
        if (input && span) {
            const monthValue = parseInt(input.value);
            if (monthValue >= 1 && monthValue <= 12) {
                span.textContent = t.months_abbr[monthValue - 1];
            }
        }
    });
}

// ============================================================
// WRAPPER: triggerUpdateWithLoader
// ============================================================
function triggerUpdateWithLoader() {
    stopHotspotTour(); // <--- Detener el tour si se cambian filtros
    runWithLoader(() => { updateUI(); });
}

// ============================================================
// TOGGLES DE DROPDOWN CUSTOM
// ============================================================
function toggleDropdown(id) {
    const el = document.getElementById(id);
    const isActive = el.classList.contains('active');
    document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('active'));

    if (!isActive) {
        el.classList.add('active');
        const rect = el.getBoundingClientRect();
        const spaceAvailable = window.innerHeight - rect.top - 50;
        const itemsCont = el.querySelector('.dropdown-items');
        itemsCont.style.maxHeight = Math.max(150, spaceAvailable) + "px";
    }
}

// ============================================================
// TODOS / NINGUNO (respeta lo que está visible por búsqueda)
// ============================================================
function toggleGroup(containerId, state, event) {
    if (event) event.stopPropagation();

    runWithLoader(() => {
        const container = document.getElementById(containerId);
        if (container) {
            container.querySelectorAll('.checkbox-item').forEach(div => {
                // Solo actuar si el elemento es visible (respeta filtro de búsqueda)
                if (div.style.display !== 'none') {
                    const cb = div.querySelector('input');
                    if (cb) cb.checked = state;
                }
            });
            updateUI();
        }
    });
}

// ============================================================
// BUSCADOR DE CATEGORÍAS (multitérmino AND + debounce)
// Llamada desde el DOMContentLoaded central en script.js
// ============================================================
function initBuscadorCategorias() {
    const searchInput = document.getElementById('cat-search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', function (e) {
        const terms = e.target.value.toLowerCase().split(' ').map(t => t.trim()).filter(t => t.length > 0);
        const container = document.getElementById('items-category');
        if (!container) return;

        const items = container.querySelectorAll('.checkbox-item');

        // Filtrado visual instantáneo
        items.forEach(div => {
            const labelText = div.querySelector('span').textContent.toLowerCase();
            const isMatch = terms.every(term => labelText.includes(term));
            div.style.display = (terms.length === 0 || isMatch) ? 'flex' : 'none';
        });

        // Auto-selección con debounce (600ms)
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            if (terms.length > 0) {
                let hasChanges = false;
                items.forEach(div => {
                    const isVisible = div.style.display !== 'none';
                    const checkbox  = div.querySelector('input');
                    if (isVisible && !checkbox.checked)   { checkbox.checked = true;  hasChanges = true; }
                    else if (!isVisible && checkbox.checked) { checkbox.checked = false; hasChanges = true; }
                });
                if (hasChanges) triggerUpdateWithLoader();
            }
        }, 600);
    });
}

// ============================================================
// LIMPIAR BÚSQUEDA DE CATEGORÍAS
// ============================================================
function clearCategorySearch(event) {
    if (event) event.stopPropagation();

    const searchInput = document.getElementById('cat-search-input');
    const container   = document.getElementById('items-category');

    if (searchInput) {
        searchInput.value = '';
        if (container) {
            container.querySelectorAll('.checkbox-item').forEach(div => {
                div.style.display = 'flex';
            });
        }
    }
}

// ============================================================
// MODO DE FILTRO DE FECHAS (mes tradicional ↔ día/mes desde-hasta)
// ============================================================
function toggleDateFilterMode() {
    const t = translations[currentLang];
    const monthModeDiv    = document.getElementById('filter-month-mode');
    const dayMonthModeDiv = document.getElementById('filter-daymonth-mode');
    const modeTextEl      = document.getElementById('date-mode-text');

    if (dateFilterMode === 'month') {
        dateFilterMode = 'daymonth';
        monthModeDiv.style.display    = 'none';
        dayMonthModeDiv.style.display = 'block';
        if (modeTextEl) modeTextEl.textContent = t.btn_year_month_mode || 'Modo: Año / Mes';
        initializeDayMonthInputs();
    } else {
        dateFilterMode = 'month';
        monthModeDiv.style.display    = 'block';
        dayMonthModeDiv.style.display = 'none';
        if (modeTextEl) modeTextEl.textContent = t.btn_date_range_mode || 'Modo: Desde - Hasta';
    }

    runWithLoader(() => { updateUI(); });
}

// ============================================================
// INICIALIZAR INPUTS DÍA/MES con valores por defecto
// ============================================================
function initializeDayMonthInputs() {
    const from = document.getElementById('daymonth-from-input');
    const to   = document.getElementById('daymonth-to-input');
    if (from && !from.value) from.value = '01/01';
    if (to   && !to.value)   to.value   = '31/12';
}

// ============================================================
// VALIDAR INPUT DÍA/MES (formato DD/MM)
// ============================================================
function validateDayMonthInput(input) {
    let value = input.value.replace(/[^\d\/]/g, '');

    // Auto-agregar barra después de 2 dígitos
    if (value.length === 2 && !value.includes('/')) value += '/';
    input.value = value;

    if (value.length === 5) {
        const parts = value.split('/');
        if (parts.length === 2) {
            const day   = parseInt(parts[0]);
            const month = parseInt(parts[1]);
            if (day < 1 || day > 31 || month < 1 || month > 12) {
                input.style.borderColor = '#f5365c';
                return false;
            } else {
                input.style.borderColor = '#e2e8f0';
                return true;
            }
        }
    }
    return false;
}

// Conectar listeners de validación día/mes
// Llamada desde el DOMContentLoaded central en script.js
function initValidacionDayMonth() {
    const from = document.getElementById('daymonth-from-input');
    const to   = document.getElementById('daymonth-to-input');
    if (from) from.addEventListener('input', function () { validateDayMonthInput(this); });
    if (to)   to.addEventListener('input',   function () { validateDayMonthInput(this); });
}

// ============================================================
// FILTRO ESPACIAL (Turf.js)
// ============================================================
function applySpatialFilter(data) {
    const isFilterActive = document.getElementById('chk-spatial-filter')?.checked;
    if (!isFilterActive) return data;

    const activeLayers = mapLayers.filter(l => l.visible);
    if (activeLayers.length === 0) return [];

    // Verificar que las capas tienen datos geométricos
    if (!activeLayers[0].geojson) {
        alert("⚠️ ERROR: La capa no tiene datos geométricos guardados.");
        return data;
    }

    // Preparar polígonos con limpieza
    let activePolygons = [];
    try {
        activeLayers.forEach(layer => {
            let clone = JSON.parse(JSON.stringify(layer.geojson));
            clone = turf.truncate(clone, { precision: 6, coordinates: 2 });
            clone = turf.rewind(clone, { mutate: true });

            turf.flatten(clone).features.forEach(feature => {
                if (feature.geometry &&
                    (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon")) {
                    activePolygons.push(feature);
                }
            });
        });
    } catch (e) {
        alert("❌ Error procesando el polígono: " + e.message);
        return data;
    }

    if (activePolygons.length === 0) {
        alert("⚠️ La capa activa es una LÍNEA o PUNTO, no una ZONA CERRADA.\nNo se puede filtrar 'dentro' de una línea.");
        return data;
    }

    // Diagnóstico de coordenadas (una sola vez por sesión)
    const polyCoord = activePolygons[0].geometry.coordinates[0][0];
    const dataPoint = data.find(d => d.hasGeo);
    if (dataPoint && !window.hasShownDiagAlert) {
        const msg = `🔍 DIAGNÓSTICO DE COORDENADAS:\n\n` +
                    `📍 POLÍGONO (Zona): [${polyCoord[0].toFixed(3)}, ${polyCoord[1].toFixed(3)}]\n` +
                    `🚓 TUS DATOS (Punto): [${dataPoint.lon.toFixed(3)}, ${dataPoint.lat.toFixed(3)}]\n\n` +
                    `REGLA DE ORO:\nEspaña está en Longitud (X) negativa (-2.0) y Latitud (Y) positiva (43.0).\n\n` +
                    `Si tus datos muestran [43.0, -2.0] están AL REVÉS.`;
        console.log(msg);
        window.hasShownDiagAlert = true;
    }

    // FILTRADO REAL
    const filtered = data.filter(point => {
        if (!point.hasGeo) return false;
        const pt = turf.point([point.lon, point.lat]);
        for (let poly of activePolygons) {
            if (turf.booleanPointInPolygon(pt, poly)) return true;
        }
        return false;
    });

    // AUTO-CORRECCIÓN: si sale 0 resultados, intentar con coordenadas invertidas
    if (filtered.length === 0 && data.length > 0) {
        console.warn("Intento 1 falló. Probando inversión de coordenadas...");

        const invertedData = data.filter(point => {
            if (!point.hasGeo) return false;
            const pt = turf.point([point.lat, point.lon]); // INVERTIDO
            for (let poly of activePolygons) {
                if (turf.booleanPointInPolygon(pt, poly)) return true;
            }
            return false;
        });

        if (invertedData.length > 0) {
            if (!window.hasShownFixAlert) {
                alert("✅ ¡ARREGLADO!\n\nEl sistema detectó que tus coordenadas estaban invertidas y las ha corregido automáticamente para este filtro.");
                window.hasShownFixAlert = true;
            }
            return invertedData;
        }
    }

    return filtered;
}

// ============================================================
// updateUI — FUNCIÓN CENTRAL (orquestadora)
// Calcula filtros → KPIs → gráficos → mapa → tablas
// ============================================================
function updateUI() {
    // 1. SINCRONIZAR SELECTOR DE VISTA TEMPORAL
    const temporalSelect = document.getElementById('select-temporal-view');
    if (temporalSelect) temporalSelect.value = temporalView;

    const t = translations[currentLang];

    // HELPERS PARA ETIQUETAS
    const getValues = (containerId) => {
        return Array.from(document.querySelectorAll(`#${containerId} input:checked`)).map(i => i.value);
    };

    const getLabels = (containerId) => {
        const container = document.getElementById(containerId);
        if (!container) return "---";
        const allCount    = container.querySelectorAll('input').length;
        const checkedInputs = Array.from(container.querySelectorAll('input:checked'));
        const count       = checkedInputs.length;

        if (count === 0) return (t.sel_none || "NINGUNO").toUpperCase();
        if (count === allCount && allCount > 0) return (t.sel_all || "TODOS").toUpperCase();
        if (count === 1) return checkedInputs[0].nextElementSibling.innerText;
        return `${count} ${(currentLang === 'en' ? 'SELECTED' : 'SELECCIONADOS')}`;
    };

    // 2. OBTENER SELECCIONES ACTUALES
    const selYears = getValues('items-year').map(Number);
    let selMonths, dayMonthFrom, dayMonthTo;

    if (dateFilterMode === 'daymonth') {
        const fromInput = document.getElementById('daymonth-from-input');
        const toInput   = document.getElementById('daymonth-to-input');
        dayMonthFrom = fromInput && fromInput.value ? fromInput.value : '01/01';
        dayMonthTo   = toInput   && toInput.value   ? toInput.value   : '31/12';
        validateDayMonthInput(fromInput);
        validateDayMonthInput(toInput);
    } else {
        selMonths = getValues('items-month').map(Number);
    }

    const selCats = getValues('items-category');

    // 3. ACTUALIZAR ETIQUETAS HEADER/SIDEBAR
    const setLabel = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text; };

    setLabel('label-year',  getLabels('items-year'));
    setLabel('header-year', getLabels('items-year'));

    if (dateFilterMode === 'month') {
        setLabel('label-month',  getLabels('items-month'));
        setLabel('header-month', getLabels('items-month'));
    } else {
        const rangeText = `${dayMonthFrom} - ${dayMonthTo}`;
        setLabel('label-month',  rangeText);
        setLabel('header-month', rangeText);
    }

    setLabel('label-category',  getLabels('items-category'));
    setLabel('header-category', getLabels('items-category'));

    // 4. FILTRADO DE DATOS (CRÍTICO)
    let filtered;

    if (dateFilterMode === 'daymonth') {
        const parsesDayMonth = (dmString) => {
            const parts = dmString.split('/');
            return { day: parseInt(parts[0]), month: parseInt(parts[1]) };
        };
        const from = parsesDayMonth(dayMonthFrom);
        const to   = parsesDayMonth(dayMonthTo);

        filtered = finalData.filter(d => {
            if (!selYears.includes(d.year) || !selCats.includes(d.cat)) return false;

            const recordDay   = d.date.getDate();
            const recordMonth = d.date.getMonth() + 1;
            const recordDM    = recordMonth * 100 + recordDay;
            const fromDM      = from.month * 100 + from.day;
            const toDM        = to.month * 100 + to.day;

            // Rango normal o que cruza el año
            if (fromDM <= toDM) return recordDM >= fromDM && recordDM <= toDM;
            else                return recordDM >= fromDM || recordDM <= toDM;
        });
    } else {
        filtered = finalData.filter(d =>
            selYears.includes(d.year) &&
            selMonths.includes(d.month) &&
            selCats.includes(d.cat)
        );
    }

    // Aplicar filtro espacial si existe
    filtered = applySpatialFilter(filtered);

    // Guardar en caché global para re-ordenamientos y otros módulos
    lastFilteredData = filtered;

    // 5. ACTUALIZAR KPIs
    document.getElementById('kpi-count').innerText = filtered.length.toLocaleString();
    const kpiTotal = document.getElementById('kpi-total-filas');
    if (kpiTotal) kpiTotal.innerHTML = `${filtered.length} <span data-i18n="kpi_reg">${t.kpi_reg}</span>`;

    const textFilename = document.getElementById('card-text-filename');
    if (textFilename) textFilename.innerText = nombreArchivoSubido || "SIN ARCHIVO";

    // 6. ACTUALIZAR MAPA Y GRÁFICOS
    updateMapData(filtered);
    updateCharts(filtered, selYears);
    updateLocationKPI(filtered).catch(err => console.warn(err));

    // 7. TABLA DE CALLES (si está activa)
    if (isTableStreetsView) renderStreetsTable(filtered);
}
