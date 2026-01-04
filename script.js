/**
 * EUROCOP ANALYTICS - SCRIPT INTEGRADO PROFESIONAL 2026
 * Versión: Dashboard de Seguridad Pública con Exportación Pro
 */

// ============================================================
// 1. VARIABLES GLOBALES Y CONFIGURACIÓN
// ============================================================
let rawData = [];
let finalData = [];
let map;
let chartTimeline, chartCategory, chartHours;
let nombreArchivoSubido = "INFORME ANALYTICS"; // Para el título del PDF

// Estados de la interfaz
let isSatelite = false;
let isHeatmap = false; 
let temporalView = 'year'; 

// Configuración de etiquetas y tiempos
const dayLabels = ['L-Lunes', 'M-Martes', 'X-Miércoles', 'J-Jueves', 'V-Viernes', 'S-Sábado', 'D-Domingo'];
const monthsConfig = [
    { id: 1, name: 'Enero', abbr: 'Ene' }, { id: 2, name: 'Febrero', abbr: 'Feb' },
    { id: 3, name: 'Marzo', abbr: 'Mar' }, { id: 4, name: 'Abril', abbr: 'Abr' },
    { id: 5, name: 'Mayo', abbr: 'May' }, { id: 6, name: 'Junio', abbr: 'Jun' },
    { id: 7, name: 'Julio', abbr: 'Jul' }, { id: 8, name: 'Agosto', abbr: 'Ago' },
    { id: 9, name: 'Septiembre', abbr: 'Sep' }, { id: 10, name: 'Octubre', abbr: 'Oct' },
    { id: 11, name: 'Noviembre', abbr: 'Nov' }, { id: 12, name: 'Diciembre', abbr: 'Dic' }
];

// Paleta de colores profesional
const yearColors = [
    { bg: 'rgba(94, 114, 228, 0.7)', border: '#5e72e4' },   // Azul
    { bg: 'rgba(45, 206, 137, 0.7)', border: '#2dce89' },   // Verde
    { bg: 'rgba(251, 99, 64, 0.7)', border: '#fb6340' },    // Naranja
    { bg: 'rgba(17, 205, 239, 0.7)', border: '#11cdef' },   // Cyan
    { bg: 'rgba(245, 54, 92, 0.7)', border: '#f5365c' },    // Rojo
    { bg: 'rgba(137, 101, 224, 0.7)', border: '#8965e0' },  // Púrpura
    { bg: 'rgba(255, 214, 0, 0.7)', border: '#ffd600' }     // Amarillo
];

// ============================================================
// 2. CARGA DE ARCHIVOS Y CAPTURA DE NOMBRE
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    if (dropZone) {
        dropZone.onclick = () => fileInput.click();
        
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // CAPTURAR NOMBRE PARA EL PDF (Sin extensión)
            nombreArchivoSubido = file.name.replace(/\.[^/.]+$/, "").toUpperCase();
                // ACTUALIZAR EL TÍTULO EN LA INTERFAZ HTML
            const displayEl = document.getElementById('display-filename');
            if (displayEl) {
                displayEl.textContent = nombreArchivoSubido;
            }
            if (file.name.endsWith('.csv')) {
                Papa.parse(file, { 
                    header: true, 
                    skipEmptyLines: true, 
                    encoding: "UTF-8",
                    complete: (res) => showMapping(res.data) 
                });
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

function showMapping(data) {
    rawData = data;
    const headers = Object.keys(data[0]);
    const mappingIds = ['map-expediente', 'map-fecha', 'map-hora', 'map-lat', 'map-lon', 'map-categoria'];
    
    mappingIds.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = id === 'map-hora' ? '<option value="">-- Sin hora (Usar 00:00) --</option>' : '<option value="" disabled selected>Seleccionar...</option>';
        
        headers.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h; opt.textContent = h;
            sel.appendChild(opt);
        });

        // Auto-detección inteligente
        headers.forEach(h => {
            const s = h.toLowerCase();
            if (id.includes('exp') && (s.includes('exp') || s.includes('id') || s.includes('num'))) sel.value = h;
            if (id.includes('fecha') && (s.includes('fec') || s.includes('date'))) sel.value = h;
            if (id.includes('hora') && (s.includes('hor') || s.includes('time'))) sel.value = h;
            if (id.includes('lat') && (s.includes('lat') || s.includes('coord_y') || s === 'y')) sel.value = h;
            if (id.includes('lon') && (s.includes('lon') || s.includes('coord_x') || s === 'x')) sel.value = h;
            if (id.includes('cat') && (s.includes('cat') || s.includes('tipo') || s.includes('delito'))) sel.value = h;
        });
    });

    document.getElementById('upload-view').style.display = 'none';
    document.getElementById('mapping-view').classList.add('active');
}

// ============================================================
// 3. PROCESAMIENTO Y GENERACIÓN DEL DASHBOARD
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
        alert("Por favor, mapea al menos Fecha, Latitud y Longitud.");
        return;
    }

    finalData = rawData.map(row => {
        let d = new Date(row[config.fecha]);
        if (isNaN(d.getTime())) return null;

        // Procesar hora si existe
        if (config.hora && row[config.hora]) {
            const t = String(row[config.hora]);
            if (t.includes(':')) {
                const parts = t.split(':');
                d.setHours(parseInt(parts[0]) || 0, parseInt(parts[1]) || 0, 0);
            }
        }

        // Limpieza de coordenadas (gestión de comas por puntos)
        const lat = parseFloat(String(row[config.lat]).replace(',', '.'));
        const lon = parseFloat(String(row[config.lon]).replace(',', '.'));
        if (isNaN(lat) || isNaN(lon)) return null;

        return {
            exp: row[config.exp] || "N/A",
            date: d, 
            year: d.getFullYear(), 
            month: d.getMonth() + 1, 
            hour: d.getHours(),
            lat: lat, 
            lon: lon, 
            cat: row[config.cat] || "General"
        };
    }).filter(v => v !== null);

    if (finalData.length === 0) {
        alert("No se pudieron procesar datos válidos. Revise el formato de fecha y coordenadas.");
        return;
    }

    document.getElementById('mapping-view').classList.remove('active');
    document.getElementById('dashboard-view').classList.add('active');
    
    setupFilters();
    initMap();
    setTimeout(() => { updateUI(); }, 500);
};

function setupFilters() {
    const years = [...new Set(finalData.map(d => d.year))].sort((a,b) => b-a);
    const cats = [...new Set(finalData.map(d => d.cat))].sort();
    
    renderCheckboxes('list-year', years, years[0]); // Seleccionamos el año más reciente por defecto
    renderCheckboxes('list-month', monthsConfig, 'all');
    renderCheckboxes('list-category', cats, 'all');
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
    const getLabels = (id) => {
        const checked = Array.from(document.querySelectorAll(`#${id} input:checked`));
        const total = document.querySelectorAll(`#${id} input`).length;
        if (checked.length === 0) return "NINGUNO";
        if (checked.length === total) return "TODOS";
        return checked.map(i => i.nextElementSibling.innerText).join(', ');
    };

    const selYears = getChecked('list-year').map(Number);
    const selMonths = getChecked('list-month').map(Number);
    const selCats = getChecked('list-category');

    const filtered = finalData.filter(d => 
        selYears.includes(d.year) && selMonths.includes(d.month) && selCats.includes(d.cat)
    );

    // 1. Actualizar Contador (Imagen 2)
    document.getElementById('kpi-count').innerText = filtered.length.toLocaleString();
    const badge = document.getElementById('kpi-total-filas');
    if(badge) badge.innerText = `${filtered.length} REGISTROS`;

    // 2. Actualizar Info de Filtros en el Header (Imagen 1)
    document.getElementById('header-year').innerText = getLabels('list-year');
    document.getElementById('header-month').innerText = getLabels('list-month');

    updateMapData(filtered);
    updateCharts(filtered, selYears);
}

// ============================================================
// 4. LÓGICA DE GRÁFICOS (CHART.JS)
// ============================================================
function changeTemporalView(val) {
    temporalView = val;
    updateUI();
}

function updateCharts(data, selYears) {
    const allYearsMaster = [...new Set(finalData.map(d => d.year))].sort((a,b) => a-b);
    
    // --- GRÁFICO 1: EVOLUCIÓN TEMPORAL ---
    const ctxTimeline = document.getElementById('chart-timeline');
    if (ctxTimeline) {
        const sortedSelYears = [...selYears].sort((a,b) => a-b);
        let labels = [];
        let datasets = [];

        if (temporalView === 'year') {
            labels = sortedSelYears.map(y => y.toString());
            const counts = sortedSelYears.map(year => data.filter(d => d.year === year).length);
            datasets = [{
                label: 'Registros',
                data: counts,
                backgroundColor: sortedSelYears.map(year => yearColors[allYearsMaster.indexOf(year) % yearColors.length].bg),
                borderColor: sortedSelYears.map(year => yearColors[allYearsMaster.indexOf(year) % yearColors.length].border),
                borderWidth: 2
            }];
        } 
        else if (temporalView === 'month') {
            labels = monthsConfig.map(m => m.abbr);
            datasets = sortedSelYears.map(year => {
                const yearData = data.filter(d => d.year === year);
                const counts = Array(12).fill(0);
                yearData.forEach(d => counts[d.month - 1]++);
                const color = yearColors[allYearsMaster.indexOf(year) % yearColors.length];
                return { label: year.toString(), data: counts, backgroundColor: color.bg, borderColor: color.border, borderWidth: 2 };
            });
        } 
        else if (temporalView === 'day') {
            labels = dayLabels;
            datasets = sortedSelYears.map(year => {
                const yearData = data.filter(d => d.year === year);
                const counts = Array(7).fill(0);
                yearData.forEach(d => {
                    let dayIdx = d.date.getDay(); 
                    let remappedIdx = dayIdx === 0 ? 6 : dayIdx - 1; 
                    counts[remappedIdx]++;
                });
                const color = yearColors[allYearsMaster.indexOf(year) % yearColors.length];
                return { label: year.toString(), data: counts, backgroundColor: color.bg, borderColor: color.border, borderWidth: 2 };
            });
        }

        if (chartTimeline) chartTimeline.destroy();
        chartTimeline = new Chart(ctxTimeline, {
            type: 'bar',
            data: { labels: labels, datasets: datasets },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                plugins: { legend: { display: temporalView !== 'year', labels: { color: '#8898aa' } } },
                scales: { 
                    y: { beginAtZero: true, ticks: { color: '#8898aa', stepSize: 1 } },
                    x: { ticks: { color: '#8898aa' } }
                }
            }
        });
    }

    // --- GRÁFICO 2: CATEGORÍAS (TOP 5) ---
    const ctxCat = document.getElementById('chart-category');
    if (ctxCat) {
        const catData = {};
        data.forEach(d => catData[d.cat] = (catData[d.cat] || 0) + 1);
        const sorted = Object.entries(catData).sort((a,b) => b[1]-a[1]).slice(0,5);
        
        if (chartCategory) chartCategory.destroy();
        chartCategory = new Chart(ctxCat, {
            type: 'doughnut',
            data: { 
                labels: sorted.map(s => s[0]), 
                datasets: [{ 
                    data: sorted.map(s => s[1]), 
                    backgroundColor: yearColors.map(c => c.bg), 
                    hoverOffset: 10 
                }] 
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { position: 'right', labels: { color: '#8898aa', padding: 20 } } } 
            }
        });
    }

    // --- GRÁFICO 3: ACTIVIDAD POR HORAS ---
    const ctxHours = document.getElementById('chart-hours');
    if (ctxHours) {
        const hourCounts = Array(24).fill(0);
        data.forEach(d => hourCounts[d.hour]++);
        
        if (chartHours) chartHours.destroy();
        chartHours = new Chart(ctxHours, {
            type: 'line',
            data: { 
                labels: Array.from({length: 24}, (_,i) => i+'h'), 
                datasets: [{ 
                    label: 'Registros', 
                    data: hourCounts, 
                    borderColor: '#11cdef', 
                    backgroundColor: 'rgba(17,205,239,0.1)',
                    fill: true, 
                    tension: 0.4,
                    pointRadius: 3
                }] 
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } },
                scales: { 
                    y: { beginAtZero: true, ticks: { color: '#8898aa' } },
                    x: { ticks: { color: '#8898aa' } }
                }
            }
        });
    }
}

// ============================================================
// 5. MAPLIBRE GL JS (MAPA)
// ============================================================
function initMap() {
    if (map) map.remove();
    map = new maplibregl.Map({
        container: 'main-map',
        style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
        center: [-2.63, 43.17], 
        zoom: 12,
        preserveDrawingBuffer: true, // Vital para la captura del PDF
        antialias: true  
    });

    map.on('load', () => {
        // Capa Satélite
        map.addSource('satellite-tiles', { 'type': 'raster', 'tiles': ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], 'tileSize': 256 });
        map.addLayer({ 'id': 'satellite-layer', 'type': 'raster', 'source': 'satellite-tiles', 'layout': { 'visibility': 'none' } });
        
        // Fuente de Datos GeoJSON
        map.addSource('puntos', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        
        // Capa Calor
        map.addLayer({
            id: 'heat-layer', type: 'heatmap', source: 'puntos', layout: { 'visibility': 'none' },
            paint: { 
                'heatmap-weight': 1, 'heatmap-intensity': 3, 'heatmap-radius': 20, 
                'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.2, 'blue', 0.4, 'cyan', 0.6, 'lime', 0.8, 'yellow', 1, 'red'] 
            }
        });

        // Capa Puntos
        map.addLayer({
            id: 'point-layer', type: 'circle', source: 'puntos', layout: { 'visibility': 'visible' },
            paint: { 'circle-radius': 6, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff', 'circle-color': '#5e72e4' }
        });

        // Popup al hacer click
        map.on('click', 'point-layer', (e) => {
            const props = e.features[0].properties;
            new maplibregl.Popup({ offset: 10 })
                .setLngLat(e.features[0].geometry.coordinates)
                .setHTML(`
                    <div style="padding:5px; font-family:Inter, sans-serif;">
                        <strong style="color:#5e72e4">Exp: ${props.exp}</strong><br>
                        <small><b>Categoría:</b> ${props.cat}</small><br>
                        <small><b>Fecha:</b> ${props.fullDate}</small>
                    </div>
                `)
                .addTo(map);
        });

        map.on('mouseenter', 'point-layer', () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', 'point-layer', () => map.getCanvas().style.cursor = '');
    });
}

function updateMapData(data) {
    if (!map || !map.getSource('puntos')) return;
    
    const geojson = {
        type: 'FeatureCollection',
        features: data.map(d => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [d.lon, d.lat] },
            properties: { 
                exp: d.exp, cat: d.cat, year: d.year,
                fullDate: d.date.toLocaleString('es-ES')
            }
        }))
    };
    
    map.getSource('puntos').setData(geojson);

    // Color dinámico según año para consistencia visual
    const allYearsMaster = [...new Set(finalData.map(d => d.year))].sort((a,b) => a-b);
    const colorExpression = ['match', ['get', 'year']];
    allYearsMaster.forEach(year => {
        colorExpression.push(year, yearColors[allYearsMaster.indexOf(year) % yearColors.length].border);
    });
    colorExpression.push('#5e72e4'); // Color por defecto
    map.setPaintProperty('point-layer', 'circle-color', colorExpression);

    // Ajustar vista a los puntos
    if (data.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        data.forEach(d => bounds.extend([d.lon, d.lat]));
        map.fitBounds(bounds, { padding: 60, maxZoom: 16 });
    }
}

// ============================================================
// 6. CONTROLES DE INTERFAZ (UI)
// ============================================================
function toggleSatelite(btn) {
    isSatelite = !isSatelite;
    map.setLayoutProperty('satellite-layer', 'visibility', isSatelite ? 'visible' : 'none');
    btn.classList.toggle('active-btn', isSatelite);
    btn.style.background = isSatelite ? '#5e72e4' : '';
    btn.style.color = isSatelite ? '#fff' : '';
}

function toggleHeatmap(btn) {
    isHeatmap = !isHeatmap;
    map.setLayoutProperty('heat-layer', 'visibility', isHeatmap ? 'visible' : 'none');
    map.setLayoutProperty('point-layer', 'visibility', isHeatmap ? 'none' : 'visible');
    btn.innerHTML = isHeatmap ? '<i class="fa-solid fa-location-dot"></i> Modo: Puntos' : '<i class="fa-solid fa-fire"></i> Modo: Calor';
}

function toggle3D() {
    const p = map.getPitch();
    map.easeTo({ pitch: p > 0 ? 0 : 60, bearing: p > 0 ? 0 : -20, duration: 1000 });
}

function toggleFullscreen(id) {
    const el = document.getElementById(id);
    if (!el) return;

    el.classList.toggle('fullscreen');

    // Función para forzar el redibujado de los gráficos
    const resizeCharts = () => {
        if (chartTimeline) chartTimeline.resize();
        if (chartCategory) chartCategory.resize();
        if (chartHours) chartHours.resize();
        if (map) map.resize();
    };

    // Ejecutamos el resize varias veces para pillar la animación de CSS
    resizeCharts();
    setTimeout(resizeCharts, 100);
    setTimeout(resizeCharts, 500);
}

function toggleGroup(containerId, state) {
    document.querySelectorAll(`#${containerId} input`).forEach(cb => cb.checked = state);
    updateUI();
}