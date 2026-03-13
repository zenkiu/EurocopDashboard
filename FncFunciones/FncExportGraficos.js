/**
 * EUROCOP ANALYTICS - EXPORTACIÓN DE GRÁFICOS A PDF Y DOCX
 * Exporta Evolución Temporal, Top Tipos y Horas.
 * Tipos: 'timeline' | 'category' | 'hours'
 */

function _tEx(key) {
    if (typeof translations !== 'undefined' && translations[currentLang] && translations[currentLang][key])
        return translations[currentLang][key];
    if (typeof translations !== 'undefined' && translations['es'] && translations['es'][key])
        return translations['es'][key];
    return key;
}

function _getChartData(tipo) {
    const titulo = nombreArchivoSubido || 'EUROCOP ANALYTICS';
    const fecha  = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

    if (tipo === 'timeline') {
        if (!tableDataCache || tableDataCache.length === 0) return null;
        const chartTitle = _tEx('chart_timeline') || 'Evolución Temporal';
        const catKeys = Object.keys(tableDataCache[0]).filter(k => k !== 'label' && k !== 'index' && k !== 'TOTAL').sort();
        const cols = ['PERIODO', ...catKeys, 'TOTAL'];
        const rows = tableDataCache.map(row => [
            row.label,
            ...catKeys.map(k => (row[k] !== undefined ? row[k] : 0).toLocaleString('es-ES')),
            (row['TOTAL'] || 0).toLocaleString('es-ES')
        ]);
        return { titulo, fecha, chartTitle, cols, rows };
    }
    if (tipo === 'category') {
        if (!tableCatDataCache || tableCatDataCache.length === 0) return null;
        const chartTitle = _tEx('chart_top') || 'Top Tipos';
        const cols = ['CATEGORÍA', 'CANTIDAD', '%'];
        const rows = tableCatDataCache.map(r => [r.cat, r.count.toLocaleString('es-ES'), r.percent + '%']);
        return { titulo, fecha, chartTitle, cols, rows };
    }
    if (tipo === 'hours') {
        if (!tableHoursDataCache || tableHoursDataCache.length === 0) return null;
        const chartTitle = _tEx('chart_hours') || 'Horas';
        const cols = ['HORA', 'CANTIDAD', '%'];
        const rows = tableHoursDataCache.map(r => [r.hourLabel, r.count.toLocaleString('es-ES'), r.percent + '%']);
        return { titulo, fecha, chartTitle, cols, rows };
    }
    return null;
}

// ============================================================
// PDF
// ============================================================
function exportChartToPdf(tipo) {
    const d = _getChartData(tipo);
    if (!d) { showToast('Sin datos para exportar.'); return; }

    const { jsPDF } = window.jspdf;
    const isLandscape = tipo === 'timeline' && d.cols.length > 5;
    const doc   = new jsPDF({ orientation: isLandscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const mL = 12, mR = 12, contW = pageW - mL - mR;

    // Cabecera
    doc.setFillColor(94, 114, 228);
    doc.rect(0, 0, pageW, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('EUROCOP ANALYTICS', mL, 11);
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
    doc.text(d.chartTitle, mL, 18);
    doc.text(d.fecha, pageW - mR, 11, { align: 'right' });
    doc.text(d.titulo, pageW - mR, 18, { align: 'right' });

    // Subtítulo
    doc.setTextColor(50, 50, 80);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    const totalReg = lastFilteredData ? lastFilteredData.length.toLocaleString('es-ES') : '-';
    doc.text(_tEx('streets_report_total') + ': ' + totalReg, mL, 33);

    // Anchos columnas
    const nCols = d.cols.length;
    let colW;
    if (tipo === 'timeline') {
        const fW = Math.min(contW * 0.20, 36);
        const lW = Math.min(16, contW * 0.08);
        const mW = (contW - fW - lW) / Math.max(1, nCols - 2);
        colW = [fW, ...Array(nCols - 2).fill(mW), lW];
    } else {
        const lW = tipo === 'hours' ? 22 : contW * 0.15;
        const fW = contW - lW * (nCols - 1);
        colW = [fW, ...Array(nCols - 1).fill(lW)];
    }

    const rowH = 6.5;
    let y = 38;

    function drawHeader(yp) {
        doc.setFillColor(94, 114, 228);
        doc.rect(mL, yp, contW, rowH + 0.5, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        let x = mL;
        d.cols.forEach((col, i) => {
            const align = i === 0 ? 'left' : 'right';
            const tx = align === 'right' ? x + colW[i] - 1.5 : x + 2;
            const maxC = Math.floor(colW[i] / 1.6);
            const txt = col.length > maxC ? col.substring(0, maxC - 1) + '.' : col;
            doc.text(txt, tx, yp + 4.8, { align });
            x += colW[i];
        });
        return yp + rowH + 0.5;
    }

    function newPage() {
        doc.addPage();
        doc.setFillColor(94, 114, 228);
        doc.rect(0, 0, pageW, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7); doc.setFont('helvetica', 'bold');
        doc.text('EUROCOP ANALYTICS · ' + d.chartTitle + ' (cont.)', mL, 7);
        y = drawHeader(14);
    }

    y = drawHeader(y);

    let odd = false;
    d.rows.forEach(row => {
        if (y + rowH > pageH - 11) newPage();
        odd = !odd;
        if (odd) { doc.setFillColor(248, 249, 255); doc.rect(mL, y, contW, rowH, 'F'); }
        doc.setDrawColor(225, 228, 245);
        doc.line(mL, y + rowH, mL + contW, y + rowH);
        let x = mL;
        row.forEach((cell, i) => {
            const isNum = i > 0;
            doc.setTextColor(isNum ? 94 : 50, isNum ? 114 : 50, isNum ? 228 : 80);
            doc.setFont('helvetica', isNum ? 'bold' : 'normal');
            doc.setFontSize(7);
            const align = isNum ? 'right' : 'left';
            const tx = align === 'right' ? x + colW[i] - 1.5 : x + 2;
            const maxC = Math.floor(colW[i] / 1.55);
            const txt = String(cell).length > maxC ? String(cell).substring(0, maxC - 1) + '..' : String(cell);
            doc.text(txt, tx, y + 4.5, { align });
            x += colW[i];
        });
        y += rowH;
    });

    // Footer
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        doc.setFillColor(240, 242, 255);
        doc.rect(0, pageH - 9, pageW, 9, 'F');
        doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(130, 130, 160);
        doc.text(_tEx('streets_report_footer'), mL, pageH - 3);
        doc.text(_tEx('streets_report_page') + ' ' + p + ' / ' + total, pageW - mR, pageH - 3, { align: 'right' });
    }

    doc.save((d.titulo + '_' + tipo).replace(/[^a-zA-Z0-9_\-]/g, '_') + '.pdf');
}

// ============================================================
// DOCX
// ============================================================
function exportChartToDocx(tipo) {
    const d = _getChartData(tipo);
    if (!d) { showToast('Sin datos para exportar.'); return; }

    function esc(s) {
        return String(s || '')
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
    }

    const totalDxa = 8860;
    const nCols = d.cols.length;
    let colDxa;
    if (tipo === 'timeline') {
        const fD = Math.round(totalDxa * 0.22);
        const lD = Math.round(totalDxa * 0.09);
        const mD = Math.round((totalDxa - fD - lD) / Math.max(1, nCols - 2));
        colDxa = [fD, ...Array(nCols - 2).fill(mD), lD];
    } else {
        const lD = Math.round(totalDxa * 0.13);
        const fD = totalDxa - lD * (nCols - 1);
        colDxa = [fD, ...Array(nCols - 1).fill(lD)];
    }

    const gridCols = colDxa.map(w => `<w:gridCol w:w="${w}"/>`).join('');

    const headerRow = '<w:tr><w:trPr><w:tblHeader/></w:trPr>' +
        d.cols.map((col, i) => `
      <w:tc><w:tcPr><w:tcW w:w="${colDxa[i]}" w:type="dxa"/>
        <w:shd w:val="clear" w:color="auto" w:fill="5E72E4"/>
        <w:tcMar><w:left w:w="120" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>
      </w:tcPr>
      <w:p><w:pPr><w:jc w:val="${i > 0 ? 'right' : 'left'}"/><w:spacing w:before="80" w:after="80"/></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="17"/><w:b/><w:color w:val="FFFFFF"/></w:rPr>
          <w:t xml:space="preserve">${esc(col)}</w:t></w:r>
      </w:p></w:tc>`).join('') + '</w:tr>';

    const dataRows = d.rows.map((row, ri) => {
        const bg = ri % 2 === 0 ? 'F0F2FF' : 'FFFFFF';
        return '<w:tr>' + row.map((cell, ci) => {
            const isNum = ci > 0;
            return `
      <w:tc><w:tcPr><w:tcW w:w="${colDxa[ci]}" w:type="dxa"/>
        <w:shd w:val="clear" w:color="auto" w:fill="${bg}"/>
        <w:tcMar><w:left w:w="120" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>
      </w:tcPr>
      <w:p><w:pPr><w:jc w:val="${isNum ? 'right' : 'left'}"/><w:spacing w:before="60" w:after="60"/></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="17"/>
          ${isNum ? '<w:b/><w:color w:val="5E72E4"/>' : '<w:color w:val="32325D"/>'}
        </w:rPr>
          <w:t xml:space="preserve">${esc(cell)}</w:t></w:r>
      </w:p></w:tc>`;
        }).join('') + '</w:tr>';
    }).join('');

    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
  <w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="5E72E4"/></w:pBdr>
    <w:spacing w:before="0" w:after="140"/></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="36"/><w:b/><w:color w:val="5E72E4"/></w:rPr>
      <w:t>EUROCOP ANALYTICS</w:t></w:r>
  </w:p>
  <w:p><w:pPr><w:spacing w:before="0" w:after="80"/></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="22"/><w:color w:val="525F7F"/></w:rPr>
      <w:t>${esc(d.chartTitle)}</w:t></w:r>
  </w:p>
  <w:p><w:pPr><w:spacing w:before="0" w:after="280"/></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="18"/><w:color w:val="8898AA"/></w:rPr>
      <w:t xml:space="preserve">Archivo: ${esc(d.titulo)}   ·   Fecha: ${esc(d.fecha)}</w:t></w:r>
  </w:p>
  <w:tbl>
    <w:tblPr>
      <w:tblW w:w="${totalDxa}" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="D0D5F0"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="D0D5F0"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="D0D5F0"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="D0D5F0"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="D0D5F0"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="D0D5F0"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid>${gridCols}</w:tblGrid>
    ${headerRow}
    ${dataRows}
  </w:tbl>
  <w:p><w:pPr><w:spacing w:before="320" w:after="0"/></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="16"/><w:color w:val="AAAACC"/></w:rPr>
      <w:t>${esc(_tEx('streets_report_footer'))}</w:t></w:r>
  </w:p>
  <w:sectPr>
    <w:pgSz w:w="${tipo === 'timeline' ? '16838' : '11906'}" w:h="${tipo === 'timeline' ? '11906' : '16838'}" ${tipo === 'timeline' ? 'w:orient="landscape"' : ''}/>
    <w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000"/>
  </w:sectPr>
</w:body>
</w:document>`;

    _buildAndDownloadDocx(docXml, (d.titulo + '_' + tipo).replace(/[^a-zA-Z0-9_\-]/g, '_') + '.docx');
}
