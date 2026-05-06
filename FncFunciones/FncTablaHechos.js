/**
 * EUROCOP ANALYTICS - FILTRO MOTIVOS (TablaHechos)
 * Árbol de motivos con diseño mejorado: jerarquía visual clara,
 * búsqueda con auto-selección, interacción fluida.
 */

const FncTablaHechos = (() => {

    let _tree               = [];
    let _selectedIds        = new Set();
    let _allIds             = new Set();
    let _active             = false;
    let _expanded           = new Set();
    let _searchTerm         = '';
    let _searchTimer        = null;
    let _totalRecords       = 0;   // total registros con motivo en el dataset actual
    let _selectedRecords    = 0;   // registros cubiertos por la selección actual
    let _idCountMap         = {};  // mapa ID→conteo para cálculo preciso

    const CONTAINER_ID = 'motivos-filter-group';
    const TREE_ID      = 'motivos-tree-content';
    const SEARCH_ID    = 'motivos-search-input';
    const LABEL_ID     = 'label-motivos';

    // ─── Paleta de colores por nivel de profundidad ──────────────────────
    const LEVEL_COLORS = ['#5e72e4','#11cdef','#2dce89','#fb6340','#f5365c'];
    const LEVEL_BG     = ['#eef0fd','#e6fbff','#e8fff5','#fff3ed','#fff0f3'];

    // ─── Init ────────────────────────────────────────────────────────────
    function init(finalData) {
        if (typeof TABLA_HECHOS_TREE === 'undefined') return;

        const idCounts = {};
        (finalData || []).forEach(row => {
            // nivel1id es el más específico (hoja del árbol), nivel3id el más genérico (raíz)
            // Tomamos el ID más específico disponible para que los conteos
            // se propaguen correctamente hacia los nodos padre a través de d[]
            let id = row.nivel1id || row.nivel2id || row.nivel3id;
            if (id) idCounts[id] = (idCounts[id] || 0) + 1;
        });

        if (!Object.keys(idCounts).length) { reset(); return; }

        _tree = _buildFilteredTree(TABLA_HECHOS_TREE, idCounts);
        _allIds.clear();
        _collectAllIds(_tree, _allIds);
        _selectedIds = new Set(_allIds);
        // Total de registros con motivo asignado
        _idCountMap      = {...idCounts};   // mapa ID→conteo para _recalcSelectedRecords
        _totalRecords    = Object.values(idCounts).reduce((s, v) => s + v, 0);
        _selectedRecords = _totalRecords;  // todo seleccionado por defecto
        const wasActive = _active;
        _active = _allIds.size > 0;
        _expanded.clear();
        _searchTerm = '';

        if (_active) {
            _ensureContainer();

            // No renderizamos aquí: el primer ciclo de updateUI llamará
            // updateCounts() con los datos ya filtrados por año/mes, que
            // reconstruirá el árbol correcto antes de mostrarlo.
            // Solo creamos el container para que esté listo.
        } else {
            _hideContainer();
        }
    }

    function _buildFilteredTree(nodes, idCounts) {
        const result = [];
        (nodes || []).forEach(node => {
            const count = (node.d || []).reduce((s, id) => s + (idCounts[id] || 0), 0);
            if (!count) return;
            result.push({
                l: node.l, i: node.i, d: node.d || [],
                n: count,
                c: _buildFilteredTree(node.c || [], idCounts),
            });
        });
        return result.sort((a, b) => b.n - a.n);
    }

    function _collectAllIds(nodes, set) {
        (nodes || []).forEach(n => {
            (n.d || []).forEach(id => set.add(id));
            if (n.c) _collectAllIds(n.c, set);
        });
    }

    /**
     * Recalcula los conteos del árbol usando los datos ya filtrados
     * por año/mes/categoría (llamado desde FncFiltros.updateUI).
     * NO cambia la selección del usuario — solo actualiza los números visibles.
     */
    function updateCounts(filteredData) {
        if (!_active) return;

        // Construir mapa ID→conteo con los datos ya filtrados por año/mes/cat
        const idCounts = {};
        (filteredData || []).forEach(row => {
            // nivel1id es el más específico (hoja del árbol), nivel3id el más genérico (raíz)
            let id = row.nivel1id || row.nivel2id || row.nivel3id;
            if (id) idCounts[id] = (idCounts[id] || 0) + 1;
        });

        // Actualizar conteos node.n en el árbol SIN reconstruirlo ni tocar _selectedIds
        // Esto preserva la selección parcial del usuario entre ciclos de filtrado
        function updateNodeCounts(node) {
            node.n = (node.d || []).reduce((s, id) => s + (idCounts[id] || 0), 0);
            (node.c || []).forEach(updateNodeCounts);
        }
        _tree.forEach(updateNodeCounts);

        // Actualizar totales y mapa de conteos
        _idCountMap   = {...idCounts};
        _totalRecords = Object.values(idCounts).reduce((s, v) => s + v, 0);
        _recalcSelectedRecords();

        _render();
        _updateStatus();
    }

    /**
     * Reconstruir el árbol eliminando nodos a 0 según los datos filtrados.
     * Solo se llama al cambiar de año/mes (desde FncFiltros, no desde el filtro de motivos).
     */
    function rebuildTree(filteredData) {
        if (!_active) return;
        const idCounts = {};
        (filteredData || []).forEach(row => {
            // nivel1id es el más específico (hoja del árbol), nivel3id el más genérico (raíz)
            let id = row.nivel1id || row.nivel2id || row.nivel3id;
            if (id) idCounts[id] = (idCounts[id] || 0) + 1;
        });

        // "Todo seleccionado" solo si había un árbol previo y la selección era completa
        // Si _allIds.size === 0 es la primera llamada: respetar _selectedIds tal como está
        const erasTodoSeleccionado = _allIds.size > 0 && _selectedIds.size === _allIds.size;
        const seleccionAnterior    = new Set(_selectedIds);

        _tree = _buildFilteredTree(TABLA_HECHOS_TREE, idCounts);
        const newAllIds = new Set();
        _collectAllIds(_tree, newAllIds);

        _selectedIds = erasTodoSeleccionado
            ? new Set(newAllIds)
            : new Set([...seleccionAnterior].filter(id => newAllIds.has(id)));
        _allIds = newAllIds;

        _idCountMap   = {...idCounts};
        _totalRecords = Object.values(idCounts).reduce((s, v) => s + v, 0);
        _recalcSelectedRecords();
        _render();
        _updateStatus();
    }

    // ─── Container HTML ──────────────────────────────────────────────────
    function _ensureContainer() {
        let el = document.getElementById(CONTAINER_ID);
        if (!el) {
            const catGroup = document.querySelector('#drop-category')?.closest('.filter-group');
            if (!catGroup) return;
            el = document.createElement('div');
            el.id = CONTAINER_ID;
            el.className = 'filter-group motivos-filter-group';
            catGroup.parentNode.insertBefore(el, catGroup);
        }
        el.style.display = 'block';
        el.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;">
                <span class="motivos-label" style="margin-bottom:0;cursor:default;user-select:none;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:5px;vertical-align:-1px;">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    MOTIVOS
                </span>
                <button id="motivos-size-btn" class="motivos-size-header-btn"
                    onclick="FncTablaHechos._toggleSize()"
                    title="Ampliar / Reducir">
                    <svg id="motivos-size-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <polyline points="9 21 3 21 3 15"></polyline>
                        <line x1="21" y1="3" x2="14" y2="10"></line>
                        <line x1="3" y1="21" x2="10" y2="14"></line>
                    </svg>
                    <span id="motivos-size-label">Ampliar</span>
                </button>
            </div>
            <div id="drop-motivos" class="motivos-dropdown">
                <!-- Header / pill de estado -->
                <div class="motivos-pill" onclick="FncTablaHechos._togglePanel(this)">
                    <span id="${LABEL_ID}" class="motivos-pill-label">Todos</span>
                    <span id="motivos-total-badge" class="motivos-pill-count"></span>
                    <svg class="motivos-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>

                <!-- Panel desplegable -->
                <div id="motivos-panel" class="motivos-panel" style="display:none;">

                    <!-- Buscador -->
                    <div class="motivos-search-wrap">
                        <svg class="motivos-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input id="${SEARCH_ID}" type="text" class="motivos-search-input"
                            placeholder="Buscar y filtrar…"
                            autocomplete="off"
                            oninput="FncTablaHechos._onSearch(this.value)">
                        <button id="motivos-clear-search" class="motivos-clear-btn"
                            onclick="FncTablaHechos._clearSearch()" style="display:none;" title="Limpiar búsqueda">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>

                    <!-- Toolbar -->
                    <div class="motivos-toolbar">
                        <button class="motivos-tb-btn" onclick="FncTablaHechos._selectAll()" title="Seleccionar todo">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            Todo
                        </button>
                        <button class="motivos-tb-btn motivos-tb-danger" onclick="FncTablaHechos._clearAll()" title="Deseleccionar todo">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            Ninguno
                        </button>
                        <span style="margin-left:auto;"></span>
                        <span id="motivos-sel-info" class="motivos-sel-info"></span>
                    </div>

                    <!-- Árbol -->
                    <div id="${TREE_ID}" class="motivos-tree-scroll"></div>
                    <!-- Handle resize vertical -->
                    <div class="motivos-resize-handle" id="motivos-resize-handle"
                        title="Arrastra para redimensionar"
                        onmousedown="FncTablaHechos._startResize(event)">
                        <div class="motivos-resize-dots">
                            <span></span><span></span><span></span>
                        </div>
                    </div>

                </div>
            </div>`;
    }

    function _hideContainer() {
        const el = document.getElementById(CONTAINER_ID);
        if (el) el.style.display = 'none';
    }

    // ─── Toggle panel ────────────────────────────────────────────────────
    function _togglePanel(pill) {
        const panel = document.getElementById('motivos-panel');
        if (!panel) return;
        const isOpen = panel.style.display !== 'none';
        // Cerrar otros dropdowns
        document.querySelectorAll('.dropdown-content').forEach(d => d.style.display = 'none');
        if (isOpen) {
            panel.style.display = 'none';
            pill.classList.remove('active');
        } else {
            panel.style.display = 'block';
            panel.classList.add('motivos-panel-open');
            pill.classList.add('active');
            document.getElementById(SEARCH_ID)?.focus();
        }
    }

    // ─── Render árbol ────────────────────────────────────────────────────
    function _render() {
        const container = document.getElementById(TREE_ID);
        if (!container) return;
        const term = _searchTerm.toLowerCase().trim();

        function buildNodes(nodes, depth) {
            if (!nodes || !nodes.length) return '';
            let html = '';
            nodes.forEach((node, idx) => {
                // Ocultar nodos sin registros en el período actual
                if (node.n === 0) return;

                const key = `${depth}_${idx}_${node.i || node.l.slice(0,6)}`;
                const hasChildren = node.c && node.c.length > 0;
                const matchesTerm = term && node.l.toLowerCase().includes(term);
                const childMatch  = term ? _childMatches(node, term) : true;
                if (term && !matchesTerm && !childMatch) return;

                const isExpanded = _expanded.has(key) || (term && childMatch);
                const leafIds = node.d && node.d.length ? node.d : (node.i ? [node.i] : []);
                const selCnt  = leafIds.filter(id => _selectedIds.has(id)).length;
                const allSel  = leafIds.length > 0 && selCnt === leafIds.length;
                const partial = selCnt > 0 && !allSel;
                const noneSel = selCnt === 0;

                const col   = LEVEL_COLORS[Math.min(depth, LEVEL_COLORS.length - 1)];
                const bg    = LEVEL_BG[Math.min(depth, LEVEL_BG.length - 1)];
                const idsJs = JSON.stringify(leafIds);

                const labelHtml = matchesTerm && term
                    ? node.l.replace(new RegExp(`(${_escRe(term)})`, 'gi'),
                        '<mark class="motivos-mark">$1</mark>')
                    : _escHtml(node.l);

                // Barra de profundidad izquierda
                const depthBar = depth > 0
                    ? `<div class="motivos-depth-line" style="border-color:${col}20;"></div>`
                    : '';

                html += `
                <div class="motivos-node-wrap" data-depth="${depth}">
                    ${depthBar}
                    <div class="motivos-node ${noneSel ? 'motivos-node--none' : ''}"
                        style="--node-depth:${depth};">

                        <!-- Expand arrow -->
                        <button class="motivos-arrow ${isExpanded ? 'expanded' : ''}"
                            onclick="FncTablaHechos._toggle('${key}', event)"
                            style="color:${col}; ${hasChildren ? '' : 'visibility:hidden;'}">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </button>

                        <!-- Checkbox custom -->
                        <button class="motivos-check ${allSel ? 'motivos-check--all' : partial ? 'motivos-check--partial' : 'motivos-check--none'}"
                            onclick="FncTablaHechos._toggleNode(${idsJs}, event)"
                            style="--check-color:${col};">
                            ${allSel
                                ? `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`
                                : partial
                                ? `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="3.5"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`
                                : ''}
                        </button>

                        <!-- Label -->
                        <span class="motivos-node-label" onclick="FncTablaHechos._toggleNode(${idsJs}, event)">
                            ${labelHtml}
                        </span>

                        <!-- Conteo badge -->
                        <span class="motivos-node-count"
                            style="--nc:${col};"
                            title="Ver registros de este nodo"
                            data-ids="${_escHtml(idsJs)}"
                            data-label="${_escHtml(node.l)}"
                            onclick="FncTablaHechos._showPreviewFromEl(this, event)">
                            ${node.n.toLocaleString('es')}
                        </span>
                    </div>
                    ${hasChildren && isExpanded ? `<div class="motivos-children">${buildNodes(node.c, depth + 1)}</div>` : ''}
                </div>`;
            });
            return html;
        }

        container.innerHTML = buildNodes(_tree, 0);
        _updateStatus();
    }

    function _childMatches(node, term) {
        if (node.l.toLowerCase().includes(term)) return true;
        return (node.c || []).some(c => _childMatches(c, term));
    }

    function _escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    function _escHtml(s) {
        return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // ─── Actualizar cabecera y estado ────────────────────────────────────
    function _updateStatus() {
        const selIds  = _selectedIds.size;
        const allIds  = _allIds.size;
        const selRec  = _selectedRecords;
        const allRec  = _totalRecords;
        const todoSel = selIds === allIds;
        const nadaSel = selIds === 0;

        // Pill label
        const lbl = document.getElementById(LABEL_ID);
        if (lbl) {
            if (todoSel)      lbl.textContent = 'Todos los motivos';
            else if (nadaSel) lbl.textContent = 'Ningún motivo';
            else              lbl.textContent = `${selIds.toLocaleString('es')} motivos`;
        }

        // Badge — siempre muestra el número de REGISTROS que cubre la selección
        // "Todo" → total de registros con motivo; "Parcial" → registros filtrados
        const badge = document.getElementById('motivos-total-badge');
        if (badge) {
            badge.textContent = nadaSel ? '0' : selRec.toLocaleString('es');
            badge.className   = 'motivos-pill-count' +
                (todoSel ? ' ok' : nadaSel ? ' none' : ' partial');
            badge.title = todoSel
                ? `${allRec.toLocaleString('es')} registros totales`
                : `${selRec.toLocaleString('es')} de ${allRec.toLocaleString('es')} registros`;
        }

        // Info toolbar — muestra reducción cuando hay filtro activo
        const info = document.getElementById('motivos-sel-info');
        if (info) {
            info.textContent = todoSel ? '' :
                nadaSel ? 'Sin datos' :
                `${selRec.toLocaleString('es')} / ${allRec.toLocaleString('es')}`;
        }
    }

    // ─── Interacciones ───────────────────────────────────────────────────
    function _toggle(key, e) {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        _expanded.has(key) ? _expanded.delete(key) : _expanded.add(key);
        _render();
    }

    function _toggleNode(ids, e) {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        const allSel = ids.length > 0 && ids.every(id => _selectedIds.has(id));
        ids.forEach(id => allSel ? _selectedIds.delete(id) : _selectedIds.add(id));
        _recalcSelectedRecords();
        _render();
        _onChange();
    }

    function _selectAll() {
        _selectedIds = new Set(_allIds);
        _selectedRecords = _totalRecords;
        _render();
        _onChange();
    }

    function _clearAll() {
        _selectedIds.clear();
        _selectedRecords = 0;
        _render();
        _onChange();
    }

    function _collapseAll() {
        _expanded.clear();
        _render();
    }

    // ─── Toggle: panel ocupa toda la sidebar (Ampliar / Reducir) ────────────
    const SIZE_SMALL = 310;
    let _sizeExpanded = false;

    function _toggleSize() {
        const tree = document.getElementById(TREE_ID);
        const icon = document.getElementById('motivos-size-icon');
        const lbl  = document.getElementById('motivos-size-label');
        const btn  = document.getElementById('motivos-size-btn');
        if (!tree) return;
        _sizeExpanded = !_sizeExpanded;

        // Todos los elementos de la sidebar a ocultar excepto MOTIVOS
        const targets = [
            document.querySelector('.sidebar-actions'),          // Exportar PDF
            document.querySelector('.filter-header'),             // FILTROS AVANZADOS
            document.querySelector('#drop-year')?.closest('.filter-group'),
            document.getElementById('filter-month-mode'),
            document.getElementById('filter-daymonth-mode'),
            document.getElementById('toggle-date-mode')?.parentElement,
            document.getElementById('filter-group-cats'),
            document.getElementById('dynamic-filters-container'),
            document.getElementById('sintesis-container'),
            document.querySelector('.sidebar-footer'),
        ].filter(Boolean);

        if (_sizeExpanded) {
            // 1. Ocultar con fade
            targets.forEach(el => {
                el._prevDisplay = el.style.display || '';
                el.style.transition = 'opacity .15s';
                el.style.opacity = '0';
                setTimeout(() => { el.style.display = 'none'; }, 150);
            });

            // 2. Tras el fade, calcular altura disponible real y asignarla al árbol
            setTimeout(() => {
                const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
                const treeEl  = document.getElementById(TREE_ID);
                if (!sidebar || !treeEl) return;
                const sidebarRect = sidebar.getBoundingClientRect();
                const treeRect    = treeEl.getBoundingClientRect();
                // Espacio desde la parte superior del árbol hasta el fondo de la sidebar
                // Restar: toolbar(38) + search(44) + handle(14) + padding(16) = 112px fijos sobre el árbol
                const panelRect   = document.getElementById('motivos-panel')?.getBoundingClientRect();
                const topOfPanel  = panelRect ? panelRect.top : treeRect.top - 112;
                const treeHeight  = Math.max(200, sidebarRect.bottom - topOfPanel - 112 - 10);
                tree.style.transition = 'max-height .3s ease';
                tree.style.maxHeight  = treeHeight + 'px';
            }, 160);

        } else {
            // Restaurar todos
            targets.forEach(el => {
                el.style.display = el._prevDisplay || '';
                requestAnimationFrame(() => {
                    el.style.transition = 'opacity .2s';
                    el.style.opacity = '1';
                });
            });
            tree.style.transition = 'max-height .25s ease';
            tree.style.maxHeight  = SIZE_SMALL + 'px';
        }

        if (icon) {
            icon.innerHTML = _sizeExpanded
                ? '<polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="10" y1="14" x2="21" y2="3"></line><line x1="3" y1="21" x2="14" y2="10"></line>'
                : '<polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>';
        }
        if (lbl) lbl.textContent = _sizeExpanded ? 'Reducir' : 'Ampliar';
        if (btn) btn.classList.toggle('active', _sizeExpanded);
    }

    function _onSearch(val) {
        _searchTerm = val;
        // Mostrar/ocultar botón clear
        const clearBtn = document.getElementById('motivos-clear-search');
        if (clearBtn) clearBtn.style.display = val ? 'flex' : 'none';

        clearTimeout(_searchTimer);
        _searchTimer = setTimeout(() => {
            _render();
            // Auto-seleccionar resultados de búsqueda
            if (val.trim()) {
                _autoSelectSearch(val.toLowerCase().trim());
            }
        }, 180);
    }

    function _clearSearch() {
        const inp = document.getElementById(SEARCH_ID);
        if (inp) { inp.value = ''; inp.focus(); }
        _searchTerm = '';
        const clearBtn = document.getElementById('motivos-clear-search');
        if (clearBtn) clearBtn.style.display = 'none';
        _render();
    }

    /** Selecciona automáticamente los nodos que hacen match con el término */
    function _autoSelectSearch(term) {
        const matchedIds = new Set();
        function collectMatching(nodes) {
            (nodes || []).forEach(node => {
                if (node.l.toLowerCase().includes(term)) {
                    // Seleccionar todos los IDs descendientes de este nodo
                    (node.d || []).forEach(id => matchedIds.add(id));
                }
                // Seguir buscando en hijos
                if (node.c) collectMatching(node.c);
            });
        }
        collectMatching(_tree);
        if (matchedIds.size > 0) {
            _selectedIds = matchedIds;
            _recalcSelectedRecords();
            _render();
            _onChange();
        }
    }

    // Recalcular cuántos registros cubre la selección actual
    // Estrategia directa: sumar _idCountMap[id] para cada ID seleccionado
    function _recalcSelectedRecords() {
        if (_selectedIds.size === _allIds.size) {
            // Todo seleccionado → total exacto de registros con motivo
            _selectedRecords = _totalRecords;
            return;
        }
        if (_selectedIds.size === 0) {
            _selectedRecords = 0;
            return;
        }
        // Selección parcial: sumar directamente desde el mapa de conteos
        let total = 0;
        _selectedIds.forEach(id => { total += (_idCountMap[id] || 0); });
        _selectedRecords = total;
    }

    function _onChange() {
        if (typeof triggerUpdateWithLoader === 'function') triggerUpdateWithLoader();
        else if (typeof updateUI === 'function') updateUI();
    }

    // ─── Resize vertical del árbol ───────────────────────────────────────
    let _resizeStartY = 0;
    let _resizeStartH = 0;

    function _startResize(e) {
        e.preventDefault();
        const tree = document.getElementById(TREE_ID);
        if (!tree) return;
        _resizeStartY = e.clientY;
        _resizeStartH = tree.offsetHeight;

        const onMove = (ev) => {
            const delta = ev.clientY - _resizeStartY;
            const newH  = Math.max(120, Math.min(700, _resizeStartH + delta));
            tree.style.maxHeight = newH + 'px';
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    // ─── Filtrado ────────────────────────────────────────────────────────
    function applyFilter(rows) {
        if (!_active) return rows;
        if (_selectedIds.size === _allIds.size) return rows;   // todo seleccionado → sin filtro
        if (_selectedIds.size === 0) return [];                // nada seleccionado → vacío
        return rows.filter(row => {
            // Usar el ID más específico disponible — igual que _idCountMap
            // nivel1id = más específico (hoja), nivel3id = más genérico (raíz)
            const id = row.nivel1id || row.nivel2id || row.nivel3id;
            // Sin ID: en selección parcial se excluyen (no pertenecen al árbol)
            if (!id) return false;
            return _selectedIds.has(id);
        });
    }

    // ─── Preview de registros al clicar en el badge de conteo ───────────
    function _showPreviewFromEl(el, e) {
        try {
            const ids   = JSON.parse(el.getAttribute('data-ids') || '[]');
            const label = el.getAttribute('data-label') || '';
            _showPreview(ids, label, e);
        } catch(err) { console.error('Preview parse error:', err); }
    }

    function _showPreview(ids, nodeLabel, e) {
        if (e) { e.stopPropagation(); e.preventDefault(); }

        // Obtener datos filtrados actualmente (los visibles en el dashboard)
        const source = (typeof lastFilteredData !== 'undefined' && lastFilteredData)
            ? lastFilteredData
            : (typeof finalData !== 'undefined' ? finalData : []);

        const idSet = new Set(ids);
        const rows  = source.filter(row => {
            const id = row.nivel1id || row.nivel2id || row.nivel3id;
            return id && idSet.has(id);
        });

        // Construir o reutilizar el panel
        let panel = document.getElementById('motivos-preview-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'motivos-preview-panel';
            panel.className = 'motivos-preview-panel';
            panel.innerHTML = `
                <div class="mpp-header">
                    <div class="mpp-title">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0">
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <span id="mpp-label">Registros</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;">
                        <span id="mpp-count" class="mpp-count-badge">0</span>
                        <button class="mpp-close" onclick="FncTablaHechos._closePreview()">✕</button>
                    </div>
                </div>
                <div id="mpp-body" class="mpp-body"></div>`;
            document.body.appendChild(panel);
        }

        // Rellenar contenido
        document.getElementById('mpp-label').textContent = nodeLabel;
        document.getElementById('mpp-count').textContent = rows.length.toLocaleString('es');

        const body = document.getElementById('mpp-body');

        if (rows.length === 0) {
            body.innerHTML = `<div class="mpp-empty">Sin registros visibles con los filtros actuales</div>`;
        } else {
            const rowsHtml = rows.map(r => {
                const ref  = (r.refanno && r.refnum) ? `REF: ${r.refanno}-${r.refnum}` : (r.refanno || r.refnum || '—');
                const fecha = r.date ? r.date.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—';
                const hora  = r.date ? r.date.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' }) : '';
                const calle = (r.calle && r.calle !== 'SIN CALLE / GPS') ? r.calle : '—';
                return `
                <div class="mpp-row">
                    <div class="mpp-row-ref">${ref}</div>
                    <div class="mpp-row-meta">
                        <span class="mpp-tag mpp-tag-date">📅 ${fecha}${hora ? ' · ' + hora : ''}</span>
                        ${calle !== '—' ? `<span class="mpp-tag mpp-tag-loc">📍 ${calle}</span>` : ''}
                    </div>
                </div>`;
            }).join('');
            body.innerHTML = `<div class="mpp-list">${rowsHtml}</div>`;
        }

        // Mostrar panel
        panel.classList.add('open');
    }

    function _closePreview() {
        const panel = document.getElementById('motivos-preview-panel');
        if (panel) panel.classList.remove('open');
    }

    function reset() {
        _active = false; _tree = [];
        _selectedIds.clear(); _allIds.clear();
        _hideContainer();
    }

    return {
        init, reset, applyFilter, updateCounts, rebuildTree,
        isActive: () => _active,
        _togglePanel, _toggle, _toggleNode,
        _selectAll, _clearAll, _collapseAll,
        _onSearch, _clearSearch, _startResize, _toggleSize,
        _showPreview, _closePreview, _showPreviewFromEl,
    };
})();
