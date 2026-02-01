/**
 * EUROCOP ANALYTICS - MAPA (MapLibre GL JS)
 * Inicialización del mapa, capas de datos (puntos + heatmap + satélite),
 * gestión de capas GeoJSON (upload, toggle, eliminar, efecto flash),
 * y análisis de hotspots inteligente.
 */

// ============================================================
// INICIALIZAR MAPA
// ============================================================
function initMap() {
    if (map) map.remove();

    map = new maplibregl.Map({
        container: 'main-map',
        style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
        center: [-2.63, 43.17],
        zoom: 12,
        preserveDrawingBuffer: true,
        antialias: true
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
        // Capa de satélite (oculta por defecto)
        map.addSource('satellite-tiles', {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256
        });
        map.addLayer({ id: 'satellite-layer', type: 'raster', source: 'satellite-tiles', layout: { visibility: 'none' } });

        // Fuente de datos (puntos del dashboard)
        map.addSource('puntos', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

        // Capa heatmap (oculta por defecto)
        map.addLayer({
            id: 'heat-layer', type: 'heatmap', source: 'puntos',
            layout: { visibility: 'none' },
            paint: { 'heatmap-weight': 1, 'heatmap-intensity': 3, 'heatmap-radius': 20 }
        });

        // Capa de puntos (visible por defecto)
        map.addLayer({
            id: 'point-layer', type: 'circle', source: 'puntos',
            layout: { visibility: 'visible' },
            paint: { 'circle-radius': 6, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff', 'circle-color': '#5e72e4' }
        });

        // Click en punto → popup con info
        map.on('click', 'point-layer', (e) => {
            const p = e.features[0].properties;

            let direccionHtml = "";
            if (p.calle && p.calle !== "SIN CALLE / GPS") {
                const num = (p.numero && p.numero !== "undefined") ? p.numero : "";
                direccionHtml = `<br><span><b>Dirección:</b> ${p.calle} ${num}</span>`;
            }

            new maplibregl.Popup({ offset: 10, maxWidth: '250px' })
                .setLngLat(e.features[0].geometry.coordinates)
                .setHTML(`
                    <div style="padding:5px; font-family:'Inter', sans-serif;">
                        <div style="color:#5e72e4; font-weight:800; font-size:12px; margin-bottom:5px; border-bottom:1px solid #eee;">
                            REF${p.refanno}-${p.refnum}
                        </div>
                        <div style="font-size:11px;">
                            <span><b>Cat:</b> ${p.cat}</span>
                            ${direccionHtml}
                            <br><span><b>Fecha:</b> ${p.fullDate}</span>
                        </div>
                    </div>
                `)
                .addTo(map);
        });
    });
}

// ============================================================
// ACTUALIZAR DATOS DEL MAPA
// ============================================================
function updateMapData(data) {
    const container = document.getElementById('container-map');
    const datosConGeo = data.filter(d => d.hasGeo);

    // Control de visibilidad del contenedor mapa
    const isFilterActive = document.getElementById('chk-spatial-filter')?.checked;
    const hasLayers      = (mapLayers.length > 0);
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

    // Generar GeoJSON con jittering (dispersión visual)
    const factor = 0.0002;
    const geojson = {
        type: 'FeatureCollection',
        features: datosConGeo.map(d => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [
                    d.lon + (Math.random() - 0.5) * factor,
                    d.lat + (Math.random() - 0.5) * factor
                ]
            },
            properties: {
                cat:      d.cat,
                year:     d.year,
                fullDate: d.date.toLocaleString([], {
                    day: 'numeric', month: 'numeric', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                }),
                refnum:   d.refnum,
                refanno:  d.refanno,
                calle:    d.calle,
                numero:   d.numero
            }
        }))
    };

    map.getSource('puntos').setData(geojson);

    // Color sólido rojo para los puntos
    map.setPaintProperty('point-layer', 'circle-color', '#FF3131');
    map.setPaintProperty('point-layer', 'circle-stroke-width', 2.5);
    map.setPaintProperty('point-layer', 'circle-radius', 7);

    // Encuadrar mapa en los datos
    if (datosConGeo.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        datosConGeo.forEach(d => {
            if (!isNaN(d.lon) && !isNaN(d.lat)) bounds.extend([d.lon, d.lat]);
        });
        setTimeout(() => {
            try { map.fitBounds(bounds, { padding: 50, maxZoom: 16, duration: 1000 }); }
            catch (e) { console.warn(e); }
        }, 400);
    }
}

// ============================================================
// TOGGLES DE MAPA
// ============================================================
function toggleSatelite(btn) {
    isSatelite = !isSatelite;
    map.setLayoutProperty('satellite-layer', 'visibility', isSatelite ? 'visible' : 'none');
    btn.style.background = isSatelite ? '#5e72e4' : '';
    btn.style.color      = isSatelite ? '#fff'    : '';
}

function toggleHeatmap(btn) {
    isHeatmap = !isHeatmap;
    map.setLayoutProperty('heat-layer',  'visibility', isHeatmap ? 'visible' : 'none');
    map.setLayoutProperty('point-layer', 'visibility', isHeatmap ? 'none'    : 'visible');
    btn.innerHTML = isHeatmap
        ? '<i class="fa-solid fa-location-dot"></i>'
        : '<i class="fa-solid fa-fire"></i>';
}

function toggle3D() {
    const p = map.getPitch();
    map.easeTo({ pitch: p > 0 ? 0 : 60, bearing: p > 0 ? 0 : -20, duration: 1000 });
}

// ============================================================
// GESTOR DE CAPAS GEOJSON
// ============================================================

// Abrir/cerrar menú de capas
function toggleLayerMenu() {
    const menu = document.getElementById('layers-dropdown');
    menu.classList.toggle('active');
    const btn = document.getElementById('btn-layers-menu');
    btn.style.background = menu.classList.contains('active') ? '#e9ecef' : '';
}

// Subida de archivo GeoJSON (versión final con geojson guardado)
function handleGeojsonUpload(input) {
    const file = input.files[0];
    if (!file) return;

    document.getElementById('loading-overlay').classList.add('active');

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const geojson  = JSON.parse(e.target.result);
            const layerId  = 'layer-' + Date.now();
            const color    = getRandomColor();
            const fileNameClean = file.name.replace(/\.[^/.]+$/, "");

            addLayerToMap(layerId, geojson, color, fileNameClean);

            mapLayers.push({
                id:      layerId,
                name:    fileNameClean,
                visible: true,
                color:   color,
                geojson: geojson   // CRÍTICO: guardamos la geometría para filtro espacial
            });

            renderLayerList();

            // Si el filtro espacial está activo, refrescar
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

// Pintar capa en MapLibre (Relleno + Línea + Click popup)
function addLayerToMap(id, geojson, color, layerName) {
    if (!map) return;

    map.addSource(id, { type: 'geojson', data: geojson });
    const beforeLayer = map.getLayer('point-layer') ? 'point-layer' : null;

    // Capa de relleno (solo Polygons)
    map.addLayer({
        id: id + '-fill', type: 'fill', source: id,
        layout: { visibility: 'visible' },
        paint: { 'fill-color': color, 'fill-opacity': 0.3 },
        filter: ['==', '$type', 'Polygon']
    }, beforeLayer);

    // Capa de línea (Polygons + LineStrings)
    map.addLayer({
        id: id + '-line', type: 'line', source: id,
        layout: { visibility: 'visible', 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': color, 'line-width': 3 },
        filter: ['in', '$type', 'Polygon', 'LineString']
    }, beforeLayer);

    const layerIds = [id + '-fill', id + '-line'];

    // Click unificado para zonas (prioriza puntos de datos)
    map.on('click', (e) => {
        const points = map.queryRenderedFeatures(e.point, { layers: ['point-layer'] });
        if (points.length > 0) return; // Prioridad: puntos de datos

        const features = map.queryRenderedFeatures(e.point, { layers: layerIds });
        if (!features.length) return;

        const p = features[0].properties;
        const nombre      = p.nombre || p.Nombre || "Sin nombre";
        const descripcion = p.descripcion || p.Descripcion || "";

        let htmlContent = `
            <div style="padding:8px; font-family:'Inter', sans-serif; color:#32325d; min-width:120px;">
                <b style="text-transform:uppercase; font-size:13px; display:block; margin-bottom:4px; border-bottom:1px solid #eee; padding-bottom:4px;">
                    ${nombre}
                </b>`;
        if (descripcion) {
            htmlContent += `<span style="font-size:11px; color:#525f7f; display:block; line-height:1.4;">${descripcion}</span>`;
        }
        htmlContent += `</div>`;

        new maplibregl.Popup({ offset: 10 })
            .setLngLat(e.lngLat)
            .setHTML(htmlContent)
            .addTo(map);
    });

    // Cursores
    map.on('mouseenter', id + '-fill', () => {
        const points = map.queryRenderedFeatures(map.project(map.getCenter()), { layers: ['point-layer'] });
        if (points.length === 0) map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', id + '-fill', () => { map.getCanvas().style.cursor = ''; });

    // Zoom automático a los datos de la capa
    try {
        const bounds = new maplibregl.LngLatBounds();
        const extractCoords = (coords) => {
            if (typeof coords[0] === 'number') bounds.extend(coords);
            else coords.forEach(extractCoords);
        };
        geojson.features.forEach(f => { if (f.geometry) extractCoords(f.geometry.coordinates); });
        if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 50, maxZoom: 14 });
    } catch (e) { /* silencioso */ }
}

// Renderizar lista de capas en el panel
function renderLayerList() {
    const container = document.getElementById('layers-list');
    const searchInput = document.getElementById('layer-search');
    const t = translations[currentLang];

    if (mapLayers.length === 0) {
        container.innerHTML = `<p class="empty-layers-msg">${t.map_no_layers}</p>`;
        if (searchInput) { searchInput.style.display = 'none'; searchInput.value = ''; }
        return;
    }

    // Mostrar buscador solo cuando hay capas
    if (searchInput) {
        searchInput.style.display = 'block';
        searchInput.placeholder = t.map_search_layers;
    }

    paintLayerList(mapLayers);
}

// Pintar los items de la lista (se reutiliza desde renderLayerList y filterLayers)
function paintLayerList(layers) {
    const container = document.getElementById('layers-list');
    const t = translations[currentLang];

    container.innerHTML = '';

    if (layers.length === 0) {
        container.innerHTML = `<p class="empty-layers-msg">${t.map_no_layers}</p>`;
        return;
    }

    layers.forEach(layer => {
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

// Filtrar capas por texto (se llama desde oninput del input)
function filterLayers(query) {
    const q = query.trim().toLowerCase();
    const filtered = q === '' ? mapLayers : mapLayers.filter(l => l.name.toLowerCase().includes(q));
    paintLayerList(filtered);
}

// Alternar visibilidad de una capa
function toggleLayer(id) {
    const layerObj = mapLayers.find(l => l.id === id);
    if (!layerObj) return;

    layerObj.visible = !layerObj.visible;
    const val = layerObj.visible ? 'visible' : 'none';

    if (map.getLayer(id + '-fill'))   map.setLayoutProperty(id + '-fill',   'visibility', val);
    if (map.getLayer(id + '-line'))   map.setLayoutProperty(id + '-line',   'visibility', val);
    if (map.getLayer(id + '-circle')) map.setLayoutProperty(id + '-circle', 'visibility', val);

    if (layerObj.visible) flashLayerEffect(id);

    // Recalcular si el filtro espacial está activo
    if (document.getElementById('chk-spatial-filter')?.checked) {
        triggerUpdateWithLoader();
    }
}

// Eliminar una capa
function removeLayer(id) {
    if (!confirm("¿Eliminar esta capa?")) return;

    if (map.getLayer(id + '-fill'))   map.removeLayer(id + '-fill');
    if (map.getLayer(id + '-line'))   map.removeLayer(id + '-line');
    if (map.getLayer(id + '-circle')) map.removeLayer(id + '-circle');
    if (map.getSource(id))            map.removeSource(id);

    mapLayers = mapLayers.filter(l => l.id !== id);
    renderLayerList();

    if (document.getElementById('chk-spatial-filter')?.checked) {
        triggerUpdateWithLoader();
    }
}

// Color aleatorio legible
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) color += letters[Math.floor(Math.random() * 16)];
    return color;
}

// Efecto de parpadeo al activar capa
function flashLayerEffect(id) {
    if (!map) return;

    let count = 0;
    const maxFlashes = 6;
    const speed = 300;

    const interval = setInterval(() => {
        const isHigh = count % 2 === 0;

        if (map.getLayer(id + '-fill'))   map.setPaintProperty(id + '-fill',   'fill-opacity', isHigh ? 0.7 : 0.3);
        if (map.getLayer(id + '-line'))   map.setPaintProperty(id + '-line',   'line-width',   isHigh ? 6 : 3);
        if (map.getLayer(id + '-circle')) {
            map.setPaintProperty(id + '-circle', 'circle-radius',       isHigh ? 12 : 6);
            map.setPaintProperty(id + '-circle', 'circle-stroke-width', isHigh ? 4  : 2);
        }

        count++;
        if (count >= maxFlashes) {
            clearInterval(interval);
            // Estado final normal
            if (map.getLayer(id + '-fill'))   map.setPaintProperty(id + '-fill',   'fill-opacity', 0.3);
            if (map.getLayer(id + '-line'))   map.setPaintProperty(id + '-line',   'line-width',   3);
            if (map.getLayer(id + '-circle')) {
                map.setPaintProperty(id + '-circle', 'circle-radius',       6);
                map.setPaintProperty(id + '-circle', 'circle-stroke-width', 2);
            }
        }
    }, speed);
}

// ============================================================
// FOCUS EN CALLE (desde tabla de calles)
// ============================================================
function focusStreetOnMap(streetName) {
    const points = lastFilteredData.filter(d => d.calle === streetName && d.hasGeo);

    if (points.length === 0) {
        showToast(translations[currentLang].hotspot_no_gps);
        return;
    }

    // 1. Cambiar visibilidad de las vistas
    isTableStreetsView = false;
    document.getElementById('main-map').style.display = 'block';
    document.getElementById('table-streets-view').style.display = 'none';
    
    const btnIcon = document.querySelector('#btn-toggle-streets i');
    if (btnIcon) btnIcon.className = 'fa-solid fa-list-ol';

    // 2. Ejecutar con un pequeño delay para que el contenedor sea visible antes del cálculo
    setTimeout(() => {
        if (map) {
            map.resize(); // Crucial para móviles al cambiar de display:none a block
            
            const bounds = new maplibregl.LngLatBounds();
            points.forEach(p => bounds.extend([p.lon, p.lat]));
            const center = bounds.getCenter();

            map.fitBounds(bounds, { 
                padding: window.innerWidth < 768 ? 40 : 100, // Menos margen en móviles
                maxZoom: 17, 
                duration: 1200 
            });

            // 3. Efecto visual radar
            createRadarEffect(center);
        }
    }, 150); // Tiempo suficiente para que el navegador procese el cambio de CSS
}

// ============================================================
// ANÁLISIS DE HOTSPOTS INTELIGENTE (Grid V3)
// ============================================================
// Variables de control globales
let hotspotTourActive = false;
let hotspotTourTimeout = null;
let hotspotCurrentIndex = 0;
let detectedHotspots = [];

function focusIntelligentHotspot() {
    const btn = document.getElementById('btn-smart-focus');
    
    if (hotspotTourActive) {
        stopHotspotTour();
        return;
    }

    // 1. Limpieza y validación de coordenadas (Aseguramos formato numérico)
    const pointsWithGeo = lastFilteredData
        .filter(d => d.hasGeo && d.lon && d.lat)
        .map(d => ({
            id: d.id || Math.random().toString(36),
            lng: parseFloat(String(d.lon).replace(',', '.')),
            lat: parseFloat(String(d.lat).replace(',', '.'))
        }))
        .filter(d => !isNaN(d.lng) && !isNaN(d.lat));

    if (pointsWithGeo.length < 2) {
        showToast(translations[currentLang].hotspot_insufficient);
        return;
    }

    // 2. CALCULAR EL TOP 3 DE CONCENTRACIONES REALES
    // Radio de búsqueda: 30m | Radio de exclusión: 80m (para que los 3 clusters sean zonas distintas)
    detectedHotspots = getTopClusters(pointsWithGeo, 3, 0.03, 0.08);

    if (detectedHotspots.length === 0) {
        showToast(translations[currentLang].hotspot_no_clusters);
        return;
    }

    // 3. INICIAR TOUR
    hotspotTourActive = true;
    hotspotCurrentIndex = 0;
    btn.classList.add('btn-active-pulse');
    btn.innerHTML = '<i class="fa-solid fa-stop"></i>';
    
    runHotspotTour();
}

/**
 * Calcula el bounding-box de un array de puntos {lng, lat}
 */
function calcBBox(points) {
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    points.forEach(p => {
        if (p.lng < minLng) minLng = p.lng;
        if (p.lng > maxLng) maxLng = p.lng;
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
    });
    return { minLng, maxLng, minLat, maxLat };
}

/**
 * Busca los epicentros de las masas de puntos.
 * 
 * Algoritmo corregido (3 pasos):
 *   1. Puntear TODOS los puntos sobre el conjunto completo (sin eliminar nada).
 *      Cada punto recibe como score la cantidad de vecinos dentro del radio.
 *   2. Ordenar por score descendente → los primeros son los pivotes más densos.
 *   3. Recorrer ese ranking y seleccionar un cluster solo si su pivote no cae
 *      dentro del radio de un cluster ya seleccionado (exclusión espacial).
 *      Como centro se usa el MEDOID (el punto real más cercano al centroide)
 *      en lugar del centroide geométrico, para que el mapa apunte exactamente
 *      al corazón de la concentración.
 */
function getTopClusters(allPoints, limit, radiusKm, excludeKm) {
    // --- paso 1: score global sobre todo el data ---
    const scored = allPoints.map(pivot => {
        const neighbors = allPoints.filter(other => {
            const d = turf.distance([pivot.lng, pivot.lat], [other.lng, other.lat], {units: 'kilometers'});
            return d <= radiusKm;
        });
        return { pivot, neighbors, score: neighbors.length };
    });

    // --- paso 2: ordenar por densidad descendente ---
    scored.sort((a, b) => b.score - a.score);

    // --- paso 3: seleccionar clusters sin superposición ---
    const clusters = [];
    const excludeRadius = excludeKm || radiusKm; // separación mínima entre clusters

    for (const candidate of scored) {
        if (clusters.length >= limit) break;
        if (candidate.score < 2) break; // mínimo 2 puntos para ser zona crítica

        // Verificar que este pivote no cae dentro de un cluster ya aceptado
        const tooClose = clusters.some(c => {
            const d = turf.distance(c.coords, [candidate.pivot.lng, candidate.pivot.lat], {units: 'kilometers'});
            return d < excludeRadius;
        });
        if (tooClose) continue;

        // Calcular centroide geométrico del grupo
        const n = candidate.neighbors.length;
        const cLng = candidate.neighbors.reduce((s, p) => s + p.lng, 0) / n;
        const cLat = candidate.neighbors.reduce((s, p) => s + p.lat, 0) / n;

        // Usar MEDOID: el punto real más cercano al centroide
        let bestDist = Infinity, medoid = [cLng, cLat];
        candidate.neighbors.forEach(p => {
            const d = turf.distance([cLng, cLat], [p.lng, p.lat], {units: 'kilometers'});
            if (d < bestDist) { bestDist = d; medoid = [p.lng, p.lat]; }
        });

        clusters.push({
            coords: medoid,
            count: candidate.score
        });
    }

    return clusters;
}

function runHotspotTour() {
    if (!hotspotTourActive || detectedHotspots.length === 0) return;

    // Resetear índice si los datos cambiaron
    if (hotspotCurrentIndex >= detectedHotspots.length) hotspotCurrentIndex = 0;

    const spot = detectedHotspots[hotspotCurrentIndex];
    
    // Vuelo directo al corazón de la agrupación
    map.flyTo({
        center: spot.coords,
        zoom: 18.5, // Zoom muy cercano para ver los puntos con claridad
        speed: 0.5,
        curve: 1,
        essential: true
    });

    // Crear efecto radar en la ubicación exacta
    createRadarEffect(spot.coords);

    // Aviso
    const icons = ["🥇", "🥈", "🥉"];
    const t = translations[currentLang];
    showMapToast(`${icons[hotspotCurrentIndex] || '📍'} ${t.hotspot_focus}: ${spot.count} ${t.hotspot_points}`);

    // Siguiente paso del tour (6 segundos)
    hotspotCurrentIndex = (hotspotCurrentIndex + 1) % detectedHotspots.length;
    hotspotTourTimeout = setTimeout(runHotspotTour, 6000);
}

function stopHotspotTour() {
    hotspotTourActive = false;
    clearTimeout(hotspotTourTimeout);
    const btn = document.getElementById('btn-smart-focus');
    if (btn) {
        btn.classList.remove('btn-active-pulse');
        btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>';
    }
}

// Método legacy: busca el punto con más vecinos cercanos
function focusIntelligentHotspotLegacy() {
    const pointsWithGeo = lastFilteredData.filter(d => d.hasGeo);
    const collection = pointsWithGeo.map(p => turf.point([p.lon, p.lat]));

    let maxNeighbors   = -1;
    let epicenterCoords = null;
    const searchRadius = 0.15;

    collection.forEach((point, i) => {
        let count = 0;
        collection.forEach((otherPoint, j) => {
            if (i === j) return;
            if (turf.distance(point, otherPoint, { units: 'kilometers' }) <= searchRadius) count++;
        });
        if (count > maxNeighbors) { maxNeighbors = count; epicenterCoords = point.geometry.coordinates; }
    });

    if (epicenterCoords) {
        map.flyTo({ center: epicenterCoords, zoom: 17, speed: 1.2, curve: 1.5, essential: true });
        createRadarEffect(epicenterCoords);

        showMapToast(translations[currentLang].hotspot_epicenter.replace('{count}', maxNeighbors + 1));
    }
}

// Toast interno del mapa (minimalista, dentro del contenedor)
let mapToastTimeout = null;
function showMapToast(message, duration = 5000) {
    const toast = document.getElementById('map-toast');
    if (!toast) return;
    clearTimeout(mapToastTimeout);
    toast.textContent = message;
    toast.classList.add('active');
    mapToastTimeout = setTimeout(() => toast.classList.remove('active'), duration);
}

// Efecto visual radar temporal
function createRadarEffect(coords) {
    const el = document.createElement('div');
    el.className = 'marker-focus-ring';

    const marker = new maplibregl.Marker({ element: el }).setLngLat(coords).addTo(map);

    setTimeout(() => {
        el.style.opacity = "0";
        setTimeout(() => marker.remove(), 1000);
    }, 4000);
}
