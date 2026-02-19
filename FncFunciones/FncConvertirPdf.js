/**
 * EUROCOP ANALYTICS - EXPORTACIÓN PDF (VERSIÓN CORREGIDA)
 * Corrige fondos negros y páginas vacías.
 */

const FncConvertirPdf = {
    exportar: async function () {
        const { jsPDF } = window.jspdf;
        const btn = document.querySelector('.btn-export-pdf');
        if (!btn) return;

        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
        btn.disabled = true;

        try {
            // 1. LEER DATOS
            const nombreArchivo = document.getElementById('card-text-filename')?.textContent.trim() || 'INFORME';
            const selAnios = document.getElementById('header-year')?.textContent.trim() || 'TODOS';
            const selMeses = document.getElementById('header-month')?.textContent.trim() || 'TODOS';
            const selCats  = document.getElementById('header-category')?.textContent.trim() || 'TODOS';

            // 2. FUNCIÓN PARA CAPTURAR CANVAS CON FONDO BLANCO (Evita el fondo negro)
            const captureCanvas = (id) => {
                const canvas = document.getElementById(id);
                if (!canvas || canvas.style.display === 'none') return null;

                // Crear un canvas temporal para poner fondo blanco
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;
                const ctx = tempCanvas.getContext('2d');

                // Pintar fondo blanco
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

                // Dibujar el gráfico encima
                ctx.drawImage(canvas, 0, 0);

                return tempCanvas.toDataURL('image/jpeg', 1.0);
            };

            const imgTimeline = captureCanvas('chart-timeline');
            const imgCategory = captureCanvas('chart-category');
            
            // Solo capturar horas si el contenedor es visible
            const containerHours = document.getElementById('container-hours');
            const imgHours = (containerHours && containerHours.style.display !== 'none') ? captureCanvas('chart-hours') : null;

            // Solo capturar mapa si está activo
            let imgMap = null;
            if (typeof map !== 'undefined' && map && document.getElementById('main-map').offsetParent !== null) {
                map.triggerRepaint();
                await new Promise(r => map.once('idle', r));
                const mapCanvas = map.getCanvas();
                const tempMapCanvas = document.createElement('canvas');
                tempMapCanvas.width = mapCanvas.width;
                tempMapCanvas.height = mapCanvas.height;
                const ctxMap = tempMapCanvas.getContext('2d');
                ctxMap.fillStyle = '#FFFFFF';
                ctxMap.fillRect(0, 0, tempMapCanvas.width, tempMapCanvas.height);
                ctxMap.drawImage(mapCanvas, 0, 0);
                imgMap = tempMapCanvas.toDataURL('image/jpeg', 0.9);
            }

            // 3. CONFIGURACIÓN PDF
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
            const PW = 297, PH = 210, M = 10, GAP = 5;
            const CHART_W = (PW - (M * 2) - GAP) / 2;

            const drawHeader = () => {
                pdf.setFillColor(15, 22, 35);
                pdf.roundedRect(M, M, PW - M * 2, 18, 2, 2, 'F');
                pdf.setFont('helvetica', 'bold').setFontSize(11).setTextColor(94, 114, 228);
                pdf.text('EUROCOP ANALYTICS', M + 5, M + 8);
                pdf.setFontSize(8).setTextColor(255, 255, 255);
                pdf.text(nombreArchivo.toUpperCase(), PW / 2, M + 8, { align: 'center' });
                pdf.setFontSize(7).setTextColor(136, 152, 170);
                pdf.text(`AÑO: ${selAnios} | MES: ${selMeses} | CAT: ${selCats}`, M + 5, M + 14);
            };

            const placeImg = (imgData, x, y, w, h, title) => {
                if (!imgData) return;
                pdf.setDrawColor(230, 233, 240).roundedRect(x, y, w, h, 1, 1, 'S');
                pdf.setFontSize(8).setTextColor(50, 60, 80).setFont('helvetica', 'bold');
                pdf.text(title.toUpperCase(), x, y - 2);
                
                const props = pdf.getImageProperties(imgData);
                const ratio = props.width / props.height;
                let iw = w - 4, ih = iw / ratio;
                if (ih > h - 4) { ih = h - 4; iw = ih * ratio; }
                pdf.addImage(imgData, 'JPEG', x + (w - iw) / 2, y + (h - ih) / 2, iw, ih, undefined, 'FAST');
            };

            // PÁGINA 1
            drawHeader();
            let curY = M + 18 + 12;
            let chartH = PH - curY - M - 10;
            placeImg(imgTimeline, M, curY, CHART_W, chartH, 'Evolución Temporal');
            placeImg(imgCategory, M + CHART_W + GAP, curY, CHART_W, chartH, 'Top Categorías');

            // PÁGINA 2 (Solo si hay Horas o Mapa)
            if (imgHours || imgMap) {
                pdf.addPage();
                drawHeader();
                if (imgHours) placeImg(imgHours, M, curY, CHART_W, chartH, 'Distribución por Horas');
                if (imgMap) placeImg(imgMap, M + CHART_W + (imgHours ? GAP : -CHART_W), curY, imgHours ? CHART_W : PW - M*2, chartH, 'Análisis Geográfico');
            }

            // Guardar
            const fechaFile = new Date().toISOString().slice(0, 10);
            pdf.save(`Informe_${nombreArchivo.replace(/\s+/g, '_')}_${fechaFile}.pdf`);
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Generado';

        } catch (e) {
            console.error('Error Crítico PDF:', e);
            btn.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Error';
        } finally {
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 3000);
        }
    }
};