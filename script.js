/**
 * EUROCOP ANALYTICS - SCRIPT INTEGRADO PROFESIONAL 2026
 * Versión: Full Fix (Dropdowns Dinámicos, Selección Masiva y Mapeo)
 */

// ============================================================
// 1. VARIABLES GLOBALES Y CONFIGURACIÓN
// ============================================================
let rawData = [];
let finalData = [];
let map;
let chartTimeline, chartCategory, chartHours;
let nombreArchivoSubido = "INFORME ANALYTICS";

let isSatelite = false;
let isHeatmap = false; 
let temporalView = 'year'; 

const dayLabels = ['L-Lunes', 'M-Martes', 'X-Miércoles', 'J-Jueves', 'V-Viernes', 'S-Sábado', 'D-Domingo'];
const monthsConfig = [
    { id: 1, name: 'Enero', abbr: 'Ene' }, { id: 2, name: 'Febrero', abbr: 'Feb' },
    { id: 3, name: 'Marzo', abbr: 'Mar' }, { id: 4, name: 'Abril', abbr: 'Abr' },
    { id: 5, name: 'Mayo', abbr: 'May' }, { id: 6, name: 'Junio', abbr: 'Jun' },
    { id: 7, name: 'Julio', abbr: 'Jul' }, { id: 8, name: 'Agosto', abbr: 'Ago' },
    { id: 9, name: 'Septiembre', abbr: 'Sep' }, { id: 10, name: 'Octubre', abbr: 'Oct' },
    { id: 11, name: 'Noviembre', abbr: 'Nov' }, { id: 12, name: 'Diciembre', abbr: 'Dic' }
];

const yearColors = [
    { bg: 'rgba(94, 114, 228, 0.7)', border: '#5e72e4' },   
    { bg: 'rgba(45, 206, 137, 0.7)', border: '#2dce89' },   
    { bg: 'rgba(251, 99, 64, 0.7)', border: '#fb6340' },    
    { bg: 'rgba(17, 205, 239, 0.7)', border: '#11cdef' },   
    { bg: 'rgba(245, 54, 92, 0.7)', border: '#f5365c' },    
    { bg: 'rgba(137, 101, 224, 0.7)', border: '#8965e0' },  
    { bg: 'rgba(155, 14, 14, 0.7)', border: '#b71825ff' }    
];

// ============================================================
// 2. CARGA DE ARCHIVOS Y NAVEGACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    if (dropZone) {
        dropZone.onclick = () => fileInput.click();
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            nombreArchivoSubido = file.name.replace(/\.[^/.]+$/, "").toUpperCase();
            const displayEl = document.getElementById('display-filename');
            if (displayEl) displayEl.textContent = nombreArchivoSubido;

            if (file.name.endsWith('.csv')) {
                Papa.parse(file, { header: true, skipEmptyLines: true, encoding: "UTF-8", complete: (res) => showMapping(res.data) });
            } else {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const dataArr = new Uint8Array(e.target.result);
                    const wb = XLSX.read(dataArr, {type: 'array', cellDates: true});
                    const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
                    showMapping(data);
                };
                reader.readAsArrayBuffer(file);
            }
        };
    }
});

function goToMapping() {
    if (document.getElementById('dashboard-view').classList.contains('active')) {
        document.getElementById('dashboard-view').classList.remove('active');
        document.getElementById('mapping-view').classList.add('active');
        setTimeout(() => { if(map) map.resize(); }, 300);
    }
}

// ============================================================
// 3. LOGICA DE MAPEO
// ============================================================
function showMapping(data) {
    rawData = data;
    const headers = Object.keys(data[0]);
    const mappingIds = ['map-expediente', 'map-fecha', 'map-hora', 'map-lat', 'map-lon', 'map-categoria'];
    
    mappingIds.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.addEventListener('change', refreshMappingStatus);
        sel.innerHTML = id === 'map-hora' ? '<option value="">-- Sin hora (00:00) --</option>' : '<option value="" disabled selected>Seleccionar...</option>';
        headers.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h; opt.textContent = h;
            sel.appendChild(opt);
        });

        headers.forEach(h => {
            const s = h.toLowerCase();
            if (id.includes('exp') && (s.includes('exp') || s.includes('id') || s.includes('num'))) sel.value = h;
            if (id.includes('fecha') && (s.includes('fec') || s.includes('date'))) sel.value = h;
            if (id.includes('hora') && (s.includes('hor') || s.includes('time'))) sel.value = h;
            if (id.includes('lat') && (s.includes('lat') || s === 'y')) sel.value = h;
            if (id.includes('lon') && (s.includes('lon') || s === 'x')) sel.value = h;
            if (id.includes('cat') && (s.includes('cat') || s.includes('tipo'))) sel.value = h;
        });
    });

    refreshMappingStatus();
    document.getElementById('upload-view').style.display = 'none';
    document.getElementById('mapping-view').classList.add('active');
}

function refreshMappingStatus() {
    const mappingIds = ['map-expediente', 'map-fecha', 'map-hora', 'map-lat', 'map-lon', 'map-categoria'];
    const currentSelections = mappingIds.map(id => document.getElementById(id).value).filter(val => val !== "");

    mappingIds.forEach(id => {
        const sel = document.getElementById(id);
        Array.from(sel.options).forEach(opt => {
            if (opt.value === "" || opt.disabled) return;
            const isUsedElsewhere = currentSelections.includes(opt.value) && sel.value !== opt.value;
            opt.textContent = (isUsedElsewhere ? "✕ " : (sel.value === opt.value ? "✓ " : "• ")) + opt.value.replace("✓ ", "").replace("• ", "").replace("✕ ", "");
            opt.style.color = isUsedElsewhere ? "#cbd5e0" : "#5e72e4";
        });
    });
}

// ============================================================
// 4. PROCESAMIENTO
// ============================================================
document.getElementById('btn-visualizar').onclick = () => {
    const config = {
        exp: document.getElementById('map-expediente').value,
        fecha: document.getElementById('map-fecha').value,
        hora: document.getElementById('map-hora').value,
        lat: document.getElementById('map-lat').value,
        lon: document.getElementById('map-lon').value,
        cat: document.getElementById('map-categoria').value
    };

    if (!config.fecha || !config.lat || !config.lon) {
        alert("Mapea al menos Fecha, Latitud y Longitud.");
        return;
    }

    finalData = rawData.map(row => {
        let d = new Date(row[config.fecha]);
        if (isNaN(d.getTime())) return null;
        if (config.hora && row[config.hora]) {
            const t = String(row[config.hora]);
            if (t.includes(':')) { const p = t.split(':'); d.setHours(parseInt(p[0]) || 0, parseInt(p[1]) || 0, 0); }
        }
        const lat = parseFloat(String(row[config.lat]).replace(',', '.'));
        const lon = parseFloat(String(row[config.lon]).replace(',', '.'));
        if (isNaN(lat) || isNaN(lon)) return null;

        return {
            exp: row[config.exp] || "N/A",
            date: d, year: d.getFullYear(), month: d.getMonth() + 1, hour: d.getHours(),
            lat, lon, cat: row[config.cat] || "General",
            calle: row['CALLE'] || row['calle'] || "", numero: row['NUMERO'] || row['numero'] || "",
            refnum: row['REFNUM'] || "", refanno: row['REFANNO'] || ""
        };
    }).filter(v => v !== null);

    document.getElementById('mapping-view').classList.remove('active');
    document.getElementById('dashboard-view').classList.add('active');
    setupFilters();
    initMap();
    setTimeout(updateUI, 500);
};

// ============================================================
// 5. FILTROS (DROPDOWNS DINÁMICOS)
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
    items.forEach(item => {
        const val = item.id || item;
        const label = item.name || item;
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
        // Cálculo de altura dinámica
        const rect = el.getBoundingClientRect();
        const spaceAvailable = window.innerHeight - rect.top - 25;
        const itemsCont = el.querySelector('.dropdown-items');
        const controlsH = el.querySelector('.dropdown-controls').offsetHeight || 45;
        itemsCont.style.maxHeight = (spaceAvailable - controlsH) + "px";
    }
}

// CERRAR SI CLIC FUERA
window.onclick = (e) => {
    if (!e.target.closest('.custom-dropdown')) {
        document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('active'));
    }
};

// FIX: BOTONES TODOS / NINGUNO
function toggleGroup(containerId, state, event) {
    if (event) event.stopPropagation(); // Evita que el menú se cierre
    // Usamos el ID del contenedor de items (items-year, etc)
    const container = document.getElementById(containerId);
    if (container) {
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = state);
        updateUI();
    }
}

// ============================================================
// FUNCIÓN CENTRAL: ACTUALIZAR UI (FILTROS Y VISUALIZACIONES)
// ============================================================
function updateUI() {
    
    // --- 1. FUNCIONES AUXILIARES INTERNAS ---

    // Obtener array de VALORES (para filtrar los datos)
    const getValues = (containerId) => {
        return Array.from(document.querySelectorAll(`#${containerId} input:checked`))
                    .map(input => input.value);
    };

    // Obtener TEXTO legible (para mostrar en Navbar y Sidebar)
    const getLabels = (containerId) => {
        const allInputs = document.querySelectorAll(`#${containerId} input`);
        const checkedInputs = Array.from(document.querySelectorAll(`#${containerId} input:checked`));

        if (checkedInputs.length === 0) return "NINGUNO";
        if (checkedInputs.length === allInputs.length) return "TODOS";

        // Obtener el texto del <span> que está al lado del checkbox
        return checkedInputs.map(input => input.nextElementSibling.innerText).join(", ");
    };

    // --- 2. CAPTURAR SELECCIONES ---
    
    // Convertimos años y meses a número para comparar correctamente
    const selYears = getValues('items-year').map(Number);
    const selMonths = getValues('items-month').map(Number);
    const selCats = getValues('items-category'); // Categorías son strings

    // --- 3. ACTUALIZAR TEXTOS EN INTERFAZ (Sidebar y Navbar) ---

    // AÑOS
    const txtYears = getLabels('items-year');
    document.getElementById('label-year').innerText = txtYears; // Sidebar
    const headYear = document.getElementById('header-year');    // Navbar
    if (headYear) {
        headYear.innerText = txtYears;
        headYear.title = txtYears; // Tooltip por si se corta
    }

    // MESES
    const txtMonths = getLabels('items-month');
    document.getElementById('label-month').innerText = txtMonths; // Sidebar
    const headMonth = document.getElementById('header-month');    // Navbar
    if (headMonth) {
        headMonth.innerText = txtMonths;
        headMonth.title = txtMonths;
    }

    // CATEGORÍAS
    const txtCats = getLabels('items-category');
    document.getElementById('label-category').innerText = txtCats; // Sidebar
    const headCat = document.getElementById('header-category');    // Navbar (Nuevo)
    if (headCat) {
        headCat.innerText = txtCats;
        headCat.title = txtCats;
    }

    // --- 4. FILTRADO DE DATOS ---

    const filtered = finalData.filter(d => 
        selYears.includes(d.year) && 
        selMonths.includes(d.month) && 
        selCats.includes(d.cat)
    );

    // --- 5. ACTUALIZAR KPIs ---

    // Contador Grande
    document.getElementById('kpi-count').innerText = filtered.length.toLocaleString();
    
    // Badge Navbar
    const badge = document.getElementById('kpi-total-filas');
    if(badge) badge.innerText = `${filtered.length} REGISTROS`;

    // --- 6. ACTUALIZAR VISUALIZACIONES ---

    updateMapData(filtered);         // Puntos en el mapa
    updateCharts(filtered, selYears);// Gráficos

    // Actualizar nombre de la ciudad (Geolocalización)
    if (typeof updateLocationKPI === "function") {
        updateLocationKPI(filtered);
    }
}

// ============================================================
// 6. GRÁFICOS
// ============================================================
function changeTemporalView(v) { temporalView = v; updateUI(); }

function updateCharts(data, selYears) {
    const allYearsMaster = [...new Set(finalData.map(d => d.year))].sort((a,b) => a-b);
    const ctxTimeline = document.getElementById('chart-timeline');
    if (ctxTimeline) {
        const sortedYears = [...selYears].sort((a,b) => a-b);
        let labels = [], datasets = [];
        if (temporalView === 'year') {
            labels = sortedYears.map(y => y.toString());
            datasets = [{ label: 'Registros', data: sortedYears.map(y => data.filter(d => d.year === y).length), backgroundColor: sortedYears.map(y => yearColors[allYearsMaster.indexOf(y) % yearColors.length].bg), borderColor: sortedYears.map(y => yearColors[allYearsMaster.indexOf(y) % yearColors.length].border), borderWidth: 2 }];
        } else if (temporalView === 'month') {
            labels = monthsConfig.map(m => m.abbr);
            datasets = sortedYears.map(y => {
                const c = Array(12).fill(0); data.filter(d => d.year === y).forEach(d => c[d.month - 1]++);
                const col = yearColors[allYearsMaster.indexOf(y) % yearColors.length];
                return { label: y.toString(), data: c, backgroundColor: col.bg, borderColor: col.border, borderWidth: 2 };
            });
        } else if (temporalView === 'day') {
            labels = dayLabels;
            datasets = sortedYears.map(y => {
                const c = Array(7).fill(0); data.filter(d => d.year === y).forEach(d => { let idx = d.date.getDay(); c[idx === 0 ? 6 : idx - 1]++; });
                const col = yearColors[allYearsMaster.indexOf(y) % yearColors.length];
                return { label: y.toString(), data: c, backgroundColor: col.bg, borderColor: col.border, borderWidth: 2 };
            });
        }
        if (chartTimeline) chartTimeline.destroy();
        chartTimeline = new Chart(ctxTimeline, { type: 'bar', data: { labels, datasets }, options: { responsive: true, maintainAspectRatio: false } });
    }

    const ctxCat = document.getElementById('chart-category');
    if (ctxCat) {
        const catData = {}; data.forEach(d => catData[d.cat] = (catData[d.cat] || 0) + 1);
        const sorted = Object.entries(catData).sort((a,b) => b[1]-a[1]).slice(0,5);
        if (chartCategory) chartCategory.destroy();
        chartCategory = new Chart(ctxCat, { type: 'doughnut', data: { labels: sorted.map(s => s[0]), datasets: [{ data: sorted.map(s => s[1]), backgroundColor: yearColors.map(c => c.bg) }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } } });
    }

    const ctxHours = document.getElementById('chart-hours');
    if (ctxHours) {
        const hC = Array(24).fill(0); data.forEach(d => hC[d.hour]++);
        if (chartHours) chartHours.destroy();
        chartHours = new Chart(ctxHours, { type: 'line', data: { labels: Array.from({length: 24}, (_,i) => i+'h'), datasets: [{ label: 'Actividad', data: hC, borderColor: '#11cdef', fill: true, backgroundColor: 'rgba(17,205,239,0.1)', tension: 0.4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    }
}

// ============================================================
// 7. MAPA
// ============================================================
function initMap() {
    if (map) map.remove();
    map = new maplibregl.Map({ container: 'main-map', style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json', center: [-2.63, 43.17], zoom: 12, preserveDrawingBuffer: true });
    map.on('load', () => {
        map.addSource('satellite-tiles', { 'type': 'raster', 'tiles': ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], 'tileSize': 256 });
        map.addLayer({ 'id': 'satellite-layer', 'type': 'raster', 'source': 'satellite-tiles', 'layout': { 'visibility': 'none' } });
        map.addSource('puntos', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'heat-layer', type: 'heatmap', source: 'puntos', layout: { 'visibility': 'none' }, paint: { 'heatmap-weight': 1, 'heatmap-intensity': 3, 'heatmap-radius': 20 } });
        map.addLayer({ id: 'point-layer', type: 'circle', source: 'puntos', layout: { 'visibility': 'visible' }, paint: { 'circle-radius': 6, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff', 'circle-color': '#5e72e4' } });
        map.on('click', 'point-layer', (e) => {
            const p = e.features[0].properties;
            new maplibregl.Popup({ offset: 10 }).setLngLat(e.features[0].geometry.coordinates).setHTML(`<div style="padding:8px; font-family:'Inter', sans-serif; min-width:180px;"><div style="color:#5e72e4; font-weight:800; font-size:13px; margin-bottom:5px; border-bottom:1px solid #eee; padding-bottom:3px;">REF${p.refanno}-${p.refnum}</div><div style="font-size:11px;"><span><b>Exp:</b> ${p.exp}</span><br><span><b>Ubicación:</b> ${p.calle} ${p.numero}</span><br><span><b>Cat:</b> ${p.cat}</span><br><span><b>Fecha:</b> ${p.fullDate}</span></div></div>`).addTo(map);
        });
    });
}

function updateMapData(data) {
    if (!map || !map.getSource('puntos')) return;
    const geojson = { type: 'FeatureCollection', features: data.map(d => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [d.lon, d.lat] }, properties: { exp: d.exp, cat: d.cat, year: d.year, fullDate: d.date.toLocaleString('es-ES'), calle: d.calle, numero: d.numero, refnum: d.refnum, refanno: d.refanno } })) };
    map.getSource('puntos').setData(geojson);
    const allY = [...new Set(finalData.map(d => d.year))].sort((a,b) => a-b);
    const colorExpr = ['match', ['get', 'year']];
    allY.forEach(y => colorExpr.push(y, yearColors[allY.indexOf(y) % yearColors.length].border));
    colorExpr.push('#5e72e4');
    map.setPaintProperty('point-layer', 'circle-color', colorExpr);
    if (data.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        data.forEach(d => bounds.extend([d.lon, d.lat]));
        map.fitBounds(bounds, { padding: 50, maxZoom: 16 });
    }
}

// ============================================================
// 8. UTILIDADES UI
// ============================================================
function toggleSatelite(btn) { isSatelite = !isSatelite; map.setLayoutProperty('satellite-layer', 'visibility', isSatelite ? 'visible' : 'none'); btn.style.background = isSatelite ? '#5e72e4' : ''; btn.style.color = isSatelite ? '#fff' : ''; }
function toggleHeatmap(btn) { isHeatmap = !isHeatmap; map.setLayoutProperty('heat-layer', 'visibility', isHeatmap ? 'visible' : 'none'); map.setLayoutProperty('point-layer', 'visibility', isHeatmap ? 'none' : 'visible'); btn.innerHTML = isHeatmap ? '<i class="fa-solid fa-location-dot"></i> Puntos' : '<i class="fa-solid fa-fire"></i> Calor'; }
function toggle3D() { const p = map.getPitch(); map.easeTo({ pitch: p > 0 ? 0 : 60, bearing: p > 0 ? 0 : -20, duration: 1000 }); }
function toggleFullscreen(id) { document.getElementById(id).classList.toggle('fullscreen'); setTimeout(() => { if(chartTimeline) chartTimeline.resize(); if(chartCategory) chartCategory.resize(); if(chartHours) chartHours.resize(); if(map) map.resize(); }, 300); }
// ============================================================
// NUEVA FUNCIÓN: OBTENER CIUDAD POR GEOLOCALIZACIÓN
// ============================================================
// ============================================================
// FUNCIÓN MEJORADA: GEOLOCALIZACIÓN CON PREFERENCIA EUSKERA
// ============================================================
async function updateLocationKPI(data) {
    const el = document.getElementById('kpi-location');
    
    if (!data || data.length === 0) {
        el.innerText = "Sin Datos";
        return;
    }

    // 1. Calcular el centro (promedio)
    let totalLat = 0, totalLon = 0;
    data.forEach(d => {
        totalLat += d.lat;
        totalLon += d.lon;
    });
    
    const centerLat = totalLat / data.length;
    const centerLon = totalLon / data.length;

    // Mostramos coord. temporalmente
    el.innerText = `${centerLat.toFixed(3)}, ${centerLon.toFixed(3)}`;

    // 2. Petición a OpenStreetMap con preferencia de idioma (eu = Euskera, es = Español)
    try {
        // AÑADIDO: &accept-language=eu,es
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${centerLat}&lon=${centerLon}&zoom=10&accept-language=eu,es`;
        
        const response = await fetch(url, { headers: { 'User-Agent': 'EurocopAnalytics/1.0' } });
        if(response.ok) {
            const json = await response.json();
            const addr = json.address;
            
            // Lógica de jerarquía para encontrar el nombre correcto
            // A veces viene como ciudad, pueblo, villa o municipio
            let placeName = addr.city || addr.town || addr.village || addr.municipality || addr.county;

            // CASO ESPECIAL: Si es Bilbao, a veces OSM devuelve "Bilbo" en Euskera puro.
            // Si prefieres el nombre oficial bilingüe (ej: Vitoria-Gasteiz), OSM suele devolver 
            // el nombre oficial primero si usamos 'accept-language=eu,es'.
            
            if (placeName) {
                el.innerText = placeName.toUpperCase();
            } else {
                el.innerText = "ZONA DESCONOCIDA";
            }
        }
    } catch (error) {
        console.warn("Error obteniendo localidad:", error);
    }
}