/**
 * EUROCOP ANALYTICS - GESTIÓN DE MULTI-FILTROS DINÁMICOS
 * Versión final: Multiselect, Buscador, Iconos y Multidioma.
 */

const FncMultiselect = {
    activeFilters: {},      
    configuredColumns: [], 
    searchQueries: {},      
    searchTimeouts: {},     
    containerId: 'dynamic-filters-container',
    lastOpenedCol: null,    

    /**
     * Inicializa el contenedor en la sidebar.
     */
    init: function() {
        const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
        if (!sidebar) return;

        if (!document.getElementById(this.containerId)) {
            const container = document.createElement('div');
            container.id = this.containerId;
            container.className = 'dynamic-filters-section';
            
            const catFilter = document.getElementById('drop-category')?.closest('.filter-group');
            if (catFilter && catFilter.parentNode) {
                catFilter.parentNode.insertBefore(container, catFilter.nextSibling);
            } else {
                sidebar.appendChild(container);
            }
        }
    },

    /**
     * Configura qué columnas del Excel se usarán como filtros extra.
     */
    setConfig: function(columns) {
        this.configuredColumns = (columns || []).filter(c => c && c !== "" && c !== "null");
        this.activeFilters = {};
        this.searchQueries = {};
        
        this.configuredColumns.forEach(col => {
            this.activeFilters[col] = [];
            this.searchQueries[col] = "";
        });
    },

    /**
     * Filtra el dataset basándose en los arrays de selección.
     */
    applyFilters: function(data) {
        if (!data || this.configuredColumns.length === 0) return data;
        return data.filter(row => {
            for (const col of this.configuredColumns) {
                const selections = this.activeFilters[col] || [];
                if (selections.length > 0) {
                    const val = String(row[col] || "").trim();
                    if (!selections.includes(val)) return false;
                }
            }
            return true;
        });
    },

    /**
     * Dibuja los filtros en la barra lateral con buscador e iconos.
     */
    renderSidebarFilters: function(baseData) {
        this.init();
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.innerHTML = '';

        const lang = (typeof currentLang !== 'undefined') ? currentLang : 'es';
        const t = (typeof translations !== 'undefined' && translations[lang]) ? translations[lang] : {};
        
        const txtAll = t.sel_all || "Todos";
        const txtNone = t.sel_none || "Ninguno";
        const txtSearch = t.map_search_layers || "Buscar...";
        const txtFiltered = t.kpi_filtered || "Filtrados";

        if (this.configuredColumns.length === 0) return;

        // Título de la sección
        const header = document.createElement('div');
        header.className = 'filter-header';
        header.style.marginTop = '20px';
        header.innerHTML = `<i class="fa-solid fa-layer-group"></i> FILTROS EXTRA`;
        container.appendChild(header);

        this.configuredColumns.forEach((colName, index) => {
            const validOptions = this.getValidOptionsForColumn(colName, baseData);
            const selections = this.activeFilters[colName] || [];
            const currentSearch = this.searchQueries[colName] || "";
            
            const wrapper = document.createElement('div');
            wrapper.className = 'filter-group';
            
            let displayLabel = txtAll;
            if (selections.length === 1) displayLabel = selections[0];
            else if (selections.length > 1) displayLabel = `${selections.length} ${txtFiltered}`;

            const labelKey = `extra_filter_${index + 1}`;
            const labelTraducido = t[labelKey] || `FILTRO ${index + 1}`;

            wrapper.innerHTML = `
                <label>${labelTraducido}</label> 
                <div class="custom-dropdown" id="drop-dyn-${colName}">
                    <div class="dropdown-header ${this.lastOpenedCol === colName ? 'active' : ''}" 
                         onclick="FncMultiselect.toggleDropdown('${colName}')">
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; font-weight:${selections.length > 0 ? '800' : '400'}; color:${selections.length > 0 ? 'var(--accent-blue)' : 'inherit'}">
                            ${displayLabel}
                        </span>
                        <i class="fa-solid fa-chevron-down"></i>
                    </div>
                    <div id="list-dyn-${colName}" class="dropdown-content ${this.lastOpenedCol === colName ? 'active' : ''}">
                        
                        <!-- Buscador -->
                        <div style="padding: 10px 10px 5px 10px;">
                            <input type="text" 
                                   class="dropdown-search" 
                                   placeholder="${txtSearch}" 
                                   value="${currentSearch}"
                                   oninput="FncMultiselect.handleSearch('${colName}', this.value)"
                                   onclick="event.stopPropagation()"
                                   autocomplete="off">
                        </div>

                        <!-- Botones Control con Iconos -->
                        <div class="dropdown-controls" style="padding: 0 10px 8px 10px; display:flex; gap:5px;">
                            <button class="btn-mini" onclick="FncMultiselect.toggleAllInDyn('${colName}', true, event)" title="${txtAll}">
                                <i class="fa-solid fa-check-double"></i>
                            </button>
                            <button class="btn-mini" onclick="FncMultiselect.toggleAllInDyn('${colName}', false, event)" title="${txtNone}">
                                <i class="fa-solid fa-minus"></i>
                            </button>
                            <button class="btn-mini" onclick="FncMultiselect.clearSearchInDyn('${colName}', event)" title="Limpiar" style="margin-left: auto;">
                                <i class="fa-solid fa-broom"></i>
                            </button>
                        </div>

                        <div class="dropdown-items" style="max-height: 250px; overflow-y: auto;" id="items-dyn-${colName}">
                            ${validOptions.map(opt => {
                                const isChecked = selections.includes(opt);
                                const isVisible = currentSearch === "" || opt.toLowerCase().includes(currentSearch.toLowerCase());
                                return `
                                <div class="checkbox-item selectable" 
                                     data-value="${opt}" 
                                     style="display: ${isVisible ? 'flex' : 'none'}"
                                     onclick="FncMultiselect.selectOption('${colName}', '${opt}')">
                                    <i class="fa-regular ${isChecked ? 'fa-square-check' : 'fa-square'}" 
                                       style="color:${isChecked ? 'var(--accent-blue)' : '#8898aa'}; font-size:1.1rem"></i>
                                    <span style="${isChecked ? 'font-weight:700; color:var(--text-dark)' : ''}">${opt}</span>
                                </div>`;
                            }).join('')}
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(wrapper);
        });

        if (this.lastOpenedCol) {
            const input = document.querySelector(`#drop-dyn-${this.lastOpenedCol} .dropdown-search`);
            if (input) {
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
            }
        }
    },

    /**
     * Lógica de búsqueda con auto-selección (Debounce).
     */
    handleSearch: function(colName, query) {
        this.searchQueries[colName] = query;
        const container = document.getElementById(`items-dyn-${colName}`);
        if (!container) return;

        const items = container.querySelectorAll('.checkbox-item.selectable');
        const terms = query.toLowerCase().trim();

        items.forEach(div => {
            const val = div.getAttribute('data-value').toLowerCase();
            div.style.display = (terms === "" || val.includes(terms)) ? 'flex' : 'none';
        });

        clearTimeout(this.searchTimeouts[colName]);
        this.searchTimeouts[colName] = setTimeout(() => {
            if (terms !== "") {
                const newSelections = [];
                items.forEach(div => {
                    if (div.style.display !== 'none') newSelections.push(div.getAttribute('data-value'));
                });
                this.activeFilters[colName] = newSelections;
                if (typeof triggerUpdateWithLoader === 'function') triggerUpdateWithLoader();
            }
        }, 800); 
    },

    /**
     * Lógica de cascada: cada filtro ignora su propia selección para no reducirse.
     */
    getValidOptionsForColumn: function(targetCol, data) {
        if (!data) return [];
        const contextData = data.filter(row => {
            for (const col of this.configuredColumns) {
                if (col === targetCol) continue;
                const selections = this.activeFilters[col] || [];
                if (selections.length > 0) {
                    const val = String(row[col] || "").trim();
                    if (!selections.includes(val)) return false;
                }
            }
            return true;
        });
        const values = new Set();
        contextData.forEach(row => {
            const val = String(row[targetCol] || "").trim();
            if (val !== "" && val !== "null" && val !== "undefined") values.add(val);
        });
        return Array.from(values).sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
    },

    toggleDropdown: function(colName) {
        const id = `list-dyn-${colName}`;
        const el = document.getElementById(id);
        if (!el) return;
        const isOpening = !el.classList.contains('active');
        document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('active'));
        if (isOpening) {
            el.classList.add('active');
            this.lastOpenedCol = colName;
        } else {
            this.lastOpenedCol = null;
        }
    },

    selectOption: function(colName, value) {
        this.searchQueries[colName] = "";
        if (value === 'ALL') {
            this.activeFilters[colName] = [];
        } else {
            const index = this.activeFilters[colName].indexOf(value);
            if (index > -1) this.activeFilters[colName].splice(index, 1);
            else this.activeFilters[colName].push(value);
        }
        if (typeof triggerUpdateWithLoader === 'function') triggerUpdateWithLoader();
    },

    /**
     * Acción para botones de iconos: Marcar/Desmarcar todos.
     */
    toggleAllInDyn: function(colName, state, event) {
        if (event) event.stopPropagation();
        const container = document.getElementById(`items-dyn-${colName}`);
        if (!container) return;
        
        const newSelections = [];
        if (state) {
            const items = container.querySelectorAll('.checkbox-item.selectable');
            items.forEach(div => {
                if (div.style.display !== 'none') newSelections.push(div.getAttribute('data-value'));
            });
        }
        this.activeFilters[colName] = newSelections;
        if (typeof triggerUpdateWithLoader === 'function') triggerUpdateWithLoader();
    },

    /**
     * Acción para botón de icono: Limpiar búsqueda.
     */
    clearSearchInDyn: function(colName, event) {
        if (event) event.stopPropagation();
        this.searchQueries[colName] = "";
        // Forzamos redibujado usando los últimos datos filtrados globales
        const dataToUse = (typeof lastFilteredData !== 'undefined') ? lastFilteredData : [];
        this.renderSidebarFilters(dataToUse);
    }
};