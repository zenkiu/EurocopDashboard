// --- FncConvertirPdf.js ---
// Captura directa: los 3 canvas de Chart.js (#chart-timeline,
// #chart-category, #chart-hours) se leen con .toDataURL().
// El mapa se lee con map.getCanvas().toDataURL().
// Los KPIs se capturan con html2canvas sobre .kpi-grid (HTML puro).
// Todo se compone a mano en jsPDF. Sin clonar canvas, sin errores WebGL.

const FncConvertirPdf = {
    exportar: async function () {
        const { jsPDF } = window.jspdf;
        const btn = document.querySelector('.btn-export-pdf');
        if (!btn) return;

        btn.innerHTML = '<i class="fa-solid fa-compress fa-spin"></i> Generando PDF...';
        btn.disabled = true;

        try {
            // ═══════════════════════════════════════════════════════
            // 1. METADATOS
            // ═══════════════════════════════════════════════════════
            const nombreArchivo = (document.getElementById('card-text-filename')?.textContent.trim()) || 'INFORME_EUROCOP';
            const getLabels = (id) => {
                const checked = Array.from(document.querySelectorAll(`#${id} input:checked`));
                const total   = document.querySelectorAll(`#${id} input`).length;
                if (checked.length === 0) return 'NINGUNO';
                if (checked.length === total) return 'TODOS';
                if (id === 'header-month') return document.getElementById(id)?.textContent || '';
                return checked.map(i => i.nextElementSibling?.innerText).join(', ');
            };
            const selAnios = getLabels('items-year');
            const selMeses = getLabels(typeof dateFilterMode !== 'undefined' && dateFilterMode === 'daymonth' ? 'header-month' : 'items-month');

            // ═══════════════════════════════════════════════════════
            // 2. CAPTURAR IMÁGENES — directamente de los canvas
            // ═══════════════════════════════════════════════════════

            // ── Chart.js: .toDataURL() directo sobre cada canvas ──
            const cvTimeline  = document.getElementById('chart-timeline');
            const cvCategory  = document.getElementById('chart-category');
            const cvHours     = document.getElementById('chart-hours');

            const imgTimeline = cvTimeline  ? cvTimeline.toDataURL('image/png')  : null;
            const imgCategory = cvCategory  ? cvCategory.toDataURL('image/png')  : null;
            const imgHours    = cvHours     ? cvHours.toDataURL('image/png')     : null;

            // ── Mapa: MapLibre canvas ──
            let imgMap = null;
            if (typeof map !== 'undefined' && map) {
                map.triggerRepaint();
                await new Promise(r => map.once('idle', r));
                imgMap = map.getCanvas().toDataURL('image/png');
            }

            // ── KPIs: html2canvas sobre .kpi-grid (HTML puro, sin canvas) ──
            let imgKpi = null;
            const kpiEl = document.querySelector('.kpi-grid');
            if (kpiEl) {
                const kpiCanvas = await html2canvas(kpiEl, {
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#f4f6f9',
                    onclone: (doc) => {
                        doc.querySelectorAll('button, select, [class*="btn"]')
                           .forEach(el => el.style.display = 'none');
                    }
                });
                imgKpi = kpiCanvas.toDataURL('image/png', 0.92);
            }

            // ═══════════════════════════════════════════════════════
            // 3. LEER TEXTOS de los títulos del dashboard
            // ═══════════════════════════════════════════════════════
            const txtKpi1   = document.getElementById('kpi-count')?.textContent.trim() || '0';
            const txtKpi2   = document.getElementById('kpi-location')?.textContent.trim() || '';
            const txtKpi3   = document.getElementById('card-text-filename')?.textContent.trim() || '';

            // ═══════════════════════════════════════════════════════
            // 4. CREAR PDF — Landscape A4 (297 × 210 mm)
            // ═══════════════════════════════════════════════════════
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });

            // ── Constantes de layout ──
            const PW       = 297;          // ancho página
            const PH       = 210;          // alto página
            const M        = 7;            // márgenes
            const HDR_H    = 14;           // alto cabecera oscura
            const GAP      = 4;            // espacio entre bloques
            const FOOTER_H = 6;            // reserva pie
            const KPI_H    = 20;           // alto fila KPIs
            const TITLE_H  = 5;            // alto zona título por gráfico

            // Ancho de cada gráfico lado a lado
            const CHART_W  = (PW - M * 2 - GAP) / 2;   // ~139.5 mm

            // Alto disponible para los gráficos (después de header + kpis + títulos)
            const CHART_H  = PH - M - HDR_H - GAP - KPI_H - GAP - TITLE_H - FOOTER_H - GAP - M;

            // ─── FUNCIONES DE DIBUJO ──────────────────────────────

            // Cabecera profesional oscura
            const drawHeader = (pdf) => {
                // Fondo
                pdf.setFillColor(15, 22, 35);
                pdf.roundedRect(M, M, PW - M * 2, HDR_H, 3, 3, 'F');

                // EUROCOP ANALYTICS. (izquierda)
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(9);
                pdf.setTextColor(94, 114, 228);
                pdf.text('EUROCOP ANALYTICS.', M + 5, M + 5.8);

                // Nombre archivo (centro, caja oscura)
                const cx   = PW / 2;
                const boxW = Math.max(48, nombreArchivo.length * 2.5);
                pdf.setFillColor(38, 48, 63);
                pdf.roundedRect(cx - boxW / 2, M + 2.8, boxW, 8.5, 2, 2, 'F');
                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(6.8);
                pdf.setFont('helvetica', 'bold');
                pdf.text(nombreArchivo.toUpperCase(), cx, M + 8, { align: 'center' });

                // AÑO / MES (derecha)
                const rx = PW - M - 5;
                pdf.setFontSize(5.5);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(136, 152, 170);
                pdf.text('AÑO:', rx - 48, M + 5.5);
                pdf.setTextColor(17, 205, 239);
                pdf.setFont('helvetica', 'bold');
                pdf.text(selAnios, rx - 36, M + 5.5);

                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(136, 152, 170);
                pdf.text('MES:', rx - 48, M + 10);
                pdf.setTextColor(17, 205, 239);
                pdf.setFont('helvetica', 'bold');
                pdf.text(selMeses, rx - 36, M + 10);
            };

            // Título de sección sobre cada gráfico
            const drawTitle = (pdf, text, x, y) => {
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(7);
                pdf.setTextColor(50, 60, 80);
                pdf.text(text.toUpperCase(), x + 1, y + 3.5);
            };

            // Línea separadora + texto pie
            const drawFooter = (pdf, page, total) => {
                const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
                pdf.setDrawColor(210, 215, 225);
                pdf.setLineWidth(0.25);
                pdf.line(M, PH - FOOTER_H - 1, PW - M, PH - FOOTER_H - 1);
                pdf.setFontSize(5.5);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(150, 155, 165);
                pdf.text(`Generado el ${fecha}`, M, PH - 2.2);
                pdf.text(`Página ${page} de ${total}`, PW - M, PH - 2.2, { align: 'right' });
            };

            // Añadir imagen dentro de un rectángulo exacto (aspect-ratio centrada)
            const placeImg = (pdf, imgData, x, y, w, h) => {
                // Fondo blanco + borde sutil
                pdf.setFillColor(255, 255, 255);
                pdf.roundedRect(x, y, w, h, 2, 2, 'F');
                pdf.setDrawColor(225, 230, 238);
                pdf.setLineWidth(0.3);
                pdf.roundedRect(x, y, w, h, 2, 2, 'S');

                if (!imgData) {
                    // Si no hay imagen mostrar placeholder
                    pdf.setFontSize(7);
                    pdf.setTextColor(180);
                    pdf.text('Sin datos disponibles', x + w / 2, y + h / 2, { align: 'center' });
                    return;
                }

                // Calcular dimensiones manteniendo aspect ratio
                const props  = pdf.getImageProperties(imgData);
                const ratio  = props.width / props.height;
                const boxR   = w / h;
                let iw, ih;

                if (ratio > boxR) {
                    // Imagen más ancha que el box → ajustar por ancho
                    iw = w - 2;   // 1mm padding cada lado
                    ih = iw / ratio;
                } else {
                    // Imagen más alta → ajustar por alto
                    ih = h - 2;
                    iw = ih * ratio;
                }

                // Centrar dentro del recuadro
                const ix = x + (w - iw) / 2;
                const iy = y + (h - ih) / 2;

                pdf.addImage(imgData, 'PNG', ix, iy, iw, ih, undefined, 'FAST');
            };

            // KPIs manuales (texto) como fallback si html2canvas falla
            const drawKpisFallback = (pdf, x, y, w, h) => {
                pdf.setFillColor(255, 255, 255);
                pdf.roundedRect(x, y, w, h, 2, 2, 'F');
                pdf.setDrawColor(225, 230, 238);
                pdf.setLineWidth(0.3);
                pdf.roundedRect(x, y, w, h, 2, 2, 'S');

                const colW = w / 3;

                // Expedientes
                pdf.setFillColor(94, 114, 228);
                pdf.roundedRect(x + 2, y + 3, 7, 7, 2, 2, 'F');
                pdf.setFontSize(5);
                pdf.setTextColor(140, 150, 160);
                pdf.text('EXPEDIENTES', x + 12, y + 5.5);
                pdf.setFontSize(9);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(30, 40, 60);
                pdf.text(txtKpi1, x + 12, y + 10);

                // Zona
                pdf.setFillColor(45, 206, 137);
                pdf.roundedRect(x + colW + 2, y + 3, 7, 7, 2, 2, 'F');
                pdf.setFontSize(5);
                pdf.setTextColor(140, 150, 160);
                pdf.setFont('helvetica', 'normal');
                pdf.text('ZONA', x + colW + 12, y + 5.5);
                pdf.setFontSize(9);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(30, 40, 60);
                pdf.text(txtKpi2, x + colW + 12, y + 10);

                // Título
                pdf.setFillColor(251, 99, 64);
                pdf.roundedRect(x + colW * 2 + 2, y + 3, 7, 7, 2, 2, 'F');
                pdf.setFontSize(5);
                pdf.setTextColor(140, 150, 160);
                pdf.setFont('helvetica', 'normal');
                pdf.text('TÍTULO', x + colW * 2 + 12, y + 5.5);
                pdf.setFontSize(7);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(30, 40, 60);
                pdf.text(txtKpi3, x + colW * 2 + 12, y + 10);
            };

            // ═══════════════════════════════════════════════════════
            // 5. PÁGINA 1: Header + KPIs + Evolución | Top Tipos
            // ═══════════════════════════════════════════════════════
            drawHeader(pdf);

            let curY = M + HDR_H + GAP;

            // ── KPIs ──
            if (imgKpi) {
                placeImg(pdf, imgKpi, M, curY, PW - M * 2, KPI_H);
            } else {
                drawKpisFallback(pdf, M, curY, PW - M * 2, KPI_H);
            }
            curY += KPI_H + GAP;

            // ── Títulos ──
            drawTitle(pdf, 'Evolución Temporal', M, curY);
            drawTitle(pdf, 'Top Tipos', M + CHART_W + GAP, curY);
            curY += TITLE_H;

            // ── Dos gráficos lado a lado, MISMO ancho y MISMO alto ──
            placeImg(pdf, imgTimeline, M,                     curY, CHART_W, CHART_H);
            placeImg(pdf, imgCategory, M + CHART_W + GAP,     curY, CHART_W, CHART_H);

            // ═══════════════════════════════════════════════════════
            // 6. PÁGINA 2: Header + Horas | Mapa
            // ═══════════════════════════════════════════════════════
            pdf.addPage();
            drawHeader(pdf);

            curY = M + HDR_H + GAP;

            // ── Títulos ──
            drawTitle(pdf, 'Horas', M, curY);
            drawTitle(pdf, 'Mapa', M + CHART_W + GAP, curY);
            curY += TITLE_H;

            // ── Alto máximo para estos gráficos (sin KPIs, más espacio) ──
            const CHART_H_P2 = PH - curY - FOOTER_H - GAP - M;

            // ── Dos gráficos lado a lado, MISMO ancho y MISMO alto ──
            placeImg(pdf, imgHours, M,                     curY, CHART_W, CHART_H_P2);
            placeImg(pdf, imgMap,   M + CHART_W + GAP,     curY, CHART_W, CHART_H_P2);

            // ═══════════════════════════════════════════════════════
            // 7. PIES DE PÁGINA en ambas páginas
            // ═══════════════════════════════════════════════════════
            const totalPages = pdf.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                pdf.setPage(i);
                drawFooter(pdf, i, totalPages);
            }

            // ═══════════════════════════════════════════════════════
            // 8. GUARDAR
            // ═══════════════════════════════════════════════════════
            const fechaFile = new Date().toISOString().slice(0, 10);
            pdf.save(`${nombreArchivo.replace(/\s+/g, '_')}_${fechaFile}.pdf`);

            btn.innerHTML = '<i class="fa-solid fa-check"></i> PDF Generado';
            setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> EXPORTAR A PDF (A4)'; }, 2000);

        } catch (e) {
            console.error('Error en PDF:', e);
            btn.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i> Error';
            setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> EXPORTAR A PDF (A4)'; }, 2000);
        } finally {
            btn.disabled = false;
        }
    }
};
