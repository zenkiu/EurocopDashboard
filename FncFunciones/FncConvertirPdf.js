// --- FncConvertirPdf.js ---
// Sin html2canvas ni clonado de nada.
// Chart.js → canvas.toDataURL() por ID directo.
// Mapa     → map.getCanvas().toDataURL().
// KPIs     → texto vectorial en jsPDF (sin captura).
// Todo se compone a mano en 2 páginas landscape A4.

const FncConvertirPdf = {
    exportar: async function () {
        const { jsPDF } = window.jspdf;
        const btn = document.querySelector('.btn-export-pdf');
        if (!btn) return;

        btn.innerHTML = '<i class="fa-solid fa-compress fa-spin"></i> Generando PDF...';
        btn.disabled = true;

        try {
            // ═══════════════════════════════════════════════════════
            // 1. LEER DATOS del DOM (texto, no imágenes)
            // ═══════════════════════════════════════════════════════
            const nombreArchivo = document.getElementById('card-text-filename')?.textContent.trim() || 'INFORME_EUROCOP';

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

            // Valores de los KPIs
            const valExpedientes = document.getElementById('kpi-count')?.textContent.trim()    || '0';
            const valZona        = document.getElementById('kpi-location')?.textContent.trim()  || '-';
            const valTitulo      = document.getElementById('card-text-filename')?.textContent.trim() || '-';

            // ═══════════════════════════════════════════════════════
            // 2. CAPTURAR CANVAS → dataURL (sin clonar, sin html2canvas)
            // ═══════════════════════════════════════════════════════
            const imgTimeline = document.getElementById('chart-timeline')?.toDataURL('image/png') || null;
            const imgCategory = document.getElementById('chart-category')?.toDataURL('image/png') || null;
            const imgHours    = document.getElementById('chart-hours')?.toDataURL('image/png')    || null;

            let imgMap = null;
            if (typeof map !== 'undefined' && map) {
                map.triggerRepaint();
                await new Promise(r => map.once('idle', r));
                imgMap = map.getCanvas().toDataURL('image/png');
            }

            // ═══════════════════════════════════════════════════════
            // 3. CREAR PDF
            // ═══════════════════════════════════════════════════════
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });

            // ── Layout constants ──
            const PW = 297, PH = 210;
            const M  = 7;              // márgenes todos los lados
            const HDR_H  = 14;         // alto cabecera oscura
            const KPI_H  = 22;         // alto fila KPIs
            const GAP    = 3.5;        // separación entre bloques
            const FOOT_H = 5.5;        // reserva pie de página
            const TTL_H  = 5;          // alto zona de título

            // Ancho de cada gráfico (dos lado a lado)
            const CHART_W = (PW - M * 2 - GAP) / 2;   // ~139.75 mm

            // ─────────────────────────────────────────────────────
            // FUNCIONES DE DIBUJO
            // ─────────────────────────────────────────────────────

            // ── Cabecera oscura ──
            const drawHeader = () => {
                pdf.setFillColor(15, 22, 35);
                pdf.roundedRect(M, M, PW - M * 2, HDR_H, 3, 3, 'F');

                // Marca izquierda
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(9);
                pdf.setTextColor(94, 114, 228);
                pdf.text('EUROCOP ANALYTICS.', M + 5, M + 5.8);

                // Nombre archivo centro
                const cx   = PW / 2;
                const boxW = Math.max(48, nombreArchivo.length * 2.4);
                pdf.setFillColor(38, 48, 63);
                pdf.roundedRect(cx - boxW / 2, M + 2.8, boxW, 8.4, 2, 2, 'F');
                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(6.8);
                pdf.setFont('helvetica', 'bold');
                pdf.text(nombreArchivo.toUpperCase(), cx, M + 8, { align: 'center' });

                // AÑO / MES derecha
                const rx = PW - M - 5;
                pdf.setFontSize(5.5);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(136, 152, 170);
                pdf.text('AÑO:', rx - 46, M + 5.5);
                pdf.setTextColor(17, 205, 239);
                pdf.setFont('helvetica', 'bold');
                pdf.text(selAnios, rx - 34, M + 5.5);

                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(136, 152, 170);
                pdf.text('MES:', rx - 46, M + 10.2);
                pdf.setTextColor(17, 205, 239);
                pdf.setFont('helvetica', 'bold');
                pdf.text(selMeses, rx - 34, M + 10.2);
            };

            // ── Fila de KPIs (3 cajas vectoriales, sin imagen) ──
            const drawKpis = (y) => {
                const totalW = PW - M * 2;
                const colW   = totalW / 3;
                const colors = [[94,114,228], [45,206,137], [251,99,64]]; // azul, verde, naranja
                const labels = ['EXPEDIENTES', 'ZONA', 'TÍTULO'];
                const values = [valExpedientes, valZona, valTitulo];

                // Fondo contenedor
                pdf.setFillColor(247, 250, 252);
                pdf.roundedRect(M, y, totalW, KPI_H, 3, 3, 'F');
                pdf.setDrawColor(230, 233, 240);
                pdf.setLineWidth(0.25);
                pdf.roundedRect(M, y, totalW, KPI_H, 3, 3, 'S');

                for (let i = 0; i < 3; i++) {
                    const x = M + colW * i;

                    // Separador vertical (excepto antes del primero)
                    if (i > 0) {
                        pdf.setDrawColor(230, 233, 240);
                        pdf.setLineWidth(0.3);
                        pdf.line(x, y + 3, x, y + KPI_H - 3);
                    }

                    // Círculo de color con icono
                    pdf.setFillColor(...colors[i]);
                    pdf.circle(x + 12, y + KPI_H / 2, 4.2, 'F');

                    // Etiqueta pequeña
                    pdf.setFontSize(5);
                    pdf.setFont('helvetica', 'normal');
                    pdf.setTextColor(140, 148, 160);
                    pdf.text(labels[i], x + 19, y + 7.5);

                    // Valor grande
                    pdf.setFontSize(i === 2 ? 7.5 : 10); // título más pequeño si es largo
                    pdf.setFont('helvetica', 'bold');
                    pdf.setTextColor(30, 40, 60);

                    // Truncar valor si es demasiado largo para el espacio
                    let val = values[i];
                    const maxChars = i === 2 ? 18 : 12;
                    if (val.length > maxChars) val = val.substring(0, maxChars - 1) + '…';
                    pdf.text(val, x + 19, y + 14.5);
                }
            };

            // ── Título de sección ──
            const drawTitle = (text, x, y) => {
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(7);
                pdf.setTextColor(50, 60, 80);
                pdf.text(text.toUpperCase(), x + 1, y + 3.5);
            };

            // ── Imagen dentro de un rect exacto (centrada, aspect-ratio) ──
            const placeImg = (imgData, x, y, w, h) => {
                // Fondo + borde
                pdf.setFillColor(255, 255, 255);
                pdf.roundedRect(x, y, w, h, 2, 2, 'F');
                pdf.setDrawColor(225, 230, 238);
                pdf.setLineWidth(0.3);
                pdf.roundedRect(x, y, w, h, 2, 2, 'S');

                if (!imgData) {
                    pdf.setFontSize(7);
                    pdf.setTextColor(180);
                    pdf.text('Sin datos', x + w / 2, y + h / 2, { align: 'center' });
                    return;
                }

                const props = pdf.getImageProperties(imgData);
                const imgR  = props.width / props.height;
                const boxR  = w / h;
                let iw, ih;

                if (imgR > boxR) {
                    iw = w - 2;
                    ih = iw / imgR;
                } else {
                    ih = h - 2;
                    iw = ih * imgR;
                }

                pdf.addImage(imgData, 'PNG',
                    x + (w - iw) / 2,
                    y + (h - ih) / 2,
                    iw, ih, undefined, 'FAST');
            };

            // ── Pie de página ──
            const drawFooter = (page, total) => {
                const fecha = new Date().toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' });
                pdf.setDrawColor(215, 218, 225);
                pdf.setLineWidth(0.2);
                pdf.line(M, PH - FOOT_H - 1, PW - M, PH - FOOT_H - 1);
                pdf.setFontSize(5.5);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(150, 155, 165);
                pdf.text(`Generado el ${fecha}`, M, PH - 2);
                pdf.text(`Página ${page} de ${total}`, PW - M, PH - 2, { align: 'right' });
            };

            // ═══════════════════════════════════════════════════════
            // PÁGINA 1: Header + KPIs + Evolución Temporal | Top Tipos
            // ═══════════════════════════════════════════════════════
            drawHeader();

            let curY = M + HDR_H + GAP;

            // KPIs vectoriales
            drawKpis(curY);
            curY += KPI_H + GAP;

            // Títulos de gráficos
            drawTitle('Evolución Temporal', M, curY);
            drawTitle('Top Tipos', M + CHART_W + GAP, curY);
            curY += TTL_H;

            // Alto disponible para los gráficos en esta página
            const chartH1 = PH - curY - FOOT_H - GAP - M;

            // Dos gráficos lado a lado → mismo ancho (CHART_W), mismo alto (chartH1)
            placeImg(imgTimeline, M,                     curY, CHART_W, chartH1);
            placeImg(imgCategory, M + CHART_W + GAP,     curY, CHART_W, chartH1);

            // ═══════════════════════════════════════════════════════
            // PÁGINA 2: Header + Horas | Mapa
            // ═══════════════════════════════════════════════════════
            pdf.addPage();
            drawHeader();

            curY = M + HDR_H + GAP;

            // Títulos
            drawTitle('Horas', M, curY);
            drawTitle('Mapa', M + CHART_W + GAP, curY);
            curY += TTL_H;

            // Alto disponible (más que página 1 porque no hay KPIs)
            const chartH2 = PH - curY - FOOT_H - GAP - M;

            // Dos gráficos lado a lado → mismo ancho, mismo alto
            placeImg(imgHours, M,                     curY, CHART_W, chartH2);
            placeImg(imgMap,   M + CHART_W + GAP,     curY, CHART_W, chartH2);

            // ═══════════════════════════════════════════════════════
            // PIES DE PÁGINA
            // ═══════════════════════════════════════════════════════
            const totalPages = pdf.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                pdf.setPage(i);
                drawFooter(i, totalPages);
            }

            // ═══════════════════════════════════════════════════════
            // GUARDAR
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
