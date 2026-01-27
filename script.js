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

let isTableStreetsView = false;
let tableStreetsDataCache = [];
let currentSortStreets = { col: 'count', dir: 'desc' };

// Paleta de alta visibilidad (Neon/Bright)
const yearColors = [
    { bg: 'rgba(255, 49, 49, 0.8)', border: '#FF3131' },   // Rojo Neón
    { bg: 'rgba(255, 110, 0, 0.8)', border: '#FF6E00' },   // Naranja Brillante
    { bg: 'rgba(255, 0, 127, 0.8)', border: '#FF007F' },   // Rosa Fucsia
    { bg: 'rgba(0, 255, 242, 0.8)', border: '#00FFF2' },   // Cian Neón
    { bg: 'rgba(188, 0, 255, 0.8)', border: '#BC00FF' }    // Violeta Eléctrico
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

    // Mostrar el loader inmediatamente
    document.getElementById('loading-overlay').classList.add('active');

    // Usar un pequeño retardo para dejar que el navegador dibuje el "Spinner"
    // antes de empezar la carga pesada del Excel
    setTimeout(() => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                nombreArchivoSubido = file.name.replace(/\.[^/.]+$/, "").toUpperCase();
                const dataArr = new Uint8Array(e.target.result);
                
                // Carga del libro con optimización de memoria
                const wb = XLSX.read(dataArr, {
                    type: 'array', 
                    cellDates: true, 
                    cellNF: false, 
                    cellText: false 
                });

                const firstSheet = wb.SheetNames[0];
                const data = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], { defval: "" });

                if (data.length === 0) {
                    throw new Error("El archivo está vacío");
                }

                showMapping(data);
                console.log("Archivo cargado con éxito:", nombreArchivoSubido);

            } catch (error) {
                console.error("Error procesando Excel:", error);
                alert("Error: No se pudo leer el archivo. Asegúrate de que es un Excel o CSV válido.");
            } finally {
                document.getElementById('loading-overlay').classList.remove('active');
            }
        };

        reader.onerror = () => {
            alert("Error de lectura del archivo.");
            document.getElementById('loading-overlay').classList.remove('active');
        };

        reader.readAsArrayBuffer(file);
    }, 200);
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
    // Añadimos 'map-calle' a la lista de IDs
    const mappingIds = ['map-expediente', 'map-fecha', 'map-hora', 'map-lat', 'map-lon', 'map-categoria', 'map-calle'];
    
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

        // AUTO-SELECCIÓN INTELIGENTE
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
        // NUEVA AUTO-SELECCIÓN DE CALLE
        else if (id === 'map-calle') {
            match = headers.find(h => h.toUpperCase().includes('CALLE') || h.toUpperCase().includes('DIR') || 
                                     h.toUpperCase().includes('DOMICILIO') || h.toUpperCase().includes('VIA') ||
                                     h.toUpperCase().includes('EMPLAZAMIENTO'));
        }

        if (match) newSel.value = match;
    });

    const locInput = document.getElementById('map-localidad');
    if(locInput) locInput.value = "";
    
    refreshMappingStatus();
    document.getElementById('upload-view').classList.remove('active');
    document.getElementById('mapping-view').classList.add('active');
    window.scrollTo(0, 0);
}

function refreshMappingStatus() {
    const mappingIds = ['map-expediente', 'map-fecha', 'map-hora', 'map-lat', 'map-lon', 'map-categoria', 'map-calle'];
    
    // Obtenemos los valores seleccionados actualmente
    const currentSelections = mappingIds.map(id => {
        const el = document.getElementById(id);
        return (el && el.value) ? el.value : "";
    }).filter(val => val !== "" && val !== "***MULTI_COLUMN***");

    mappingIds.forEach(id => {
        const sel = document.getElementById(id);
        if(!sel) return;
        
        Array.from(sel.options).forEach(opt => {
            if (opt.value === "" || opt.disabled || opt.value === "***MULTI_COLUMN***") return;
            
            // Si la columna ya está usada en OTRO selector, la marcamos
            const isUsedElsewhere = currentSelections.includes(opt.value) && sel.value !== opt.value;
            
            let textoLimpio = opt.value.replace('__EMPTY', 'BLANCO'); 
            const symbol = isUsedElsewhere ? "✕ " : (sel.value === opt.value ? "✓ " : "• ");
            
            opt.textContent = symbol + textoLimpio;
            opt.style.color = isUsedElsewhere ? "#cbd5e0" : "#5e72e4";
        });
    });
}

// ============================================================
// 5. PROCESAMIENTO
// ============================================================
document.getElementById('btn-visualizar').onclick = () => {
    // 1. VALIDACIÓN INICIAL Y CAPTURA DE CONFIGURACIÓN
    const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value : "";

    const config = {
        exp: getVal('map-expediente'),
        fecha: getVal('map-fecha'),
        hora: getVal('map-hora'),
        lat: getVal('map-lat'),
        lon: getVal('map-lon'),
        cat: getVal('map-categoria'),
        calle: getVal('map-calle'), // <--- IMPORTANTE: Captura la columna de calle
        locManual: document.getElementById('map-localidad') ? document.getElementById('map-localidad').value.trim() : ""
    };

    if (!config.fecha) {
        alert("Por favor, selecciona al menos la columna de FECHA.");
        return;
    }

    // 2. MOSTRAR PANTALLA DE CARGA
    document.getElementById('loading-overlay').classList.add('active');

    // Usamos un pequeño delay para que el navegador tenga tiempo de pintar el spinner
    setTimeout(() => {
        try {
            let registrosSinFecha = [];
            finalData = [];

            // 3. PROCESAMIENTO DE LOS DATOS
            finalData = rawData.map(row => {
                let valFecha = row[config.fecha];
                let d;
                
                // Tratamiento de Fecha (Date vs String)
                if (valFecha instanceof Date) {
                    d = new Date(valFecha);
                } else if (typeof valFecha === 'string' && valFecha.includes('/')) {
                    const parts = valFecha.split('/');
                    if (parts.length >= 3) {
                        d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
                    } else d = new Date(valFecha);
                } else {
                    d = new Date(valFecha);
                }

                // Si la fecha es inválida, guardamos para el modal de errores
                if (isNaN(d.getTime())) {
                    const keyNum = Object.keys(row).find(k => k.toUpperCase().includes('REFNUM') || k.toUpperCase().includes('NUMERO'));
                    registrosSinFecha.push(`REF: ${row[keyNum] || 'S/N'}`);
                    return null;
                }

                // Tratamiento de Hora
                if (config.hora && row[config.hora]) {
                    const t = String(row[config.hora]).trim();
                    if (t.includes(':')) {
                        const p = t.split(':');
                        d.setHours(parseInt(p[0]) || 0, parseInt(p[1]) || 0, 0);
                    }
                }

                // Tratamiento de Coordenadas (Limpieza de comas por puntos)
                let lat = 0, lon = 0, tieneGeo = false;
                if (config.lat && config.lon && row[config.lat] && row[config.lon]) {
                    lat = parseFloat(String(row[config.lat]).replace(',', '.'));
                    lon = parseFloat(String(row[config.lon]).replace(',', '.'));
                    if (!isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0)) {
                        tieneGeo = true;
                    }
                }

                // Retornamos el objeto normalizado
                return {
                    exp: row[config.exp] || "N/A",
                    date: d, 
                    year: d.getFullYear(), 
                    month: d.getMonth() + 1, 
                    hour: d.getHours(),
                    lat, 
                    lon, 
                    hasGeo: tieneGeo,
                    cat: row[config.cat] || "General",
                    calle: row[config.calle] ? String(row[config.calle]).toUpperCase().trim() : "SIN CALLE / GPS",
                    locManual: config.locManual,
                    refnum: row['REFNUM'] || "", 
                    refanno: row['REFANNO'] || ""
                };
            }).filter(v => v !== null);

            // 4. TRANSICIÓN DE VISTAS
            document.getElementById('mapping-view').classList.remove('active');
            document.getElementById('dashboard-view').classList.add('active');
            
            // Resetear scroll a la parte superior
            window.scrollTo(0, 0);

            // 5. INICIALIZAR COMPONENTES
            setupFilters();
            initMap();
            
            // 6. FIX CRÍTICO: CENTRADO DE MAPA Y RENDERIZADO
            // Esperamos a que la animación de la página termine para que el mapa
            // detecte su tamaño real y el zoom automático (fitBounds) funcione.
            setTimeout(() => {
                if (map) {
                    map.resize(); // Fuerza al mapa a ocupar todo su div
                }
                updateUI(); // Calcula KPIs, Gráficos y activa el Zoom del mapa
            }, 600);

            // Mostrar errores de fecha si existen
            if (registrosSinFecha.length > 0) {
                showRejectedModal(registrosSinFecha);
            }

        } catch (err) {
            console.error("Error en procesamiento:", err);
            alert("Hubo un error al generar el dashboard. Revisa el formato de tus datos.");
        } finally {
            // Ocultar pantalla de carga
            document.getElementById('loading-overlay').classList.remove('active');
        }
    }, 150);
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
    // 1. CERRAR FILTROS (Años, Meses, Categorías)
    // Si el clic NO fue dentro de un dropdown personalizado, cerramos todos los desplegables
    if (!e.target.closest('.custom-dropdown')) {
        document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('active'));
        // Quitar clase active a los headers también si fuera necesario visualmente
        document.querySelectorAll('.dropdown-header').forEach(h => h.classList.remove('active'));
    }

    // 2. CERRAR SIDEBAR MÓVIL
    // Si estamos en móvil, el sidebar está abierto, y el clic no fue en el sidebar ni en el botón de abrir
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.querySelector('.mobile-menu-btn');
    
    if (sidebar && toggleBtn && window.innerWidth <= 768) {
        if (sidebar.classList.contains('active') && !sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
            toggleSidebarMobile();
        }
    }

    // 3. CERRAR GESTOR DE CAPAS DEL MAPA (NUEVO)
    const layerMenu = document.getElementById('layers-dropdown');
    const layerBtn = document.getElementById('btn-layers-menu');
    
    // Si el menú existe y está abierto...
    if (layerMenu && layerMenu.classList.contains('active')) {
        // ...y el clic NO fue dentro del menú NI en el botón que lo abre
        if (!layerMenu.contains(e.target) && !layerBtn.contains(e.target)) {
            layerMenu.classList.remove('active');
            // Resetear el estilo del botón (quitar el fondo gris)
            if (layerBtn) layerBtn.style.background = '';
        }
    }
};

function toggleGroup(containerId, state, event) {
    if (event) event.stopPropagation();
    
    runWithLoader(() => {
        const container = document.getElementById(containerId);
        if (container) {
            const items = container.querySelectorAll('.checkbox-item');
            items.forEach(div => {
                if (div.style.display !== 'none') {
                    const cb = div.querySelector('input');
                    if (cb) cb.checked = state;
                }
            });
            // El updateUI debe ir AQUÍ, UNA SOLA VEZ al final del bucle
            updateUI(); 
        }
    });
}

// VARIABLE GLOBAL PARA EL TEMPORIZADOR DE BÚSQUEDA
let searchTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. INDICADOR DE VERSIÓN
    const versionBadge = document.getElementById('app-version-badge');
    if (versionBadge && typeof EUROCOP_VERSION !== 'undefined') {
        versionBadge.textContent = 'v' + EUROCOP_VERSION;
    }

    // 2. INICIALIZACIÓN DE IDIOMA
    const langSelect = document.getElementById('lang-selector');
    if(langSelect) {
        langSelect.value = currentLang;
        applyLanguage(currentLang);
    }

    // 3. GESTIÓN DE CARGA DE ARCHIVOS (DROP ZONE & INPUT)
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    if (dropZone && fileInput) {
        // Abrir selector al hacer clic en el área
        dropZone.onclick = () => fileInput.click();

        // Listener cuando se selecciona un archivo por el explorador
        fileInput.onchange = (e) => { 
            if (e.target.files.length > 0) {
                processFile(e.target.files[0]);
                // LIMPIEZA CRÍTICA: Permite volver a subir el mismo archivo si el usuario lo corrige
                e.target.value = ""; 
            }
        };

        // Configuración de Drag & Drop
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        // Efectos visuales de arrastre
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
        });
        
        // Listener cuando se suelta un archivo
        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) processFile(files[0]);
        });
    }

    // 4. LÓGICA DEL BUSCADOR DE CATEGORÍAS (MULTITÉRMINO / AND)
    const searchInput = document.getElementById('cat-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            // Dividir por espacios para buscar todas las palabras (lógica AND)
            const terms = e.target.value.toLowerCase().split(' ').map(t => t.trim()).filter(t => t.length > 0);
            const container = document.getElementById('items-category');
            if (!container) return;
            
            const items = container.querySelectorAll('.checkbox-item');

            // Filtrado visual instantáneo
            items.forEach(div => {
                const labelText = div.querySelector('span').textContent.toLowerCase();
                const isMatch = terms.every(term => labelText.includes(term));
                
                if (terms.length === 0) {
                    div.style.display = 'flex';
                } else {
                    div.style.display = isMatch ? 'flex' : 'none';
                }
            });

            // Auto-selección inteligente (Debounce de 600ms para no saturar procesos)
            clearTimeout(searchTimeout); 
            searchTimeout = setTimeout(() => {
                if (terms.length > 0) {
                    let hasChanges = false;
                    items.forEach(div => {
                        const isVisible = div.style.display !== 'none';
                        const checkbox = div.querySelector('input');
                        
                        // Seleccionar lo que el usuario ha filtrado y deseleccionar lo que ha ocultado
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
let lastFilteredData = []; 
function updateUI() {
    // 1. SINCRONIZAR SELECTOR DE VISTA TEMPORAL
    const temporalSelect = document.getElementById('select-temporal-view');
    if (temporalSelect) temporalSelect.value = temporalView; 

    const t = translations[currentLang];
    
    // HELPERS PARA ETIQUETAS DE FILTROS
    const getValues = (containerId) => {
        return Array.from(document.querySelectorAll(`#${containerId} input:checked`)).map(i => i.value);
    };

    const getLabels = (containerId) => {
        const container = document.getElementById(containerId);
        if (!container) return "---";
        const allCount = container.querySelectorAll('input').length;
        const checkedInputs = Array.from(container.querySelectorAll('input:checked'));
        const count = checkedInputs.length;
        
        if (count === 0) return (t.sel_none || "NINGUNO").toUpperCase();
        if (count === allCount && allCount > 0) return (t.sel_all || "TODOS").toUpperCase();
        if (count === 1) return checkedInputs[0].nextElementSibling.innerText;
        return `${count} ${(currentLang === 'en' ? 'SELECTED' : 'SELECCIONADOS')}`;
    };

    // 2. OBTENER SELECCIONES ACTUALES
    const selYears = getValues('items-year').map(Number);
    const selMonths = getValues('items-month').map(Number);
    const selCats = getValues('items-category');

    // 3. ACTUALIZAR ETIQUETAS HEADER/SIDEBAR
    if(document.getElementById('label-year')) document.getElementById('label-year').innerText = getLabels('items-year');
    if(document.getElementById('header-year')) document.getElementById('header-year').innerText = getLabels('items-year');
    if(document.getElementById('label-month')) document.getElementById('label-month').innerText = getLabels('items-month');
    if(document.getElementById('header-month')) document.getElementById('header-month').innerText = getLabels('items-month');
    if(document.getElementById('label-category')) document.getElementById('label-category').innerText = getLabels('items-category');
    if(document.getElementById('header-category')) document.getElementById('header-category').innerText = getLabels('items-category');

    // 4. FILTRADO DE DATOS (CRÍTICO)
    let filtered = finalData.filter(d => 
        selYears.includes(d.year) && 
        selMonths.includes(d.month) && 
        selCats.includes(d.cat)
    );

    // Aplicar Filtro Espacial si existe
    if (typeof applySpatialFilter === 'function') {
        filtered = applySpatialFilter(filtered);
    }

    // GUARDAR EN CACHÉ GLOBAL PARA RE-ORDENAMIENTOS
    lastFilteredData = filtered; 

    // 5. ACTUALIZAR KPIS
    document.getElementById('kpi-count').innerText = filtered.length.toLocaleString();
    if(document.getElementById('kpi-total-filas')) 
        document.getElementById('kpi-total-filas').innerHTML = `${filtered.length} <span data-i18n="kpi_reg">${t.kpi_reg}</span>`;

    const textFilename = document.getElementById('card-text-filename');
    if (textFilename) textFilename.innerText = nombreArchivoSubido || "SIN ARCHIVO";

    // 6. ACTUALIZAR MAPA Y GRÁFICOS
    updateMapData(filtered);
    updateCharts(filtered, selYears);
    updateLocationKPI(filtered).catch(err => console.warn(err));

    // 7. NUEVA LÓGICA: RENDERIZAR TABLA DE CALLES SI ESTÁ ACTIVA
    if (isTableStreetsView) {
        renderStreetsTable(filtered);
    }
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
        // Busca la creación del chartTimeline dentro de la función updateCharts
        chartTimeline = new Chart(ctxTimeline, { 
            type: chartTimelineType, 
            data: { labels, datasets }, 
            options: { 
                ...commonOptions,
                // --- REINSERTA ESTE BLOQUE onClick ---
                onClick: (e, activeEls) => {
                    if (activeEls.length > 0) {
                        const dataIndex = activeEls[0].index;
                        const datasetIndex = activeEls[0].datasetIndex;
                        const labelX = labels[dataIndex]; 
                        const categoryName = datasets[datasetIndex].label;
                        showDetailedRecords(labelX, categoryName);
                    }
                },
                // -------------------------------------
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        mode: 'index',
                        intersect: false,
                        itemSort: (a, b) => b.raw - a.raw,
                        filter: (tooltipItem) => tooltipItem.raw > 0
                    }
                },
                scales: {
                    x: { stacked: chartTimelineType === 'bar', grid: { display: false } },
                    y: { stacked: chartTimelineType === 'bar', beginAtZero: true, ticks: { precision: 0 } }
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
    map = new maplibregl.Map({ 
        container: 'main-map', 
        style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json', 
        center: [-2.63, 43.17], 
        zoom: 12, 
        preserveDrawingBuffer: true, // Esto ya lo tenías, mantenlo.
        antialias: true              // Añade esto para mejorar compatibilidad de captura.
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
        map.addSource('satellite-tiles', { 'type': 'raster', 'tiles': ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], 'tileSize': 256 });
        map.addLayer({ 'id': 'satellite-layer', 'type': 'raster', 'source': 'satellite-tiles', 'layout': { 'visibility': 'none' } });
        map.addSource('puntos', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'heat-layer', type: 'heatmap', source: 'puntos', layout: { 'visibility': 'none' }, paint: { 'heatmap-weight': 1, 'heatmap-intensity': 3, 'heatmap-radius': 20 } });
        map.addLayer({ id: 'point-layer', type: 'circle', source: 'puntos', layout: { 'visibility': 'visible' }, paint: { 'circle-radius': 6, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff', 'circle-color': '#5e72e4' } });
        // Busca esta sección dentro de initMap:
        map.on('click', 'point-layer', (e) => {
            const p = e.features[0].properties;
            
            // 1. Lógica para construir la dirección
            let direccionHtml = "";
            // Solo mostramos si la calle no es el valor por defecto
            if (p.calle && p.calle !== "SIN CALLE / GPS") {
                const num = (p.numero && p.numero !== "undefined") ? p.numero : "";
                direccionHtml = `<br><span><b>Dirección:</b> ${p.calle} ${num}</span>`;
            }

            // 2. Generar el Popup
            new maplibregl.Popup({ offset: 10, maxWidth: '250px' })
                .setLngLat(e.features[0].geometry.coordinates)
                .setHTML(`
                    <div style="padding:5px; font-family:'Inter', sans-serif;">
                        <div style="color:#5e72e4; font-weight:800; font-size:12px; margin-bottom:5px; border-bottom:1px solid #eee;">
                            REF${p.refanno}-${p.refnum}
                        </div>
                        <div style="font-size:11px;">
                            <span><b>Cat:</b> ${p.cat}</span>
                            ${direccionHtml} <!-- AQUÍ SE INSERTA LA CALLE -->
                            <br><span><b>Fecha:</b> ${p.fullDate}</span>
                        </div>
                    </div>
                `)
                .addTo(map);
        });
    });
}

// ============================================================
// ACTUALIZAR DATOS DEL MAPA (Versión: No ocultar si hay capas)
// ============================================================
function updateMapData(data) {
    const container = document.getElementById('container-map');
    const datosConGeo = data.filter(d => d.hasGeo); 

    // 1. CONTROL DE VISIBILIDAD
    const isFilterActive = document.getElementById('chk-spatial-filter')?.checked;
    const hasLayers = (typeof mapLayers !== 'undefined' && mapLayers.length > 0);
    const shouldKeepOpen = isFilterActive || hasLayers || datosConGeo.length > 0;

    if (!shouldKeepOpen) {
        if (container) container.classList.remove('active-map');
        return; 
    } else {
        if (container && !container.classList.contains('active-map')) {
            container.classList.add('active-map');
            setTimeout(() => { if (map) map.resize(); }, 300);
        }
    }

    if (!map || !map.getSource('puntos')) return;

    // 2. GENERAR GEOJSON CON JITTERING (HH:mm sin segundos en fullDate)
    const factor = 0.0002; 
    const geojson = { 
        type: 'FeatureCollection', 
        features: datosConGeo.map(d => ({ 
            type: 'Feature', 
            geometry: { 
                type: 'Point', 
                coordinates: [d.lon + (Math.random() - 0.5) * factor, d.lat + (Math.random() - 0.5) * factor] 
            }, 
            properties: { 
                cat: d.cat, 
                year: d.year, 
                fullDate: d.date.toLocaleString([], { 
                    day: 'numeric', month: 'numeric', year: 'numeric', 
                    hour: '2-digit', minute: '2-digit' 
                }), 
                refnum: d.refnum, 
                refanno: d.refanno,
                calle: d.calle,
                numero: d.numero
            } 
        }))
    };

    map.getSource('puntos').setData(geojson);

    // 3. LÓGICA DE COLORES DINÁMICOS POR AÑO
    // Obtenemos todos los años únicos presentes en el archivo original (para mantener consistencia)
    const allYearsMaster = [...new Set(finalData.map(d => d.year))].sort((a, b) => a - b);
    
    // Creamos la expresión: ['match', ['get', 'year'], año1, color1, año2, color2, ..., color_por_defecto]
    const colorExpression = ['match', ['get', 'year']];
    
    allYearsMaster.forEach((y, index) => {
        // Usamos la paleta de colores definida en yearColors
        const colorIndex = index % yearColors.length;
        colorExpression.push(y, yearColors[colorIndex].border);
    });
    
    // Color final por defecto (por si acaso)
    colorExpression.push('#5e72e4');

    // Aplicamos la expresión a la capa de puntos
    map.setPaintProperty('point-layer', 'circle-color', '#FF3131');
    // Añade esto debajo para que el borde blanco sea más fuerte y resalte más:
    map.setPaintProperty('point-layer', 'circle-stroke-width', 2.5);
    map.setPaintProperty('point-layer', 'circle-radius', 7); // Un poquito más grandes
    // 4. ENCUADRAR EL MAPA (ZOOM)
    if (datosConGeo.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        datosConGeo.forEach(d => {
            if (!isNaN(d.lon) && !isNaN(d.lat)) bounds.extend([d.lon, d.lat]);
        });

        setTimeout(() => {
            try {
                map.fitBounds(bounds, { padding: 50, maxZoom: 16, duration: 1000 });
            } catch (e) { console.warn(e); }
        }, 400); 
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
// 1. Variable global para evitar colapsar la API (ponla al inicio de script.js)
let isGeocodingActive = false;

async function updateLocationKPI(data) {
    const el = document.getElementById('kpi-location');
    if (!el) return;

    // Si no hay datos, resetear
    if (!data || data.length === 0) { 
        el.innerText = "Sin Datos"; 
        return; 
    }
    
    // Si hay localidad manual, usarla y no llamar a la API
    if (data[0].locManual && data[0].locManual !== "") { 
        el.innerText = data[0].locManual.toUpperCase(); 
        return; 
    }

    // Calcular centroide
    const dataConGeo = data.filter(d => d.hasGeo);
    if (dataConGeo.length === 0) { 
        el.innerText = "Sin Ubicación GPS"; 
        return; 
    }

    let totalLat = 0, totalLon = 0;
    dataConGeo.forEach(d => { totalLat += d.lat; totalLon += d.lon; });
    const centerLat = totalLat / dataConGeo.length;
    const centerLon = totalLon / dataConGeo.length;
    
    // Mostrar coordenadas temporalmente por si la API falla
    el.innerText = `${centerLat.toFixed(3)}, ${centerLon.toFixed(3)}`;

    // --- BLOQUEO PARA EVITAR "NO RESPONSE" O COLAPSOS ---
    if (isGeocodingActive) return; // Si ya hay una petición en curso, ignorar la nueva
    isGeocodingActive = true;

    // Declaramos variables de control fuera del try para usarlas en finally
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 segundos timeout

    try {
        const langCode = currentLang === 'eu' ? 'eu' : (currentLang === 'ca' ? 'ca' : 'es');
        const urlB = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${centerLat}&longitude=${centerLon}&localityLanguage=${langCode}`;
        
        const resB = await fetch(urlB, { signal: controller.signal });

        if(resB.ok) {
            const jB = await resB.json();
            let p = jB.locality || jB.city || jB.principalSubdivision;
            if (p) { 
                el.innerText = p.toUpperCase(); 
            }
        }
    } catch (er) {
        // Error silencioso: Si la API falla, nos quedamos con las coordenadas
        // console.warn("Geocoding API falló o tardó demasiado");
    } finally {
        // LIMPIEZA CRUCIAL: Cancelar el timeout y liberar el bloqueo
        clearTimeout(timeoutId); 
        setTimeout(() => { isGeocodingActive = false; }, 1000);
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
function toggleStreetsView() {
    isTableStreetsView = !isTableStreetsView;
    const btn = document.querySelector('#btn-toggle-streets i');
    const mapDiv = document.getElementById('main-map');
    const tableDiv = document.getElementById('table-streets-view');

    // Alternar visibilidad
    mapDiv.style.display = isTableStreetsView ? 'none' : 'block';
    tableDiv.style.display = isTableStreetsView ? 'block' : 'none';

    // Cambiar icono del botón
    btn.className = isTableStreetsView ? 'fa-solid fa-earth-americas' : 'fa-solid fa-list-ol';
    btn.parentElement.title = isTableStreetsView ? "Ver Mapa" : "Ver Listado de Calles";

    if (isTableStreetsView) {
        // Al activar, refrescamos con los datos actuales filtrados
        updateUI(); 
    }
}

function renderStreetsTable(data) {
    const container = document.getElementById('table-streets-view');
    if (!container) return;

    // 1. Agrupar por calle
    const streetCounts = {};
    data.forEach(d => {
        // d.calle ya viene procesado desde el paso anterior
        let nombreCalle = d.calle || "SIN CALLE / GPS";
        streetCounts[nombreCalle] = (streetCounts[nombreCalle] || 0) + 1;
    });

    // 2. Convertir a array y aplicar orden
    tableStreetsDataCache = Object.entries(streetCounts).map(([name, count]) => ({ name, count }));
    
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

    // 3. Generar Tabla HTML
    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th onclick="sortTableStreets('name')" style="cursor:pointer; text-align:left;">CALLE <i class="fa-solid fa-sort"></i></th>
                    <th onclick="sortTableStreets('count')" style="cursor:pointer; width:90px;">REG. <i class="fa-solid fa-sort"></i></th>
                </tr>
            </thead>
            <tbody>`;

        tableStreetsDataCache.forEach(row => {
            // Escapamos comillas simples por si el nombre de la calle las tiene (ej: CL' ARTUNDUAGA)
            const safeName = row.name.replace(/'/g, "\\'");
            
            html += `
                <tr ondblclick="focusStreetOnMap('${safeName}')" 
                    style="cursor:pointer;" 
                    title="Doble clic para situar en mapa">
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
    renderStreetsTable(lastFilteredData); // Necesitaremos guardar el último filtro
}

function sortDataStreets() {
    tableStreetsDataCache.sort((a, b) => {
        let vA = a[currentSortStreets.col];
        let vB = b[currentSortStreets.col];
        if (currentSortStreets.dir === 'asc') return vA > vB ? 1 : -1;
        else return vA < vB ? 1 : -1;
    });
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
    
    // 1. Traducción estándar de etiquetas data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => { 
        const k = el.getAttribute('data-i18n'); 
        if (t[k]) el.textContent = t[k]; 
    });

    // ... (código existente del placeholder, botones dropdown, etc.) ...

    // 2. NUEVO: Traducir title del botón de subir capa
    const btnAdd = document.getElementById('btn-add-layer-icon');
    if(btnAdd && t.btn_add_layer_title) {
        btnAdd.title = t.btn_add_layer_title;
    }

    // 3. NUEVO: Refrescar mensaje de "Sin capas" si la lista está vacía
    if(typeof renderLayerList === 'function') {
        renderLayerList();
    }

    if(finalData.length > 0) updateUI();
}

// ============================================================
// MODALES PDF E IMAGEN (ACTUALIZADO)
// ============================================================

function openPdfModal(fileName, title) {
    document.getElementById('pdf-modal-title').innerHTML = `<i class="fa-solid fa-file-pdf"></i> ${title}`;
    
    // Versión para evitar caché
    let versionParam = (typeof EUROCOP_VERSION !== 'undefined') ? EUROCOP_VERSION : new Date().getTime();
    
    // 1. Mostrar IFRAME y Ocultar IMAGEN
    const iframe = document.getElementById('pdf-frame');
    const img = document.getElementById('img-frame');
    
    if (img) img.style.display = 'none';
    if (iframe) {
        iframe.style.display = 'block';
        iframe.src = "./ArchivosPdf/" + fileName + "?v=" + versionParam;
    }

    document.getElementById('pdf-modal').classList.add('active');
}

// NUEVA FUNCIÓN PARA ABRIR IMAGEN
function openImageModal(path, title) {
    const titleEl = document.getElementById('pdf-modal-title');
    if(titleEl) titleEl.innerHTML = `<i class="fa-solid fa-image"></i> ${title}`;
    
    const iframe = document.getElementById('pdf-frame');
    const img = document.getElementById('img-frame');
    const modal = document.getElementById('pdf-modal');

    // Ocultamos el iframe y mostramos la imagen
    if (iframe) iframe.style.display = 'none';
    if (img) {
        img.src = path + "?v=" + new Date().getTime(); // Evitar caché
        img.style.display = 'block'; // Mostrar la imagen
    }

    modal.classList.add('active');
}

function closePdfModal() { 
    const modal = document.getElementById('pdf-modal');
    const iframe = document.getElementById('pdf-frame');
    const img = document.getElementById('img-frame');

    modal.classList.remove('active');
    
    // Limpiar fuentes para detener carga/memoria
    setTimeout(() => {
        if(iframe) iframe.src = "";
        if(img) img.src = "";
    }, 300);
}

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

// ============================================================
// 13. MAPA POLIGONOS
// ============================================================

// VARIABLES GLOBALES PARA POLÍGONOS
let isPolygonLoaded = false;
let isPolygonVisible = false;

// 1. Simular clic en el input oculto o alternar visibilidad si ya existe
function clickPolygonUpload() {
    if (!map) return;
    
    // Si ya cargamos una capa, solo alternamos visibilidad
    if (isPolygonLoaded) {
        isPolygonVisible = !isPolygonVisible;
        const visibility = isPolygonVisible ? 'visible' : 'none';
        
        if (map.getLayer('poly-fill')) map.setLayoutProperty('poly-fill', 'visibility', visibility);
        if (map.getLayer('poly-line')) map.setLayoutProperty('poly-line', 'visibility', visibility);
        
        // Cambiar estilo del botón
        const btn = document.getElementById('btn-polygons');
        btn.style.background = isPolygonVisible ? '#5e72e4' : '';
        btn.style.color = isPolygonVisible ? '#fff' : '';
    } else {
        // Si no hay capa, abrir selector de archivos
        document.getElementById('input-geojson').click();
    }
}

// 2. Procesar el archivo GeoJSON subido
// 2. Manejar la subida del archivo (ACTUALIZADA PARA FILTRO ESPACIAL)
function handleGeojsonUpload(input) {
    const file = input.files[0];
    if (!file) return;

    // Mostrar loader
    document.getElementById('loading-overlay').classList.add('active');

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            // 1. Parsear el archivo GeoJSON
            const geojson = JSON.parse(e.target.result);
            
            // 2. Generar metadatos (ID único y Color)
            const layerId = 'layer-' + Date.now(); 
            const color = getRandomColor(); 
            
            // 3. Añadir visualmente al mapa (Pintar)
            addLayerToMap(layerId, geojson, color);
            
            // 4. Guardar en el registro global
            mapLayers.push({
                id: layerId,
                name: file.name.replace('.geojson', '').replace('.json', ''),
                visible: true,
                color: color,
                geojson: geojson // <--- IMPORTANTE: Guardamos los datos crudos para el filtro espacial (Turf.js)
            });
            
            // 5. Actualizar la lista visual en el menú
            renderLayerList();

            // 6. Si el interruptor "Filtrar datos por zona" ya estaba encendido,
            // forzamos una actualización de los KPIs y gráficos inmediatamente.
            const isFilterActive = document.getElementById('chk-spatial-filter')?.checked;
            if (isFilterActive) {
                triggerUpdateWithLoader();
            }

        } catch (err) {
            console.error(err);
            alert("Error: El archivo no es un GeoJSON válido.");
        } finally {
            // Limpieza final
            document.getElementById('loading-overlay').classList.remove('active');
            input.value = ''; // Resetear input para permitir subir el mismo archivo de nuevo si se desea
        }
    };
    reader.readAsText(file);
}

// 3. Pintar en el mapa (Debajo de los puntos)
function addPolygonLayerToMap(geojson) {
    if (!map) return;

    // Si ya existen fuentes/capas previas, borrarlas para actualizar
    if (map.getSource('poligonos-source')) {
        map.removeLayer('poly-line');
        map.removeLayer('poly-fill');
        map.removeSource('poligonos-source');
    }

    // Agregar Fuente
    map.addSource('poligonos-source', {
        type: 'geojson',
        data: geojson
    });

    // TRUCO: 'point-layer' es el ID de tus puntos. 
    // Al ponerlo como segundo argumento, decimos "Dibuja esto ANTES (debajo) de point-layer"
    const beforeLayer = map.getLayer('point-layer') ? 'point-layer' : null;

    // Capa de Relleno (Transparente)
    map.addLayer({
        'id': 'poly-fill',
        'type': 'fill',
        'source': 'poligonos-source',
        'layout': { 'visibility': 'visible' },
        'paint': {
            'fill-color': '#8898aa', // Color grisáceo neutro
            'fill-opacity': 0.2      // Muy transparente
        }
    }, beforeLayer);

    // Capa de Borde (Línea)
    map.addLayer({
        'id': 'poly-line',
        'type': 'line',
        'source': 'poligonos-source',
        'layout': { 'visibility': 'visible' },
        'paint': {
            'line-color': '#525f7f',
            'line-width': 2,
            'line-dasharray': [2, 1] // Línea punteada opcional
        }
    }, beforeLayer);

    // Zoom para encuadrar los polígonos
    try {
        const bounds = new maplibregl.LngLatBounds();
        geojson.features.forEach(function(feature) {
            if(feature.geometry.type === 'Polygon') {
                feature.geometry.coordinates[0].forEach(coord => bounds.extend(coord));
            } else if (feature.geometry.type === 'MultiPolygon') {
                feature.geometry.coordinates.forEach(poly => poly[0].forEach(coord => bounds.extend(coord)));
            }
        });
        if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 40 });
    } catch (e) { console.log("No se pudo centrar mapa en polígonos"); }

    // Click en polígono para ver info (Nombre/Barrio)
    map.on('click', 'poly-fill', (e) => {
        // Evitar que se solape con el click del punto
        const props = e.features[0].properties;
        // Buscamos propiedades comunes de nombre
        const name = props.Name || props.NAME || props.nombre || props.BARRIO || props.DISTRITO || "Polígono";
        
        new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`<div style="color:#333; font-weight:bold;">${name}</div>`)
            .addTo(map);
    });
    
    // Cambiar cursor
    map.on('mouseenter', 'poly-fill', () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', 'poly-fill', () => map.getCanvas().style.cursor = '');
}
/* ... AL FINAL DE SCRIPT.JS ... */

// --- GESTOR DE CAPAS AVANZADO ---
let mapLayers = []; // Almacena objetos: { id, name, visible, color }

// 1. Abrir/Cerrar el menú
function toggleLayerMenu() {
    const menu = document.getElementById('layers-dropdown');
    menu.classList.toggle('active');
    
    // Cambiar estilo del botón principal
    const btn = document.getElementById('btn-layers-menu');
    btn.style.background = menu.classList.contains('active') ? '#e9ecef' : '';
}

// 2. Manejar la subida del archivo
function handleGeojsonUpload(input) {
    const file = input.files[0];
    if (!file) return;

    document.getElementById('loading-overlay').classList.add('active');

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const geojson = JSON.parse(e.target.result);
            const layerId = 'layer-' + Date.now(); // ID único
            const color = getRandomColor(); // Color aleatorio
            
            // Añadir al mapa
            addLayerToMap(layerId, geojson, color);
            
            // Guardar en nuestro registro
            mapLayers.push({
                id: layerId,
                name: file.name.replace('.geojson', '').replace('.json', ''),
                visible: true,
                color: color
            });
            
            // Actualizar la lista visual
            renderLayerList();

        } catch (err) {
            console.error(err);
            alert("Error: Archivo GeoJSON inválido.");
        } finally {
            document.getElementById('loading-overlay').classList.remove('active');
            input.value = ''; // Reset input
        }
    };
    reader.readAsText(file);
}

// 3. Función técnica para pintar en MapLibre
// 3. Función técnica para pintar en MapLibre (VERSION UNIVERSAL)
function addLayerToMap(id, geojson, color) {
    if (!map) return;

    // Agregar Fuente
    map.addSource(id, { type: 'geojson', data: geojson });

    // Asegurar que se pinte DEBAJO de los puntos (point-layer)
    const beforeLayer = map.getLayer('point-layer') ? 'point-layer' : null;

    // 1. CAPA DE RELLENO (Solo para Polígonos)
    map.addLayer({
        'id': id + '-fill',
        'type': 'fill',
        'source': id,
        'layout': { 'visibility': 'visible' },
        'paint': {
            'fill-color': color,
            'fill-opacity': 0.3, // Aumentado a 0.3 para que se vea mejor
            'fill-outline-color': color
        },
        'filter': ['==', '$type', 'Polygon'] // Solo aplica a polígonos
    }, beforeLayer);

    // 2. CAPA DE LÍNEAS (Para Polígonos y LineStrings/Rutas)
    map.addLayer({
        'id': id + '-line',
        'type': 'line',
        'source': id,
        'layout': { 
            'visibility': 'visible',
            'line-join': 'round',
            'line-cap': 'round'
        },
        'paint': {
            'line-color': color,
            'line-width': 3
        },
        // Aplica a Polígonos (borde) y LineStrings (rutas)
        'filter': ['in', '$type', 'Polygon', 'LineString'] 
    }, beforeLayer);

    // 3. CAPA DE PUNTOS (Por si el GeoJSON trae marcadores)
    map.addLayer({
        'id': id + '-circle',
        'type': 'circle',
        'source': id,
        'layout': { 'visibility': 'visible' },
        'paint': {
            'circle-radius': 6,
            'circle-color': color,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
        },
        'filter': ['==', '$type', 'Point'] // Solo aplica a puntos
    }, beforeLayer);
    
    // POPUP AL HACER CLICK (Detecta cualquier geometría)
    const layerIds = [id + '-fill', id + '-line', id + '-circle'];
    
    // Evento Click
    map.on('click', (e) => {
        // Verificar si el click fue sobre alguna de nuestras capas
        const features = map.queryRenderedFeatures(e.point, { layers: layerIds });
        if (!features.length) return;

        const p = features[0].properties;
        // Intentar buscar el nombre en varias propiedades comunes
        const name = p.Name || p.NAME || p.Name || p.nombre || p.label || p.title || p.BARRIO || p.DISTRITO || "Sin nombre";
        const desc = p.description || p.Description || "";
        
        let htmlContent = `<div style="padding:5px; color:#333;"><b>${name}</b>`;
        if(desc) htmlContent += `<br><span style="font-size:0.8em; color:#666;">${desc}</span>`;
        htmlContent += `</div>`;

        new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(htmlContent)
            .addTo(map);
    });

    // Cambiar cursor al pasar por encima
    map.on('mouseenter', id + '-fill', () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseenter', id + '-line', () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseenter', id + '-circle', () => map.getCanvas().style.cursor = 'pointer');
    
    map.on('mouseleave', id + '-fill', () => map.getCanvas().style.cursor = '');
    map.on('mouseleave', id + '-line', () => map.getCanvas().style.cursor = '');
    map.on('mouseleave', id + '-circle', () => map.getCanvas().style.cursor = '');

    // 4. ZOOM AUTOMÁTICO MEJORADO (Detecta todas las coordenadas)
    try {
        const bounds = new maplibregl.LngLatBounds();
        
        // Función recursiva para extraer coordenadas de cualquier estructura GeoJSON
        const extractCoords = (coords) => {
            if (typeof coords[0] === 'number') {
                bounds.extend(coords);
            } else {
                coords.forEach(extractCoords);
            }
        };

        geojson.features.forEach(feature => {
            if (feature.geometry && feature.geometry.coordinates) {
                extractCoords(feature.geometry.coordinates);
            }
        });

        if (!bounds.isEmpty()) {
            map.fitBounds(bounds, { padding: 50, maxZoom: 14 });
        }
    } catch (e) { 
        console.log("No se pudo centrar mapa en la capa", e); 
    }
    // Disparar efecto visual para localizar la capa
    flashLayerEffect(id);
}

// 4. Renderizar la lista en el HTML
// Busca esta función y actualízala
function renderLayerList() {
    const container = document.getElementById('layers-list');
    const t = translations[currentLang]; // Obtener traducciones actuales
    
    if (mapLayers.length === 0) {
        // Usar la traducción
        container.innerHTML = `<p class="empty-layers-msg">${t.map_no_layers}</p>`;
        return;
    }
    
    container.innerHTML = ''; 
    
    mapLayers.forEach(layer => {
        // ... (el resto del código del bucle sigue igual)
        const div = document.createElement('div');
        div.className = 'layer-item';
        div.innerHTML = `
            <span class="layer-color-indicator" style="background:${layer.color}"></span>
            <input type="checkbox" ${layer.visible ? 'checked' : ''} onchange="toggleLayer('${layer.id}')">
            <span class="layer-name" title="${layer.name}">${layer.name}</span>
            <button class="btn-remove-layer" onclick="removeLayer('${layer.id}')"><i class="fa-solid fa-trash"></i></button>
        `;
        container.appendChild(div);
    });
}

// 5. Alternar Visibilidad
// 5. Alternar Visibilidad (CORREGIDO)
function toggleLayer(id) {
    const layerObj = mapLayers.find(l => l.id === id);
    if (!layerObj) return;
    
    layerObj.visible = !layerObj.visible;
    const val = layerObj.visible ? 'visible' : 'none';
    
    // Actualizamos visibilidad en el mapa
    if (map.getLayer(id + '-fill')) map.setLayoutProperty(id + '-fill', 'visibility', val);
    if (map.getLayer(id + '-line')) map.setLayoutProperty(id + '-line', 'visibility', val);
    if (map.getLayer(id + '-circle')) map.setLayoutProperty(id + '-circle', 'visibility', val);

    // Efecto visual si se activa
    if (layerObj.visible) {
        flashLayerEffect(id);
    }

    // --- NUEVO: FORZAR ACTUALIZACIÓN DE DATOS ---
    // Si el filtro de zona está activo, tenemos que recalcular los gráficos
    // porque ahora hay una capa más (o menos) para filtrar.
    const isFilterActive = document.getElementById('chk-spatial-filter')?.checked;
    if (isFilterActive) {
        triggerUpdateWithLoader();
    }
}

// 6. Eliminar Capa (ACTUALIZADO)
// 6. Eliminar Capa (CORREGIDO)
function removeLayer(id) {
    if(!confirm("¿Eliminar esta capa?")) return;
    
    // Quitar del mapa las 3 capas posibles
    if (map.getLayer(id + '-fill')) map.removeLayer(id + '-fill');
    if (map.getLayer(id + '-line')) map.removeLayer(id + '-line');
    if (map.getLayer(id + '-circle')) map.removeLayer(id + '-circle');
    
    // Quitar la fuente
    if (map.getSource(id)) map.removeSource(id);
    
    // Quitar del array
    mapLayers = mapLayers.filter(l => l.id !== id);
    renderLayerList();

    // --- NUEVO: Recalcular gráficos si el filtro estaba activo ---
    const isFilterActive = document.getElementById('chk-spatial-filter')?.checked;
    if (isFilterActive) {
        triggerUpdateWithLoader();
    }
}

// Helper: Color aleatorio legible
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}
// --- EFECTO VISUAL DE PARPADEO ---
function flashLayerEffect(id) {
    if (!map) return;
    
    let count = 0;
    const maxFlashes = 6; // Parpadeará 3 veces (Encendido/Apagado x3)
    const speed = 300;    // Velocidad en milisegundos

    const interval = setInterval(() => {
        // Calculamos si es momento "ALTO" (brillante) o "BAJO" (normal)
        const isHigh = count % 2 === 0;

        // 1. EFECTO EN POLÍGONOS (Opacidad)
        if (map.getLayer(id + '-fill')) {
            // Sube a 0.7 y baja a 0.3
            map.setPaintProperty(id + '-fill', 'fill-opacity', isHigh ? 0.7 : 0.3);
        }

        // 2. EFECTO EN LÍNEAS (Grosor y Color)
        if (map.getLayer(id + '-line')) {
            // Engrosa la línea a 6px y luego vuelve a 3px
            map.setPaintProperty(id + '-line', 'line-width', isHigh ? 6 : 3);
        }

        // 3. EFECTO EN PUNTOS (Radio)
        if (map.getLayer(id + '-circle')) {
            // Agranda el punto a 12px y luego vuelve a 6px
            map.setPaintProperty(id + '-circle', 'circle-radius', isHigh ? 12 : 6);
            map.setPaintProperty(id + '-circle', 'circle-stroke-width', isHigh ? 4 : 2);
        }

        count++;

        // DETENER ANIMACIÓN
        if (count >= maxFlashes) {
            clearInterval(interval);
            // Aseguramos que quede en el estado normal final
            if (map.getLayer(id + '-fill')) map.setPaintProperty(id + '-fill', 'fill-opacity', 0.3);
            if (map.getLayer(id + '-line')) map.setPaintProperty(id + '-line', 'line-width', 3);
            if (map.getLayer(id + '-circle')) {
                map.setPaintProperty(id + '-circle', 'circle-radius', 6);
                map.setPaintProperty(id + '-circle', 'circle-stroke-width', 2);
            }
        }
    }, speed);
}
// --- FILTRO ESPACIAL (TURF.JS) ---
/* ============================================================
   BLOQUE DE REPARACIÓN Y DIAGNÓSTICO ZONAS (Sobrescribe anteriores)
   ============================================================ */

// 1. CARGA DE ARCHIVO: Aseguramos que se guarde el GeoJSON crudo
function handleGeojsonUpload(input) {
    const file = input.files[0];
    if (!file) return;

    document.getElementById('loading-overlay').classList.add('active');

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const geojson = JSON.parse(e.target.result);
            const layerId = 'layer-' + Date.now(); 
            const color = getRandomColor(); 
            
            // Pintar en mapa
            addLayerToMap(layerId, geojson, color);
            
            // Guardar datos
            mapLayers.push({
                id: layerId,
                name: file.name.replace('.geojson', '').replace('.json', ''),
                visible: true,
                color: color,
                geojson: geojson // <--- CRÍTICO: Guardamos la geometría
            });
            
            renderLayerList();

            // Si el filtro ya estaba activo, refrescamos
            if (document.getElementById('chk-spatial-filter')?.checked) {
                triggerUpdateWithLoader();
            }

        } catch (err) {
            console.error(err);
            alert("❌ Error: Archivo GeoJSON inválido.");
        } finally {
            document.getElementById('loading-overlay').classList.remove('active');
            input.value = ''; 
        }
    };
    reader.readAsText(file);
}

// 2. FILTRO ESPACIAL: Con Diagnóstico VISUAL (Alert)
function applySpatialFilter(data) {
    const isFilterActive = document.getElementById('chk-spatial-filter')?.checked;
    
    // Si apagado, devolver todo
    if (!isFilterActive) return data; 

    // Obtener capas activas
    const activeLayers = mapLayers.filter(l => l.visible);
    
    // CHECK 1: ¿Hay capas cargadas?
    if (activeLayers.length === 0) return []; 

    // CHECK 2: ¿Tienen datos GeoJSON guardados?
    if (!activeLayers[0].geojson) {
        alert("⚠️ ERROR DE CÓDIGO: La capa no tiene datos geométricos guardados.\n\nAsegúrate de haber copiado la función 'handleGeojsonUpload' nueva que te acabo de dar.");
        return data;
    }

    // Preparar Polígonos
    let activePolygons = [];
    try {
        activeLayers.forEach(layer => {
            // Limpieza profunda de geometría
            let clone = JSON.parse(JSON.stringify(layer.geojson));
            clone = turf.truncate(clone, {precision: 6, coordinates: 2}); // Solo 2D
            clone = turf.rewind(clone, {mutate: true}); // Sentido horario correcto

            turf.flatten(clone).features.forEach(feature => {
                if (feature.geometry && (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon")) {
                    activePolygons.push(feature);
                }
            });
        });
    } catch (e) {
        alert("❌ Error procesando el polígono: " + e.message);
        return data;
    }

    if (activePolygons.length === 0) {
        alert("⚠️ La capa activa es una LÍNEA o PUNTO, no una ZONA CERRADA.\nNo se puede filtrar 'dentro' de una línea.");
        return data;
    }

    // --- DIAGNÓSTICO: ALERTA DE COORDENADAS ---
    // Tomamos el primer punto del polígono y el primer punto de tus datos para comparar
    const polyCoord = activePolygons[0].geometry.coordinates[0][0]; // [X, Y]
    const dataPoint = data.find(d => d.hasGeo); // Tu primer dato con GPS

    if (dataPoint) {
        // Solo mostramos la alerta UNA vez por sesión para no molestar
        if (!window.hasShownDiagAlert) {
            const msg = `🔍 DIAGNÓSTICO DE COORDENADAS:\n\n` +
                        `📍 POLÍGONO (Zona): [${polyCoord[0].toFixed(3)}, ${polyCoord[1].toFixed(3)}]\n` +
                        `🚓 TUS DATOS (Punto): [${dataPoint.lon.toFixed(3)}, ${dataPoint.lat.toFixed(3)}]\n\n` +
                        `REGLA DE ORO:\n` +
                        `España está en Longitud (X) negativa (-2.0) y Latitud (Y) positiva (43.0).\n\n` +
                        `Si tus datos muestran [43.0, -2.0] están AL REVÉS.`;
            
            // alert(msg); // Descomenta esto si quieres verlo siempre
            console.log(msg);
            window.hasShownDiagAlert = true;
        }
    }
    // -------------------------------------------

    // FILTRADO REAL
    const filtered = data.filter(point => {
        if (!point.hasGeo) return false;
        const pt = turf.point([point.lon, point.lat]); 
        
        for (let poly of activePolygons) {
            if (turf.booleanPointInPolygon(pt, poly)) return true;
        }
        return false;
    });

    // AUTO-CORRECCIÓN SI SALE 0 RESULTADOS
    if (filtered.length === 0 && data.length > 0) {
        console.warn("Intento 1 falló. Probando inversión de coordenadas...");
        
        const invertedData = data.filter(point => {
            if (!point.hasGeo) return false;
            // PRUEBA INVERTIDA: [Lat, Lon]
            const pt = turf.point([point.lat, point.lon]); 
            for (let poly of activePolygons) {
                if (turf.booleanPointInPolygon(pt, poly)) return true;
            }
            return false;
        });

        if (invertedData.length > 0) {
            if (!window.hasShownFixAlert) {
                alert("✅ ¡ARREGLADO!\n\nEl sistema detectó que tus coordenadas estaban invertidas (Latitud en lugar de Longitud) y las ha corregido automáticamente para este filtro.\n\nAhora verás los datos correctos.");
                window.hasShownFixAlert = true;
            }
            return invertedData;
        }
    }

    return filtered;
}
// ============================================================
// UTILIDADES PARA INFOGRAFÍA
// ============================================================

/**
 * Función auxiliar para cortar texto si es demasiado largo
 * Añade "..." al final.
 */
function truncateText(str, maxLength) {
    if (!str) return "";
    if (str.length > maxLength) {
        return str.substring(0, maxLength).trim() + "...";
    }
    return str;
}

// ============================================================
// GENERADOR DE INFOGRAFÍA IA (Smart Brief)
// ============================================================
/**
 * GENERADOR DE INFOGRAFÍA SÍNTESIS (IA BRIEF)
 * Versión: Full Multilingüe + Análisis de Ubicaciones
 */
function generateSmartInfographic() {
    const t = translations[currentLang];
    if (!t) return;

    // 1. RECOPILAR DATOS FILTRADOS ACTUALES
    const selYears = Array.from(document.querySelectorAll('#items-year input:checked')).map(i => Number(i.value));
    const selMonths = Array.from(document.querySelectorAll('#items-month input:checked')).map(i => Number(i.value));
    const selCats = Array.from(document.querySelectorAll('#items-category input:checked')).map(i => i.value);

    let data = finalData.filter(d => 
        selYears.includes(d.year) && 
        selMonths.includes(d.month) && 
        selCats.includes(d.cat)
    );
    
    // Aplicar filtro espacial si está activo
    if (typeof applySpatialFilter === 'function') data = applySpatialFilter(data);

    if (data.length === 0) {
        alert(currentLang === 'eu' ? "Ez dago daturik" : "No hay datos para la síntesis");
        return;
    }

    document.getElementById('loading-overlay').classList.add('active');

    // 2. CÁLCULOS ESTADÍSTICOS
    const total = data.length;

    // 2.1. Categorías
    const catCounts = {};
    data.forEach(d => catCounts[d.cat] = (catCounts[d.cat] || 0) + 1);
    const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
    const topCatName = sortedCats.length > 0 ? sortedCats[0][0] : "N/A"; 
    const topCatVal = sortedCats.length > 0 ? sortedCats[0][1] : 0;  
    const percent = total > 0 ? Math.round((topCatVal / total) * 100) : 0;

    // 2.2. Ubicaciones (Calles) - Excluyendo "SIN CALLE / GPS"
    const streetCounts = {};
    data.forEach(d => {
        if (d.calle && d.calle !== "SIN CALLE / GPS") {
            streetCounts[d.calle] = (streetCounts[d.calle] || 0) + 1;
        }
    });
    const sortedStreets = Object.entries(streetCounts).sort((a, b) => b[1] - a[1]);

    // 2.3. Tiempos (Horas y Días)
    const hourCounts = Array(24).fill(0);
    data.forEach(d => hourCounts[d.hour]++);
    const maxHourIdx = hourCounts.indexOf(Math.max(...hourCounts));
    const peakTime = `${String(maxHourIdx).padStart(2,'0')}:00 - ${String(maxHourIdx+1).padStart(2,'0')}:00`;

    const dayCounts = Array(7).fill(0);
    data.forEach(d => dayCounts[d.date.getDay()]++);
    const maxDayIdx = dayCounts.indexOf(Math.max(...dayCounts));
    const busiestDay = t.days_full ? t.days_full[maxDayIdx] : "---";

    // 3. FUNCIÓN AUXILIAR PARA INYECTAR DATOS
    const setSafeInner = (id, value, isHTML = false) => {
        const el = document.getElementById(id);
        if (el) {
            if (isHTML) el.innerHTML = value;
            else el.innerText = value;
        }
    };

    // 4. RELLENAR TEXTOS CABECERA Y KPI
    const yearsText = selYears.length > 2 ? (currentLang === 'eu' ? "Anitzak" : "Multi-Periodo") : selYears.join(', ');
    setSafeInner('info-title', `${t.info_report_title || 'Informe'} ${yearsText}`);
    setSafeInner('info-date', new Date().toLocaleDateString());

    const insightHTML = (t.info_insight_text || "Categoría: {cat} ({percent}%)")
        .replace('{cat}', `<span style="color:#ffd600">${truncateText(topCatName, 60)}</span>`)
        .replace('{percent}', percent);
    setSafeInner('info-insight-main', insightHTML, true);

    setSafeInner('info-stat-total', total.toLocaleString());
    setSafeInner('info-stat-peak', peakTime);
    setSafeInner('info-stat-day', busiestDay);

    // 5. TENDENCIA Y CALLES
    let trendText = t.info_trend_night;
    if (maxHourIdx >= 6 && maxHourIdx < 14) trendText = t.info_trend_morning;
    else if (maxHourIdx >= 14 && maxHourIdx < 22) trendText = t.info_trend_afternoon;
    
    // Si hay una calle líder, añadir el insight narrativo
    if (sortedStreets.length > 0) {
        const streetInsight = t.info_street_insight.replace('{street}', sortedStreets[0][0]);
        trendText += " " + streetInsight;
    }
    setSafeInner('info-text-trend', trendText);

    // 6. RELLENAR LISTADOS (TOP 3)
    
    // 6.1 Categorías (Tarjeta Azul)
    const listCatContainer = document.getElementById('info-top-list');
    if (listCatContainer) {
        listCatContainer.innerHTML = '';
        sortedCats.slice(0, 3).forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${truncateText(item[0], 45)}</span> <span>${item[1].toLocaleString()}</span>`;
            listCatContainer.appendChild(li);
        });
    }

    // 6.2 Ubicaciones Críticas (Tarjeta Blanca)
    const streetListContainer = document.getElementById('info-street-list');
    if (streetListContainer) {
        streetListContainer.innerHTML = '';
        const topStreets = sortedStreets.slice(0, 3);
        
        if (topStreets.length > 0) {
            topStreets.forEach(item => {
                const li = document.createElement('li');
                // Estilo para evitar que se separe el texto corto
                li.style.display = "flex";
                li.style.justifyContent = "space-between";
                li.style.borderBottom = "1px solid #f3f4f6";
                li.style.paddingBottom = "5px";
                li.style.marginBottom = "8px";
                li.style.color = "#374151";
                li.innerHTML = `<span style="text-align:left; flex:1;">${truncateText(item[0], 45)}</span> <span style="font-weight:800; margin-left:10px;">${item[1]}</span>`;
                streetListContainer.appendChild(li);
            });
        } else {
            // FIX: "Sin datos" centrado y sin space-between
            let noDataMsg = "Sin datos de vía";
            if (currentLang === 'eu') noDataMsg = "Ez dago kale daturik";
            if (currentLang === 'gl') noDataMsg = "Sen datos de vía";
            if (currentLang === 'ca') noDataMsg = "Sense dades de via";
            
            const li = document.createElement('li');
            li.style.display = "block";
            li.style.textAlign = "center";
            li.style.color = "#9ca3af";
            li.style.fontStyle = "italic";
            li.style.padding = "10px 0";
            li.innerText = noDataMsg;
            streetListContainer.appendChild(li);
        }
    }

    // 7. GRÁFICO CIRCULAR (DOMINANCIA)
    setSafeInner('info-pie-percent', `${percent}%`);
    const circle = document.getElementById('svg-pie-progress');
    if (circle) {
        const radius = circle.r.baseVal.value;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percent / 100) * circumference;
        circle.style.strokeDasharray = circumference;
        circle.style.strokeDashoffset = offset;
    }
    setSafeInner('info-lbl-leader', truncateText(topCatName, 40));
    
    // Traducir "Resto"
    const restLabels = { es: 'Resto', eu: 'Gainerakoak', ca: 'Resta', gl: 'Resto' };
    setSafeInner('info-lbl-resto', restLabels[currentLang] || 'Resto');
    setSafeInner('info-pie-subtext', `${topCatVal.toLocaleString()} vs ${(total - topCatVal).toLocaleString()}`);

    // Aplicar i18n a etiquetas estáticas
    document.querySelectorAll('#ai-infographic-container [data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.textContent = t[key];
    });

    // 8. EXPORTACIÓN A IMAGEN
    const container = document.getElementById('ai-infographic-container');
    setTimeout(() => {
        const contentHeight = container.scrollHeight;
        html2canvas(container, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#f3f4f6',
            width: 800,
            height: contentHeight,
            windowWidth: 800,
            windowHeight: contentHeight,
            onclone: (clonedDoc) => {
                const clonedEl = clonedDoc.getElementById('ai-infographic-container');
                clonedEl.style.display = 'flex';
                clonedEl.style.position = 'relative';
                clonedEl.style.left = '0';
                clonedEl.style.height = 'auto';
            }
        }).then(canvas => {
            const link = document.createElement('a');
            const fileNamePrefix = { es:'Sintesis', eu:'Sintesia', ca:'Sintesi', gl:'Sintese' }[currentLang];
            link.download = `Eurocop_${fileNamePrefix}_${new Date().getTime()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(err => {
            console.error("Error capturando sintesis:", err);
        }).finally(() => {
            document.getElementById('loading-overlay').classList.remove('active');
        });
    }, 800);
}
/**
 * Descarga el contenido actual de un contenedor (Gráfico, Mapa o Tabla) como imagen
 * @param {string} containerId ID del contenedor padre
 */
function downloadComponent(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 1. Caso específico para el MAPA
    if (containerId === 'container-map' && map) {
        // Forzamos al mapa a redibujarse para llenar el búfer
        map.triggerRepaint();

        // Esperamos al siguiente "frame" de renderizado para capturar
        requestAnimationFrame(() => {
            try {
                // Buscamos el canvas técnico de MapLibre
                const mapCanvas = container.querySelector('.maplibregl-canvas');
                if (mapCanvas) {
                    const link = document.createElement('a');
                    link.download = `Mapa_${nombreArchivoSubido}_${new Date().getTime()}.png`;
                    // Capturamos el contenido del canvas
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

    // 2. Caso para las TABLAS (Evolución, Calles, etc.)
    const tableView = container.querySelector('.table-view');
    if (tableView && tableView.style.display !== 'none') {
        document.getElementById('loading-overlay').classList.add('active');
        html2canvas(tableView, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false
        }).then(canvasTable => {
            const link = document.createElement('a');
            link.download = `Tabla_${containerId}.png`;
            link.href = canvasTable.toDataURL('image/png');
            link.click();
            document.getElementById('loading-overlay').classList.remove('active');
        });
        return;
    }

    // 3. Caso para Gráficos de Chart.js
    const standardCanvas = container.querySelector('canvas:not(.maplibregl-canvas)');
    if (standardCanvas) {
        const link = document.createElement('a');
        link.download = `Grafico_${containerId}.png`;
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = standardCanvas.width;
        tempCanvas.height = standardCanvas.height;
        const ctx = tempCanvas.getContext('2d');
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        ctx.drawImage(standardCanvas, 0, 0);
        
        link.href = tempCanvas.toDataURL('image/png');
        link.click();
    }
}
/**
 * Al hacer doble clic en una calle, vuelve al mapa, hace zoom 
 * y genera un efecto visual temporal (flash).
 */
function focusStreetOnMap(streetName) {
    const points = lastFilteredData.filter(d => d.calle === streetName && d.hasGeo);

    if (points.length === 0) {
        alert("Esta calle no tiene coordenadas GPS.");
        return;
    }

    // 1. Cambiar vista
    isTableStreetsView = false;
    document.getElementById('main-map').style.display = 'block';
    document.getElementById('table-streets-view').style.display = 'none';
    
    const btnIcon = document.querySelector('#btn-toggle-streets i');
    if (btnIcon) btnIcon.className = 'fa-solid fa-list-ol';

    // 2. Calcular límites y centro
    const bounds = new maplibregl.LngLatBounds();
    points.forEach(p => bounds.extend([p.lon, p.lat]));
    const center = bounds.getCenter();

    // 3. Zoom y efecto
    setTimeout(() => {
        map.resize();
        map.fitBounds(bounds, { padding: 100, maxZoom: 17, duration: 1200 });

        // Crear contenedor para las ondas
        const el = document.createElement('div');
        el.className = 'marker-focus-ring';

        const flashMarker = new maplibregl.Marker({ element: el })
            .setLngLat(center)
            .addTo(map);

        // Eliminar el efecto tras 4 segundos para limpiar el mapa
        setTimeout(() => {
            el.style.transition = "opacity 1s";
            el.style.opacity = "0";
            setTimeout(() => flashMarker.remove(), 1000);
        }, 4000);

    }, 100);
}
function showDetailedRecords(periodLabel, categoryName) {
    const t = translations[currentLang];
    
    // 1. Filtrar los datos
    const filtered = lastFilteredData.filter(d => {
        if (d.cat !== categoryName) return false;
        if (temporalView === 'year') return d.year.toString() === periodLabel;
        if (temporalView === 'month') return t.months_abbr[d.month - 1] === periodLabel;
        if (temporalView === 'quarter') {
            const qIndex = Math.floor((d.month - 1) / 3);
            return t.quarters[qIndex] === periodLabel;
        }
        if (temporalView === 'day') {
            let idx = d.date.getDay();
            let dayName = t.days_abbr[idx === 0 ? 6 : idx - 1].substring(0,3);
            return dayName === periodLabel;
        }
        return false;
    });

    if (filtered.length === 0) return;

    // 2. Traducciones rápidas
    const labelReg = { es: 'Registros', eu: 'Erregistro', ca: 'Registres', gl: 'Rexistros' }[currentLang];
    const labelCat = { es: 'CATEGORÍA', eu: 'KATEGORIA', ca: 'CATEGORIA', gl: 'CATEGORÍA' }[currentLang];
    const labelDate = { es: 'FECHA', eu: 'DATA', ca: 'DATA', gl: 'DATA' }[currentLang];

    document.getElementById('records-modal-title').innerText = `${categoryName} (${periodLabel}): ${filtered.length} ${labelReg}`;

    // 3. Crear Tabla
    let html = `<table class="data-table" style="width:100%;">
        <thead><tr><th style="text-align:left;">REF/EXP</th><th>${labelDate}</th><th style="text-align:left;">${labelCat}</th></tr></thead>
        <tbody>`;

    filtered.forEach(d => {
        const dateStr = d.date.toLocaleString([], { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
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

function closeRecordsModal() {
    document.getElementById('records-modal').classList.remove('active');
}