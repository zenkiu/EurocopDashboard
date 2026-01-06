/**
 * EUROCOP ANALYTICS - SCRIPT INTEGRADO PROFESIONAL 2026
 * Versión: Smart Locality (Auto-Centroide) + Full Responsive + Fullscreen Fix
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
    // Localidad eliminada del mapeo según requerimiento
    const mappingIds = ['map-expediente', 'map-fecha', 'map-hora', 'map-lat', 'map-lon', 'map-categoria'];
    
    mappingIds.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        
        sel.addEventListener('change', refreshMappingStatus);
        sel.innerHTML = id === 'map-hora' ? '<option value="">-- Sin hora (00:00) --</option>' : '<option value="" disabled selected>Seleccionar...</option>';
        
        headers.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h; 
            opt.textContent = h;
            sel.appendChild(opt);
        });

        // AUTO-DETECCIÓN INTELIGENTE
        headers.forEach(h => {
            const s = h.toLowerCase();
            if (id.includes('exp')) {
                if (s === 'refexp') sel.value = h;
                else if (!sel.value && (s.includes('exp') || s.includes('id') || s.includes('num'))) sel.value = h;
            }
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
// 5. FILTROS Y UI DINÁMICA
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

function updateUI() {
    const getChecked = (id) => Array.from(document.querySelectorAll(`#${id} input:checked`)).map(i => i.value);
    
    const getLabels = (id, isNavbar = false) => {
        const checked = Array.from(document.querySelectorAll(`#${id} input:checked`));
        const total = document.querySelectorAll(`#${id} input`).length;
        if (checked.length === 0) return "NINGUNO";
        if (checked.length === total) return "TODOS";
        const names = checked.map(i => i.nextElementSibling.innerText).join(', ');
        return (!isNavbar && names.length > 20) ? `${checked.length} SELECC.` : names;
    };

    const selYears = getChecked('items-year').map(Number);
    const selMonths = getChecked('items-month').map(Number);
    const selCats = getChecked('items-category');

    // Actualizar Labels Sidebar
    document.getElementById('label-year').innerText = getLabels('items-year');
    document.getElementById('label-month').innerText = getLabels('items-month');
    document.getElementById('label-category').innerText = getLabels('items-category');

    // Actualizar Navbar Superior
    if (document.getElementById('header-year')) document.getElementById('header-year').innerText = getLabels('items-year', true).toUpperCase();
    if (document.getElementById('header-month')) document.getElementById('header-month').innerText = getLabels('items-month', true).toUpperCase();
    if (document.getElementById('header-category')) document.getElementById('header-category').innerText = getLabels('items-category', true).toUpperCase();

    const filtered = finalData.filter(d => 
        selYears.includes(d.year) && selMonths.includes(d.month) && selCats.includes(d.cat)
    );

    document.getElementById('kpi-count').innerText = filtered.length.toLocaleString();
    document.getElementById('kpi-total-filas').innerText = `${filtered.length} REGISTROS`;

    updateMapData(filtered);
    updateCharts(filtered, selYears);
    updatePrincipalZone(filtered); // Autodetección de localidad
}

/**
 * DETECTAR ZONA PRINCIPAL AUTOMÁTICAMENTE (Geocodificación Inversa)
 */
async function updatePrincipalZone(data) {
    const kpiLoc = document.getElementById('kpi-localidad');
    if (!kpiLoc) return;

    if (!data || data.length === 0) {
        kpiLoc.innerText = "SIN DATOS";
        return;
    }

    // Calculamos el centroide (promedio lat/lon de los puntos filtrados)
    const avgLat = data.reduce((sum, d) => sum + d.lat, 0) / data.length;
    const avgLon = data.reduce((sum, d) => sum + d.lon, 0) / data.length;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${avgLat}&lon=${avgLon}&zoom=12`, { signal: controller.signal });
        const result = await response.json();
        
        const city = result.address.city || result.address.town || result.address.village || result.address.county || "ZONA LOCAL";
        kpiLoc.innerText = city.toUpperCase();
        clearTimeout(timeoutId);
    } catch (error) {
        kpiLoc.innerText = "LOCALIDAD DETECTADA";
    }
}

// ============================================================
// 6. GRÁFICOS (CHART.JS)
// ============================================================
function changeTemporalView(v) { temporalView = v; updateUI(); }

function updateCharts(data, selYears) {
    const allYearsMaster = [...new Set(finalData.map(d => d.year))].sort((a,b) => a-b);
    const commonOpts = { responsive: true, maintainAspectRatio: false };

    // Gráfico Evolución
    const ctxTimeline = document.getElementById('chart-timeline');
    if (ctxTimeline) {
        const sortedYears = [...selYears].sort((a,b) => a-b);
        let labels = [], datasets = [];
        if (temporalView === 'year') {
            labels = sortedYears.map(y => y.toString());
            datasets = [{ label: 'Registros', data: sortedYears.map(y => data.filter(d => d.year === y).length), backgroundColor: sortedYears.map(y => yearColors[allYearsMaster.indexOf(y) % yearColors.length].bg) }];
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
        chartTimeline = new Chart(ctxTimeline, { type: 'bar', data: { labels, datasets }, options: commonOpts });
    }

    // Gráfico Categorías
    const ctxCat = document.getElementById('chart-category');
    if (ctxCat) {
        const catData = {}; data.forEach(d => catData[d.cat] = (catData[d.cat] || 0) + 1);
        const sorted = Object.entries(catData).sort((a,b) => b[1]-a[1]).slice(0,5);
        if (chartCategory) chartCategory.destroy();
        chartCategory = new Chart(ctxCat, { type: 'doughnut', data: { labels: sorted.map(s => s[0]), datasets: [{ data: sorted.map(s => s[1]), backgroundColor: yearColors.map(c => c.bg) }] }, options: { ...commonOpts, plugins: { legend: { position: 'right' } } } });
    }

    // Gráfico Horas
    const ctxHours = document.getElementById('chart-hours');
    if (ctxHours) {
        const hC = Array(24).fill(0); data.forEach(d => hC[d.hour]++);
        if (chartHours) chartHours.destroy();
        chartHours = new Chart(ctxHours, { type: 'line', data: { labels: Array.from({length: 24}, (_,i) => i+'h'), datasets: [{ label: 'Actividad', data: hC, borderColor: '#11cdef', fill: true, backgroundColor: 'rgba(17,205,239,0.1)', tension: 0.4 }] }, options: commonOpts });
    }
}

// ============================================================
// 7. MAPA (MAPLIBRE)
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
        // Busca y reemplaza este bloque dentro de initMap
        map.on('click', 'point-layer', (e) => {
            const p = e.features[0].properties;
            
            // Formateamos el título como EXP: AÑO-NÚMERO
            const tituloExpediente = `EXP: ${p.year}-${p.exp}`;

            new maplibregl.Popup({ offset: 10 })
                .setLngLat(e.features[0].geometry.coordinates)
                .setHTML(`
                    <div style="padding:10px; font-family:'Inter', sans-serif; min-width:200px;">
                        <div style="color:#5e72e4; font-weight:800; font-size:13px; margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:5px;">
                            ${tituloExpediente}
                        </div>
                        <div style="font-size:11px; line-height:1.6;">
                            <span style="color:#8898aa; font-weight:600;">CATEGORÍA:</span> 
                            <span style="color:#32325d;">${p.cat}</span><br>
                            
                            <span style="color:#8898aa; font-weight:600;">UBICACIÓN:</span> 
                            <span style="color:#32325d;">${p.calle} ${p.numero}</span><br>
                            
                            <span style="color:#8898aa; font-weight:600;">FECHA:</span> 
                            <span style="color:#32325d;">${p.fullDate}</span><br>
                            
                            <span style="color:#8898aa; font-weight:600;">HORA:</span> 
                            <span style="color:#32325d; font-weight:700;">${p.time} h</span>
                        </div>
                    </div>
                `)
                .addTo(map);
        });
    });
}

function updateMapData(data) {
    if (!map || !map.getSource('puntos')) return;

    const geojson = { 
        type: 'FeatureCollection', 
        features: data.map(d => {
            // Formatear hora a HH:mm
            const hh = d.date.getHours().toString().padStart(2, '0');
            const mm = d.date.getMinutes().toString().padStart(2, '0');
            const timeStr = `${hh}:${mm}`;

            return { 
                type: 'Feature', 
                geometry: { type: 'Point', coordinates: [d.lon, d.lat] }, 
                properties: { 
                    exp: d.exp, 
                    cat: d.cat, // Aquí va el tipo de categoría del Excel
                    year: d.year, // Guardamos el año para el título del popup
                    calle: d.calle || "No disp.",
                    numero: d.numero || "",
                    fullDate: d.date.toLocaleDateString('es-ES'),
                    time: timeStr
                } 
            };
        }) 
    };

    map.getSource('puntos').setData(geojson);

    // Colores por año en el mapa (Mantenemos tu lógica anterior)
    const allY = [...new Set(finalData.map(d => d.year))].sort((a,b) => a-b);
    const colorExpr = ['match', ['get', 'year']];
    allY.forEach(y => {
        const color = yearColors[allY.indexOf(y) % yearColors.length].border;
        colorExpr.push(y, color);
    });
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
function toggleDropdown(id) {
    const el = document.getElementById(id);
    const isActive = el.classList.contains('active');
    document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('active'));
    if (!isActive) el.classList.add('active');
}

window.onclick = (e) => { if (!e.target.closest('.custom-dropdown')) document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('active')); };

function toggleGroup(containerId, state, event) {
    if (event) event.stopPropagation();
    const container = document.getElementById(containerId);
    if (container) {
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = state);
        updateUI();
    }
}

function toggleSatelite(btn) { isSatelite = !isSatelite; map.setLayoutProperty('satellite-layer', 'visibility', isSatelite ? 'visible' : 'none'); btn.style.background = isSatelite ? '#5e72e4' : ''; btn.style.color = isSatelite ? '#fff' : ''; }
function toggleHeatmap(btn) { isHeatmap = !isHeatmap; map.setLayoutProperty('heat-layer', 'visibility', isHeatmap ? 'visible' : 'none'); map.setLayoutProperty('point-layer', 'visibility', isHeatmap ? 'none' : 'visible'); }
function toggle3D() { map.easeTo({ pitch: map.getPitch() > 0 ? 0 : 60, duration: 1000 }); }
function toggleFullscreen(id) {
    const el = document.getElementById(id);
    el.classList.toggle('fullscreen');
    document.body.style.overflow = el.classList.contains('fullscreen') ? 'hidden' : 'auto';
    setTimeout(() => {
        if (chartTimeline) chartTimeline.resize();
        if (chartCategory) chartCategory.resize();
        if (chartHours) chartHours.resize();
        if (map) map.resize();
        window.dispatchEvent(new Event('resize'));
    }, 350);
}

// ============================================================
// 8. UTILIDADES UI Y RESPONSIVE
// ============================================================
function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('active');
    }
}

// Cerrar menú al hacer clic fuera (solo móvil)
document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menu-toggle');
    
    if (sidebar && sidebar.classList.contains('active')) {
        if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
            sidebar.classList.remove('active');
        }
    }
});

function toggleSatelite(btn) { 
    isSatelite = !isSatelite; 
    map.setLayoutProperty('satellite-layer', 'visibility', isSatelite ? 'visible' : 'none'); 
    btn.style.background = isSatelite ? '#5e72e4' : ''; 
    btn.style.color = isSatelite ? '#fff' : ''; 
}

function toggleHeatmap(btn) { 
    isHeatmap = !isHeatmap; 
    map.setLayoutProperty('heat-layer', 'visibility', isHeatmap ? 'visible' : 'none'); 
    map.setLayoutProperty('point-layer', 'visibility', isHeatmap ? 'none' : 'visible'); 
    btn.innerHTML = isHeatmap ? '<i class="fa-solid fa-location-dot"></i> Puntos' : '<i class="fa-solid fa-fire"></i> Calor'; 
}

function toggle3D() { 
    const p = map.getPitch(); 
    map.easeTo({ pitch: p > 0 ? 0 : 60, bearing: p > 0 ? 0 : -20, duration: 1000 }); 
}

function toggleFullscreen(id) { 
    const el = document.getElementById(id);
    el.classList.toggle('fullscreen'); 
    
    // Cerrar menú móvil si está abierto
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
    }
    
    setTimeout(() => { 
        if(chartTimeline) chartTimeline.resize(); 
        if(chartCategory) chartCategory.resize(); 
        if(chartHours) chartHours.resize(); 
        if(map) map.resize(); 
    }, 300); 
}

// Resize charts on window resize (responsive)
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if(chartTimeline) chartTimeline.resize();
        if(chartCategory) chartCategory.resize();
        if(chartHours) chartHours.resize();
        if(map) map.resize();
    }, 250);
});


