/**
 * EUROCOP ANALYTICS - UTILIDADES GENÉRICAS
 * Helpers que son usados por otros módulos: loader, toast, modales, fullscreen, descargas.
 */

// ============================================================
// PANTALLA DE CARGA (LOADER)
// ============================================================
/**
 * Ejecuta una función pesada envuelta en el spinner de carga.
 * El navegador dibuja el spinner antes de bloquear con el cálculo.
 */
function runWithLoader(actionCallback) {
    // Asegurar que el texto del loader está en el idioma activo antes de mostrarlo
    const loaderTxt = document.querySelector('#loading-overlay [data-i18n="loading_msg"]');
    if (loaderTxt && typeof currentLang !== 'undefined' && typeof translations !== 'undefined') {
        const msg = (translations[currentLang] || {}).loading_msg;
        if (msg) loaderTxt.textContent = msg;
    }
    document.getElementById('loading-overlay').classList.add('active');
    setTimeout(() => {
        try {
            actionCallback();
        } catch (e) {
            console.error("Error durante el procesamiento:", e);
        } finally {
            document.getElementById('loading-overlay').classList.remove('active');
        }
    }, 50);
}

// ============================================================
// TOAST (NOTIFICACIÓN TEMPORAL)
// ============================================================
function showToast(message, duration = 6000) {
    const toast = document.getElementById('toast-notification');
    const msgSpan = document.getElementById('toast-message');
    if (toast && msgSpan) {
        msgSpan.innerText = message;
        toast.classList.add('active');
        setTimeout(() => { toast.classList.remove('active'); }, duration);
    }
}

// ============================================================
// MODALES PDF / IMAGEN
// ============================================================
function openPdfModal(fileName, title) {
    document.getElementById('pdf-modal-title').innerHTML = `<i class="fa-solid fa-file-pdf"></i> ${title}`;
    let versionParam = (typeof EUROCOP_VERSION !== 'undefined') ? EUROCOP_VERSION : new Date().getTime();

    const iframe = document.getElementById('pdf-frame');
    const img   = document.getElementById('img-frame');

    if (img)    img.style.display = 'none';
    if (iframe) {
        iframe.style.display = 'block';
        iframe.src = "./ArchivosPdf/" + fileName + "?v=" + versionParam;
    }
    document.getElementById('pdf-modal').classList.add('active');
}

function openImageModal(path, title) {
    const titleEl = document.getElementById('pdf-modal-title');
    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-image"></i> ${title}`;

    const iframe = document.getElementById('pdf-frame');
    const img   = document.getElementById('img-frame');
    const modal = document.getElementById('pdf-modal');

    if (iframe) iframe.style.display = 'none';
    if (img) {
        img.src = path + "?v=" + new Date().getTime();
        img.style.display = 'block';
    }
    modal.classList.add('active');
}

function closePdfModal() {
    const modal  = document.getElementById('pdf-modal');
    const iframe = document.getElementById('pdf-frame');
    const img    = document.getElementById('img-frame');

    modal.classList.remove('active');
    setTimeout(() => {
        if (iframe) iframe.src = "";
        if (img)    img.src = "";
    }, 300);
}

// ============================================================
// MODAL DE REGISTROS RECHAZADOS (fechas inválidas)
// ============================================================
function showRejectedModal(lista) {
    const container = document.getElementById('rejected-list');
    if (container) {
        container.innerHTML = lista.map(item =>
            `<div><i class="fa-solid fa-xmark" style="color:#f5365c"></i> ${item}</div>`
        ).join('');
    }
    document.getElementById('rejected-modal').classList.add('active');
}

function closeRejectedModal() {
    document.getElementById('rejected-modal').classList.remove('active');
}

// ============================================================
// MODAL DE REGISTROS DETALLADOS (clic en gráfico timeline)
// ============================================================
function showDetailedRecords(periodLabel, categoryName) {
    const t = translations[currentLang];

    // Filtrar por período y categoría
    const filtered = lastFilteredData.filter(d => {
        if (d.cat !== categoryName) return false;

        // Extraer la parte de texto de la etiqueta (sin el "(total)")
        const labelClean = periodLabel.replace(/\s*\(\d+\)$/, '').trim();

        if (temporalView === 'year')    return d.year.toString() === labelClean;
        if (temporalView === 'month')   return t.months_abbr[d.month - 1] === labelClean;
        if (temporalView === 'quarter') {
            const qIndex = Math.floor((d.month - 1) / 3);
            return t.quarters[qIndex] === labelClean;
        }
        if (temporalView === 'day') {
            let idx = d.date.getDay();
            let dayName = t.days_abbr[idx === 0 ? 6 : idx - 1].substring(0, 3);
            return dayName === labelClean;
        }
        if (temporalView === 'daily') {
            // La etiqueta tiene formato "DD/MM/YY L" — extraemos solo los primeros 8 chars
            const dateKey = labelClean.substring(0, 8);
            const dd = String(d.date.getDate()).padStart(2, '0');
            const mm = String(d.date.getMonth() + 1).padStart(2, '0');
            const yy = String(d.date.getFullYear()).slice(-2);
            return `${dd}/${mm}/${yy}` === dateKey;
        }
        return false;
    });

    if (filtered.length === 0) return;

    // Traducciones
    const labelReg  = { es: 'Registros', eu: 'Erregistro', ca: 'Registres', gl: 'Rexistros' }[currentLang];
    const labelCat  = { es: 'CATEGORÍA', eu: 'KATEGORIA',  ca: 'CATEGORIA', gl: 'CATEGORÍA' }[currentLang];
    const labelDate = { es: 'FECHA',     eu: 'DATA',       ca: 'DATA',      gl: 'DATA'      }[currentLang];

    document.getElementById('records-modal-title').innerText =
        `${categoryName} (${periodLabel}): ${filtered.length} ${labelReg}`;

    let html = `<table class="data-table" style="width:100%;">
        <thead><tr>
            <th style="text-align:left;">REF/EXP</th>
            <th>${labelDate}</th>
            <th style="text-align:left;">${labelCat}</th>
        </tr></thead><tbody>`;

    filtered.forEach(d => {
        const dateStr = d.date.toLocaleString([], {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        html += `<tr>
            <td style="color:var(--accent-blue); font-weight:bold; text-align:left;">REF${d.refanno}-${d.refnum}</td>
            <td style="font-size:0.85rem;">${dateStr}</td>
            <td style="text-align:left; font-size:0.85rem; font-weight:600; color:#32325d;">${d.cat}</td>
        </tr>`;
    });

    document.getElementById('records-table-container').innerHTML = html + `</tbody></table>`;
    document.getElementById('records-modal').classList.add('active');
}

function closeRecordsModal() {
    document.getElementById('records-modal').classList.remove('active');
}

// ============================================================
// FULLSCREEN (contenedores: gráficos y mapa)
// ============================================================
// --- SUSTITUYE TU FUNCIÓN toggleFullscreen POR ESTA ---
function toggleFullscreen(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const isFullscreen = container.classList.toggle('fullscreen');
    const btnIcon = container.querySelector('.btn-maximize i');

    if (isFullscreen) {
        if (btnIcon) { btnIcon.classList.remove('fa-maximize', 'fa-expand'); btnIcon.classList.add('fa-xmark'); }
        document.body.style.overflow = 'hidden';
    } else {
        if (btnIcon) {
            btnIcon.classList.remove('fa-xmark');
            btnIcon.classList.add(containerId === 'container-map' ? 'fa-expand' : 'fa-maximize');
        }
        document.body.style.overflow = '';
    }

    // El tiempo debe ser suficiente para que la animación CSS termine
    setTimeout(() => {
        if (map) map.resize();
        
        // FORZAR REDIBUJADO DE GRÁFICOS AL NUEVO TAMAÑO
        if (chartHours) chartHours.resize();
        if (chartTimeline) chartTimeline.resize();
        if (chartCategory) chartCategory.resize();

        // Si hay tablas, se mantienen las lógicas de visibilidad que ya tenías
        if (containerId === 'container-category' && isTableCatView) {
            document.getElementById('chart-category').style.display = 'none';
            document.getElementById('table-category-view').style.display = 'block';
        }
        if (containerId === 'container-hours' && isTableHoursView) {
            document.getElementById('chart-hours').style.display = 'none';
            document.getElementById('table-hours-view').style.display = 'block';
        }
        if (containerId === 'container-timeline' && isTableView) {
            document.getElementById('chart-timeline').style.display = 'none';
            document.getElementById('table-timeline-view').style.display = 'block';
        }
    }, 350); // 350ms es el tiempo ideal para transiciones CSS
}

// ============================================================
// DESCARGA DE COMPONENTES (gráficos, mapa, tablas)
// ============================================================
function downloadComponent(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 1. MAPA → captura directa del canvas de MapLibre
    if (containerId === 'container-map' && map) {
        map.triggerRepaint();
        requestAnimationFrame(() => {
            try {
                const mapCanvas = container.querySelector('.maplibregl-canvas');
                if (mapCanvas) {
                    const link = document.createElement('a');
                    link.download = `Mapa_${nombreArchivoSubido}_${new Date().getTime()}.png`;
                    link.href = mapCanvas.toDataURL('image/png');
                    link.click();
                }
            } catch (e) {
                console.error("Error capturando mapa:", e);
                alert("Error al exportar el mapa. Inténtalo de nuevo.");
            }
        });
        return;
    }

    // 2. TABLAS → html2canvas sobre el div .table-view
    const tableView = container.querySelector('.table-view');
    if (tableView && tableView.style.display !== 'none') {
        document.getElementById('loading-overlay').classList.add('active');
        html2canvas(tableView, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false })
            .then(canvasTable => {
                const link = document.createElement('a');
                link.download = `Tabla_${containerId}.png`;
                link.href = canvasTable.toDataURL('image/png');
                link.click();
                document.getElementById('loading-overlay').classList.remove('active');
            });
        return;
    }

    // 3. GRÁFICOS Chart.js → copia canvas con fondo blanco
    const standardCanvas = container.querySelector('canvas:not(.maplibregl-canvas)');
    if (standardCanvas) {
        const link = document.createElement('a');
        link.download = `Grafico_${containerId}.png`;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width  = standardCanvas.width;
        tempCanvas.height = standardCanvas.height;
        const ctx = tempCanvas.getContext('2d');
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        ctx.drawImage(standardCanvas, 0, 0);

        link.href = tempCanvas.toDataURL('image/png');
        link.click();
    }
}

// ============================================================
// HELPERS DE TEXTO
// ============================================================
function truncateText(str, maxLength) {
    if (!str) return "";
    return str.length > maxLength ? str.substring(0, maxLength).trim() + "..." : str;
}

function cleanCategoryName(categoryName) {
    if (!categoryName) return categoryName;
    return categoryName.replace(/^[\d\s.]+/, '').trim();
}

// ============================================================
// HELPER: OBTENER TEXTO COMPLETO DE UN FILTRO (tooltip)
// ============================================================
function getFullListString(containerId) {
    const checked = Array.from(document.querySelectorAll(`#${containerId} input:checked`));
    if (checked.length === 0) return "Ninguno";
    return checked.map(i => i.nextElementSibling.innerText).join(", ");
}

// ============================================================
// ICONOS DE ORDENAMIENTO EN TABLAS
// ============================================================
function updateSortIcons(activeCol, containerSelector, sortObj) {
    document.querySelectorAll(containerSelector + ' th i').forEach(i => i.className = 'fa-solid fa-sort');
    const ths = document.querySelectorAll(containerSelector + ' th');
    for (let th of ths) {
        if (th.getAttribute('onclick') && th.getAttribute('onclick').includes(`'${activeCol}'`)) {
            th.querySelector('i').className = sortObj.dir === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
        }
    }
}
