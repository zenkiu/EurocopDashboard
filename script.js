/**
 * EUROCOP ANALYTICS - SCRIPT FINAL 2026
 * Versión: Full Responsive + Multi-Idioma + Trimestres + GeoFix
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
let isHeatmap = false; 
let temporalView = 'year'; 
let currentLang = localStorage.getItem('eurocop_lang') || 'es'; // Idioma por defecto

// Variables para Tablas
let isTableView = false; 
let tableDataCache = []; 
let currentSort = { col: 0, dir: 'asc' };

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
    // Inicializar idioma
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

function processFile(file) {
    if (!file) return;
    document.getElementById('loading-overlay').classList.add('active');

    setTimeout(() => {
        try {
            nombreArchivoSubido = file.name.replace(/\.[^/.]+$/, "").toUpperCase();
            const displayEl = document.getElementById('display-filename');
            if (displayEl) displayEl.textContent = nombreArchivoSubido;

            if (file.name.endsWith('.csv')) {
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
    }, 100);
}

function goToMapping() {
    if (document.getElementById('dashboard-view').classList.contains('active')) {
        document.getElementById('dashboard-view').classList.remove('active');
        document.getElementById('mapping-view').classList.add('active');
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
        
        // Clonamos para eliminar listeners antiguos y limpiar opciones
        const newSel = sel.cloneNode(false);
        sel.parentNode.replaceChild(newSel, sel);
        newSel.addEventListener('change', refreshMappingStatus);

        // Añadir opción por defecto
        if (id === 'map-hora') newSel.innerHTML = '<option value="">-- Sin hora (00:00) --</option>';
        else newSel.innerHTML = '<option value="" disabled selected>Seleccionar...</option>';

        // 1. Llenar el desplegable con todas las columnas
        headers.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h; 
            opt.textContent = h;
            newSel.appendChild(opt);
        });

        // 2. AUTO-SELECCIÓN INTELIGENTE (SISTEMA DE PRIORIDADES)
        let match = null;

        if (id === 'map-expediente') {
            // Prioridad 1: REFNUM (El rey)
            match = headers.find(h => h.toUpperCase().includes('REFNUM'));
            
            // Prioridad 2: EXPEDIENTE (Si no hay refnum)
            if (!match) match = headers.find(h => h.toUpperCase().includes('EXPEDIENTE'));
            
            // Prioridad 3: NUMERO o ID (Solo coincidencias exactas para evitar "ACCIDENTE")
            if (!match) match = headers.find(h => {
                const s = h.toUpperCase();
                return s === 'NUMERO' || s === 'ID'; 
            });
        }

        else if (id === 'map-fecha') {
            // Prioridad 1: FECHA o DATE
            match = headers.find(h => {
                const s = h.toUpperCase();
                return s.includes('FECHA') || s.includes('DATE') || s.includes('FEC_');
            });
        }

        else if (id === 'map-hora') {
            // Prioridad 1: HORA o TIME
            match = headers.find(h => {
                const s = h.toUpperCase();
                return s.includes('HORA') || s.includes('TIME');
            });
        }

        else if (id === 'map-lat') {
            // Prioridad 1: Y o LATITUD
            match = headers.find(h => {
                const s = h.toUpperCase();
                return s === 'Y' || s.includes('LAT'); // "LAT" coge Latitud
            });
        }

        else if (id === 'map-lon') {
            // Prioridad 1: X o LONGITUD
            match = headers.find(h => {
                const s = h.toUpperCase();
                return s === 'X' || s.includes('LON') || s.includes('LNG');
            });
        }

        else if (id === 'map-categoria') {
            // Prioridad 1: TIPO, CATEGORIA o CAUSA
            match = headers.find(h => {
                const s = h.toUpperCase();
                return s.includes('TIPO') || s.includes('CAT') || s.includes('CAUSA');
            });
        }

        // Si encontramos una coincidencia, la seleccionamos
        if (match) {
            newSel.value = match;
        }
    });

    // Limpiar campo de localidad manual
    const locInput = document.getElementById('map-localidad');
    if(locInput) locInput.value = "";

    // Actualizar estados visuales (ticks y colores)
    refreshMappingStatus();

    // Cambiar de vista
    document.getElementById('upload-view').style.display = 'none';
    document.getElementById('mapping-view').classList.add('active');
}

function refreshMappingStatus() {
    const mappingIds = ['map-expediente', 'map-fecha', 'map-hora', 'map-lat', 'map-lon', 'map-categoria'];
    
    // 1. Obtenemos qué columnas ya han sido seleccionadas en otros desplegables
    const currentSelections = mappingIds.map(id => {
        const el = document.getElementById(id);
        return el ? el.value : "";
    }).filter(val => val !== "");

    // 2. Recorremos cada desplegable para actualizar sus opciones
    mappingIds.forEach(id => {
        const sel = document.getElementById(id);
        if(!sel) return;
        
        Array.from(sel.options).forEach(opt => {
            // Saltamos la opción por defecto ("Seleccionar...")
            if (opt.value === "" || opt.disabled) return;
            
            const isUsedElsewhere = currentSelections.includes(opt.value) && sel.value !== opt.value;
            
            // --- CAMBIO: DETECTAR SI ES "__EMPTY" Y MOSTRAR "VACIO" ---
            let textoVisual = opt.value;
            if (textoVisual.includes('__EMPTY')) {
                // Reemplazamos __EMPTY por BLANCO (Mantiene el número si es BLANCO_1, BLANCO_2...)
                textoVisual = textoVisual.replace('__EMPTY', 'BLANCO'); 
            }
            // -----------------------------------------------------------

            // Construimos el texto con el símbolo delante (✓, •, ✕) + el nombre corregido
            const symbol = isUsedElsewhere ? "✕ " : (sel.value === opt.value ? "✓ " : "• ");
            opt.textContent = symbol + textoVisual;
            
            opt.style.color = isUsedElsewhere ? "#cbd5e0" : "#5e72e4";
        });
    });
}

// ============================================================
// 5. PROCESAMIENTO
// ============================================================
// ============================================================
// MODIFICACIÓN EN SCRIPT.JS - PERMITIR SIN GPS
// ============================================================

// ============================================================
// MODIFICACIÓN: DETECCIÓN DE ERRORES DE FECHA
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

    // Array para guardar los errores
    let registrosSinFecha = []; 

    finalData = rawData.map(row => {
        // --- 1. PROCESAMIENTO DE FECHA ---
        let valFecha = row[config.fecha];
        let d;

        if (valFecha instanceof Date) {
            d = new Date(valFecha);
        }
        else if (typeof valFecha === 'string' && valFecha.includes('/')) {
            const parts = valFecha.split('/');
            if (parts.length >= 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1; 
                const year = parseInt(parts[2], 10);
                d = new Date(year, month, day);
            } else {
                d = new Date(valFecha); 
            }
        } else {
            d = new Date(valFecha);
        }

        // --- DETECCIÓN DE ERROR ---
        if (isNaN(d.getTime())) {
            // Intentamos buscar las columnas REFANNO y REFNUM/REFEXP para el mensaje
            // Buscamos sin importar mayúsculas/minúsculas
            const keys = Object.keys(row);
            const keyAnno = keys.find(k => k.toUpperCase().includes('REFANNO')) || keys.find(k => k.toUpperCase().includes('ANNO'));
            const keyNum  = keys.find(k => k.toUpperCase().includes('REFNUM')) || keys.find(k => k.toUpperCase().includes('REFEXP')) || keys.find(k => k.toUpperCase().includes('NUMERO'));

            let valAnno = keyAnno ? row[keyAnno] : "??";
            let valNum  = keyNum ? row[keyNum] : "??";

            // Formato solicitado: REF + ANNO + - + NUM
            registrosSinFecha.push(`REF${valAnno}-${valNum}`);
            
            return null; // Descartamos la fila
        }

        // --- 2. PROCESAMIENTO DE HORA ---
        if (config.hora && row[config.hora]) {
            const t = String(row[config.hora]).trim();
            if (t.includes(':')) { 
                const p = t.split(':'); 
                d.setHours(parseInt(p[0]) || 0, parseInt(p[1]) || 0, 0); 
            }
        }
        
        // --- 3. GEO ---
        let lat = 0, lon = 0, tieneUbicacion = false;
        if (config.lat && config.lon) {
            lat = parseFloat(String(row[config.lat]).replace(',', '.'));
            lon = parseFloat(String(row[config.lon]).replace(',', '.'));
            if (!isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0)) tieneUbicacion = true;
            else { lat = 0; lon = 0; }
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

    // --- LÓGICA FINAL ---
    document.getElementById('mapping-view').classList.remove('active');
    document.getElementById('dashboard-view').classList.add('active');
    setupFilters();
    initMap();
    setTimeout(updateUI, 500);

    // --- MOSTRAR AVISO SI HAY ERRORES ---
    if (registrosSinFecha.length > 0) {
        showRejectedModal(registrosSinFecha);
    }
};

// --- FUNCIONES NUEVAS PARA EL MODAL ---
function showRejectedModal(lista) {
    const container = document.getElementById('rejected-list');
    if(container) {
        // Creamos una lista HTML
        container.innerHTML = lista.map(item => `<div><i class="fa-solid fa-xmark" style="color:#f5365c"></i> ${item}</div>`).join('');
    }
    document.getElementById('rejected-modal').classList.add('active');
}

function closeRejectedModal() {
    document.getElementById('rejected-modal').classList.remove('active');
}

// ============================================================
// 6. FILTROS
// ============================================================
function setupFilters() {
    const years = [...new Set(finalData.map(d => d.year))].sort((a,b) => b-a);
    const cats = [...new Set(finalData.map(d => d.cat))].sort();
    
    // Usamos monthsConfig pero necesitamos que el texto se actualice por idioma
    renderCheckboxes('items-year', years, years[0]); 
    renderCheckboxes('items-month', monthsConfig, 'all'); 
    renderCheckboxes('items-category', cats, 'all');
}

function renderCheckboxes(containerId, items, defaultValue) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const t = translations[currentLang]; // Textos traducidos

    items.forEach(item => {
        let val, label;
        if(typeof item === 'object') {
            val = item.id;
            // Si es mes, usamos la traducción
            if(containerId === 'items-month') label = t.months_abbr[item.id - 1]; 
            else label = item.name || item.id;
        } else {
            val = item; label = item;
        }

        const div = document.createElement('div');
        div.className = 'checkbox-item';
        const isChecked = (defaultValue === 'all' || val == defaultValue) ? 'checked' : '';
        div.innerHTML = `<input type="checkbox" value="${val}" ${isChecked} onchange="updateUI()"> <span>${label}</span>`;
        container.appendChild(div);
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
    const container = document.getElementById(containerId);
    if (container) {
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = state);
        updateUI();
    }
}

// ============================================================
// 7. ACTUALIZAR UI
// ============================================================
function updateUI() {
    const t = translations[currentLang];
    
    // --- 1. FUNCIONES AUXILIARES INTERNAS ---
    const getValues = (containerId) => Array.from(document.querySelectorAll(`#${containerId} input:checked`)).map(i => i.value);
    
    const getLabels = (containerId) => {
        const all = document.querySelectorAll(`#${containerId} input`);
        const checked = Array.from(document.querySelectorAll(`#${containerId} input:checked`));
        
        if (checked.length === 0) return t.sel_none.toUpperCase();
        if (checked.length === all.length) return t.sel_all.toUpperCase();
        
        // Unir con comas los seleccionados
        return checked.map(i => i.nextElementSibling.innerText).join(", ");
    };

    // --- 2. LEER SELECCIÓN DE FILTROS ---
    const selYears = getValues('items-year').map(Number);
    const selMonths = getValues('items-month').map(Number);
    const selCats = getValues('items-category');

    // --- 3. ACTUALIZAR ETIQUETAS VISUALES (DROPDOWNS Y HEADER) ---
    // Años
    if(document.getElementById('label-year')) document.getElementById('label-year').innerText = getLabels('items-year');
    if(document.getElementById('header-year')) document.getElementById('header-year').innerText = getLabels('items-year');
    
    // Meses
    if(document.getElementById('label-month')) document.getElementById('label-month').innerText = getLabels('items-month');
    if(document.getElementById('header-month')) document.getElementById('header-month').innerText = getLabels('items-month');
    
    // Categorías
    if(document.getElementById('label-category')) document.getElementById('label-category').innerText = getLabels('items-category');
    if(document.getElementById('header-category')) document.getElementById('header-category').innerText = getLabels('items-category');

    // --- 4. FILTRAR LOS DATOS (EL MOTOR PRINCIPAL) ---
    const filtered = finalData.filter(d => 
        selYears.includes(d.year) && 
        selMonths.includes(d.month) && 
        selCats.includes(d.cat)
    );

    // --- 5. ACTUALIZAR KPIs BÁSICOS ---
    // Contador Grande (Expedientes)
    document.getElementById('kpi-count').innerText = filtered.length.toLocaleString();
    
    // Contador Pequeño (Arriba a la derecha)
    if(document.getElementById('kpi-total-filas')) 
        document.getElementById('kpi-total-filas').innerHTML = `${filtered.length} <span data-i18n="kpi_reg">${t.kpi_reg}</span>`;

    // --- 6. ACTUALIZAR COMPONENTES COMPLEJOS ---
    updateMapData(filtered);
    updateCharts(filtered, selYears);
    updateLocationKPI(filtered);

    // --- 7. NUEVO: ACTUALIZAR TARJETA DE ARCHIVO (NOMBRE Y TÍTULO) ---
    
    // A) Cambiar "EPEA" por "TITULO" (o "IZENBURUA" si es euskera)
    const labelTitulo = document.getElementById('card-label-titulo');
    if (labelTitulo) {
        // Lógica simple para ES/EU, puedes añadir más si quieres
        labelTitulo.innerText = currentLang === 'eu' ? "IZENBURUA" : "TITULO";
    }

    // B) Poner el nombre del archivo cargado
    const textFilename = document.getElementById('card-text-filename');
    if (textFilename) {
        // Usamos la variable global 'nombreArchivoSubido'
        // Si no hay archivo aún, mostramos un guion o texto por defecto
        textFilename.innerText = nombreArchivoSubido || "SIN ARCHIVO";
    }
}

// ============================================================
// 8. GRÁFICOS (TRADUCIDOS + TRIMESTRES + HORAS TABLA)
// ============================================================
function changeTemporalView(v) { temporalView = v; updateUI(); }

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
        const sortedYears = [...selYears].sort((a,b) => a-b);
        let labels = [], datasets = [];
        
        if (temporalView === 'year') {
            labels = sortedYears.map(y => y.toString());
            datasets = [{ label: 'Registros', data: sortedYears.map(y => data.filter(d => d.year === y).length), backgroundColor: sortedYears.map(y => yearColors[allYearsMaster.indexOf(y) % yearColors.length].bg), borderColor: sortedYears.map(y => yearColors[allYearsMaster.indexOf(y) % yearColors.length].border), borderWidth: 2 }];
        } else if (temporalView === 'month') {
            labels = t.months_abbr;
            datasets = sortedYears.map(y => {
                const c = Array(12).fill(0); data.filter(d => d.year === y).forEach(d => c[d.month - 1]++);
                const col = yearColors[allYearsMaster.indexOf(y) % yearColors.length];
                return { label: y.toString(), data: c, backgroundColor: col.bg, borderColor: col.border, borderWidth: 2 };
            });
        } else if (temporalView === 'quarter') {
            labels = t.quarters;
            datasets = sortedYears.map(y => {
                const c = Array(4).fill(0); 
                data.filter(d => d.year === y).forEach(d => {
                    const qIndex = Math.floor((d.month - 1) / 3);
                    c[qIndex]++;
                });
                const col = yearColors[allYearsMaster.indexOf(y) % yearColors.length];
                return { label: y.toString(), data: c, backgroundColor: col.bg, borderColor: col.border, borderWidth: 2 };
            });
        } else if (temporalView === 'day') {
            labels = t.days_abbr.map(l => l.substring(0,3));
            datasets = sortedYears.map(y => {
                const c = Array(7).fill(0); 
                data.filter(d => d.year === y).forEach(d => { let idx = d.date.getDay(); c[idx === 0 ? 6 : idx - 1]++; });
                const col = yearColors[allYearsMaster.indexOf(y) % yearColors.length];
                return { label: y.toString(), data: c, backgroundColor: col.bg, borderColor: col.border, borderWidth: 2 };
            });
        }

        tableDataCache = [];
        labels.forEach((lbl, index) => {
            let row = { label: lbl, index: index };
            datasets.forEach(ds => { row[ds.label] = ds.data[index]; });
            tableDataCache.push(row);
        });
        if (isTableView) renderTimelineTable();

        if (chartTimeline) chartTimeline.destroy();
        chartTimeline = new Chart(ctxTimeline, { 
            type: 'bar', 
            data: { labels, datasets }, 
            options: { 
                ...commonOptions,
                // AÑADIDO: Configuración del eje Y para enteros
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0 // <--- ESTO FUERZA ENTEROS
                        }
                    }
                }
            } 
        });
    }

    // --- CATEGORY ---
// --- CATEGORY ---
    const ctxCat = document.getElementById('chart-category');
    if (ctxCat) {
        // 1. Detectar si estamos en pantalla completa
        const container = document.getElementById('container-category');
        const isFullscreen = container.classList.contains('fullscreen');

        // Procesamiento de datos
        const catData = {}; 
        data.forEach(d => catData[d.cat] = (catData[d.cat] || 0) + 1);
        const sorted = Object.entries(catData).sort((a,b) => b[1]-a[1]);
        const top5 = sorted.slice(0, 5);
        const total = sorted.reduce((sum, item) => sum + item[1], 0);

        // Definir etiquetas LARGAS y CORTAS
        const fullLabels = top5.map(s => s[0]);
        const shortLabels = top5.map(s => s[0].length > 20 ? s[0].substring(0, 20) + '...' : s[0]);

        // 2. DECISIÓN: ¿Qué etiquetas y tamaño de letra usar?
        // Si es fullscreen usamos las largas, si no, las cortas.
        const activeLabels = isFullscreen ? fullLabels : shortLabels;
        const fontSize = isFullscreen ? 16 : 11; // Letra más grande en fullscreen
        const boxSize = isFullscreen ? 20 : 12;  // Cuadradito de color más grande

        // Cache para la tabla
        tableCatDataCache = sorted.map(item => ({
            cat: item[0], count: item[1], percent: ((item[1] / total) * 100).toFixed(1)
        }));
        if (isTableCatView) renderCategoryTable();

        if (chartCategory) chartCategory.destroy();
        
        chartCategory = new Chart(ctxCat, { 
            type: 'doughnut', 
            data: { 
                labels: activeLabels, // Usamos la variable dinámica
                datasets: [{ 
                    data: top5.map(s => s[1]), 
                    backgroundColor: yearColors.map(c => c.bg), 
                    borderColor: '#ffffff', 
                    borderWidth: 2 
                }] 
            }, 
            options: { 
                ...commonOptions, 
                maintainAspectRatio: false, 
                cutout: '60%',
                
                scales: { x: { display: false }, y: { display: false } },
                
                layout: {
                    padding: {
                        top: 10,
                        bottom: 20,
                        left: 10,
                        right: 10
                    }
                },

                plugins: { 
                    legend: { 
                        // En móvil siempre abajo, en PC: derecha (normal) o izquierda/derecha (fullscreen)
                        position: window.innerWidth < 768 ? 'bottom' : 'right',
                        labels: { 
                            boxWidth: boxSize,     // Tamaño dinámico caja color
                            padding: 15, 
                            font: { size: fontSize } // Tamaño dinámico letra
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = fullLabels[context.dataIndex] || '';
                                let value = context.parsed;
                                let totalVal = context.chart._metasets[context.datasetIndex].total;
                                let percentage = ((value / totalVal) * 100).toFixed(1) + "%";
                                return ` ${label}: ${value} (${percentage})`;
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
        
        // Datos para tabla
        const totalReg = data.length;
        tableHoursDataCache = hC.map((count, index) => ({
            hour: index, hourLabel: String(index).padStart(2, '0') + ":00",
            count: count, percent: totalReg > 0 ? ((count / totalReg) * 100).toFixed(1) : "0.0"
        }));
        if (isTableHoursView) renderHoursTable();

// ... código anterior de chartHours ...

        if (chartHours) chartHours.destroy();
        chartHours = new Chart(ctxHours, { 
            type: 'line', 
            data: { labels: Array.from({length: 24}, (_,i) => i), datasets: [{ label: 'Actividad', data: hC, borderColor: '#11cdef', fill: true, backgroundColor: 'rgba(17,205,239,0.1)', tension: 0.4 }] }, 
            options: { 
                ...commonOptions, 
                plugins: { legend: { display: false } }, 
                scales: { 
                    x: { ticks: { maxTicksLimit: 8 } },
                    // AÑADIDO: Configuración del eje Y para enteros
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0 // <--- ESTO FUERZA ENTEROS
                        }
                    }
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
    if (!map || !map.getSource('puntos')) return;
    const datosConGeo = data.filter(d => d.hasGeo); // Solo pintamos lo que tiene GPS

    const geojson = { type: 'FeatureCollection', features: datosConGeo.map(d => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [d.lon, d.lat] }, properties: { exp: d.exp, cat: d.cat, year: d.year, fullDate: d.date.toLocaleString('es-ES'), calle: d.calle, numero: d.numero, refnum: d.refnum, refanno: d.refanno } })) };
    map.getSource('puntos').setData(geojson);
    
    const allY = [...new Set(finalData.map(d => d.year))].sort((a,b) => a-b);
    const colorExpr = ['match', ['get', 'year']];
    allY.forEach(y => colorExpr.push(y, yearColors[allY.indexOf(y) % yearColors.length].border));
    colorExpr.push('#5e72e4');
    map.setPaintProperty('point-layer', 'circle-color', colorExpr);
    
    if (datosConGeo.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        datosConGeo.forEach(d => bounds.extend([d.lon, d.lat]));
        try { map.fitBounds(bounds, { padding: 40, maxZoom: 16 }); } catch (e) {}
    }
}

function toggleSatelite(btn) { isSatelite = !isSatelite; map.setLayoutProperty('satellite-layer', 'visibility', isSatelite ? 'visible' : 'none'); btn.style.background = isSatelite ? '#5e72e4' : ''; btn.style.color = isSatelite ? '#fff' : ''; }
function toggleHeatmap(btn) { isHeatmap = !isHeatmap; map.setLayoutProperty('heat-layer', 'visibility', isHeatmap ? 'visible' : 'none'); map.setLayoutProperty('point-layer', 'visibility', isHeatmap ? 'none' : 'visible'); btn.innerHTML = isHeatmap ? '<i class="fa-solid fa-location-dot"></i>' : '<i class="fa-solid fa-fire"></i>'; }
function toggle3D() { const p = map.getPitch(); map.easeTo({ pitch: p > 0 ? 0 : 60, bearing: p > 0 ? 0 : -20, duration: 1000 }); }

/* --- script.js --- */

function toggleFullscreen(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const isFullscreen = container.classList.toggle('fullscreen');
    const btnIcon = container.querySelector('.btn-maximize i');
    
    // Cambiar icono
    if (isFullscreen) {
        if (btnIcon) { 
            btnIcon.classList.remove('fa-maximize', 'fa-expand'); 
            btnIcon.classList.add('fa-xmark'); 
        }
        document.body.style.overflow = 'hidden'; 
    } else {
        if (btnIcon) {
            btnIcon.classList.remove('fa-xmark');
            if (containerId === 'container-map') btnIcon.classList.add('fa-expand'); 
            else btnIcon.classList.add('fa-maximize');
        }
        document.body.style.overflow = '';
    }

    // --- CORRECCIÓN AQUÍ ---
    setTimeout(() => {
        if (map) map.resize(); 
        updateUI(); 

        // FUERZA VISUAL: Aseguramos que si estaba en modo tabla, se vea la tabla
        // (A veces updateUI resetea la vista si no se controla bien)
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
async function updateLocationKPI(data) {
    const el = document.getElementById('kpi-location');
    const t = translations[currentLang];

    if (!data || data.length === 0) { el.innerText = "Sin Datos"; return; }
    if (data[0].locManual && data[0].locManual !== "") { el.innerText = data[0].locManual.toUpperCase(); return; }

    const dataConGeo = data.filter(d => d.hasGeo);
    if (dataConGeo.length === 0) { el.innerText = "Sin Ubicación GPS"; return; }

    let totalLat = 0, totalLon = 0;
    dataConGeo.forEach(d => { totalLat += d.lat; totalLon += d.lon; });
    const centerLat = totalLat / dataConGeo.length;
    const centerLon = totalLon / dataConGeo.length;

    el.innerText = `${centerLat.toFixed(3)}, ${centerLon.toFixed(3)}`;

    try {
        const urlOSM = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${centerLat}&lon=${centerLon}&zoom=10&accept-language=eu,es`;
        const response = await fetch(urlOSM, { method: 'GET', mode: 'cors', headers: { 'Accept': 'application/json' } });
        if(response.ok) {
            const json = await response.json();
            const addr = json.address;
            let placeName = addr.city || addr.town || addr.village || addr.municipality || addr.county;
            if (placeName) { el.innerText = placeName.toUpperCase(); return; }
        }
        throw new Error("OSM falló"); 
    } catch (e) {
        try {
            const urlB = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${centerLat}&longitude=${centerLon}&localityLanguage=es`;
            const resB = await fetch(urlB);
            if(resB.ok) {
                const jB = await resB.json();
                let p = jB.locality || jB.city || jB.principalSubdivision;
                if (p) el.innerText = p.toUpperCase();
            }
        } catch (er) {}
    }
}

// ============================================================
// 11. TABLAS DE DATOS Y VISOR (CORREGIDO DEFINITIVO)
// ============================================================

// 1. EVOLUCIÓN TEMPORAL
function toggleTimelineView() {
    isTableView = !isTableView;
    const btn = document.querySelector('#btn-toggle-view i');
    const canvas = document.getElementById('chart-timeline');
    const table = document.getElementById('table-timeline-view');

    // Alternar visibilidad
    canvas.style.display = isTableView ? 'none' : 'block';
    table.style.display = isTableView ? 'block' : 'none';
    
    // Cambiar icono y título
    btn.className = isTableView ? 'fa-solid fa-chart-column' : 'fa-solid fa-table';
    btn.parentElement.title = isTableView ? "Ver Gráfico" : "Ver Datos";

    if(isTableView) {
        renderTimelineTable();
    } else {
        // SOLUCIÓN: En lugar de resize(), llamamos a updateUI()
        // Esto destruye el gráfico y lo crea de nuevo ajustado perfectamente al hueco
        setTimeout(() => { updateUI(); }, 50);
    }
}

// 2. TOP TIPOS (CATEGORÍA)
function toggleCategoryView() {
    isTableCatView = !isTableCatView;
    const btn = document.querySelector('#btn-toggle-view-cat i');
    const canvas = document.getElementById('chart-category');
    const table = document.getElementById('table-category-view');

    canvas.style.display = isTableCatView ? 'none' : 'block';
    table.style.display = isTableCatView ? 'block' : 'none';
    
    btn.className = isTableCatView ? 'fa-solid fa-chart-pie' : 'fa-solid fa-table';
    btn.parentElement.title = isTableCatView ? "Ver Gráfico" : "Ver Datos";

    if(isTableCatView) {
        renderCategoryTable();
    } else {
        // SOLUCIÓN: Redibujar completo para recalcular centro y márgenes
        setTimeout(() => { updateUI(); }, 50);
    }
}

// 3. HORAS
function toggleHoursView() {
    isTableHoursView = !isTableHoursView;
    const btn = document.querySelector('#btn-toggle-view-hours i');
    const canvas = document.getElementById('chart-hours');
    const table = document.getElementById('table-hours-view');

    canvas.style.display = isTableHoursView ? 'none' : 'block';
    table.style.display = isTableHoursView ? 'block' : 'none';
    
    btn.className = isTableHoursView ? 'fa-solid fa-chart-line' : 'fa-solid fa-table';
    btn.parentElement.title = isTableHoursView ? "Ver Gráfico" : "Ver Datos";

    if(isTableHoursView) {
        renderHoursTable();
    } else {
        // SOLUCIÓN: Redibujar completo
        setTimeout(() => { updateUI(); }, 50);
    }
}

// --- FUNCIONES DE RENDERIZADO DE TABLAS (Sin cambios) ---

function renderTimelineTable() {
    const c = document.getElementById('table-timeline-view');
    if (!tableDataCache || tableDataCache.length === 0) { c.innerHTML = '<p style="padding:20px; text-align:center; color:#888;">Sin datos</p>'; return; }
    
    const keys = Object.keys(tableDataCache[0]).filter(k => k !== 'label' && k !== 'index');
    let html = `<table class="data-table"><thead><tr><th onclick="sortTable('index')">PERIODO <i class="fa-solid fa-sort"></i></th>`;
    keys.forEach(k => { html += `<th onclick="sortTable('${k}')">${k} <i class="fa-solid fa-sort"></i></th>`; });
    html += `</tr></thead><tbody>`;
    
    tableDataCache.forEach(row => {
        html += `<tr><td><strong>${row.label}</strong></td>`;
        keys.forEach(k => { html += `<td>${row[k].toLocaleString()}</td>`; });
        html += `</tr>`;
    });
    html += `</tbody></table>`;
    c.innerHTML = html;
    updateSortIcons(currentSort.col, '#table-timeline-view', currentSort);
}

function sortTable(column) {
    if (currentSort.col === column) currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
    else { currentSort.col = column; currentSort.dir = column === 'index' ? 'asc' : 'desc'; }
    
    tableDataCache.sort((a, b) => {
        let valA = a[column], valB = b[column];
        if (valA < valB) return currentSort.dir === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.dir === 'asc' ? 1 : -1;
        return 0;
    });
    renderTimelineTable();
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

// ============================================================
// MODIFICACIÓN: CACHE BUSTING AUTOMÁTICO
// ============================================================
function openPdfModal(fileName, title) {
    document.getElementById('pdf-modal-title').innerHTML = `<i class="fa-solid fa-file-pdf"></i> ${title}`;
    
    // Creamos un sello de tiempo único (ej: 1709123456789)
    const cacheBuster = new Date().getTime();
    
    // Lo añadimos al final de la URL con "?v="
    // El navegador creerá que es un archivo nuevo cada vez que lo abras
    document.getElementById('pdf-frame').src = "./ArchivosPdf/" + fileName + "?v=" + cacheBuster;
    
    document.getElementById('pdf-modal').classList.add('active');
}
function closePdfModal() { document.getElementById('pdf-modal').classList.remove('active'); }
document.getElementById('pdf-modal').addEventListener('click', function(e) { if (e.target === this) closePdfModal(); });
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closePdfModal(); });