/**
 * MÓDULO: FncConvertirPdf.js 
 * VERSIÓN: Corregido - Sin recortes laterales
 */

const FncConvertirPdf = {
    exportar: async function() {
        const { jsPDF } = window.jspdf;
        const dashboard = document.querySelector('.main-content');
        const btn = document.querySelector('.btn-export-pdf');

        if (!dashboard) return;

        // 1. RECOPILAR INFORMACIÓN
        const nombreArchivo = (document.getElementById('display-filename')?.textContent.trim()) || "INFORME_EUROCOP";
        const getLabels = (id) => {
            const checked = Array.from(document.querySelectorAll(`#${id} input:checked`));
            const total = document.querySelectorAll(`#${id} input`).length;
            if (checked.length === 0) return "NINGUNO";
            if (checked.length === total) return "TODOS";
            return checked.map(i => i.nextElementSibling.innerText).join(', ');
        };
        const selAnios = getLabels('list-year');
        const selMeses = getLabels('list-month');

        btn.innerHTML = '<i class="fa-solid fa-compress fa-spin"></i> Generando PDF...';
        btn.disabled = true;

        // 2. CAPTURAR MAPA
        let mapSnapshot = null;
        if (typeof map !== 'undefined' && map) {
            map.triggerRepaint();
            await new Promise(r => map.once('idle', r));
            mapSnapshot = map.getCanvas().toDataURL('image/png');
        }

        // 3. CONFIGURACIÓN PARA EVITAR RECORTES
        const CAPTURE_WIDTH = 1480; // Aumentado para dar más espacio
        const CAPTURE_HEIGHT = Math.round(CAPTURE_WIDTH / 1.414);

        try {
            const canvas = await html2canvas(dashboard, {
                scale: 1.5,
                useCORS: true,
                allowTaint: true,
                backgroundColor: "#f4f6f9",
                width: CAPTURE_WIDTH,
                height: CAPTURE_HEIGHT,
                windowWidth: CAPTURE_WIDTH,
                scrollY: -window.scrollY,
                scrollX: -window.scrollX,
                x: 0,
                y: 0,
                onclone: (clonedDoc) => {
                    const clonedDashboard = clonedDoc.querySelector('.main-content');
                    
                    // Layout forzado con espacio extra
                    clonedDashboard.style.width = `${CAPTURE_WIDTH}px`;
                    clonedDashboard.style.height = `${CAPTURE_HEIGHT}px`;
                    clonedDashboard.style.minWidth = `${CAPTURE_WIDTH}px`;
                    clonedDashboard.style.maxWidth = `${CAPTURE_WIDTH}px`;
                    clonedDashboard.style.display = "block";
                    clonedDashboard.style.padding = "20px";
                    clonedDashboard.style.margin = "0";
                    clonedDashboard.style.boxSizing = "border-box";
                    clonedDashboard.style.overflow = "visible"; // CAMBIADO de hidden a visible

                    // Cabecera profesional
                    const header = clonedDoc.createElement('div');
                    header.style.cssText = `
                        display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; 
                        background: #0f1623; color: white; padding: 12px 25px; border-radius: 10px; 
                        margin-bottom: 15px; font-family: 'Inter', sans-serif;
                    `;
                    header.innerHTML = `
                        <div style="text-align: left;">
                            <h1 style="margin:0; font-size:16px; color:#5e72e4; font-weight:800;">EUROCOP ANALYTICS.</h1>
                        </div>
                        <div style="text-align: center;">
                            <div style="background:rgba(255,255,255,0.1); padding:5px 18px; border-radius:8px; font-size:12px; font-weight:600; text-transform: uppercase;">
                                ${nombreArchivo}
                            </div>
                        </div>
                        <div style="display:flex; gap:12px; justify-content:flex-end; font-size:10px; color:#8898aa;">
                            <div><strong>AÑO:</strong> <span style="color:#11cdef;">${selAnios}</span></div>
                            <div><strong>MES:</strong> <span style="color:#11cdef;">${selMeses}</span></div>
                        </div>
                    `;
                    clonedDashboard.prepend(header);

                    // Reemplazar mapa
                    const clonedMap = clonedDoc.getElementById('main-map');
                    if (clonedMap && mapSnapshot) {
                        clonedMap.innerHTML = `<img src="${mapSnapshot}" style="width:100%; height:100%; object-fit:cover; border-radius:10px;">`;
                    }

                    // CRÍTICO: Asegurar que los contenedores de gráficos no recorten
                    clonedDoc.querySelectorAll('.chart-container, .canvas-wrapper').forEach(container => {
                        container.style.overflow = 'visible';
                        container.style.position = 'relative';
                        container.style.width = '100%';
                        container.style.boxSizing = 'border-box';
                    });

                    // Ajustar grids para que no compriman contenido
                    const chartsGridTop = clonedDoc.querySelector('.charts-grid-top');
                    if (chartsGridTop) {
                        chartsGridTop.style.display = 'grid';
                        chartsGridTop.style.gridTemplateColumns = '1fr 1fr';
                        chartsGridTop.style.gap = '15px';
                        chartsGridTop.style.marginBottom = '15px';
                    }

                    const bottomGrid = clonedDoc.querySelector('.bottom-grid');
                    if (bottomGrid) {
                        bottomGrid.style.display = 'grid';
                        bottomGrid.style.gridTemplateColumns = '1fr 1.5fr';
                        bottomGrid.style.gap = '15px';
                    }

                    // Asegurar que los canvas no se recorten
                    clonedDoc.querySelectorAll('canvas').forEach(canvas => {
                        const parent = canvas.parentElement;
                        if (parent) {
                            parent.style.overflow = 'visible';
                            parent.style.width = '100%';
                            parent.style.height = 'auto';
                        }
                        canvas.style.maxWidth = '100%';
                        canvas.style.height = 'auto';
                        canvas.style.display = 'block';
                    });

                    // Ajustar KPIs
                    const kpiGrid = clonedDoc.querySelector('.kpi-grid');
                    if (kpiGrid) {
                        kpiGrid.style.marginBottom = '15px';
                        kpiGrid.style.display = 'grid';
                        kpiGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
                        kpiGrid.style.gap = '15px';
                    }

                    // Limpiar elementos interactivos
                    clonedDoc.querySelectorAll('button, .header-actions select, .btn-maximize, .mapboxgl-ctrl').forEach(el => {
                        el.style.visibility = 'hidden';
                        el.style.display = 'none';
                    });

                    // Ocultar cabeceras de acciones pero mantener títulos
                    clonedDoc.querySelectorAll('.header-actions').forEach(el => {
                        el.style.display = 'none';
                    });
                }
            });

            // 4. GENERAR PDF CON AJUSTE PERFECTO
            const imgData = canvas.toDataURL('image/png', 0.95);
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4',
                compress: true
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            // Márgenes mínimos para aprovechar espacio
            const margin = 6;
            const availableWidth = pdfWidth - (margin * 2);
            const availableHeight = pdfHeight - (margin * 2);

            const imgProps = pdf.getImageProperties(imgData);
            const imgRatio = imgProps.width / imgProps.height;
            const pageRatio = availableWidth / availableHeight;

            let finalWidth, finalHeight;

            if (imgRatio > pageRatio) {
                finalWidth = availableWidth;
                finalHeight = availableWidth / imgRatio;
            } else {
                finalHeight = availableHeight;
                finalWidth = availableHeight * imgRatio;
            }

            const x = (pdfWidth - finalWidth) / 2;
            const y = (pdfHeight - finalHeight) / 2;

            pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight, undefined, 'FAST');
            
            const fechaHoy = new Date().toISOString().slice(0,10);
            pdf.save(`${nombreArchivo.replace(/\s+/g, '_')}_${fechaHoy}.pdf`);

            btn.innerHTML = '<i class="fa-solid fa-check"></i> PDF Generado';
            setTimeout(() => {
                btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> EXPORTAR A PDF (A4)';
            }, 2000);

        } catch (e) {
            console.error("Error en PDF:", e);
            btn.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i> Error';
            setTimeout(() => {
                btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> EXPORTAR A PDF (A4)';
            }, 2000);
        } finally {
            btn.disabled = false;
        }
    }
};