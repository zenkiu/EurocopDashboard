/**
 * EUROCOP ANALYTICS - FILTROS Y updateUI
 * Genera los filtros (años, meses, categorías), buscador con debounce,
 * modo fecha día/mes, filtro espacial con Turf.js, y la función central updateUI
 * que orquesta KPIs + gráficos + mapa + MULTISELECT.
 */

// ============================================================
// INICIALIZAR FILTROS (tras procesar datos)
// ============================================================
function setupFilters() {
    // Protección contra datos vacíos
    if (!finalData || finalData.length === 0) return;

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
    if (!container) return;
    
    container.innerHTML = '';
    // Protección por si translations no está cargado aún
    const t = (typeof translations !== 'undefined' && translations[currentLang]) 
              ? translations[currentLang] 
              : (translations ? translations['es'] : {});

    items.forEach(item => {
        let val, label;
        if (typeof item === 'object') {
            val = item.id;
            // Si es mes, usamos la abreviatura, si no el nombre
            label = (containerId === 'items-month' && t.months_abbr) 
                    ? t.months_abbr[item.id - 1] 
                    : (item.name || item.id);
        } else {
            val = item;
            label = item;
        }

        const div = document.createElement('div');
        div.className = 'checkbox-item';
        // 'all' marca todo, si es un valor específico solo marca ese
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
    if (window._filterResetInProgress) return; // Bloquear durante reset masivo
    if (typeof stopHotspotTour === 'function') stopHotspotTour(); 
    runWithLoader(() => { updateUI(); });
}

// ============================================================
// TOGGLES DE DROPDOWN CUSTOM
// ============================================================
function toggleDropdown(id) {
    const el = document.getElementById(id);
    if (!el) return;
    
    const isActive = el.classList.contains('active');
    
    // Cerrar otros dropdowns activos
    document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('active'));

    if (!isActive) {
        el.classList.add('active');
        // Cálculo de altura disponible para scroll
        const rect = el.getBoundingClientRect();
        const spaceAvailable = window.innerHeight - rect.top - 50;
        const itemsCont = el.querySelector('.dropdown-items');
        if (itemsCont) {
            itemsCont.style.maxHeight = Math.max(150, spaceAvailable) + "px";
        }
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
// ============================================================
// NOTA: 'searchTimeout' debe estar declarado en FncGlobales.js
// Si no lo está, descomenta la siguiente línea:
// var searchTimeout; 

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
        if (typeof searchTimeout !== 'undefined') clearTimeout(searchTimeout);
        
        // Asignamos a window.searchTimeout o variable global implícita
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
// MODO DE FILTRO DE FECHAS (mes tradicional ↔ día/mes)
// ============================================================
function toggleDateFilterMode() {
    const t = translations[currentLang] || translations['es'];
    const monthModeDiv    = document.getElementById('filter-month-mode');
    const dayMonthModeDiv = document.getElementById('filter-daymonth-mode');
    const modeTextEl      = document.getElementById('date-mode-text');

    if (dateFilterMode === 'month') {
        dateFilterMode = 'daymonth';
        if(monthModeDiv) monthModeDiv.style.display    = 'none';
        if(dayMonthModeDiv) dayMonthModeDiv.style.display = 'block';
        if (modeTextEl) modeTextEl.textContent = t.btn_year_month_mode || 'Modo: Año / Mes';
        initializeDayMonthInputs();
    } else {
        dateFilterMode = 'month';
        if(monthModeDiv) monthModeDiv.style.display    = 'block';
        if(dayMonthModeDiv) dayMonthModeDiv.style.display = 'none';
        if (modeTextEl) modeTextEl.textContent = t.btn_date_range_mode || 'Modo: Desde - Hasta';

        // Resetear todos los filtros a "TODOS" — bloqueamos eventos durante el reset
        window._filterResetInProgress = true;
        try {
            document.querySelectorAll('#items-year input[type="checkbox"]').forEach(cb => { cb.checked = true; });
            const yearAllCb = document.getElementById('check-year-all');
            if (yearAllCb) yearAllCb.checked = true;

            document.querySelectorAll('#items-month input[type="checkbox"]').forEach(cb => { cb.checked = true; });
            const monthAllCb = document.getElementById('check-month-all');
            if (monthAllCb) monthAllCb.checked = true;

            document.querySelectorAll('#items-category input[type="checkbox"]').forEach(cb => { cb.checked = true; });
            const catAllCb = document.getElementById('check-category-all');
            if (catAllCb) catAllCb.checked = true;
        } finally {
            window._filterResetInProgress = false;
        }

        // Si estaba en vista Diario, cambiar a Años para evitar ralentización
        if (typeof temporalView !== 'undefined' && temporalView === 'daily') {
            const sel = document.getElementById('select-temporal-view');
            if (sel) sel.value = 'year';
            temporalView = 'year';
            if (typeof hideMeteoUI === 'function') hideMeteoUI();
        }
    }

    runWithLoader(() => { updateUI(); });
}

// ============================================================
// INICIALIZAR INPUTS DÍA/MES
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
    if(!input) return false;
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

function initValidacionDayMonth() {
    const from = document.getElementById('daymonth-from-input');
    const to   = document.getElementById('daymonth-to-input');

    // Solo validación visual — el filtro se aplica únicamente al pulsar "Aplicar filtro"
    if (from) {
        from.addEventListener('input', function () { validateDayMonthInput(this); });
        from.addEventListener('blur',  function () { validateDayMonthInput(this); });
    }
    if (to) {
        to.addEventListener('input', function () { validateDayMonthInput(this); });
        to.addEventListener('blur',  function () { validateDayMonthInput(this); });
    }
}

// ============================================================
// FILTRO ESPACIAL (Turf.js)
// ============================================================
function applySpatialFilter(data) {
    const chk = document.getElementById('chk-spatial-filter');
    const isFilterActive = chk && chk.checked;
    
    if (!isFilterActive) return data;
    if (typeof mapLayers === 'undefined' || !mapLayers || mapLayers.length === 0) return data;

    const activeLayers = mapLayers.filter(l => l.visible);
    if (activeLayers.length === 0) return [];

    // Verificar datos geométricos
    if (!activeLayers[0].geojson) {
        alert("⚠️ ERROR: La capa no tiene datos geométricos guardados.");
        return data;
    }

    // Preparar polígonos
    let activePolygons = [];
    try {
        activeLayers.forEach(layer => {
            let clone = JSON.parse(JSON.stringify(layer.geojson));
            if(typeof turf !== 'undefined') {
                clone = turf.truncate(clone, { precision: 6, coordinates: 2 });
                clone = turf.rewind(clone, { mutate: true });

                turf.flatten(clone).features.forEach(feature => {
                    if (feature.geometry &&
                        (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon")) {
                        activePolygons.push(feature);
                    }
                });
            }
        });
    } catch (e) {
        alert("❌ Error procesando el polígono: " + e.message);
        return data;
    }

    if (activePolygons.length === 0) {
        console.warn("La capa activa no contiene polígonos.");
        return data; 
    }

    // FILTRADO REAL
    const filtered = data.filter(point => {
        if (!point.hasGeo) return false;
        if (typeof turf === 'undefined') return true; // Si falla turf, devolvemos todo
        
        const pt = turf.point([point.lon, point.lat]);
        for (let poly of activePolygons) {
            if (turf.booleanPointInPolygon(pt, poly)) return true;
        }
        return false;
    });

    return filtered;
}

// ============================================================
// updateUI — FUNCIÓN CENTRAL (orquestadora)
// Calcula filtros → MULTISELECT → mapa → gráficos
// ============================================================
// ============================================================
// updateUI — FUNCIÓN CENTRAL (orquestadora)
// Calcula filtros → MULTISELECT → mapa → gráficos
// ============================================================
function updateUI() {
    // 1. SINCRONIZAR SELECTOR DE VISTA TEMPORAL
    const temporalSelect = document.getElementById('select-temporal-view');
    if (temporalSelect && typeof temporalView !== 'undefined') temporalSelect.value = temporalView;

    const t = translations[currentLang] || translations['es'];

    // HELPERS PARA ETIQUETAS
    const getValues = (containerId) => {
        return Array.from(document.querySelectorAll(`#${containerId} input:checked`)).map(i => i.value);
    };

    const getLabels = (containerId) => {
        const container = document.getElementById(containerId);
        if (!container) return "---";
        const allCount      = container.querySelectorAll('input').length;
        const checkedInputs = Array.from(container.querySelectorAll('input:checked'));
        const count         = checkedInputs.length;

        if (count === 0) return (t.sel_none || "NINGUNO").toUpperCase();
        if (count === allCount && allCount > 0) return (t.sel_all || "TODOS").toUpperCase();
        if (count === 1) return checkedInputs[0].nextElementSibling.innerText;
        return `${count} ${(currentLang === 'en' ? 'SELECTED' : 'SELECCIONADOS')}`;
    };

    // 2. OBTENER SELECCIONES DE FILTROS BÁSICOS
    const selYears = getValues('items-year').map(Number);
    let selMonths = [], dayMonthFrom, dayMonthTo;

    if (typeof dateFilterMode !== 'undefined' && dateFilterMode === 'daymonth') {
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

    if (typeof dateFilterMode !== 'undefined' && dateFilterMode === 'month') {
        setLabel('label-month',  getLabels('items-month'));
        setLabel('header-month', getLabels('items-month'));
    } else {
        const rangeText = `${dayMonthFrom} - ${dayMonthTo}`;
        setLabel('label-month',  rangeText);
        setLabel('header-month', rangeText);
    }

    setLabel('label-category',  getLabels('items-category'));
    setLabel('header-category', getLabels('items-category'));

    // 4. FILTRADO DE DATOS (Filtros Base: Año, Mes/Día, Categoría)
    let filtered;

    if (typeof dateFilterMode !== 'undefined' && dateFilterMode === 'daymonth') {
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

    // -----------------------------------------------------------------------
    // [MODIFICADO] APLICAR MULTI-FILTROS DINÁMICOS (Talde, Siglas...)
    // -----------------------------------------------------------------------
    if (typeof FncMultiselect !== 'undefined') {
        // 1. Guardamos una copia antes de filtrar por Multiselect para el render
        const baseDataForDropdowns = [...filtered];

        // 2. Filtramos los datos para los gráficos y mapa (aquí sí se reduce)
        filtered = FncMultiselect.applyFilters(filtered);

        // 3. Renderizamos la barra lateral usando los datos SIN reducir por sí mismos
        FncMultiselect.renderSidebarFilters(baseDataForDropdowns);
    }
    // -----------------------------------------------------------------------

    // 5. FILTRO ESPACIAL (si aplica)
    filtered = applySpatialFilter(filtered);

    // Guardar en caché global
    if (typeof lastFilteredData !== 'undefined') lastFilteredData = filtered;
    else window.lastFilteredData = filtered;

    // 6. ACTUALIZAR KPIs
    const elCount = document.getElementById('kpi-count');
    if(elCount) elCount.innerText = filtered.length.toLocaleString();
    
    const kpiTotal = document.getElementById('kpi-total-filas');
    if (kpiTotal) kpiTotal.innerHTML = `${filtered.length} <span data-i18n="kpi_reg">${t.kpi_reg || "REG"}</span>`;

    const textFilename = document.getElementById('card-text-filename');
    if (textFilename) textFilename.innerText = (typeof nombreArchivoSubido !== 'undefined' ? nombreArchivoSubido : "SIN ARCHIVO");

    // 7. ACTUALIZAR MAPA Y GRÁFICOS
    if (typeof updateMapData === 'function') updateMapData(filtered);
    if (typeof updateCharts === 'function') updateCharts(filtered, selYears);
    if (typeof updateLocationKPI === 'function') updateLocationKPI(filtered).catch(err => console.warn(err));

    // 8. TABLAS ESPECÍFICAS
    if (typeof isTableStreetsView !== 'undefined' && isTableStreetsView && typeof renderStreetsTable === 'function') {
        renderStreetsTable(filtered);
    }
    
    // Gestión visual de tablas vs gráficos
    if (typeof isTableView !== 'undefined' && isTableView) {
        if(document.getElementById('chart-timeline')) document.getElementById('chart-timeline').style.display = 'none';
        if(document.getElementById('table-timeline-view')) document.getElementById('table-timeline-view').style.display = 'block';
    }

    if (typeof isTableCatView !== 'undefined' && isTableCatView) {
        if(document.getElementById('chart-category')) document.getElementById('chart-category').style.display = 'none';
        if(document.getElementById('table-category-view')) document.getElementById('table-category-view').style.display = 'block';
    }

    if (typeof isTableHoursView !== 'undefined' && isTableHoursView) {
        if(document.getElementById('chart-hours')) document.getElementById('chart-hours').style.display = 'none';
        if(document.getElementById('table-hours-view')) document.getElementById('table-hours-view').style.display = 'block';
    }
}