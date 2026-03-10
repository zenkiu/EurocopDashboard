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

    // Mostrar/ocultar botones de exportación
    const btnPdf  = document.getElementById('btn-export-streets-pdf');
    const btnDocx = document.getElementById('btn-export-streets-docx');
    if (btnPdf)  btnPdf.style.display  = isTableStreetsView ? 'inline-flex' : 'none';
    if (btnDocx) btnDocx.style.display = isTableStreetsView ? 'inline-flex' : 'none';

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

    // Eliminar prefijo tipo "PORTAL:", "VIA:", "CL:", etc. — mostrar solo lo que va después de ":"
    function limpiarNombreCalle(nombre) {
        if (!nombre || nombre === "SIN CALLE / GPS") return nombre;
        const idx = nombre.indexOf(':');
        if (idx !== -1 && idx < nombre.length - 1) return nombre.substring(idx + 1).trim();
        return nombre;
    }

    tableStreetsDataCache = Object.entries(streetCounts).map(([name, count]) => ({
        name,
        displayName: limpiarNombreCalle(name),
        count
    }));

    // Ordenar según estado actual
    tableStreetsDataCache.sort((a, b) => {
        // Ordenar por displayName cuando la columna es 'name' para ignorar el prefijo original
        let vA = currentSortStreets.col === 'name' ? (a.displayName || a.name) : a[currentSortStreets.col];
        let vB = currentSortStreets.col === 'name' ? (b.displayName || b.name) : b[currentSortStreets.col];
        if (currentSortStreets.dir === 'asc') return vA > vB ? 1 : -1;
        return vA < vB ? 1 : -1;
    });

    if (tableStreetsDataCache.length === 0) {
        container.innerHTML = '<p style="padding:20px; text-align:center; color:#888;">Sin datos disponibles</p>';
        return;
    }

    // ── Nombre base: quitar número de portal (todo tras la última ", <dígitos>")
    function nombreBase(displayName) {
        if (!displayName || displayName === "SIN CALLE / GPS") return displayName;
        // Agrupar por: NOMBRE (TIPO) — todo hasta el primer espacio tras el paréntesis de cierre
        const m = displayName.match(/^(.+?\([^)]+\))/);
        if (m) return m[1].trim();
        // Sin paréntesis: quedarse solo con el texto antes del primer número o coma
        return displayName.split(/[,\d]/)[0].trim() || displayName;
    }

    tableStreetsDataCache.forEach(row => {
        row.streetBase = nombreBase(row.displayName);
    });

    let html = `
        <table class="data-table">
            <thead><tr>
                <th onclick="sortTableStreets('name')" style="cursor:pointer; text-align:left;">CALLE <i class="fa-solid fa-sort"></i></th>
                <th onclick="sortTableStreets('count')" style="cursor:pointer; width:90px;">REG. <i class="fa-solid fa-sort"></i></th>
            </tr></thead>
            <tbody>`;

    // Subtotales solo cuando se ordena por nombre (agrupación tiene sentido)
    const mostrarSubtotales = currentSortStreets.col === 'name';

    let grupoActual    = null;
    let totalGrupo     = 0;
    const filasPend    = [];

    function flushGrupo() {
        if (grupoActual === null) return;
        html += `
            <tr style="background:linear-gradient(90deg,#eef0ff,#f5f6ff); border-top:2px solid #c5caf0; border-bottom:2px solid #c5caf0;">
                <td style="text-align:left; font-weight:800; color:#3d4db7; font-size:0.78rem; padding-left:14px;">
                    <i class="fa-solid fa-layer-group" style="font-size:0.68rem; margin-right:5px; opacity:0.7;"></i>
                    ${(typeof translations !== 'undefined' && translations[currentLang]) ? translations[currentLang]['streets_report_subtotal'] : 'SUBTOTAL'} &nbsp;·&nbsp; ${grupoActual}
                </td>
                <td style="font-weight:900; color:#3d4db7; text-align:right; font-size:0.85rem;">${totalGrupo.toLocaleString()}</td>
            </tr>`;
        filasPend.forEach(f => { html += f; });
        grupoActual = null;
        totalGrupo  = 0;
        filasPend.length = 0;
    }

    tableStreetsDataCache.forEach(row => {
        const safeName = row.name.replace(/'/g, "\\'");
        const indent   = mostrarSubtotales ? '24px' : '8px';
        const fila = `
            <tr onclick="focusStreetOnMap('${safeName}')"
                style="cursor:pointer;"
                title="Clic para situar en mapa">
                <td style="text-align:left; font-weight:600; padding-left:${indent};">${row.displayName}</td>
                <td style="font-weight:800; color:var(--accent-blue); text-align:right;">${row.count.toLocaleString()}</td>
            </tr>`;

        if (mostrarSubtotales) {
            if (row.streetBase !== grupoActual) {
                flushGrupo();
                grupoActual = row.streetBase;
            }
            totalGrupo += row.count;
            filasPend.push(fila);
        } else {
            html += fila;
        }
    });

    if (mostrarSubtotales) flushGrupo();

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

// ============================================================
// EXPORTACIÓN CALLES — PDF
// ============================================================
function exportStreetsToPdf() {
    if (!tableStreetsDataCache || tableStreetsDataCache.length === 0) {
        showToast('Sin datos de calles para exportar.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Helper de traducción
    const T = (key) => (typeof translations !== 'undefined' && translations[currentLang] && translations[currentLang][key]) ? translations[currentLang][key] : translations['es'][key];

    const titulo    = nombreArchivoSubido || 'EUROCOP ANALYTICS';
    const fecha     = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const total     = tableStreetsDataCache.reduce((s, r) => s + r.count, 0);
    const pageW     = doc.internal.pageSize.getWidth();
    const pageH     = doc.internal.pageSize.getHeight();
    const marginL   = 15;
    const marginR   = 15;
    const contentW  = pageW - marginL - marginR;

    // ── Cabecera ──
    doc.setFillColor(94, 114, 228);
    doc.rect(0, 0, pageW, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('EUROCOP ANALYTICS', marginL, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(T('streets_report_title'), marginL, 19);
    doc.text(fecha, pageW - marginR, 12, { align: 'right' });
    doc.text(titulo, pageW - marginR, 19, { align: 'right' });

    // ── Subtítulo / Resumen ──
    doc.setTextColor(50, 50, 80);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${T('streets_report_total')}: ${total.toLocaleString('es-ES')}   ·   ${T('streets_report_unique')}: ${tableStreetsDataCache.length.toLocaleString('es-ES')}`, marginL, 35);

    // ── Cabecera de tabla ──
    let y = 41;
    const rowH    = 7;
    const colWName = contentW - 25;
    const colWReg  = 25;

    doc.setFillColor(240, 242, 255);
    doc.rect(marginL, y, contentW, rowH, 'F');
    doc.setDrawColor(200, 205, 230);
    doc.rect(marginL, y, contentW, rowH, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(94, 114, 228);
    doc.text(T('streets_report_col_street'), marginL + 3, y + 4.8);
    doc.text(T('streets_report_col_reg'), marginL + colWName + colWReg - 3, y + 4.8, { align: 'right' });

    y += rowH;

    // ── Función helper: nueva página con cabecera ──
    function nuevaPaginaPDF() {
        doc.addPage();
        doc.setFillColor(94, 114, 228);
        doc.rect(0, 0, pageW, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text('EUROCOP ANALYTICS · ' + T('streets_report_title') + ' (cont.)', marginL, 7);
        y = 16;
        doc.setFillColor(240, 242, 255);
        doc.rect(marginL, y, contentW, rowH, 'F');
        doc.setDrawColor(200, 205, 230);
        doc.rect(marginL, y, contentW, rowH, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(94, 114, 228);
        doc.text(T('streets_report_col_street'), marginL + 3, y + 4.8);
        doc.text(T('streets_report_col_reg'), marginL + colWName + colWReg - 3, y + 4.8, { align: 'right' });
        y += rowH;
    }

    // ── Filas con subtotales agrupados por nombre base ──
    function nombreBasePDF(dn) {
        if (!dn || dn === 'SIN CALLE / GPS') return dn;
        const m = dn.match(/^(.+?\([^)]+\))/);
        if (m) return m[1].trim();
        return dn.split(/[,\d]/)[0].trim() || dn;
    }

    // Preparar lista con filas de subtotal intercaladas
    const rowsConSubtotal = [];
    let grupoBase = null, grupoTotal = 0, grupoFilas = [];

    function pushGrupoPDF() {
        if (grupoBase === null) return;
        rowsConSubtotal.push({ tipo: 'subtotal', label: grupoBase, count: grupoTotal });
        grupoFilas.forEach(r => rowsConSubtotal.push({ tipo: 'fila', row: r }));
        grupoBase = null; grupoTotal = 0; grupoFilas = [];
    }

    tableStreetsDataCache.forEach(row => {
        const base = nombreBasePDF(row.displayName || row.name);
        if (base !== grupoBase) { pushGrupoPDF(); grupoBase = base; }
        grupoTotal += row.count;
        grupoFilas.push(row);
    });
    pushGrupoPDF();

    let odd = false;

    rowsConSubtotal.forEach(item => {
        if (y + rowH > pageH - 15) nuevaPaginaPDF();

        if (item.tipo === 'subtotal') {
            // Fila de subtotal
            const subH = rowH + 1;
            doc.setFillColor(224, 228, 252);
            doc.rect(marginL, y, contentW, subH, 'F');
            // Barra izquierda de acento
            doc.setFillColor(61, 77, 183);
            doc.rect(marginL, y, 2, subH, 'F');
            doc.setDrawColor(180, 188, 235);
            doc.rect(marginL, y, contentW, subH, 'S');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(61, 77, 183);
            const label = item.label.length > 60 ? item.label.substring(0, 57) + '...' : item.label;
            doc.text(T('streets_report_subtotal') + '  ' + label, marginL + 5, y + 5.2);
            doc.text(item.count.toLocaleString('es-ES'), marginL + colWName + colWReg - 3, y + 5.2, { align: 'right' });
            y += subH;
            odd = false;
        } else {
            // Fila normal
            odd = !odd;
            if (odd) { doc.setFillColor(248, 249, 255); doc.rect(marginL, y, contentW, rowH, 'F'); }
            doc.setDrawColor(230, 232, 242);
            doc.line(marginL, y + rowH, marginL + contentW, y + rowH);
            doc.setTextColor(50, 50, 80);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            const dispName = item.row.displayName || item.row.name;
            const nombreCorto = dispName.length > 66 ? dispName.substring(0, 63) + '...' : dispName;
            doc.text(nombreCorto, marginL + 6, y + 4.8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(94, 114, 228);
            doc.text(item.row.count.toLocaleString('es-ES'), marginL + colWName + colWReg - 3, y + 4.8, { align: 'right' });
            y += rowH;
        }
    });

    // ── Footer ──
    const totalPags = doc.getNumberOfPages();
    for (let p = 1; p <= totalPags; p++) {
        doc.setPage(p);
        doc.setFillColor(240, 242, 255);
        doc.rect(0, pageH - 10, pageW, 10, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(130, 130, 160);
        doc.text(T('streets_report_footer'), marginL, pageH - 3.5);
        doc.text(`${T('streets_report_page')} ${p} / ${totalPags}`, pageW - marginR, pageH - 3.5, { align: 'right' });
    }

    const nombreArchivo = (nombreArchivoSubido || 'calles').replace(/[^a-zA-Z0-9_\-]/g, '_');
    doc.save(`${nombreArchivo}_calles.pdf`);
}

// ============================================================
// EXPORTACIÓN CALLES — DOCX
// ============================================================
function exportStreetsToDocx() {
    if (!tableStreetsDataCache || tableStreetsDataCache.length === 0) {
        showToast('Sin datos de calles para exportar.');
        return;
    }

    const titulo  = nombreArchivoSubido || 'EUROCOP ANALYTICS';
    const fecha   = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const total   = tableStreetsDataCache.reduce((s, r) => s + r.count, 0);
    // Helper de traducción
    const T = (key) => (typeof translations !== 'undefined' && translations[currentLang] && translations[currentLang][key]) ? translations[currentLang][key] : translations['es'][key];

    // Construir XML del documento DOCX manualmente (sin dependencia externa)
    // Colores corporativos: azul #5E72E4
    // Preparar lista con subtotales intercalados (igual que en pantalla y PDF)
    function nombreBaseDocx(dn) {
        if (!dn || dn === 'SIN CALLE / GPS') return dn;
        const m = dn.match(/^(.+?\([^)]+\))/);
        if (m) return m[1].trim();
        return dn.split(/[,\d]/)[0].trim() || dn;
    }

    const itemsDocx = [];
    let gBase = null, gTotal = 0, gFilas = [];
    function pushGrupoDocx() {
        if (gBase === null) return;
        itemsDocx.push({ tipo: 'subtotal', label: gBase, count: gTotal });
        gFilas.forEach(r => itemsDocx.push({ tipo: 'fila', row: r }));
        gBase = null; gTotal = 0; gFilas = [];
    }
    tableStreetsDataCache.forEach(row => {
        const base = nombreBaseDocx(row.displayName || row.name);
        if (base !== gBase) { pushGrupoDocx(); gBase = base; }
        gTotal += row.count;
        gFilas.push(row);
    });
    pushGrupoDocx();

    let filaIdx = 0;
    const filas = itemsDocx.map(item => {
        if (item.tipo === 'subtotal') {
            return `
        <w:tr>
          <w:tc>
            <w:tcPr>
              <w:tcW w:w="7500" w:type="dxa"/>
              <w:shd w:val="clear" w:color="auto" w:fill="C8CEF5"/>
              <w:tcMar><w:left w:w="120" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar>
              <w:tcBorders><w:top w:val="single" w:sz="6" w:color="5E72E4"/><w:bottom w:val="single" w:sz="6" w:color="5E72E4"/></w:tcBorders>
            </w:tcPr>
            <w:p><w:pPr><w:spacing w:before="80" w:after="80"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="17"/><w:b/><w:color w:val="3D4DB7"/></w:rPr>
                <w:t xml:space="preserve">${T('streets_report_subtotal')}  ${_escapeXml(item.label)}</w:t>
              </w:r>
            </w:p>
          </w:tc>
          <w:tc>
            <w:tcPr>
              <w:tcW w:w="1360" w:type="dxa"/>
              <w:shd w:val="clear" w:color="auto" w:fill="C8CEF5"/>
              <w:jc w:val="right"/>
              <w:tcBorders><w:top w:val="single" w:sz="6" w:color="5E72E4"/><w:bottom w:val="single" w:sz="6" w:color="5E72E4"/></w:tcBorders>
            </w:tcPr>
            <w:p><w:pPr><w:jc w:val="right"/><w:spacing w:before="80" w:after="80"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="17"/><w:b/><w:color w:val="3D4DB7"/></w:rPr>
                <w:t>${item.count.toLocaleString('es-ES')}</w:t>
              </w:r>
            </w:p>
          </w:tc>
        </w:tr>`;
        } else {
            const bg = filaIdx++ % 2 === 0 ? 'F0F2FF' : 'FFFFFF';
            return `
        <w:tr>
          <w:tc>
            <w:tcPr>
              <w:tcW w:w="7500" w:type="dxa"/>
              <w:shd w:val="clear" w:color="auto" w:fill="${bg}"/>
              <w:tcMar><w:left w:w="200" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar>
            </w:tcPr>
            <w:p><w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="18"/><w:color w:val="32325D"/></w:rPr>
                <w:t xml:space="preserve">${_escapeXml(item.row.displayName || item.row.name)}</w:t>
              </w:r>
            </w:p>
          </w:tc>
          <w:tc>
            <w:tcPr>
              <w:tcW w:w="1360" w:type="dxa"/>
              <w:shd w:val="clear" w:color="auto" w:fill="${bg}"/>
              <w:jc w:val="right"/>
              <w:tcMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar>
            </w:tcPr>
            <w:p><w:pPr><w:jc w:val="right"/><w:spacing w:before="60" w:after="60"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="18"/><w:b/><w:color w:val="5E72E4"/></w:rPr>
                <w:t>${item.row.count.toLocaleString('es-ES')}</w:t>
              </w:r>
            </w:p>
          </w:tc>
        </w:tr>`;
        }
    }).join('');

    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mo="http://schemas.microsoft.com/office/mac/office/2008/main"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:mv="urn:schemas-microsoft-com:mac:vml"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
  xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
  mc:Ignorable="w14 wp14">
<w:body>

  <!-- TÍTULO -->
  <w:p>
    <w:pPr>
      <w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="5E72E4"/></w:pBdr>
      <w:spacing w:before="0" w:after="160"/>
    </w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="36"/><w:b/><w:color w:val="5E72E4"/></w:rPr>
      <w:t>EUROCOP ANALYTICS</w:t>
    </w:r>
  </w:p>

  <!-- SUBTÍTULO -->
  <w:p>
    <w:pPr><w:spacing w:before="0" w:after="80"/></w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="22"/><w:color w:val="525F7F"/></w:rPr>
      <w:t>${T('streets_report_title')}</w:t>
    </w:r>
  </w:p>

  <!-- METADATOS -->
  <w:p>
    <w:pPr><w:spacing w:before="0" w:after="240"/></w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="18"/><w:color w:val="8898AA"/></w:rPr>
      <w:t xml:space="preserve">Archivo: ${_escapeXml(titulo)}   ·   Fecha: ${fecha}   ·   ${T('streets_report_total')}: ${total.toLocaleString('es-ES')}   ·   ${T('streets_report_unique')}: ${tableStreetsDataCache.length.toLocaleString('es-ES')}</w:t>
    </w:r>
  </w:p>

  <!-- TABLA -->
  <w:tbl>
    <w:tblPr>
      <w:tblW w:w="8860" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="D0D5F0"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="D0D5F0"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="D0D5F0"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="D0D5F0"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="D0D5F0"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="D0D5F0"/>
      </w:tblBorders>
      <w:tblCellMar>
        <w:top w:w="80" w:type="dxa"/>
        <w:bottom w:w="80" w:type="dxa"/>
        <w:left w:w="120" w:type="dxa"/>
        <w:right w:w="120" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tblGrid>
      <w:gridCol w:w="7500"/>
      <w:gridCol w:w="1360"/>
    </w:tblGrid>

    <!-- Cabecera -->
    <w:tr>
      <w:trPr><w:tblHeader/></w:trPr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="7500" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="5E72E4"/>
        </w:tcPr>
        <w:p><w:pPr><w:spacing w:before="80" w:after="80"/></w:pPr>
          <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="18"/><w:b/><w:color w:val="FFFFFF"/></w:rPr>
            <w:t>${T('streets_report_col_street')}</w:t>
          </w:r>
        </w:p>
      </w:tc>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="1360" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="5E72E4"/>
          <w:jc w:val="right"/>
        </w:tcPr>
        <w:p><w:pPr><w:jc w:val="right"/><w:spacing w:before="80" w:after="80"/></w:pPr>
          <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="18"/><w:b/><w:color w:val="FFFFFF"/></w:rPr>
            <w:t>${T('streets_report_col_reg')}</w:t>
          </w:r>
        </w:p>
      </w:tc>
    </w:tr>

    ${filas}
  </w:tbl>

  <!-- Pie -->
  <w:p>
    <w:pPr><w:spacing w:before="320" w:after="0"/></w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="16"/><w:color w:val="AAAACC"/></w:rPr>
      <w:t>${T('streets_report_footer')}</w:t>
    </w:r>
  </w:p>

  <w:sectPr>
    <w:pgSz w:w="11906" w:h="16838"/>
    <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/>
  </w:sectPr>
</w:body>
</w:document>`;

    // Construir el ZIP del DOCX en el navegador
    _buildAndDownloadDocx(docXml, (nombreArchivoSubido || 'calles').replace(/[^a-zA-Z0-9_\-]/g, '_') + '_calles.docx');
}

// ── Helpers internos ──

function _escapeXml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Construye un archivo DOCX mínimo en el navegador usando solo APIs nativas.
 * No requiere ninguna librería extra: crea el ZIP con JSZip si está disponible,
 * o lo genera manualmente si no.
 */
function _buildAndDownloadDocx(documentXml, filename) {
    // Partes mínimas de un DOCX válido
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

    const relsRoot = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

    const relsWord = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;

    // Usar JSZip si está disponible (muchos proyectos la incluyen junto con xlsx)
    if (typeof JSZip !== 'undefined') {
        const zip = new JSZip();
        zip.file('[Content_Types].xml', contentTypes);
        zip.folder('_rels').file('.rels', relsRoot);
        zip.folder('word').file('document.xml', documentXml);
        zip.folder('word/_rels').file('document.xml.rels', relsWord);
        zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
            .then(blob => _downloadBlob(blob, filename));
        return;
    }

    // Alternativa: usar XLSX.js (ya cargado en la app) que incluye JSZip internamente
    // Construimos el ZIP byte a byte con una implementación mínima
    try {
        const files = {
            '[Content_Types].xml': contentTypes,
            '_rels/.rels': relsRoot,
            'word/document.xml': documentXml,
            'word/_rels/document.xml.rels': relsWord
        };
        const blob = _makeZipBlob(files);
        _downloadBlob(blob, filename);
    } catch (e) {
        showToast('No se pudo generar el archivo DOCX. Intenta con PDF.');
        console.error('DOCX export error:', e);
    }
}

function _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href    = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Implementación mínima de ZIP sin dependencias para generar el DOCX */
function _makeZipBlob(files) {
    // Usamos la API de XLSX (ya incluida) que expone internamente CFB/ZIP
    // Si no, generamos un ZIP store (sin compresión) manualmente
    const enc = new TextEncoder();
    const parts = [];
    const centralDir = [];
    let offset = 0;

    const crc32Table = (() => {
        const t = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            t[i] = c;
        }
        return t;
    })();

    function crc32(data) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < data.length; i++) crc = crc32Table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    function u16(n) { return [n & 0xFF, (n >> 8) & 0xFF]; }
    function u32(n) { return [n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF, (n >> 24) & 0xFF]; }

    function writeStr(s) { return Array.from(enc.encode(s)); }

    for (const [name, content] of Object.entries(files)) {
        const nameBytes    = writeStr(name);
        const contentBytes = new Uint8Array(enc.encode(content));
        const crc          = crc32(contentBytes);
        const size         = contentBytes.length;

        const local = [
            0x50, 0x4B, 0x03, 0x04, // signature
            0x14, 0x00,              // version needed
            0x00, 0x00,              // flags
            0x00, 0x00,              // compression: stored
            0x00, 0x00, 0x00, 0x00, // mod time/date
            ...u32(crc),
            ...u32(size),
            ...u32(size),
            ...u16(nameBytes.length),
            0x00, 0x00,              // extra field length
            ...nameBytes,
            ...Array.from(contentBytes)
        ];

        centralDir.push({
            name: nameBytes,
            crc, size,
            offset
        });

        parts.push(new Uint8Array(local));
        offset += local.length;
    }

    // Central directory
    const cdParts = [];
    let cdSize = 0;
    for (const e of centralDir) {
        const cd = [
            0x50, 0x4B, 0x01, 0x02,
            0x1E, 0x03, 0x14, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            ...u32(e.crc),
            ...u32(e.size),
            ...u32(e.size),
            ...u16(e.name.length),
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            ...u32(e.offset),
            ...e.name
        ];
        cdParts.push(new Uint8Array(cd));
        cdSize += cd.length;
    }

    const eocd = new Uint8Array([
        0x50, 0x4B, 0x05, 0x06,
        0x00, 0x00, 0x00, 0x00,
        ...u16(centralDir.length),
        ...u16(centralDir.length),
        ...u32(cdSize),
        ...u32(offset),
        0x00, 0x00
    ]);

    const totalSize = parts.reduce((s, p) => s + p.length, 0)
                    + cdParts.reduce((s, p) => s + p.length, 0)
                    + eocd.length;
    const out = new Uint8Array(totalSize);
    let pos = 0;
    for (const p of [...parts, ...cdParts, [eocd]].flat()) {
        if (p instanceof Uint8Array) { out.set(p, pos); pos += p.length; }
    }

    return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
