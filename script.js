/**
 * EUROCOP ANALYTICS - SCRIPT FINAL 2026
 * Versión: Full Integrated (Stats + LineChart + TableFix + Geo + Lang)
 */

// ============================================================
// 1. VARIABLES GLOBALES
// ============================================================
let rawData = [];
let finalData = [];
let map;
let chartTimeline, chartCategory, chartHours;
let nombreArchivoSubido = "INFORME ANALYTICS";

let isSatelite = false;
let chartTimelineType = 'bar'; // Variable para alternar gráfico
let isHeatmap = false; 
let temporalView = 'year'; 
let currentLang = localStorage.getItem('eurocop_lang') || 'es';

// Variables para Tablas
let isTableView = false; 
let tableDataCache = []; 
let currentSort = { col: 'index', dir: 'desc' };

let isTableCatView = false;
let tableCatDataCache = [];
let currentSortCat = { col: 'count', dir: 'desc' };

let isTableHoursView = false;
let tableHoursDataCache = [];
let currentSortHours = { col: 'hour', dir: 'asc' };

const yearColors = [
    { bg: 'rgba(94, 114, 228, 0.7)', border: '#5e72e4' },   
    { bg: 'rgba(45, 206, 137, 0.7)', border: '#2dce89' },   
    { bg: 'rgba(251, 99, 64, 0.7)', border: '#fb6340' },    
    { bg: 'rgba(17, 205, 239, 0.7)', border: '#11cdef' },   
    { bg: 'rgba(245, 54, 92, 0.7)', border: '#f5365c' },    
    { bg: 'rgba(137, 101, 224, 0.7)', border: '#8965e0' },  
    { bg: 'rgba(155, 14, 14, 0.7)', border: '#b71825ff' }    
];

const monthsConfig = [
    { id: 1, abbr: 'Ene' }, { id: 2, abbr: 'Feb' }, { id: 3, abbr: 'Mar' },
    { id: 4, abbr: 'Abr' }, { id: 5, abbr: 'May' }, { id: 6, abbr: 'Jun' },
    { id: 7, abbr: 'Jul' }, { id: 8, abbr: 'Ago' }, { id: 9, abbr: 'Sep' },
    { id: 10, abbr: 'Oct' }, { id: 11, abbr: 'Nov' }, { id: 12, abbr: 'Dic' }
];

// ============================================================
// 2. LÓGICA RESPONSIVE / MENU MÓVIL
// ============================================================
function toggleSidebarMobile() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        document.getElementById('sidebar').classList.remove('active');
        document.getElementById('mobile-overlay').classList.remove('active');
    }
    if (map) setTimeout(() => map.resize(), 300);
});

// ============================================================
// 3. CARGA DE ARCHIVOS
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    // --- NUEVO BLOQUE: PINTAR VERSIÓN ---
    const versionBadge = document.getElementById('app-version-badge');
    if (versionBadge && typeof EUROCOP_VERSION !== 'undefined') {
        versionBadge.textContent = 'v' + EUROCOP_VERSION;
    }
    const langSelect = document.getElementById('lang-selector');
    if(langSelect) langSelect.value = currentLang;
    applyLanguage(currentLang);

    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    if (dropZone && fileInput) {
        dropZone.onclick = () => fileInput.click();
        fileInput.onchange = (e) => { if (e.target.files.length > 0) processFile(e.target.files[0]); };

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
        });
        ['dragenter', 'dragover'].forEach(eventName => dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false));
        ['dragleave', 'drop'].forEach(eventName => dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false));
        
        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) processFile(files[0]);
        });
    }
});

// Función para mostrar el aviso temporal
function showToast(message, duration = 6000) {
    const toast = document.getElementById('toast-notification');
    const msgSpan = document.getElementById('toast-message');
    
    if (toast && msgSpan) {
        msgSpan.innerText = message;
        toast.classList.add('active');
        
        // Ocultar automáticamente después del tiempo definido
        setTimeout(() => {
            toast.classList.remove('active');
        }, duration);
    }
}

function processFile(file) {
    if (!file) return;

    // --- NUEVO: COMPROBACIÓN DE TAMAÑO (4MB) ---
    const FILE_SIZE_LIMIT = 4 * 1024 * 1024; // 4 MB en bytes
    
    if (file.size > FILE_SIZE_LIMIT) {
        showToast("⚠️ Archivo grande detectado. Para un mejor rendimiento, se recomienda filtrar previamente por años en Eurocop.");
    }
    // --------------------------------------------

    document.getElementById('loading-overlay').classList.add('active');

    setTimeout(() => {
        try {
            nombreArchivoSubido = file.name.replace(/\.[^/.]+$/, "").toUpperCase();
            const displayEl = document.getElementById('display-filename');
            if (displayEl) displayEl.textContent = nombreArchivoSubido;

            if (file.name.endsWith('.csv')) {
                // ... (código existente del CSV) ...
                Papa.parse(file, {
                    header: true, skipEmptyLines: true, encoding: "UTF-8",
                    complete: (res) => {
                        showMapping(res.data);
                        document.getElementById('loading-overlay').classList.remove('active');
                    },
                    error: (err) => {
                        console.error(err); alert("Error al leer CSV");
                        document.getElementById('loading-overlay').classList.remove('active');
                    }
                });
            } else {
                // ... (código existente del Excel) ...
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const dataArr = new Uint8Array(e.target.result);
                        const wb = XLSX.read(dataArr, {type: 'array', cellDates: true});
                        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
                        showMapping(data);
                    } catch (error) {
                        console.error(error); alert("El archivo Excel parece dañado.");
                    } finally {
                        document.getElementById('loading-overlay').classList.remove('active');
                    }
                };
                reader.readAsArrayBuffer(file);
            }
        } catch (e) {
            console.error(e);
            document.getElementById('loading-overlay').classList.remove('active');
        }
    }, 500); // Aumentamos un poco el timeout inicial para que dé tiempo a ver el Toast empezar a bajar
}

function goToMapping() {
    // Si estamos en dashboard, volvemos a config
    if (document.getElementById('dashboard-view').classList.contains('active')) {
        document.getElementById('dashboard-view').classList.remove('active');
        document.getElementById('mapping-view').classList.add('active');
        window.scrollTo(0, 0); // Scroll arriba
        setTimeout(() => { if(map) map.resize(); }, 300);
    }
}

// ============================================================
// 4. MAPEO
// ============================================================
function showMapping(data) {
    rawData = data;
    const headers = Object.keys(data[0]);
    const mappingIds = ['map-expediente', 'map-fecha', 'map-hora', 'map-lat', 'map-lon', 'map-categoria'];
    
    mappingIds.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        
        const newSel = sel.cloneNode(false);
        sel.parentNode.replaceChild(newSel, sel);
        newSel.addEventListener('change', refreshMappingStatus);

        if (id === 'map-hora') {
            newSel.innerHTML = '<option value="">-- Sin hora (00:00) --</option>';
        } 
        else if (id === 'map-categoria') {
            // --- OPCIÓN ESPECIAL PARA ARCHIVOS ESTADÍSTICOS ---
            newSel.innerHTML = '<option value="" disabled selected>Seleccionar...</option>';
            const optSpecial = document.createElement('option');
            optSpecial.value = "***MULTI_COLUMN***";
            optSpecial.textContent = "📊 [ USAR COLUMNAS COMO CATEGORIAS ]";
            optSpecial.style.fontWeight = "bold";
            optSpecial.style.color = "#fb6340";
            newSel.appendChild(optSpecial);
        }
        else {
            newSel.innerHTML = '<option value="" disabled selected>Seleccionar...</option>';
        }

        headers.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h; 
            opt.textContent = h;
            newSel.appendChild(opt);
        });

        // AUTO-SELECCIÓN
        let match = null;
        if (id === 'map-expediente') {
            match = headers.find(h => h.toUpperCase().includes('REFNUM')) || 
                    headers.find(h => h.toUpperCase().includes('EXPEDIENTE')) ||
                    headers.find(h => h.toUpperCase() === 'NUMERO' || h.toUpperCase() === 'ID');
        }
        else if (id === 'map-fecha') {
            match = headers.find(h => h.toUpperCase().includes('FECHA') || h.toUpperCase().includes('DATE'));
        }
        else if (id === 'map-hora') {
            match = headers.find(h => h.toUpperCase().includes('HORA') || h.toUpperCase().includes('TIME'));
        }
        else if (id === 'map-lat') {
            match = headers.find(h => h.toUpperCase() === 'Y' || h.toUpperCase().includes('LAT'));
        }
        else if (id === 'map-lon') {
            match = headers.find(h => h.toUpperCase() === 'X' || h.toUpperCase().includes('LON') || h.toUpperCase().includes('LNG'));
        }
        else if (id === 'map-categoria') {
            match = headers.find(h => h.toUpperCase().includes('TIPO') || h.toUpperCase().includes('CAT') || h.toUpperCase().includes('CAUSA'));
        }

        if (match) newSel.value = match;
    });

    const locInput = document.getElementById('map-localidad');
    if(locInput) locInput.value = "";
    
    refreshMappingStatus();
    document.getElementById('upload-view').classList.remove('active'); // Quitar activa a upload
    document.getElementById('mapping-view').classList.add('active');   // Poner activa a mapping
    window.scrollTo(0, 0);
}

function refreshMappingStatus() {
    const mappingIds = ['map-expediente', 'map-fecha', 'map-hora', 'map-lat', 'map-lon', 'map-categoria'];
    const currentSelections = mappingIds.map(id => {
        const el = document.getElementById(id);
        return el ? el.value : "";
    }).filter(val => val !== "");

    mappingIds.forEach(id => {
        const sel = document.getElementById(id);
        if(!sel) return;
        Array.from(sel.options).forEach(opt => {
            if (opt.value === "" || opt.disabled || opt.value === "***MULTI_COLUMN***") return;
            const isUsedElsewhere = currentSelections.includes(opt.value) && sel.value !== opt.value;
            let textoVisual = opt.value.replace('__EMPTY', 'BLANCO'); 
            const symbol = isUsedElsewhere ? "✕ " : (sel.value === opt.value ? "✓ " : "• ");
            opt.textContent = symbol + textoVisual;
            opt.style.color = isUsedElsewhere ? "#cbd5e0" : "#5e72e4";
        });
    });
}

// ============================================================
// 5. PROCESAMIENTO
// ============================================================
document.getElementById('btn-visualizar').onclick = () => {
    const config = {
        exp: document.getElementById('map-expediente').value,
        fecha: document.getElementById('map-fecha').value,
        hora: document.getElementById('map-hora').value,
        lat: document.getElementById('map-lat').value,
        lon: document.getElementById('map-lon').value,
        cat: document.getElementById('map-categoria').value,
        locManual: document.getElementById('map-localidad').value.trim() 
    };

    if (!config.fecha) {
        alert("Por favor, selecciona al menos la columna de FECHA.");
        return;
    }

    let registrosSinFecha = [];
    finalData = [];

    // --- LÓGICA 1: PROCESAMIENTO ESTADÍSTICO (COLUMNAS COMO CATEGORÍAS) ---
    if (config.cat === "***MULTI_COLUMN***") {
        rawData.forEach(row => {
            let valFecha = row[config.fecha];
            let d;
            if (valFecha instanceof Date) d = new Date(valFecha);
            else if (typeof valFecha === 'string' && valFecha.includes('/')) {
                const parts = valFecha.split('/');
                if (parts.length >= 3) d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                else d = new Date(valFecha);
            } else d = new Date(valFecha);

            if (isNaN(d.getTime())) return; 

            Object.keys(row).forEach(colName => {
                if (colName === config.fecha || colName === config.hora || colName === config.lat || colName === config.lon || colName === config.exp) return;
                const val = row[colName];
                const cantidad = parseInt(val);
                if (!isNaN(cantidad) && cantidad > 0) {
                    for (let i = 0; i < cantidad; i++) {
                        finalData.push({
                            exp: "AUTO-GEN", 
                            date: d, year: d.getFullYear(), month: d.getMonth() + 1, hour: 12,
                            lat: 0, lon: 0, hasGeo: false,
                            cat: colName.trim().toUpperCase(),
                            locManual: config.locManual,
                            calle: "", numero: "", refnum: "", refanno: ""
                        });
                    }
                }
            });
        });
    } 
    // --- LÓGICA 2: PROCESAMIENTO ESTÁNDAR (LISTADO) ---
    else {
        finalData = rawData.map(row => {
            let valFecha = row[config.fecha];
            let d;
            if (valFecha instanceof Date) d = new Date(valFecha);
            else if (typeof valFecha === 'string' && valFecha.includes('/')) {
                const parts = valFecha.split('/');
                if (parts.length >= 3) {
                    d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
                } else d = new Date(valFecha);
            } else d = new Date(valFecha);

            if (isNaN(d.getTime())) {
                const keys = Object.keys(row);
                const keyAnno = keys.find(k => k.toUpperCase().includes('REFANNO')) || keys.find(k => k.toUpperCase().includes('ANNO'));
                const keyNum  = keys.find(k => k.toUpperCase().includes('REFNUM')) || keys.find(k => k.toUpperCase().includes('REFEXP')) || keys.find(k => k.toUpperCase().includes('NUMERO'));
                let valAnno = keyAnno ? row[keyAnno] : "??";
                let valNum  = keyNum ? row[keyNum] : "??";
                registrosSinFecha.push(`REF${valAnno}-${valNum}`);
                return null;
            }

            if (config.hora && row[config.hora]) {
                const t = String(row[config.hora]).trim();
                if (t.includes(':')) { 
                    const p = t.split(':'); 
                    d.setHours(parseInt(p[0]) || 0, parseInt(p[1]) || 0, 0); 
                }
            }
            
            let lat = 0, lon = 0, tieneUbicacion = false;
            if (config.lat && config.lon) {
                lat = parseFloat(String(row[config.lat]).replace(',', '.'));
                lon = parseFloat(String(row[config.lon]).replace(',', '.'));
                if (!isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0)) tieneUbicacion = true;
            }

            return {
                exp: row[config.exp] || "N/A",
                date: d, year: d.getFullYear(), month: d.getMonth() + 1, hour: d.getHours(),
                lat, lon, hasGeo: tieneUbicacion,
                cat: row[config.cat] || "General",
                locManual: config.locManual, 
                calle: row['CALLE'] || row['calle'] || "", numero: row['NUMERO'] || row['numero'] || "",
                refnum: row['REFNUM'] || "", refanno: row['REFANNO'] || ""
            };
        }).filter(v => v !== null);
    }

    if (finalData.length === 0 && registrosSinFecha.length === 0) {
        alert("No se han generado datos. Revisa el archivo.");
        return;
    }

    document.getElementById('mapping-view').classList.remove('active');
    document.getElementById('dashboard-view').classList.add('active')
    // Resetear scroll
    window.scrollTo(0, 0);
    setupFilters();
    initMap();
    // Pequeño timeout para asegurar que el DOM está pintado antes de actualizar gráficos
    setTimeout(() => {
        updateUI();
        if(map) map.resize(); // Forzar redimensionado del mapa
    }, 500);

    if (registrosSinFecha.length > 0) {
        registrosSinFecha.sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }));
        showRejectedModal(registrosSinFecha);
    }
};

function showRejectedModal(lista) {
    const container = document.getElementById('rejected-list');
    if(container) {
        container.innerHTML = lista.map(item => `<div><i class="fa-solid fa-xmark" style="color:#f5365c"></i> ${item}</div>`).join('');
    }
    document.getElementById('rejected-modal').classList.add('active');
}
function closeRejectedModal() { document.getElementById('rejected-modal').classList.remove('active'); }

// ============================================================
// 6. FILTROS
// ============================================================
function setupFilters() {
    const years = [...new Set(finalData.map(d => d.year))].sort((a,b) => b-a);
    const cats = [...new Set(finalData.map(d => d.cat))].sort();
    
    renderCheckboxes('items-year', years, years[0]); 
    renderCheckboxes('items-month', monthsConfig, 'all'); 
    renderCheckboxes('items-category', cats, 'all');
}

function renderCheckboxes(containerId, items, defaultValue) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const t = translations[currentLang]; 

    items.forEach(item => {
        let val, label;
        if(typeof item === 'object') {
            val = item.id;
            if(containerId === 'items-month') label = t.months_abbr[item.id - 1]; 
            else label = item.name || item.id;
        } else {
            val = item; label = item;
        }

        const div = document.createElement('div');
        div.className = 'checkbox-item';
        // CAMBIO AQUÍ: en lugar de updateUI(), llamamos a triggerUpdateWithLoader()
        const isChecked = (defaultValue === 'all' || val == defaultValue) ? 'checked' : '';
        div.innerHTML = `<input type="checkbox" value="${val}" ${isChecked} onchange="triggerUpdateWithLoader()"> <span>${label}</span>`;
        container.appendChild(div);
    });
}

// Función auxiliar pequeña para los checkboxes
function triggerUpdateWithLoader() {
    runWithLoader(() => {
        updateUI();
    });
}

function toggleDropdown(id) {
    const el = document.getElementById(id);
    const isActive = el.classList.contains('active');
    document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('active'));
    if (!isActive) {
        el.classList.add('active');
        const rect = el.getBoundingClientRect();
        const spaceAvailable = window.innerHeight - rect.top - 50; 
        const itemsCont = el.querySelector('.dropdown-items');
        itemsCont.style.maxHeight = Math.max(150, spaceAvailable) + "px";
    }
}

window.onclick = (e) => {
    if (!e.target.closest('.custom-dropdown')) {
        document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('active'));
    }
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.querySelector('.mobile-menu-btn');
    if (window.innerWidth <= 768 && sidebar.classList.contains('active') && !sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
        toggleSidebarMobile();
    }
};

function toggleGroup(containerId, state, event) {
    if (event) event.stopPropagation();
    
    // Usamos el envoltorio de carga
    runWithLoader(() => {
        const container = document.getElementById(containerId);
        if (container) {
            container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = state);
            updateUI(); // La operación pesada
        }
    });
}
/* ... dentro de script.js ... */

// VARIABLE GLOBAL PARA EL TEMPORIZADOR DE BÚSQUEDA
let searchTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
    // ... tu código existente ...

    // LÓGICA DEL BUSCADOR DE CATEGORÍAS
// ... dentro de document.addEventListener ...

    // LÓGICA DEL BUSCADOR DE CATEGORÍAS (MULTITERMINO / AND)
    const searchInput = document.getElementById('cat-search-input');
    
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            // 1. Obtener lo que escribe el usuario en minúsculas
            const rawText = e.target.value.toLowerCase();
            
            // 2. Dividir por espacios para obtener las "palabras clave"
            // .trim() quita espacios al inicio/final
            // .split(' ') separa por espacios
            // .filter(...) elimina huecos vacíos si el usuario pone doble espacio
            const terms = rawText.split(' ').map(t => t.trim()).filter(t => t.length > 0);

            const container = document.getElementById('items-category');
            if (!container) return;
            
            const items = container.querySelectorAll('.checkbox-item');

            // 3. FILTRADO VISUAL
            items.forEach(div => {
                const labelText = div.querySelector('span').textContent.toLowerCase();
                
                // LÓGICA CLAVE: Verificamos si el texto de la categoría incluye TODAS las palabras escritas
                // 'every' devuelve true solo si todas las condiciones se cumplen
                const isMatch = terms.every(term => labelText.includes(term));
                
                // Si no hay términos escritos (input vacío), mostramos todo (isMatch será true por defecto en arrays vacíos con every, pero forzamos validación)
                if (terms.length === 0) {
                    div.style.display = 'flex';
                } else {
                    div.style.display = isMatch ? 'flex' : 'none';
                }
            });

            // 4. AUTO-SELECCIÓN (Con Debounce)
            clearTimeout(searchTimeout); 
            
            searchTimeout = setTimeout(() => {
                // Solo ejecutar si el usuario ha escrito algo
                if (terms.length > 0) {
                    let hasChanges = false;
                    
                    items.forEach(div => {
                        const isVisible = div.style.display !== 'none';
                        const checkbox = div.querySelector('input');
                        
                        // Seleccionar lo visible, Deseleccionar lo oculto
                        if (isVisible && !checkbox.checked) {
                            checkbox.checked = true;
                            hasChanges = true;
                        } else if (!isVisible && checkbox.checked) {
                            checkbox.checked = false;
                            hasChanges = true;
                        }
                    });

                    if (hasChanges) {
                        triggerUpdateWithLoader();
                    }
                }
            }, 600); 
        });
    }
});

/**
 * MODIFICACIÓN DE LA FUNCIÓN toggleGroup EXISTENTE
 * Para que los botones "Todos/Ninguno" solo afecten a lo que se ve en pantalla
 */
function toggleGroup(containerId, state, event) {
    if (event) event.stopPropagation();
    
    runWithLoader(() => {
        const container = document.getElementById(containerId);
        if (container) {
            // Modificamos el selector para incluir solo elementos VISIBLES (que no tengan display:none)
            const items = container.querySelectorAll('.checkbox-item');
            
            items.forEach(div => {
                // Solo actuar si el elemento es visible (respetando el filtro de búsqueda)
                if (div.style.display !== 'none') {
                    const cb = div.querySelector('input');
                    if (cb) cb.checked = state;
                }
            });
            updateUI(); 
        }
    });
}
// ============================================================
// 7. ACTUALIZAR UI
// ============================================================
function updateUI() {
    // 1. SINCRONIZAR SELECTOR DE VISTA TEMPORAL
    const temporalSelect = document.getElementById('select-temporal-view');
    if (temporalSelect) temporalSelect.value = temporalView; 

    const t = translations[currentLang];
    
    // --- HELPER 1: Obtener valores (IDs) de los checkbox marcados ---
    const getValues = (containerId) => {
        return Array.from(document.querySelectorAll(`#${containerId} input:checked`)).map(i => i.value);
    };

    // --- HELPER 2: Obtener lista completa en texto (para el Tooltip) ---
    const getFullListString = (containerId) => {
        const checked = Array.from(document.querySelectorAll(`#${containerId} input:checked`));
        if (checked.length === 0) return t.sel_none || "NINGUNO";
        return checked.map(i => i.nextElementSibling.innerText).join(", ");
    };

    // --- HELPER 3: LÓGICA DE ETIQUETAS INTELIGENTE (Visualización Resumida) ---
    const getLabels = (containerId) => {
        const container = document.getElementById(containerId);
        if (!container) return "---";

        const allCount = container.querySelectorAll('input').length;
        const checkedInputs = Array.from(container.querySelectorAll('input:checked'));
        const count = checkedInputs.length;
        
        // A) Ninguno
        if (count === 0) return (t.sel_none || "NINGUNO").toUpperCase();
        
        // B) Todos (solo si hay más de 0 items totales)
        if (count === allCount && allCount > 0) return (t.sel_all || "TODOS").toUpperCase();
        
        // C) Uno solo seleccionado: Mostrar nombre completo
        if (count === 1) {
            return checkedInputs[0].nextElementSibling.innerText;
        }

        // D) Dos seleccionados: Mostrar "Nombre1, Nombre2" (truncados si son largos)
        if (count === 2) {
             const n1 = checkedInputs[0].nextElementSibling.innerText;
             const n2 = checkedInputs[1].nextElementSibling.innerText;
             // Cortar a 12 caracteres para que quepa bien
             const safeN1 = n1.length > 12 ? n1.substring(0,12) + '...' : n1;
             const safeN2 = n2.length > 12 ? n2.substring(0,12) + '...' : n2;
             return `${safeN1}, ${safeN2}`;
        }

        // E) Muchos: Mostrar contador "15 SELECCIONADOS"
        // (Usamos una traducción genérica o un texto fijo)
        const labelSelected = currentLang === 'en' ? 'SELECTED' : 'SELECCIONADOS';
        return `${count} ${labelSelected}`;
    };

    // 2. OBTENER SELECCIONES ACTUALES
    const selYears = getValues('items-year').map(Number);
    const selMonths = getValues('items-month').map(Number);
    const selCats = getValues('items-category');

    // 3. ACTUALIZAR TEXTOS E INDICADORES (Sidebar y Header)
    // Para cada grupo actualizamos: Texto visible (Resumen) y Title (Tooltip completo)

    // AÑOS
    const txtYear = getLabels('items-year');
    const titleYear = getFullListString('items-year');
    if(document.getElementById('label-year')) {
        document.getElementById('label-year').innerText = txtYear;
        document.getElementById('label-year').title = titleYear;
    }
    if(document.getElementById('header-year')) {
        document.getElementById('header-year').innerText = txtYear;
        document.getElementById('header-year').title = titleYear;
    }

    // MESES
    const txtMonth = getLabels('items-month');
    const titleMonth = getFullListString('items-month');
    if(document.getElementById('label-month')) {
        document.getElementById('label-month').innerText = txtMonth;
        document.getElementById('label-month').title = titleMonth;
    }
    if(document.getElementById('header-month')) {
        document.getElementById('header-month').innerText = txtMonth;
        document.getElementById('header-month').title = titleMonth;
    }

    // CATEGORÍAS
    const txtCat = getLabels('items-category');
    const titleCat = getFullListString('items-category');
    if(document.getElementById('label-category')) {
        document.getElementById('label-category').innerText = txtCat;
        document.getElementById('label-category').title = titleCat; // Tooltip al pasar mouse
    }
    if(document.getElementById('header-category')) {
        document.getElementById('header-category').innerText = txtCat;
        document.getElementById('header-category').title = titleCat;
    }

    // 4. FILTRAR DATOS
    const filtered = finalData.filter(d => 
        selYears.includes(d.year) && 
        selMonths.includes(d.month) && 
        selCats.includes(d.cat)
    );

    // 5. ACTUALIZAR KPIS
    document.getElementById('kpi-count').innerText = filtered.length.toLocaleString();
    if(document.getElementById('kpi-total-filas')) 
        document.getElementById('kpi-total-filas').innerHTML = `${filtered.length} <span data-i18n="kpi_reg">${t.kpi_reg}</span>`;

    // 6. ACTUALIZAR GRÁFICOS Y MAPA
    updateMapData(filtered);
    updateCharts(filtered, selYears);
    updateLocationKPI(filtered);

    // 7. ACTUALIZAR TÍTULOS ESTÁTICOS
    const labelTitulo = document.getElementById('card-label-titulo');
    if (labelTitulo) labelTitulo.innerText = currentLang === 'eu' ? "IZENBURUA" : "TITULO";
    
    const textFilename = document.getElementById('card-text-filename');
    if (textFilename) textFilename.innerText = nombreArchivoSubido || "SIN ARCHIVO";
}
// ============================================================
// 8. GRÁFICOS
// ============================================================
function changeTemporalView(v) { 
    runWithLoader(() => {
        temporalView = v; 
        updateUI(); 
    });
}
function toggleTimelineType() {
    // Usamos el envoltorio de carga
    runWithLoader(() => {
        chartTimelineType = (chartTimelineType === 'bar') ? 'line' : 'bar';
        const btnIcon = document.querySelector('#btn-toggle-chart-type i');
        const btn = document.getElementById('btn-toggle-chart-type');
        
        if (chartTimelineType === 'line') {
            btnIcon.className = 'fa-solid fa-chart-simple'; 
            btn.title = "Volver a Barras";
        } else {
            btnIcon.className = 'fa-solid fa-chart-line'; 
            btn.title = "Cambiar a Líneas";
        }
        updateUI(); // La operación pesada
    });
}

function updateCharts(data, selYears) {
    const allYearsMaster = [...new Set(finalData.map(d => d.year))].sort((a,b) => a-b);
    const t = translations[currentLang]; 

    const commonOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { position: window.innerWidth < 768 ? 'bottom' : 'top', labels: { boxWidth: 12, font: { size: 10 } } }
        }
    };

    // --- TIMELINE ---
    const ctxTimeline = document.getElementById('chart-timeline');
    if (ctxTimeline) {
        
        // 1. OBTENER CATEGORÍAS ACTIVAS
        const activeCategories = [...new Set(data.map(d => d.cat))].sort();

        // 2. CORRECCIÓN: CALCULAR AÑOS REALES (EJE X)
        // En lugar de usar los filtros (selYears), miramos qué años existen realmente en los datos 'data'
        // y nos aseguramos de que tengan al menos 1 registro válido.
        let activeYears = [];
        
        if (temporalView === 'year') {
            // Solo cogemos los años que están en los datos actuales
            activeYears = [...new Set(data.map(d => d.year))].sort((a,b) => a-b);
        } else {
            // Para otras vistas (meses, días), usamos el filtro seleccionado para no romper la lógica
            activeYears = [...selYears].sort((a,b) => a-b);
        }

        // 3. GENERAR ETIQUETAS (LABELS)
        let labels = [];
        if (temporalView === 'year') labels = activeYears.map(y => y.toString());
        else if (temporalView === 'month') labels = t.months_abbr;
        else if (temporalView === 'quarter') labels = t.quarters;
        else if (temporalView === 'day') labels = t.days_abbr.map(l => l.substring(0,3));

        const getCategoryColor = (index) => {
            const palette = ['#5e72e4', '#2dce89', '#fb6340', '#11cdef', '#f5365c', '#8965e0', '#ffd600', '#32325d', '#adb5bd', '#f3a4b5', '#2bffc6', '#8898aa'];
            return palette[index % palette.length];
        };

        const datasets = activeCategories.map((catName, index) => {
            let catData = [];
            
            if (temporalView === 'year') {
                // Mapeamos los datos basándonos en 'activeYears', no en el filtro global
                catData = activeYears.map(y => data.filter(d => d.year === y && d.cat === catName).length);
            } 
            else if (temporalView === 'month') {
                catData = Array(12).fill(0);
                data.filter(d => d.cat === catName).forEach(d => { catData[d.month - 1]++; });
            } 
            else if (temporalView === 'quarter') {
                catData = Array(4).fill(0);
                data.filter(d => d.cat === catName).forEach(d => { const qIndex = Math.floor((d.month - 1) / 3); catData[qIndex]++; });
            } 
            else if (temporalView === 'day') {
                catData = Array(7).fill(0);
                data.filter(d => d.cat === catName).forEach(d => { let idx = d.date.getDay(); catData[idx === 0 ? 6 : idx - 1]++; });
            }

            return {
                label: catName,
                data: catData,
                backgroundColor: getCategoryColor(index),
                borderColor: getCategoryColor(index),
                borderWidth: chartTimelineType === 'line' ? 2 : 0,
                fill: false,
                tension: 0.3,
                pointRadius: chartTimelineType === 'line' ? 3 : 0,
                pointHoverRadius: 6,
                stack: 'combined'
            };
        });

        // Actualizar Tabla Cache
        tableDataCache = [];
        labels.forEach((lbl, index) => {
            let row = { label: lbl, index: index };
            datasets.forEach(ds => { row[ds.label] = ds.data[index]; });
            row['TOTAL'] = datasets.reduce((sum, ds) => sum + ds.data[index], 0);
            tableDataCache.push(row);
        });
        if (isTableView) renderTimelineTable();

        if (chartTimeline) chartTimeline.destroy();
        chartTimeline = new Chart(ctxTimeline, { 
            type: chartTimelineType, 
            data: { labels, datasets }, 
            options: { 
                ...commonOptions,
                interaction: {
                    mode: 'nearest',   
                    axis: 'xy',        
                    intersect: true    
                },
                scales: {
                    x: { stacked: chartTimelineType === 'bar', grid: { display: false } },
                    y: { stacked: chartTimelineType === 'bar', beginAtZero: true, ticks: { precision: 0 } }
                },
                plugins: {
                    legend: { display: false }, // Ocultar leyenda (bolas de colores)
                    tooltip: {}
                }
            } 
        });
    }

    // --- CATEGORY ---
    const ctxCat = document.getElementById('chart-category');
    if (ctxCat) {
        const container = document.getElementById('container-category');
        const isFullscreen = container.classList.contains('fullscreen');

        const catData = {}; 
        data.forEach(d => catData[d.cat] = (catData[d.cat] || 0) + 1);
        const sorted = Object.entries(catData).sort((a,b) => b[1]-a[1]);
        const top5 = sorted.slice(0, 5);
        const total = sorted.reduce((sum, item) => sum + item[1], 0);
        const fullLabels = top5.map(s => s[0]);
        const shortLabels = top5.map(s => s[0].length > 20 ? s[0].substring(0, 20) + '...' : s[0]);
        const activeLabels = isFullscreen ? fullLabels : shortLabels;
        const fontSize = isFullscreen ? 16 : 11;
        const boxSize = isFullscreen ? 20 : 12;

        tableCatDataCache = sorted.map(item => ({
            cat: item[0], count: item[1], percent: ((item[1] / total) * 100).toFixed(1)
        }));
        if (isTableCatView) renderCategoryTable();

        if (chartCategory) chartCategory.destroy();
        chartCategory = new Chart(ctxCat, { 
            type: 'doughnut', 
            data: { 
                labels: activeLabels,
                datasets: [{ 
                    data: top5.map(s => s[1]), 
                    backgroundColor: yearColors.map(c => c.bg), 
                    borderColor: '#ffffff', borderWidth: 2 
                }] 
            }, 
            options: { 
                ...commonOptions, maintainAspectRatio: false, cutout: '60%',
                scales: { x: { display: false }, y: { display: false } },
                layout: { padding: { top: 10, bottom: 20, left: 10, right: 10 } },
                plugins: { 
                    legend: { 
                        display: false 
                        //position: window.innerWidth < 768 ? 'bottom' : 'right',
                        //labels: { boxWidth: boxSize, padding: 15, font: { size: fontSize } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = fullLabels[context.dataIndex] || '';
                                let value = context.parsed;
                                let totalVal = context.chart._metasets[context.datasetIndex].total;
                                return ` ${label}: ${value} (${((value / totalVal) * 100).toFixed(1)}%)`;
                            }
                        }
                    }
                } 
            } 
        });
    }

    // --- HOURS ---
    const ctxHours = document.getElementById('chart-hours');
    if (ctxHours) {
        const hC = Array(24).fill(0); data.forEach(d => hC[d.hour]++);
        const totalReg = data.length;
        tableHoursDataCache = hC.map((count, index) => ({
            hour: index, hourLabel: String(index).padStart(2, '0') + ":00",
            count: count, percent: totalReg > 0 ? ((count / totalReg) * 100).toFixed(1) : "0.0"
        }));
        if (isTableHoursView) renderHoursTable();

        if (chartHours) chartHours.destroy();
        chartHours = new Chart(ctxHours, { 
            type: 'line', 
            data: { labels: Array.from({length: 24}, (_,i) => i), datasets: [{ label: 'Actividad', data: hC, borderColor: '#11cdef', fill: true, backgroundColor: 'rgba(17,205,239,0.1)', tension: 0.4 }] }, 
            options: { 
                ...commonOptions, 
                plugins: { legend: { display: false } }, 
                scales: { 
                    x: { ticks: { maxTicksLimit: 8 } },
                    y: { beginAtZero: true, ticks: { precision: 0 } }
                } 
            } 
        });
    }
}

// ============================================================
// 9. MAPA Y UTILIDADES
// ============================================================
function initMap() {
    if (map) map.remove();
    map = new maplibregl.Map({ container: 'main-map', style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json', center: [-2.63, 43.17], zoom: 12, preserveDrawingBuffer: true });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
        map.addSource('satellite-tiles', { 'type': 'raster', 'tiles': ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], 'tileSize': 256 });
        map.addLayer({ 'id': 'satellite-layer', 'type': 'raster', 'source': 'satellite-tiles', 'layout': { 'visibility': 'none' } });
        map.addSource('puntos', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'heat-layer', type: 'heatmap', source: 'puntos', layout: { 'visibility': 'none' }, paint: { 'heatmap-weight': 1, 'heatmap-intensity': 3, 'heatmap-radius': 20 } });
        map.addLayer({ id: 'point-layer', type: 'circle', source: 'puntos', layout: { 'visibility': 'visible' }, paint: { 'circle-radius': 6, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff', 'circle-color': '#5e72e4' } });
        map.on('click', 'point-layer', (e) => {
            const p = e.features[0].properties;
            new maplibregl.Popup({ offset: 10, maxWidth: '200px' }).setLngLat(e.features[0].geometry.coordinates).setHTML(`<div style="padding:5px; font-family:'Inter', sans-serif;"><div style="color:#5e72e4; font-weight:800; font-size:12px; margin-bottom:5px; border-bottom:1px solid #eee;">REF${p.refanno}-${p.refnum}</div><div style="font-size:11px;"><span><b>Cat:</b> ${p.cat}</span><br><span><b>Fecha:</b> ${p.fullDate}</span></div></div>`).addTo(map);
        });
    });
}

function updateMapData(data) {
    const container = document.getElementById('container-map');
    
    // 1. Filtrar solo los registros que tienen Geoposicionamiento real
    const datosConGeo = data.filter(d => d.hasGeo); 

    // 2. LÓGICA DE ANIMACIÓN
    if (datosConGeo.length === 0) {
        // --- OCULTAR MAPA ---
        if (container && container.classList.contains('active-map')) {
            container.classList.remove('active-map');
            // Esperar a que termine la animación para limpiar recursos si fuera necesario
        }
        return; 
    } else {
        // --- MOSTRAR MAPA ---
        if (container) {
            const estabaOculto = !container.classList.contains('active-map');
            
            if (estabaOculto) {
                container.classList.add('active-map');
                
                // CRÍTICO: Esperar a que termine la transición CSS (0.6s)
                // para decirle al mapa que recalcule su tamaño.
                setTimeout(() => {
                   if (map) map.resize();
                }, 650);
            } else {
                // Si ya estaba visible, redimensionar por si cambió el tamaño de ventana
                if (map) map.resize();
            }
        }
    }

    // 3. Actualizar datos del mapa (Puntos, colores, etc.)
    if (!map || !map.getSource('puntos')) return;

//tooltip mapa
    const geojson = { 
        type: 'FeatureCollection', 
        features: datosConGeo.map(d => ({ 
            type: 'Feature', 
            geometry: { type: 'Point', coordinates: [d.lon, d.lat] }, 
            properties: { 
                exp: d.exp, cat: d.cat, year: d.year, 
                
                // --- CAMBIO AQUÍ: Formatear fecha sin segundos ---
                fullDate: d.date.toLocaleString(undefined, { 
                    year: 'numeric', 
                    month: 'numeric', 
                    day: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                }), 
                // ------------------------------------------------
                
                calle: d.calle, numero: d.numero, 
                refnum: d.refnum, refanno: d.refanno 
            } 
        })) 
    };

    
    map.getSource('puntos').setData(geojson);
    
    // Colores por año (Lógica existente)
    const allY = [...new Set(finalData.map(d => d.year))].sort((a,b) => a-b);
    const colorExpr = ['match', ['get', 'year']];
    const localColors = window.yearColors || [
       { border: '#5e72e4'}, { border: '#2dce89'}, { border: '#fb6340'}, 
       { border: '#11cdef'}, { border: '#f5365c'}, { border: '#8965e0'}, { border: '#b71825ff'}
    ];
    allY.forEach((y, index) => {
        colorExpr.push(y, localColors[index % localColors.length].border);
    });
    colorExpr.push('#5e72e4'); 
    map.setPaintProperty('point-layer', 'circle-color', colorExpr);
    
    // Centrar el mapa con un pequeño retraso para asegurar que el contenedor ya está expandido
    if (datosConGeo.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        datosConGeo.forEach(d => bounds.extend([d.lon, d.lat]));
        
        setTimeout(() => {
            try { 
                map.fitBounds(bounds, { padding: 40, maxZoom: 16 }); 
            } catch (e) { console.log(e); }
        }, 700); // 700ms > 600ms de la transición CSS
    }
}

function toggleSatelite(btn) { isSatelite = !isSatelite; map.setLayoutProperty('satellite-layer', 'visibility', isSatelite ? 'visible' : 'none'); btn.style.background = isSatelite ? '#5e72e4' : ''; btn.style.color = isSatelite ? '#fff' : ''; }
function toggleHeatmap(btn) { isHeatmap = !isHeatmap; map.setLayoutProperty('heat-layer', 'visibility', isHeatmap ? 'visible' : 'none'); map.setLayoutProperty('point-layer', 'visibility', isHeatmap ? 'none' : 'visible'); btn.innerHTML = isHeatmap ? '<i class="fa-solid fa-location-dot"></i>' : '<i class="fa-solid fa-fire"></i>'; }
function toggle3D() { const p = map.getPitch(); map.easeTo({ pitch: p > 0 ? 0 : 60, bearing: p > 0 ? 0 : -20, duration: 1000 }); }

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
            if (containerId === 'container-map') btnIcon.classList.add('fa-expand'); 
            else btnIcon.classList.add('fa-maximize');
        }
        document.body.style.overflow = '';
    }

    setTimeout(() => {
        if (map) map.resize(); 
        updateUI(); 
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
    }, 300);
}

// ============================================================
// 10. GEOLOCALIZACIÓN
// ============================================================
// ============================================================
// 10. GEOLOCALIZACIÓN (CORREGIDO)
// ============================================================
async function updateLocationKPI(data) {
    const el = document.getElementById('kpi-location');
    
    // 1. Validaciones básicas
    if (!data || data.length === 0) { el.innerText = "Sin Datos"; return; }
    
    // 2. Si hay localidad manual en el excel, usarla
    if (data[0].locManual && data[0].locManual !== "") { el.innerText = data[0].locManual.toUpperCase(); return; }

    // 3. Calcular centroide
    const dataConGeo = data.filter(d => d.hasGeo);
    if (dataConGeo.length === 0) { el.innerText = "Sin Ubicación GPS"; return; }

    let totalLat = 0, totalLon = 0;
    dataConGeo.forEach(d => { totalLat += d.lat; totalLon += d.lon; });
    const centerLat = totalLat / dataConGeo.length;
    const centerLon = totalLon / dataConGeo.length;
    
    // Mostrar coordenadas por defecto mientras carga
    el.innerText = `${centerLat.toFixed(3)}, ${centerLon.toFixed(3)}`;

    // 4. INTENTO 1: BigDataCloud (Más rápido y sin bloqueo CORS en localhost)
    try {
        // Usamos currentLang para pedir el idioma correcto
        const langCode = currentLang === 'eu' ? 'eu' : (currentLang === 'ca' ? 'ca' : 'es');
        const urlB = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${centerLat}&longitude=${centerLon}&localityLanguage=${langCode}`;
        
        const resB = await fetch(urlB);
        if(resB.ok) {
            const jB = await resB.json();
            // Buscamos el nombre más relevante en orden
            let p = jB.locality || jB.city || jB.principalSubdivision || jB.localityInfo?.administrative[2]?.name;
            
            if (p) { 
                el.innerText = p.toUpperCase(); 
                return; // Éxito, salimos de la función
            }
        }
    } catch (er) {
        console.warn("BigDataCloud sin respuesta, intentando OSM...");
    }

    // 5. INTENTO 2: OpenStreetMap (Solo si falla el anterior, suele dar 403 en localhost)
    try {
        const urlOSM = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${centerLat}&lon=${centerLon}&zoom=10&accept-language=${currentLang}`;
        const response = await fetch(urlOSM, { 
            method: 'GET', 
            mode: 'cors', 
            headers: { 'Accept': 'application/json' } 
        });
        
        if(response.ok) {
            const json = await response.json();
            const addr = json.address;
            let placeName = addr.city || addr.town || addr.village || addr.municipality || addr.county;
            if (placeName) { el.innerText = placeName.toUpperCase(); }
        }
    } catch (e) {
        // Si todo falla, se queda con las coordenadas numéricas que pusimos al principio
        console.log("No se pudo obtener el nombre de la localidad.");
    }
}

// ============================================================
// 11. TABLAS DE DATOS Y VISOR
// ============================================================

function toggleTimelineView() {
    isTableView = !isTableView;
    const btn = document.querySelector('#btn-toggle-view i');
    const canvas = document.getElementById('chart-timeline');
    const table = document.getElementById('table-timeline-view');

    canvas.style.display = isTableView ? 'none' : 'block';
    table.style.display = isTableView ? 'block' : 'none';
    btn.className = isTableView ? 'fa-solid fa-chart-column' : 'fa-solid fa-table';
    btn.parentElement.title = isTableView ? "Ver Gráfico" : "Ver Datos";

    if(isTableView) {
        // Forzar orden descendente por defecto
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

    let html = `<table class="data-table"><thead><tr><th onclick="sortTable('index')" style="cursor:pointer">PERIODO <i class="fa-solid fa-sort"></i></th>`;
    categoryKeys.forEach(k => { 
        let displayName = k.length > 20 ? k.substring(0, 20) + '...' : k;
        html += `<th onclick="sortTable('${k}')" title="${k}" style="cursor:pointer">${displayName} <i class="fa-solid fa-sort"></i></th>`; 
    });
    html += `<th onclick="sortTable('TOTAL')" style="cursor:pointer; color:#333;">TOTAL <i class="fa-solid fa-sort"></i></th></tr></thead><tbody>`;
    
    tableDataCache.forEach(row => {
        html += `<tr><td>${row.label}</td>`;
        categoryKeys.forEach(k => { 
            let val = row[k] !== undefined ? row[k] : 0;
            let colorStyle = val === 0 ? 'color:#ccc;' : '';
            html += `<td style="${colorStyle}">${val.toLocaleString()}</td>`; 
        });
        html += `<td>${(row['TOTAL'] || 0).toLocaleString()}</td></tr>`;
    });
    html += `</tbody></table>`;
    c.innerHTML = html;
    updateSortIcons(currentSort.col, '#table-timeline-view', currentSort);
}

function sortTable(column) {
    if (currentSort.col === column) currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
    else { currentSort.col = column; currentSort.dir = 'desc'; }
    
    tableDataCache.sort((a, b) => {
        let valA = a[column];
        let valB = b[column];
        if (column === 'index') return currentSort.dir === 'asc' ? valA - valB : valB - valA;
        if (valA < valB) return currentSort.dir === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.dir === 'asc' ? 1 : -1;
        return 0;
    });
    renderTimelineTable();
}

function toggleCategoryView() {
    isTableCatView = !isTableCatView;
    const btn = document.querySelector('#btn-toggle-view-cat i');
    const canvas = document.getElementById('chart-category');
    const table = document.getElementById('table-category-view');

    canvas.style.display = isTableCatView ? 'none' : 'block';
    table.style.display = isTableCatView ? 'block' : 'none';
    btn.className = isTableCatView ? 'fa-solid fa-chart-pie' : 'fa-solid fa-table';
    btn.parentElement.title = isTableCatView ? "Ver Gráfico" : "Ver Datos";

    if(isTableCatView) renderCategoryTable();
    else setTimeout(() => { updateUI(); }, 50);
}

function renderCategoryTable() {
    const c = document.getElementById('table-category-view');
    if (!tableCatDataCache.length) { c.innerHTML = '<p style="padding:20px; text-align:center; color:#888;">Sin datos</p>'; return; }
    
    let html = `<table class="data-table"><thead><tr><th onclick="sortTableCategory('cat')">CAT <i class="fa-solid fa-sort"></i></th><th onclick="sortTableCategory('count')">CANT <i class="fa-solid fa-sort"></i></th><th onclick="sortTableCategory('percent')">% <i class="fa-solid fa-sort"></i></th></tr></thead><tbody>`;
    tableCatDataCache.forEach(r => html += `<tr><td>${r.cat}</td><td style="text-align:right;">${r.count}</td><td style="text-align:right;">${r.percent}%</td></tr>`);
    c.innerHTML = html + `</tbody></table>`;
    updateSortIcons(currentSortCat.col, '#table-category-view', currentSortCat);
}

function sortTableCategory(col) {
    if (currentSortCat.col === col) currentSortCat.dir = currentSortCat.dir === 'asc' ? 'desc' : 'asc'; 
    else { currentSortCat.col = col; currentSortCat.dir = 'desc'; }
    tableCatDataCache.sort((a,b) => { 
        let vA = a[col], vB = b[col]; 
        if(col==='percent'){vA=parseFloat(vA);vB=parseFloat(vB);} 
        return vA < vB ? (currentSortCat.dir === 'asc' ? -1 : 1) : 1; 
    });
    renderCategoryTable();
}

function toggleHoursView() {
    isTableHoursView = !isTableHoursView;
    const btn = document.querySelector('#btn-toggle-view-hours i');
    const canvas = document.getElementById('chart-hours');
    const table = document.getElementById('table-hours-view');

    canvas.style.display = isTableHoursView ? 'none' : 'block';
    table.style.display = isTableHoursView ? 'block' : 'none';
    btn.className = isTableHoursView ? 'fa-solid fa-chart-line' : 'fa-solid fa-table';
    btn.parentElement.title = isTableHoursView ? "Ver Gráfico" : "Ver Datos";

    if(isTableHoursView) renderHoursTable();
    else setTimeout(() => { updateUI(); }, 50);
}

function renderHoursTable() {
    const c = document.getElementById('table-hours-view');
    if (!tableHoursDataCache.length) { c.innerHTML = '<p style="padding:20px; text-align:center; color:#888;">Sin datos</p>'; return; }
    
    let html = `<table class="data-table"><thead><tr><th onclick="sortTableHours('hour')">HORA <i class="fa-solid fa-sort"></i></th><th onclick="sortTableHours('count')">CANT <i class="fa-solid fa-sort"></i></th><th onclick="sortTableHours('percent')">% <i class="fa-solid fa-sort"></i></th></tr></thead><tbody>`;
    tableHoursDataCache.forEach(r => html += `<tr><td>${r.hourLabel}</td><td style="text-align:right;">${r.count}</td><td style="text-align:right;">${r.percent}%</td></tr>`);
    c.innerHTML = html + `</tbody></table>`;
    updateSortIcons(currentSortHours.col, '#table-hours-view', currentSortHours);
}

function sortTableHours(col) {
    if (currentSortHours.col === col) currentSortHours.dir = currentSortHours.dir === 'asc' ? 'desc' : 'asc'; 
    else { currentSortHours.col = col; currentSortHours.dir = 'asc'; }
    tableHoursDataCache.sort((a,b) => { 
        let vA = a[col], vB = b[col]; 
        if(col==='percent'){vA=parseFloat(vA);vB=parseFloat(vB);} 
        return vA < vB ? (currentSortHours.dir === 'asc' ? -1 : 1) : 1; 
    });
    renderHoursTable();
}

function updateSortIcons(activeCol, containerSelector, sortObj) {
    document.querySelectorAll(containerSelector + ' th i').forEach(i => i.className = 'fa-solid fa-sort');
    const ths = document.querySelectorAll(containerSelector + ' th');
    for (let th of ths) {
        if (th.getAttribute('onclick') && th.getAttribute('onclick').includes(`'${activeCol}'`)) {
            th.querySelector('i').className = sortObj.dir === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
        }
    }
}

// ============================================================
// 12. MULTI-IDIOMA Y PDF
// ============================================================
function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('eurocop_lang', lang);
    applyLanguage(lang);
}
function applyLanguage(lang) {
    const t = translations[lang];
    if (!t) return;
    document.querySelectorAll('[data-i18n]').forEach(el => { const k = el.getAttribute('data-i18n'); if (t[k]) el.textContent = t[k]; });
    const locInput = document.getElementById('map-localidad');
    if(locInput && t.col_loc_placeholder) locInput.placeholder = t.col_loc_placeholder;
    document.querySelectorAll('.dropdown-controls button:nth-child(1)').forEach(b => b.textContent = t.sel_all);
    document.querySelectorAll('.dropdown-controls button:nth-child(2)').forEach(b => b.textContent = t.sel_none);
    if(finalData.length > 0) updateUI();
}

function openPdfModal(fileName, title) {
    document.getElementById('pdf-modal-title').innerHTML = `<i class="fa-solid fa-file-pdf"></i> ${title}`;
    
    // USAR VERSIÓN GLOBAL
    let versionParam = (typeof EUROCOP_VERSION !== 'undefined') ? EUROCOP_VERSION : new Date().getTime();
    
    document.getElementById('pdf-frame').src = "./ArchivosPdf/" + fileName + "?v=" + versionParam;
    document.getElementById('pdf-modal').classList.add('active');
}
function closePdfModal() { document.getElementById('pdf-modal').classList.remove('active'); }
document.getElementById('pdf-modal').addEventListener('click', function(e) { if (e.target === this) closePdfModal(); });
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closePdfModal(); });
// ============================================================
// NUEVA FUNCIÓN: ENVOLTORIO PARA CARGA VISUAL
// ============================================================
function runWithLoader(actionCallback) {
    // 1. Mostrar pantalla de carga
    document.getElementById('loading-overlay').classList.add('active');

    // 2. Esperar un poco para que el navegador renderice el spinner
    setTimeout(() => {
        try {
            // 3. Ejecutar la acción pesada
            actionCallback();
        } catch (e) {
            console.error("Error durante el procesamiento:", e);
        } finally {
            // 4. Ocultar pantalla de carga (siempre, aunque haya error)
            document.getElementById('loading-overlay').classList.remove('active');
        }
    }, 50); // 50ms de pausa técnica
}
// Función auxiliar para obtener la lista completa de texto para el "tooltip"
function getFullListString(containerId) {
    const checked = Array.from(document.querySelectorAll(`#${containerId} input:checked`));
    if (checked.length === 0) return "Ninguno";
    return checked.map(i => i.nextElementSibling.innerText).join(", ");
}