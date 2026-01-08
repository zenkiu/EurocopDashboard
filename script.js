/**
 * EUROCOP ANALYTICS - SCRIPT FINAL 2026
 * Versión: Full Responsive + Localidad Texto Libre + Drag&Drop + Tablas
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

// Variables para Tablas
let isTableView = false; 
let tableDataCache = []; 
let currentSort = { col: 0, dir: 'asc' };

let isTableCatView = false;
let tableCatDataCache = [];
let currentSortCat = { col: 'count', dir: 'desc' };

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
// 3. CARGA DE ARCHIVOS (DRAG & DROP)
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
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
}

function goToMapping() {
    if (document.getElementById('dashboard-view').classList.contains('active')) {
        document.getElementById('dashboard-view').classList.remove('active');
        document.getElementById('mapping-view').classList.add('active');
        setTimeout(() => { if(map) map.resize(); }, 300);
    }
}

// ============================================================
// 4. MAPEO (MODIFICADO: LOCALIDAD ES TEXTO LIBRE)
// ============================================================
function showMapping(data) {
    rawData = data;
    const headers = Object.keys(data[0]);
    
    // NOTA: Hemos quitado 'map-localidad' de aquí porque ya no es un desplegable
    const mappingIds = ['map-expediente', 'map-fecha', 'map-hora', 'map-lat', 'map-lon', 'map-categoria'];
    
    mappingIds.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        
        const newSel = sel.cloneNode(false);
        sel.parentNode.replaceChild(newSel, sel);
        newSel.addEventListener('change', refreshMappingStatus);

        if (id === 'map-hora') newSel.innerHTML = '<option value="">-- Sin hora (00:00) --</option>';
        else newSel.innerHTML = '<option value="" disabled selected>Seleccionar...</option>';

        headers.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h; opt.textContent = h;
            newSel.appendChild(opt);
        });

        // Auto-detección
        headers.forEach(h => {
            const s = h.toLowerCase();
            if (id.includes('exp') && (s.includes('exp') || s.includes('id'))) newSel.value = h;
            if (id.includes('fecha') && (s.includes('fec') || s.includes('date'))) newSel.value = h;
            if (id.includes('hora') && (s.includes('hor') || s.includes('time'))) newSel.value = h;
            if (id.includes('lat') && (s.includes('lat') || s === 'y')) newSel.value = h;
            if (id.includes('lon') && (s.includes('lon') || s === 'x')) newSel.value = h;
            if (id.includes('cat') && (s.includes('cat') || s.includes('tipo'))) newSel.value = h;
        });
    });

    // Limpiar el campo de localidad por si acaso
    const locInput = document.getElementById('map-localidad');
    if(locInput) locInput.value = "";

    refreshMappingStatus();
    document.getElementById('upload-view').style.display = 'none';
    document.getElementById('mapping-view').classList.add('active');
}

function refreshMappingStatus() {
    // Solo validamos los selects
    const mappingIds = ['map-expediente', 'map-fecha', 'map-hora', 'map-lat', 'map-lon', 'map-categoria'];
    const currentSelections = mappingIds.map(id => {
        const el = document.getElementById(id);
        return el ? el.value : "";
    }).filter(val => val !== "");

    mappingIds.forEach(id => {
        const sel = document.getElementById(id);
        if(!sel) return;
        Array.from(sel.options).forEach(opt => {
            if (opt.value === "" || opt.disabled) return;
            const isUsedElsewhere = currentSelections.includes(opt.value) && sel.value !== opt.value;
            opt.textContent = (isUsedElsewhere ? "✕ " : (sel.value === opt.value ? "✓ " : "• ")) + opt.value.replace(/^[✓•✕]\s/, "");
            opt.style.color = isUsedElsewhere ? "#cbd5e0" : "#5e72e4";
        });
    });
}

// ============================================================
// 5. PROCESAMIENTO (CON LOCALIDAD MANUAL)
// ============================================================
document.getElementById('btn-visualizar').onclick = () => {
    const config = {
        exp: document.getElementById('map-expediente').value,
        fecha: document.getElementById('map-fecha').value,
        hora: document.getElementById('map-hora').value,
        lat: document.getElementById('map-lat').value,
        lon: document.getElementById('map-lon').value,
        cat: document.getElementById('map-categoria').value,
        // CAPTURAMOS EL TEXTO MANUAL
        locManual: document.getElementById('map-localidad').value.trim() 
    };

    if (!config.fecha || !config.lat || !config.lon) {
        alert("Por favor, selecciona al menos Fecha, Latitud y Longitud.");
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
            // Guardamos el dato manual en cada fila para tenerlo disponible
            locManual: config.locManual, 
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
    const getValues = (containerId) => Array.from(document.querySelectorAll(`#${containerId} input:checked`)).map(i => i.value);
    const getLabels = (containerId) => {
        const all = document.querySelectorAll(`#${containerId} input`);
        const checked = Array.from(document.querySelectorAll(`#${containerId} input:checked`));
        if (checked.length === 0) return "NINGUNO";
        if (checked.length === all.length) return "TODOS";
        return checked.map(i => i.nextElementSibling.innerText).join(", ");
    };

    const selYears = getValues('items-year').map(Number);
    const selMonths = getValues('items-month').map(Number);
    const selCats = getValues('items-category');

    const txtYears = getLabels('items-year');
    if(document.getElementById('label-year')) document.getElementById('label-year').innerText = txtYears;
    if(document.getElementById('header-year')) document.getElementById('header-year').innerText = txtYears;

    const txtMonths = getLabels('items-month');
    if(document.getElementById('label-month')) document.getElementById('label-month').innerText = txtMonths;
    if(document.getElementById('header-month')) document.getElementById('header-month').innerText = txtMonths;

    const txtCats = getLabels('items-category');
    if(document.getElementById('label-category')) document.getElementById('label-category').innerText = txtCats;
    if(document.getElementById('header-category')) document.getElementById('header-category').innerText = txtCats;

    const filtered = finalData.filter(d => 
        selYears.includes(d.year) && 
        selMonths.includes(d.month) && 
        selCats.includes(d.cat)
    );

    document.getElementById('kpi-count').innerText = filtered.length.toLocaleString();
    const badge = document.getElementById('kpi-total-filas');
    if(badge) badge.innerText = `${filtered.length} REG`;

    updateMapData(filtered);
    updateCharts(filtered, selYears);
    if (typeof updateLocationKPI === "function") updateLocationKPI(filtered);
}

// ============================================================
// 8. GRÁFICOS
// ============================================================
function changeTemporalView(v) { temporalView = v; updateUI(); }

function updateCharts(data, selYears) {
    const allYearsMaster = [...new Set(finalData.map(d => d.year))].sort((a,b) => a-b);
    
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { 
                position: window.innerWidth < 768 ? 'bottom' : 'top',
                labels: { boxWidth: 12, font: { size: 10 } }
            }
        }
    };

    // TIMELINE
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
            labels = dayLabels.map(l => l.substring(0,3));
            datasets = sortedYears.map(y => {
                const c = Array(7).fill(0); data.filter(d => d.year === y).forEach(d => { let idx = d.date.getDay(); c[idx === 0 ? 6 : idx - 1]++; });
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
        chartTimeline = new Chart(ctxTimeline, { type: 'bar', data: { labels, datasets }, options: commonOptions });
    }

    // CATEGORY
    const ctxCat = document.getElementById('chart-category');
    if (ctxCat) {
        const catData = {}; 
        data.forEach(d => catData[d.cat] = (catData[d.cat] || 0) + 1);
        
        const sorted = Object.entries(catData).sort((a,b) => b[1]-a[1]);
        const top5 = sorted.slice(0, 5);
        const total = sorted.reduce((sum, item) => sum + item[1], 0);

        tableCatDataCache = sorted.map(item => ({
            cat: item[0],
            count: item[1],
            percent: ((item[1] / total) * 100).toFixed(1)
        }));
        if (isTableCatView) renderCategoryTable();

        if (chartCategory) chartCategory.destroy();
        chartCategory = new Chart(ctxCat, { 
            type: 'doughnut', 
            data: { 
                labels: top5.map(s => s[0]), 
                datasets: [{ 
                    data: top5.map(s => s[1]), 
                    backgroundColor: yearColors.map(c => c.bg),
                    borderColor: '#ffffff',
                    borderWidth: 2
                }] 
            }, 
            options: { 
                ...commonOptions, 
                cutout: '60%',
                layout: { padding: 10 },
                scales: { x: { display: false }, y: { display: false } },
                plugins: { 
                    legend: { 
                        position: window.innerWidth < 768 ? 'bottom' : 'right',
                        labels: { boxWidth: 15, padding: 15, font: { size: 11 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                let value = context.parsed;
                                let total = context.chart._metasets[context.datasetIndex].total;
                                let percentage = ((value / total) * 100).toFixed(1) + "%";
                                return ` ${label}: ${value} (${percentage})`;
                            }
                        }
                    }
                } 
            } 
        });
    }

    // HOURS
    const ctxHours = document.getElementById('chart-hours');
    if (ctxHours) {
        const hC = Array(24).fill(0); data.forEach(d => hC[d.hour]++);
        if (chartHours) chartHours.destroy();
        chartHours = new Chart(ctxHours, { type: 'line', data: { labels: Array.from({length: 24}, (_,i) => i), datasets: [{ label: 'Actividad', data: hC, borderColor: '#11cdef', fill: true, backgroundColor: 'rgba(17,205,239,0.1)', tension: 0.4 }] }, options: { ...commonOptions, plugins: { legend: { display: false } }, scales: { x: { ticks: { maxTicksLimit: 8 } } } } });
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
        map.fitBounds(bounds, { padding: 40, maxZoom: 16 });
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
        if (chartTimeline) chartTimeline.resize();
        if (chartCategory) chartCategory.resize();
        if (chartHours) chartHours.resize();
        if (map) map.resize();
    }, 300);
}

// ============================================================
// 10. GEOLOCALIZACIÓN: MANUAL > GPS
// ============================================================
async function updateLocationKPI(data) {
    const el = document.getElementById('kpi-location');
    if (!data || data.length === 0) { el.innerText = "Sin Datos"; return; }

    // 1. INTENTO: TEXTO MANUAL CONFIGURADO
    // Miramos el primer registro, ya que todos tienen el mismo valor de configuración
    if (data[0].locManual && data[0].locManual !== "") {
        el.innerText = data[0].locManual.toUpperCase();
        return;
    }

    // 2. INTENTO: GPS AUTOMÁTICO
    let totalLat = 0, totalLon = 0;
    data.forEach(d => { totalLat += d.lat; totalLon += d.lon; });
    const centerLat = totalLat / data.length;
    const centerLon = totalLon / data.length;

    const defaultText = `${centerLat.toFixed(3)}, ${centerLon.toFixed(3)}`;
    el.innerText = defaultText;

    try {
        const urlOSM = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${centerLat}&lon=${centerLon}&zoom=10&accept-language=eu,es`;
        const response = await fetch(urlOSM, { method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', headers: { 'Accept': 'application/json' } });

        if(response.ok) {
            const json = await response.json();
            const addr = json.address;
            let placeName = addr.city || addr.town || addr.village || addr.municipality || addr.county;
            if (placeName) { el.innerText = placeName.toUpperCase(); return; }
        }
        throw new Error("OSM falló"); 
    } catch (errorOSM) {
        try {
            const urlBackup = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${centerLat}&longitude=${centerLon}&localityLanguage=es`;
            const responseBackup = await fetch(urlBackup, { method: 'GET', mode: 'cors', credentials: 'omit' });
            if(responseBackup.ok) {
                const jsonBackup = await responseBackup.json();
                let placeName = jsonBackup.locality || jsonBackup.city || jsonBackup.principalSubdivision;
                if (placeName) el.innerText = placeName.toUpperCase();
            }
        } catch (errorBackup) { console.error("Fallo GPS", errorBackup); }
    }
}

// ============================================================
// 11. FUNCIONES TABLAS DE DATOS
// ============================================================
function toggleTimelineView() {
    const canvas = document.getElementById('chart-timeline');
    const tableDiv = document.getElementById('table-timeline-view');
    const btnIcon = document.querySelector('#btn-toggle-view i');
    isTableView = !isTableView;
    if (isTableView) {
        canvas.style.display = 'none'; tableDiv.style.display = 'block';
        btnIcon.className = 'fa-solid fa-chart-column'; btnIcon.parentElement.title = "Ver Gráfico";
        renderTimelineTable();
    } else {
        tableDiv.style.display = 'none'; canvas.style.display = 'block';
        btnIcon.className = 'fa-solid fa-table'; btnIcon.parentElement.title = "Ver Datos";
    }
}

function renderTimelineTable() {
    const container = document.getElementById('table-timeline-view');
    if (!tableDataCache || tableDataCache.length === 0) { container.innerHTML = '<p style="padding:20px; text-align:center; color:#888;">Sin datos</p>'; return; }
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
    container.innerHTML = html;
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

function toggleCategoryView() {
    const canvas = document.getElementById('chart-category');
    const tableDiv = document.getElementById('table-category-view');
    const btnIcon = document.querySelector('#btn-toggle-view-cat i');
    isTableCatView = !isTableCatView;
    if (isTableCatView) {
        canvas.style.display = 'none'; tableDiv.style.display = 'block';
        btnIcon.className = 'fa-solid fa-chart-pie'; btnIcon.parentElement.title = "Ver Gráfico";
        renderCategoryTable();
    } else {
        tableDiv.style.display = 'none'; canvas.style.display = 'block';
        btnIcon.className = 'fa-solid fa-table'; btnIcon.parentElement.title = "Ver Datos";
    }
}

function renderCategoryTable() {
    const container = document.getElementById('table-category-view');
    if (!tableCatDataCache || tableCatDataCache.length === 0) { container.innerHTML = '<p style="padding:20px; text-align:center; color:#888;">Sin datos</p>'; return; }
    let html = `<table class="data-table"><thead><tr>
        <th onclick="sortTableCategory('cat')">CATEGORÍA <i class="fa-solid fa-sort"></i></th>
        <th onclick="sortTableCategory('count')">CANTIDAD <i class="fa-solid fa-sort"></i></th>
        <th onclick="sortTableCategory('percent')">% <i class="fa-solid fa-sort"></i></th>
    </tr></thead><tbody>`;
    tableCatDataCache.forEach(row => {
        html += `<tr><td><strong>${row.cat}</strong></td><td style="text-align:right;">${row.count.toLocaleString()}</td><td style="text-align:right;">${row.percent}%</td></tr>`;
    });
    html += `</tbody></table>`;
    container.innerHTML = html;
    updateSortIcons(currentSortCat.col, '#table-category-view', currentSortCat);
}

function sortTableCategory(column) {
    if (currentSortCat.col === column) currentSortCat.dir = currentSortCat.dir === 'asc' ? 'desc' : 'asc';
    else { currentSortCat.col = column; currentSortCat.dir = column === 'cat' ? 'asc' : 'desc'; }
    tableCatDataCache.sort((a, b) => {
        let valA = a[column], valB = b[column];
        if(column === 'percent') { valA = parseFloat(valA); valB = parseFloat(valB); }
        if (valA < valB) return currentSortCat.dir === 'asc' ? -1 : 1;
        if (valA > valB) return currentSortCat.dir === 'asc' ? 1 : -1;
        return 0;
    });
    renderCategoryTable();
}

function updateSortIcons(activeCol, containerSelector, sortObj) {
    const container = document.querySelector(containerSelector);
    if(!container) return;
    const headers = container.querySelectorAll('.data-table th');
    headers.forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
        const icon = th.querySelector('i');
        if(icon) icon.className = 'fa-solid fa-sort';
    });
    for (let th of headers) {
        if (th.getAttribute('onclick') && th.getAttribute('onclick').includes(`'${activeCol}'`)) {
            th.classList.add(sortObj.dir === 'asc' ? 'sorted-asc' : 'sorted-desc');
            const icon = th.querySelector('i');
            if(icon) icon.className = sortObj.dir === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
        }
    }
}