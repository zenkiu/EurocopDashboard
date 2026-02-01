/**
 * EUROCOP ANALYTICS - TABLAS DE DATOS
 * 4 tablas intercambiables con sus gráficos:
 *   1. Timeline (periodos × categorías)
 *   2. Categorías (cat, cantidad, %)
 *   3. Horas (hora, cantidad, %)
 *   4. Calles (nombre, cantidad) con doble-clic → mapa
 * Cada una tiene ordenamiento por columnas.
 */

// ============================================================
// 1. TABLA TIMELINE
// ============================================================
function toggleTimelineView() {
    isTableView = !isTableView;
    const btn    = document.querySelector('#btn-toggle-view i');
    const canvas = document.getElementById('chart-timeline');
    const table  = document.getElementById('table-timeline-view');

    canvas.style.display = isTableView ? 'none' : 'block';
    table.style.display  = isTableView ? 'block' : 'none';
    btn.className        = isTableView ? 'fa-solid fa-chart-column' : 'fa-solid fa-table';
    btn.parentElement.title = isTableView ? "Ver Gráfico" : "Ver Datos";

    if (isTableView) {
        currentSort = { col: 'index', dir: 'desc' };
        tableDataCache.sort((a, b) => b.index - a.index);
        renderTimelineTable();
    } else {
        setTimeout(() => { updateUI(); }, 50);
    }
}

function renderTimelineTable() {
    const c = document.getElementById('table-timeline-view');
    if (!tableDataCache || tableDataCache.length === 0) {
        c.innerHTML = '<p style="padding:20px; text-align:center; color:#888;">Sin datos</p>';
        return;
    }

    let categoryKeys = Object.keys(tableDataCache[0])
        .filter(k => k !== 'label' && k !== 'index' && k !== 'TOTAL')
        .sort();

    let html = `<table class="data-table"><thead><tr>
        <th onclick="sortTable('index')" style="cursor:pointer">PERIODO <i class="fa-solid fa-sort"></i></th>`;

    categoryKeys.forEach(k => {
        let displayName = k.length > 20 ? k.substring(0, 20) + '...' : k;
        html += `<th onclick="sortTable('${k}')" title="${k}" style="cursor:pointer">${displayName} <i class="fa-solid fa-sort"></i></th>`;
    });

    html += `<th onclick="sortTable('TOTAL')" style="cursor:pointer; color:#333;">TOTAL <i class="fa-solid fa-sort"></i></th>
        </tr></thead><tbody>`;

    tableDataCache.forEach(row => {
        html += `<tr><td>${row.label}</td>`;
        categoryKeys.forEach(k => {
            let val        = row[k] !== undefined ? row[k] : 0;
            let colorStyle = val === 0 ? 'color:#ccc;' : '';
            html += `<td style="${colorStyle}">${val.toLocaleString()}</td>`;
        });
        html += `<td>${(row['TOTAL'] || 0).toLocaleString()}</td></tr>`;
    });

    c.innerHTML = html + `</tbody></table>`;
    updateSortIcons(currentSort.col, '#table-timeline-view', currentSort);
}

function sortTable(column) {
    if (currentSort.col === column) currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
    else { currentSort.col = column; currentSort.dir = 'desc'; }

    tableDataCache.sort((a, b) => {
        let valA = a[column], valB = b[column];
        if (column === 'index') return currentSort.dir === 'asc' ? valA - valB : valB - valA;
        if (valA < valB) return currentSort.dir === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.dir === 'asc' ?  1 : -1;
        return 0;
    });
    renderTimelineTable();
}

// ============================================================
// 2. TABLA CATEGORÍAS
// ============================================================
function toggleCategoryView() {
    isTableCatView = !isTableCatView;
    const btn    = document.querySelector('#btn-toggle-view-cat i');
    const canvas = document.getElementById('chart-category');
    const table  = document.getElementById('table-category-view');

    canvas.style.display = isTableCatView ? 'none' : 'block';
    table.style.display  = isTableCatView ? 'block' : 'none';
    btn.className        = isTableCatView ? 'fa-solid fa-chart-pie' : 'fa-solid fa-table';
    btn.parentElement.title = isTableCatView ? "Ver Gráfico" : "Ver Datos";

    if (isTableCatView) renderCategoryTable();
    else setTimeout(() => { updateUI(); }, 50);
}

function renderCategoryTable() {
    const c = document.getElementById('table-category-view');
    if (!tableCatDataCache.length) {
        c.innerHTML = '<p style="padding:20px; text-align:center; color:#888;">Sin datos</p>';
        return;
    }

    let html = `<table class="data-table"><thead><tr>
        <th onclick="sortTableCategory('cat')">CAT <i class="fa-solid fa-sort"></i></th>
        <th onclick="sortTableCategory('count')">CANT <i class="fa-solid fa-sort"></i></th>
        <th onclick="sortTableCategory('percent')">% <i class="fa-solid fa-sort"></i></th>
    </tr></thead><tbody>`;

    tableCatDataCache.forEach(r => {
        html += `<tr><td>${r.cat}</td><td style="text-align:right;">${r.count}</td><td style="text-align:right;">${r.percent}%</td></tr>`;
    });

    c.innerHTML = html + `</tbody></table>`;
    updateSortIcons(currentSortCat.col, '#table-category-view', currentSortCat);
}

function sortTableCategory(col) {
    if (currentSortCat.col === col) currentSortCat.dir = currentSortCat.dir === 'asc' ? 'desc' : 'asc';
    else { currentSortCat.col = col; currentSortCat.dir = 'desc'; }

    tableCatDataCache.sort((a, b) => {
        let vA = a[col], vB = b[col];
        if (col === 'percent') { vA = parseFloat(vA); vB = parseFloat(vB); }
        return vA < vB ? (currentSortCat.dir === 'asc' ? -1 : 1) : 1;
    });
    renderCategoryTable();
}

// ============================================================
// 3. TABLA HORAS
// ============================================================
function toggleHoursView() {
    isTableHoursView = !isTableHoursView;
    const btn    = document.querySelector('#btn-toggle-view-hours i');
    const canvas = document.getElementById('chart-hours');
    const table  = document.getElementById('table-hours-view');

    canvas.style.display = isTableHoursView ? 'none' : 'block';
    table.style.display  = isTableHoursView ? 'block' : 'none';
    btn.className        = isTableHoursView ? 'fa-solid fa-chart-line' : 'fa-solid fa-table';
    btn.parentElement.title = isTableHoursView ? "Ver Gráfico" : "Ver Datos";

    if (isTableHoursView) renderHoursTable();
    else setTimeout(() => { updateUI(); }, 50);
}

function renderHoursTable() {
    const c = document.getElementById('table-hours-view');
    if (!tableHoursDataCache.length) {
        c.innerHTML = '<p style="padding:20px; text-align:center; color:#888;">Sin datos</p>';
        return;
    }

    let html = `<table class="data-table"><thead><tr>
        <th onclick="sortTableHours('hour')">HORA <i class="fa-solid fa-sort"></i></th>
        <th onclick="sortTableHours('count')">CANT <i class="fa-solid fa-sort"></i></th>
        <th onclick="sortTableHours('percent')">% <i class="fa-solid fa-sort"></i></th>
    </tr></thead><tbody>`;

    tableHoursDataCache.forEach(r => {
        html += `<tr><td>${r.hourLabel}</td><td style="text-align:right;">${r.count}</td><td style="text-align:right;">${r.percent}%</td></tr>`;
    });

    c.innerHTML = html + `</tbody></table>`;
    updateSortIcons(currentSortHours.col, '#table-hours-view', currentSortHours);
}

function sortTableHours(col) {
    if (currentSortHours.col === col) currentSortHours.dir = currentSortHours.dir === 'asc' ? 'desc' : 'asc';
    else { currentSortHours.col = col; currentSortHours.dir = 'asc'; }

    tableHoursDataCache.sort((a, b) => {
        let vA = a[col], vB = b[col];
        if (col === 'percent') { vA = parseFloat(vA); vB = parseFloat(vB); }
        return vA < vB ? (currentSortHours.dir === 'asc' ? -1 : 1) : 1;
    });
    renderHoursTable();
}

// ============================================================
// 4. TABLA CALLES
// ============================================================
function toggleStreetsView() {
    isTableStreetsView = !isTableStreetsView;
    const btn    = document.querySelector('#btn-toggle-streets i');
    const mapDiv = document.getElementById('main-map');
    const tableDiv = document.getElementById('table-streets-view');

    mapDiv.style.display   = isTableStreetsView ? 'none'  : 'block';
    tableDiv.style.display = isTableStreetsView ? 'block' : 'none';
    btn.className          = isTableStreetsView ? 'fa-solid fa-earth-americas' : 'fa-solid fa-list-ol';
    btn.parentElement.title = isTableStreetsView ? "Ver Mapa" : "Ver Listado de Calles";

    if (isTableStreetsView) updateUI();
}

function renderStreetsTable(data) {
    const container = document.getElementById('table-streets-view');
    if (!container) return;

    // Agrupar por calle
    const streetCounts = {};
    data.forEach(d => {
        let nombreCalle = d.calle || "SIN CALLE / GPS";
        streetCounts[nombreCalle] = (streetCounts[nombreCalle] || 0) + 1;
    });

    tableStreetsDataCache = Object.entries(streetCounts).map(([name, count]) => ({ name, count }));

    // Ordenar según estado actual
    tableStreetsDataCache.sort((a, b) => {
        let vA = a[currentSortStreets.col];
        let vB = b[currentSortStreets.col];
        if (currentSortStreets.dir === 'asc') return vA > vB ? 1 : -1;
        return vA < vB ? 1 : -1;
    });

    if (tableStreetsDataCache.length === 0) {
        container.innerHTML = '<p style="padding:20px; text-align:center; color:#888;">Sin datos disponibles</p>';
        return;
    }

    let html = `
        <table class="data-table">
            <thead><tr>
                <th onclick="sortTableStreets('name')" style="cursor:pointer; text-align:left;">CALLE <i class="fa-solid fa-sort"></i></th>
                <th onclick="sortTableStreets('count')" style="cursor:pointer; width:90px;">REG. <i class="fa-solid fa-sort"></i></th>
            </tr></thead>
            <tbody>`;

    tableStreetsDataCache.forEach(row => {
        const safeName = row.name.replace(/'/g, "\\'");
        html += `
            <tr onclick="focusStreetOnMap('${safeName}')"
                style="cursor:pointer;"
                title="Clic para situar en mapa">
                <td style="text-align:left; font-weight:600;">${row.name}</td>
                <td style="font-weight:800; color:var(--accent-blue); text-align:right;">${row.count.toLocaleString()}</td>
            </tr>`;
    });

    container.innerHTML = html + `</tbody></table>`;
    updateSortIcons(currentSortStreets.col, '#table-streets-view', currentSortStreets);
}

function sortTableStreets(col) {
    if (currentSortStreets.col === col) {
        currentSortStreets.dir = currentSortStreets.dir === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortStreets.col = col;
        currentSortStreets.dir = col === 'count' ? 'desc' : 'asc';
    }
    renderStreetsTable(lastFilteredData);
}
