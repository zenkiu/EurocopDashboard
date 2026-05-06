/**
 * EUROCOP ANALYTICS - MAPA (MapLibre GL JS)
 * Inicialización del mapa, capas de datos (puntos + heatmap + satélite),
 * gestión de capas GeoJSON (upload, toggle, eliminar, efecto flash),
 * y análisis de hotspots inteligente.
 */

// ============================================================
// INICIALIZAR MAPA
// ============================================================
let currentSearchPopup = null; // Para controlar que solo haya un popup de búsqueda a la vez

// Cerrar panel de resultados de búsqueda
window._closeSearchPanel = function() {
    const panel = document.getElementById('search-results-panel');
    if (panel) { panel.style.display = 'none'; panel.innerHTML = ''; }
    if (currentSearchPopup) { currentSearchPopup = null; }
    clearAllHighlights();
};
let layerSearchTimeout = null;
let lastSearchQuery = '';
let isSearchInputFocused = false;

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
        // Inicializar capas del editor de geometrías
        initDrawLayer();

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

            const direccionRow = (p.calle && p.calle !== "SIN CALLE / GPS")
                ? `<div class="ec-popup-row"><b>Dirección</b>${p.calle}${(p.numero && p.numero !== "undefined") ? ' ' + p.numero : ''}</div>`
                : '';
            new maplibregl.Popup({ offset: 10, maxWidth: '270px' })
                .setLngLat(e.features[0].geometry.coordinates)
                .setHTML(`
                    <div class="ec-popup">
                        <div class="ec-popup-ref">REF: ${p.refanno}-${p.refnum}</div>
                        <div class="ec-popup-body">
                            <div class="ec-popup-row"><b>Cat</b>${p.cat}</div>
                            ${direccionRow}
                            <div class="ec-popup-row"><b>Fecha</b>${p.fullDate}</div>
                        </div>
                    </div>
                `)
                .addTo(map);
        });
    });

    // Inicializar el buscador de capas después de un breve retraso
    setTimeout(() => {
        const searchInput = document.getElementById('layer-search');
        if (searchInput) {
            // Limpiar eventos anteriores
            searchInput.removeEventListener('input', handleSearchInput);
            searchInput.addEventListener('input', handleSearchInput);
            
            // Configurar para mantener el foco
            setupLayerSearchInput();
        }
    }, 500);
    
    // Añadir listener para evitar cierre del menú cuando se escribe
    document.addEventListener('click', function(e) {
        const searchInput = document.getElementById('layer-search');
        if (searchInput && (searchInput === e.target || searchInput.contains(e.target))) {
            // Prevenir que otros eventos cierren el menú
            e.stopPropagation();
        }
    });
}

// Manejador específico para el input
function handleSearchInput(e) {
    searchAndFlyToLayer(this.value);
}

// ============================================================
// ACTUALIZAR DATOS DEL MAPA
// ============================================================
// ============================================================
// ACTUALIZAR DATOS DEL MAPA (CON COLORES POR AÑO)
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
                year:     d.year, // Importante: MapLibre usará esto para el color
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

    // --- NUEVO: LÓGICA DE COLORES POR AÑO ---
    
    // 1. Obtener años únicos y ordenarlos
    const uniqueYears = [...new Set(datosConGeo.map(d => d.year))].sort();

    // 2. Definir paleta de colores (Estilo Dashboard)
    const yearPalette = [
        '#5e72e4', // Azul (Principal)
        '#fb6340', // Naranja
        '#2dce89', // Verde Esmeralda
        '#11cdef', // Cyan
        '#f5365c', // Rojo
        '#8965e0', // Púrpura
        '#ffd600', // Amarillo
        '#32325d', // Azul Oscuro
        '#e74c3c', // Terracota
        '#2ecc71'  // Verde Claro
    ];

    // 3. Construir la expresión 'match' para MapLibre
    // Sintaxis: ['match', ['get', 'year'], año1, color1, año2, color2, color_default]
    let colorExpression = ['match', ['get', 'year']];

    uniqueYears.forEach((year, index) => {
        colorExpression.push(year);
        // Asignar color ciclando la paleta si hay más años que colores
        colorExpression.push(yearPalette[index % yearPalette.length]);
    });

    // Color por defecto (si el año no está en la lista o es null)
    colorExpression.push('#8898aa'); // Gris

    // 4. Aplicar el color dinámico
    map.setPaintProperty('point-layer', 'circle-color', colorExpression);
    
    // Mantener el resto de propiedades estéticas
    map.setPaintProperty('point-layer', 'circle-stroke-width', 2.5);
    map.setPaintProperty('point-layer', 'circle-radius', 7);

    // --- FIN NUEVO ---

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
    const p    = map.getPitch();
    const is3D = p > 0;
    map.easeTo({ pitch: is3D ? 0 : 60, bearing: is3D ? 0 : -20, duration: 1000 });
    const btn = document.getElementById('btn-3d');
    if (btn) {
        btn.style.background = is3D ? '' : '#e9ecef';
        btn.style.color      = is3D ? '' : '#32325d';
    }
}

// ============================================================
// GESTOR DE CAPAS GEOJSON
// ============================================================

// Abrir/cerrar menú de capas
function _closeAllDropdowns() {
    const ld = document.getElementById('layers-dropdown');
    if (ld) ld.classList.remove('active');
    const lBtn = document.getElementById('btn-layers-menu');
    if (lBtn) lBtn.style.background = '';
    const dd = document.getElementById('draw-dropdown');
    if (dd) dd.style.display = 'none';
    const dBtn = document.getElementById('btn-draw-menu');
    if (dBtn) dBtn.classList.remove('active');
}

// Cerrar dropdowns al hacer clic fuera (una sola vez)
if (!window._dropdownOutsideListenerAdded) {
    window._dropdownOutsideListenerAdded = true;
    document.addEventListener('click', (e) => {
        const insideLayers = e.target.closest('.layer-manager-container');
        const insideDraw   = e.target.closest('#draw-dropdown') ||
                             e.target.closest('#btn-draw-menu');
        if (!insideLayers && !insideDraw) {
            const dd = document.getElementById('draw-dropdown');
            const ld = document.getElementById('layers-dropdown');
            if (dd && dd.style.display === 'block') _closeAllDropdowns();
            if (ld && ld.classList.contains('active')) {
                // solo cerrar layers si el clic fue fuera del layer container
                if (!e.target.closest('.layer-manager-container')) {
                    ld.classList.remove('active');
                    const lBtn = document.getElementById('btn-layers-menu');
                    if (lBtn) lBtn.style.background = '';
                }
            }
        }
    });
}

function toggleLayerMenu() {
    const menu = document.getElementById('layers-dropdown');
    const isOpen = menu.classList.contains('active');
    _closeAllDropdowns();
    if (!isOpen) {
        menu.classList.add('active');
        const btn = document.getElementById('btn-layers-menu');
        if (btn) btn.style.background = '#e9ecef';
        setTimeout(() => {
            const searchInput = document.getElementById('layer-search');
            if (searchInput && searchInput.style.display !== 'none') {
                searchInput.focus();
                isSearchInputFocused = true;
            }
        }, 50);
    } else {
        isSearchInputFocused = false;
    }
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
            const color    = getRandomColor(); // Color base por si el feature no tiene uno
            const fileNameClean = file.name.replace(/\.[^/.]+$/, "");

            // Llamamos a la función mejorada que respeta propiedades individuales
            addLayerToMap(layerId, geojson, color, fileNameClean);

            mapLayers.push({
                id:      layerId,
                name:    fileNameClean,
                visible: true,
                color:   color,
                geojson: geojson 
            });

            renderLayerList();

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
// Pintar capa en MapLibre (Relleno + Línea + Puntos + Popups con Foto)
// Variable global para controlar el popup de hover y evitar duplicados
let hoverPopup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: 15
});

function addLayerToMap(id, geojson, color, layerName) {
    if (!map) return;

    map.addSource(id, { type: 'geojson', data: geojson });
    const beforeLayer = map.getLayer('point-layer') ? 'point-layer' : null;

    // Capa de relleno (Polígonos)
    map.addLayer({
        id: id + '-fill', type: 'fill', source: id,
        layout: { visibility: 'visible' },
        paint: { 
            'fill-color': ['coalesce', ['get', '_color'], color], 
            'fill-opacity': 0.3 
        },
        filter: ['==', '$type', 'Polygon']
    }, beforeLayer);

    // Capa de línea (Bordes)
    map.addLayer({
        id: id + '-line', type: 'line', source: id,
        layout: { visibility: 'visible', 'line-join': 'round', 'line-cap': 'round' },
        paint: { 
            'line-color': ['coalesce', ['get', '_color'], color], 
            'line-width': 2 
        },
        filter: ['in', '$type', 'Polygon', 'LineString']
    }, beforeLayer);

    // Capa de círculos (Puntos)
    map.addLayer({
        id: id + '-circle', type: 'circle', source: id,
        layout: { visibility: 'visible' },
        paint: {
            'circle-color': ['coalesce', ['get', '_color'], color],
            'circle-radius': 6,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff'
        },
        filter: ['==', '$type', 'Point']
    }, beforeLayer);

    // Definimos qué capas activan el hover
    const interactiveLayers = [id + '-fill', id + '-circle'];

    interactiveLayers.forEach(layerId => {
        // Cuando el mouse entra en el área
        map.on('mouseenter', layerId, (e) => {
            map.getCanvas().style.cursor = 'pointer';
            
            const props = e.features[0].properties;
            // Si el objeto no tiene nombre ni descripción, no mostramos nada
            if (!props.nombre && !props.Nombre && !props.descripcion) return;

            const html = _buildLayerPopupHTML(props);
            
            hoverPopup.setLngLat(e.lngLat)
                      .setHTML(html)
                      .addTo(map);
        });

        // Mientras el mouse se mueve dentro del área (el popup sigue al cursor)
        map.on('mousemove', layerId, (e) => {
            if (hoverPopup.isOpen()) {
                hoverPopup.setLngLat(e.lngLat);
            }
        });

        // Cuando el mouse sale del área
        map.on('mouseleave', layerId, () => {
            map.getCanvas().style.cursor = '';
            hoverPopup.remove();
        });
    });

    // Ajustar vista a los datos cargados
    try {
        const bounds = new maplibregl.LngLatBounds();
        const extractCoords = (coords) => {
            if (typeof coords[0] === 'number') bounds.extend(coords);
            else coords.forEach(extractCoords);
        };
        geojson.features.forEach(f => { if (f.geometry) extractCoords(f.geometry.coordinates); });
        if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 50, maxZoom: 15 });
    } catch (e) {}
}

// Renderizar lista de capas en el panel
function renderLayerList() {
    const container = document.getElementById('layers-list');
    const searchInput = document.getElementById('layer-search');
    const t = translations[currentLang];

    if (mapLayers.length === 0) {
        container.innerHTML = `<p class="empty-layers-msg">${t.map_no_layers}</p>`;
        if (searchInput) { 
            searchInput.style.display = 'none'; 
            searchInput.value = ''; 
        }
        return;
    }

    // Mostrar buscador solo cuando hay capas
    if (searchInput) {
        searchInput.style.display = 'block';
        searchInput.placeholder = t.map_search_layers;
        // Restaurar valor si ya había una búsqueda
        if (lastSearchQuery) {
            searchInput.value = lastSearchQuery;
        }
    }

    container.innerHTML = '';
    mapLayers.forEach(layer => {
        const div = document.createElement('div');
        div.className = 'layer-item';
        div.innerHTML = `
            <span class="layer-color-indicator" style="background:${layer.color}"></span>
            <input type="checkbox" ${layer.visible ? 'checked' : ''} onchange="toggleLayer('${layer.id}')" class="layer-checkbox">
            <span class="layer-name" title="${layer.name}">${layer.name}</span>
            <button class="btn-remove-layer" onclick="removeLayer('${layer.id}')"><i class="fa-solid fa-trash"></i></button>
        `;
        container.appendChild(div);
    });
    
    // Configurar el input para mantener el foco
    setupLayerSearchInput();
    
    // Si hay texto en el buscador, enfocarlo automáticamente
    if (searchInput && searchInput.value) {
        setTimeout(() => {
            searchInput.focus();
            // Colocar el cursor al final del texto
            searchInput.selectionStart = searchInput.selectionEnd = searchInput.value.length;
        }, 100);
    }
}
//********************* */
// Buscar zona por nombre/descripción dentro de features y navegar con flyTo + flash + popup
function searchAndFlyToLayer(query) {
    if (!map) return;
    
    const q = query.trim().toLowerCase();
    lastSearchQuery = q;
    
    // Limpiar búsqueda anterior inmediatamente
    if (q === '') {
        if (currentSearchPopup) currentSearchPopup.remove();
        // También limpiar cualquier efecto de resaltado anterior
        clearAllHighlights();
        return;
    }
    
    // Cancelar timeout anterior
    clearTimeout(layerSearchTimeout);
    
    // Usar un timeout más corto para mejor respuesta
    layerSearchTimeout = setTimeout(() => {
        // Verificar que la consulta no haya cambiado durante el timeout
        if (query.trim().toLowerCase() !== lastSearchQuery) return;
        
        performLayerSearch(q);
    }, 200);
}

function performLayerSearch(query) {
    if (!map) return;
    
    let foundFeatures = []; 
    const q = query.toLowerCase().trim();
    const searchTerms = q.split(' ').filter(term => term.length > 0);
    
    // --- 1. Buscar en Capas Cargadas (Archivos GeoJSON subidos) ---
    for (const layer of mapLayers) {
        if (!layer.geojson || !layer.geojson.features) continue;
        
        for (const feature of layer.geojson.features) {
            const props = feature.properties || {};
            if (Object.keys(props).length === 0) continue; // Saltar si no tiene propiedades

            // Unimos nombre y descripción para la búsqueda
            const nombre = (props.nombre || props.Nombre || props.name || '').toLowerCase();
            const descripcion = (props.descripcion || props.Descripcion || '').toLowerCase();
            const contenidoBusqueda = nombre + " " + descripcion;

            const matches = searchTerms.every(term => contenidoBusqueda.includes(term));
            
            if (matches) {
                foundFeatures.push({
                    feature: feature,
                    layer: layer,
                    sourceType: 'uploaded'
                });
            }
        }
    }

    // --- 2. Buscar en el Editor de Geometrías (Dibujos hechos a mano o cargados ahí) ---
    if (typeof drawFeatures !== 'undefined') {
        for (const feature of drawFeatures) {
            const props = feature.properties || {};
            const nombre = (props.nombre || '').toLowerCase();
            const descripcion = (props.descripcion || '').toLowerCase();
            const contenidoBusqueda = nombre + " " + descripcion;

            const matches = searchTerms.every(term => contenidoBusqueda.includes(term));
            
            if (matches) {
                foundFeatures.push({
                    feature: feature,
                    sourceType: 'editor'
                });
            }
        }
    }
    
    if (foundFeatures.length === 0) {
        // Opcional: mostrar un aviso de "No encontrado"
        if (currentSearchPopup) currentSearchPopup.remove();
        return;
    }
    
    renderSearchResults(foundFeatures);
}
// ... funciones anteriores de búsqueda ...

// Pégalo aquí, después de performLayerSearch
window._flyToSearchResult = (idx) => {
    const foundFeatures = window._currentFoundFeatures;
    if (!foundFeatures || !foundFeatures[idx]) return;
    
    const item = foundFeatures[idx];
    const fb = new maplibregl.LngLatBounds();
    const extract = (c) => {
        if (typeof c[0] === 'number') fb.extend(c);
        else c.forEach(extract);
    };
    if (item.feature.geometry) extract(item.feature.geometry.coordinates);

    // Efecto visual de pulso
    _pulseFeature(item);

    // Mostrar popup automáticamente al encontrarlo
    const html = _buildLayerPopupHTML(item.feature.properties);
    new maplibregl.Popup({ offset: 10 })
        .setLngLat(fb.getCenter())
        .setHTML(html)
        .addTo(map);

    if (!fb.isEmpty()) {
        map.fitBounds(fb, { padding: 100, maxZoom: 18, duration: 900, essential: true });
    }
};

// ... resto de funciones ...
// Función auxiliar para mostrar los resultados en el panel
function renderSearchResults(foundFeatures) {
    if (currentSearchPopup) currentSearchPopup.remove();
    clearAllHighlights();

    const bounds = new maplibregl.LngLatBounds();
    
    // Función para obtener el centro de una geometría
    const getCentroid = (geometry) => {
        const coords = [];
        const extract = (c) => {
            if (typeof c[0] === 'number') { coords.push(c); bounds.extend(c); }
            else c.forEach(extract);
        };
        if (geometry) extract(geometry.coordinates);
        if (!coords.length) return null;
        return [
            coords.reduce((s, c) => s + c[0], 0) / coords.length,
            coords.reduce((s, c) => s + c[1], 0) / coords.length
        ];
    };

    foundFeatures.forEach(item => { item.centroid = getCentroid(item.feature.geometry); });

    // Zoom para ver todos los resultados
    if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 80, maxZoom: 17, duration: 1000 });
    }

    // Resaltar en el mapa
    flashAllFoundFeatures(foundFeatures);

    // Crear el HTML del panel de resultados
    let htmlContent = `
        <div style="font-family:'Inter',sans-serif; color:#32325d; min-width:220px;">
            <div style="font-weight:800; font-size:11px; text-transform:uppercase; color:#8898aa; margin-bottom:10px; border-bottom:2px solid #5e72e4; padding-bottom:5px;">
                ✦ ${foundFeatures.length} Resultado(s)
            </div>
            <div style="max-height:250px; overflow-y:auto;">`;

    foundFeatures.forEach((item, index) => {
        const nombre = item.feature.properties.nombre || "Sin nombre";
        const desc = item.feature.properties.descripcion || "";
        const tipo = item.sourceType === 'editor' ? '✏️' : '📂';

        htmlContent += `
            <div onclick="window._flyToSearchResult(${index})" 
                 style="margin-bottom:8px; padding:8px; border-radius:6px; cursor:pointer; background:#f8f9ff; border:1px solid #e2e8f0;">
                <div style="font-weight:700; font-size:12px; color:#5e72e4;">${tipo} ${nombre}</div>
                ${desc ? `<div style="font-size:10px; color:#8898aa;">${desc}</div>` : ''}
            </div>`;
    });

    htmlContent += `</div></div>`;
    window._currentFoundFeatures = foundFeatures;

    const panel = document.getElementById('search-results-panel');
    if (panel) {
        panel.innerHTML = `<button onclick="window._closeSearchPanel()" style="position:absolute; top:5px; right:5px; border:none; background:none; cursor:pointer; color:#8898aa;">✕</button>${htmlContent}`;
        panel.style.display = 'block';
        currentSearchPopup = { remove: () => { panel.style.display = 'none'; } };
    }
}

// Pulso visual temporal en una feature seleccionada del popup
function _pulseFeature(item) {
    if (!map || !item || !item.layer) return;
    const fillLayer = item.layer.id + '-fill';
    const lineLayer = item.layer.id + '-line';
    if (!map.getLayer(fillLayer)) return;

    // Flash rápido: blanco → naranja → color resaltado
    map.setPaintProperty(fillLayer, 'fill-color', '#ffffff');
    map.setPaintProperty(fillLayer, 'fill-opacity', 0.95);
    if (map.getLayer(lineLayer)) {
        map.setPaintProperty(lineLayer, 'line-color', '#ff6b35');
        map.setPaintProperty(lineLayer, 'line-width', 6);
    }
    setTimeout(() => {
        if (!map.getLayer(fillLayer)) return;
        map.setPaintProperty(fillLayer, 'fill-color', '#ff6b35');
        map.setPaintProperty(fillLayer, 'fill-opacity', 0.75);
        setTimeout(() => {
            if (!map.getLayer(fillLayer)) return;
            map.setPaintProperty(fillLayer, 'fill-color', '#FFD700');
            map.setPaintProperty(fillLayer, 'fill-opacity', 0.8);
            if (map.getLayer(lineLayer)) {
                map.setPaintProperty(lineLayer, 'line-color', '#FFD700');
                map.setPaintProperty(lineLayer, 'line-width', 5);
            }
        }, 250);
    }, 120);
}

// Limpiar todos los resaltados anteriores
function clearAllHighlights() {
    if (!map) return;
    
    mapLayers.forEach(layer => {
        const fillLayer = layer.id + '-fill';
        const lineLayer = layer.id + '-line';
        
        if (map.getLayer(fillLayer)) {
            // Restaurar filtro original
            map.setFilter(fillLayer, ["all"]);
            // Restaurar color original
            map.setPaintProperty(fillLayer, 'fill-color', layer.color);
            map.setPaintProperty(fillLayer, 'fill-opacity', 0.3);
        }
        
        if (map.getLayer(lineLayer)) {
            map.setPaintProperty(lineLayer, 'line-color', layer.color);
            map.setPaintProperty(lineLayer, 'line-width', 3);
        }
    });
}

// Resaltar todas las features encontradas
function flashAllFoundFeatures(foundItems) {
    if (!map || !foundItems.length) return;
    
    foundItems.forEach(item => {
        let layerId = "";
        if (item.sourceType === 'uploaded') {
            layerId = item.layer.id + '-fill';
        } else {
            layerId = 'draw-polygon-fill'; // Capa por defecto del editor
        }

        if (map.getLayer(layerId)) {
            map.setPaintProperty(layerId, 'fill-color', '#FFD700');
            map.setPaintProperty(layerId, 'fill-opacity', 0.8);
            
            // Restaurar después de 3 segundos
            setTimeout(() => {
                if (map.getLayer(layerId)) {
                    const originalColor = item.layer ? item.layer.color : (item.feature.properties._color || '#5e72e4');
                    map.setPaintProperty(layerId, 'fill-color', originalColor);
                    map.setPaintProperty(layerId, 'fill-opacity', 0.3);
                }
            }, 3000);
        }
    });
}

// Asegurar que el input mantenga el foco - VERSIÓN ROBUSTA
function setupLayerSearchInput() {
    const searchInput = document.getElementById('layer-search');
    if (!searchInput) return;
    
    // Limpiar cualquier evento duplicado
    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);
    
    // Obtener la nueva referencia
    const freshSearchInput = document.getElementById('layer-search');
    
    // Configurar eventos desde cero
    freshSearchInput.addEventListener('input', function(e) {
        searchAndFlyToLayer(this.value);
    });
    
    freshSearchInput.addEventListener('focus', function() {
        isSearchInputFocused = true;
        // Asegurar que el menú esté abierto
        const menu = document.getElementById('layers-dropdown');
        if (menu && !menu.classList.contains('active')) {
            menu.classList.add('active');
            const btn = document.getElementById('btn-layers-menu');
            if (btn) btn.style.background = '#e9ecef';
        }
    });
    
    freshSearchInput.addEventListener('blur', function(e) {
        // Pequeño retraso para verificar si realmente debemos perder el foco
        setTimeout(() => {
            const menu = document.getElementById('layers-dropdown');
            // Solo perder foco si el menú está cerrado
            if (menu && !menu.classList.contains('active')) {
                isSearchInputFocused = false;
            } else if (document.activeElement !== freshSearchInput && 
                      !(e.relatedTarget && e.relatedTarget.classList.contains('layer-checkbox'))) {
                // Si no estamos enfocando otro elemento del menú, recuperar el foco
                freshSearchInput.focus();
            }
        }, 10);
    });
    
    freshSearchInput.addEventListener('click', function(e) {
        e.stopPropagation();
    });
    
    freshSearchInput.addEventListener('mousedown', function(e) {
        e.stopPropagation();
    });
    
    // Prevenir que Escape cierre el menú
    freshSearchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            // Solo limpiar el texto
            this.value = '';
            searchAndFlyToLayer('');
            e.stopPropagation();
        }
    });
    
    // Restaurar el valor si existía
    if (lastSearchQuery) {
        freshSearchInput.value = lastSearchQuery;
    }
}

// Función antigua modificada para uso específico (si aún se usa en otro lugar)
function flashSpecificFeature(layerId, featureName) {
    if (!map) return;
    
    const fillLayer = layerId + '-fill';
    const lineLayer = layerId + '-line';
    
    // Guardamos los filtros originales para restaurarlos luego
    const originalFilter = map.getFilter(fillLayer) || ["all"];
    
    let count = 0;
    const maxFlashes = 8;
    
    const interval = setInterval(() => {
        const isHigh = count % 2 === 0;
        
        if (isHigh) {
            // Aplicamos un filtro temporal para que la capa SOLO pinte el elemento buscado
            const highlightFilter = ["all", originalFilter, ["any", 
                ["==", ["get", "nombre"], featureName], 
                ["==", ["get", "Nombre"], featureName]
            ]];
            
            map.setPaintProperty(fillLayer, 'fill-color', '#FFD700');
            map.setPaintProperty(fillLayer, 'fill-opacity', 0.8);
            map.setFilter(fillLayer, highlightFilter);
            
            if (map.getLayer(lineLayer)) {
                map.setPaintProperty(lineLayer, 'line-color', '#FFD700');
                map.setPaintProperty(lineLayer, 'line-width', 5);
            }
        } else {
            // Restauramos color y filtro original en el parpadeo
            const layerObj = mapLayers.find(l => l.id === layerId);
            map.setPaintProperty(fillLayer, 'fill-color', layerObj ? layerObj.color : '#5e72e4');
            map.setPaintProperty(fillLayer, 'fill-opacity', 0.3);
            map.setFilter(fillLayer, originalFilter);
            
            if (map.getLayer(lineLayer)) {
                map.setPaintProperty(lineLayer, 'line-color', layerObj ? layerObj.color : '#5e72e4');
                map.setPaintProperty(lineLayer, 'line-width', 3);
            }
        }
        
        count++;
        if (count >= maxFlashes) {
            clearInterval(interval);
            // Restauración final
            const layerObj = mapLayers.find(l => l.id === layerId);
            map.setFilter(fillLayer, originalFilter);
            if (layerObj) {
                map.setPaintProperty(fillLayer, 'fill-color', layerObj.color);
                if (map.getLayer(lineLayer)) {
                    map.setPaintProperty(lineLayer, 'line-color', layerObj.color);
                }
            }
            map.setPaintProperty(fillLayer, 'fill-opacity', 0.3);
            if (map.getLayer(lineLayer)) {
                map.setPaintProperty(lineLayer, 'line-width', 3);
            }
        }
    }, 250);
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
                padding: window.innerWidth < 769 ? 40 : 100, // Menos margen en móviles
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
// ═══════════════════════════════════════════════════════════════════════════
// EDITOR DE GEOMETRÍAS — FncMapa.js
// Puntos informativos, polígonos, líneas y círculos
// Guardado/carga en .geojson
// ═══════════════════════════════════════════════════════════════════════════

const DRAW_SOURCE = 'draw-source';
const DRAW_LAYERS = {
    polygon_fill  : 'draw-polygon-fill',
    polygon_line  : 'draw-polygon-line',
    line          : 'draw-line',
    point         : 'draw-point',
    point_label   : 'draw-point-label',
    circle_fill   : 'draw-circle-fill',
    circle_line   : 'draw-circle-line',
    preview       : 'draw-preview',
    preview_point : 'draw-preview-point',
};

let drawMode        = null;   // 'point'|'polygon'|'line'|'circle'|null
let drawFeatures    = [];     // GeoJSON features guardadas
let drawTempCoords  = [];     // coords en construcción
let drawCircleCenter= null;   // centro del círculo
let _drawMapListeners = {};   // handlers del mapa registrados

// ── Inicializar source y layers del editor ───────────────────────────────
function initDrawLayer() {
    if (!map || map.getSource(DRAW_SOURCE)) return;

    map.addSource(DRAW_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
    });

    // Polígono relleno
    map.addLayer({ id: DRAW_LAYERS.polygon_fill, type: 'fill', source: DRAW_SOURCE,
        filter: ['==', ['get', '_type'], 'polygon'],
        paint: { 'fill-color': ['get', '_color'], 'fill-opacity': 0.3 }
    });
    // Polígono borde
    map.addLayer({ id: DRAW_LAYERS.polygon_line, type: 'line', source: DRAW_SOURCE,
        filter: ['==', ['get', '_type'], 'polygon'],
        paint: { 'line-color': ['get', '_color'], 'line-width': 2.5 }
    });
    // Línea
    map.addLayer({ id: DRAW_LAYERS.line, type: 'line', source: DRAW_SOURCE,
        filter: ['==', ['get', '_type'], 'line'],
        paint: { 'line-color': ['get', '_color'], 'line-width': 3 }
    });
    // Círculo relleno
    map.addLayer({ id: DRAW_LAYERS.circle_fill, type: 'fill', source: DRAW_SOURCE,
        filter: ['==', ['get', '_type'], 'circle'],
        paint: { 'fill-color': ['get', '_color'], 'fill-opacity': 0.25 }
    });
    // Círculo borde
    map.addLayer({ id: DRAW_LAYERS.circle_line, type: 'line', source: DRAW_SOURCE,
        filter: ['==', ['get', '_type'], 'circle'],
        paint: { 'line-color': ['get', '_color'], 'line-width': 2.5 }
    });
    // Punto
    map.addLayer({ id: DRAW_LAYERS.point, type: 'circle', source: DRAW_SOURCE,
        filter: ['==', ['get', '_type'], 'point'],
        paint: {
            'circle-color': ['get', '_color'],
            'circle-radius': 8,
            'circle-stroke-width': 2,
            'circle-stroke-color': 'white'
        }
    });
    // Etiqueta punto
    map.addLayer({ id: DRAW_LAYERS.point_label, type: 'symbol', source: DRAW_SOURCE,
        filter: ['all', ['==', ['get', '_type'], 'point'], ['!=', ['get', 'nombre'], '']],
        layout: {
            'text-field': ['get', 'nombre'],
            'text-offset': [0, 1.4],
            'text-anchor': 'top',
            'text-size': 12,
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold']
        },
        paint: { 'text-color': '#32325d', 'text-halo-color': 'white', 'text-halo-width': 1.5 }
    });
    // Capa de preview (dibujo en curso)
    map.addLayer({ id: DRAW_LAYERS.preview, type: 'line', source: DRAW_SOURCE,
        filter: ['==', ['get', '_type'], 'preview'],
        paint: { 'line-color': '#5e72e4', 'line-width': 2, 'line-dasharray': [2, 2] }
    });
    map.addLayer({ id: DRAW_LAYERS.preview_point, type: 'circle', source: DRAW_SOURCE,
        filter: ['==', ['get', '_type'], 'preview_pt'],
        paint: { 'circle-color': '#5e72e4', 'circle-radius': 5, 'circle-stroke-width': 2, 'circle-stroke-color': 'white' }
    });

    // Hover popup para puntos
    initDrawHoverPopup();

    // Click en feature existente → editar
    [DRAW_LAYERS.polygon_fill, DRAW_LAYERS.line, DRAW_LAYERS.circle_fill, DRAW_LAYERS.point].forEach(layer => {
        map.on('click', layer, (e) => {
            if (drawMode) return; // en modo dibujo no editar
            const f = e.features[0];
            if (f) showEditPanel(f.properties._id);
            e.stopPropagation();
        });
        map.on('mouseenter', layer, () => { if (!drawMode) map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layer, () => { if (!drawMode) map.getCanvas().style.cursor = ''; });
    });
}

// ── Actualizar source con features + preview ─────────────────────────────
function refreshDrawSource(previewCoords, circleRadius) {
    if (!map || !map.getSource(DRAW_SOURCE)) return;

    const all = [...drawFeatures];

    // Preview en construcción
    if (drawMode && drawTempCoords.length > 0) {
        if (drawMode === 'polygon' && drawTempCoords.length >= 2) {
            all.push({ type: 'Feature', properties: { _type: 'preview' },
                geometry: { type: 'LineString', coordinates: [...drawTempCoords, drawTempCoords[0]] }
            });
        } else if (drawMode === 'line' && drawTempCoords.length >= 2) {
            all.push({ type: 'Feature', properties: { _type: 'preview' },
                geometry: { type: 'LineString', coordinates: drawTempCoords }
            });
        } else if (drawMode === 'circle' && drawCircleCenter && circleRadius > 0) {
            all.push({ type: 'Feature', properties: { _type: 'preview' },
                geometry: _circleGeometry(drawCircleCenter, circleRadius)
            });
        }
        // Puntos intermedios
        drawTempCoords.forEach(c => {
            all.push({ type: 'Feature', properties: { _type: 'preview_pt' },
                geometry: { type: 'Point', coordinates: c }
            });
        });
    }

    map.getSource(DRAW_SOURCE).setData({ type: 'FeatureCollection', features: all });
}

// ── Generar polígono círculo aproximado ──────────────────────────────────
function _circleGeometry(center, radiusKm, steps = 64) {
    const coords = [];
    for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * 2 * Math.PI;
        const dx = radiusKm / (111.32 * Math.cos(center[1] * Math.PI / 180));
        const dy = radiusKm / 110.574;
        coords.push([center[0] + dx * Math.cos(angle), center[1] + dy * Math.sin(angle)]);
    }
    return { type: 'Polygon', coordinates: [coords] };
}

// ── Modo de dibujo ───────────────────────────────────────────────────────
function setDrawMode(mode) {
    if (!map) return;
    initDrawLayer();
    stopDrawMode(false); // limpiar anterior sin resetear UI
    drawMode = mode;
    drawTempCoords = [];
    drawCircleCenter = null;

    map.getCanvas().style.cursor = 'crosshair';
    document.getElementById('draw-btn-stop').style.display = 'block';

    const msgs = {
        point:   '📍 Clic en el mapa para colocar un punto',
        polygon: '🔷 Clic para añadir vértices · Doble clic para cerrar',
        line:    '📏 Clic para añadir puntos · Doble clic para terminar',
        circle:  '⭕ Clic para el centro · Segundo clic para el radio'
    };
    setDrawStatus(msgs[mode] || '');

    // Destacar botón activo
    ['point','polygon','line','circle'].forEach(m => {
        const btn = document.getElementById('draw-btn-' + m);
        if (btn) btn.classList.toggle('draw-tool-active', m === mode);
    });

    // Registrar handlers
    _drawMapListeners.click = (e) => onDrawClick(e);
    _drawMapListeners.dblclick = (e) => onDrawDblClick(e);
    _drawMapListeners.mousemove = (e) => onDrawMouseMove(e);
    map.on('click', _drawMapListeners.click);
    map.on('dblclick', _drawMapListeners.dblclick);
    map.on('mousemove', _drawMapListeners.mousemove);
    map.doubleClickZoom.disable();
}

function stopDrawMode(resetUI = true) {
    if (_drawMapListeners.click)     map.off('click',     _drawMapListeners.click);
    if (_drawMapListeners.dblclick)  map.off('dblclick',  _drawMapListeners.dblclick);
    if (_drawMapListeners.mousemove) map.off('mousemove', _drawMapListeners.mousemove);
    _drawMapListeners = {};
    map.getCanvas().style.cursor = '';
    map.doubleClickZoom.enable();
    drawMode = null;
    drawTempCoords = [];
    drawCircleCenter = null;
    if (resetUI) {
        ['point','polygon','line','circle'].forEach(m => {
            const btn = document.getElementById('draw-btn-' + m);
            if (btn) btn.classList.remove('draw-tool-active');
        });
        const stopBtn = document.getElementById('draw-btn-stop');
        if (stopBtn) stopBtn.style.display = 'none';
        setDrawStatus(_td('map_draw_hint'));
        refreshDrawSource();
    }
}

function onDrawClick(e) {
    const coords = [e.lngLat.lng, e.lngLat.lat];

    if (drawMode === 'point') {
        const id = 'pt_' + Date.now();
        drawFeatures.push({
            type: 'Feature',
            properties: { _id: id, _type: 'point', _color: '#e74c3c',
                nombre: '', descripcion: '', imagen: '' },
            geometry: { type: 'Point', coordinates: coords }
        });
        refreshDrawSource();
        stopDrawMode();
        setTimeout(() => showEditPanel(id), 100);
        return;
    }

    if (drawMode === 'circle') {
        if (!drawCircleCenter) {
            drawCircleCenter = coords;
            drawTempCoords = [coords]; // para que mousemove funcione
            setDrawStatus('⭕ Ahora clic para definir el radio');
        } else {
            const R = 6371;
            const dLat = (coords[1] - drawCircleCenter[1]) * Math.PI / 180;
            const dLon = (coords[0] - drawCircleCenter[0]) * Math.PI / 180;
            const a = Math.sin(dLat/2)**2 + Math.cos(drawCircleCenter[1]*Math.PI/180)
                * Math.cos(coords[1]*Math.PI/180) * Math.sin(dLon/2)**2;
            const radiusKm = Math.max(0.01, R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
            const radiusM = Math.round(radiusKm * 1000);
            const id = 'circ_' + Date.now();
            drawFeatures.push({
                type: 'Feature',
                properties: { _id: id, _type: 'circle', _color: '#9b59b6',
                    nombre: '', descripcion: '',
                    _center: drawCircleCenter, _radiusKm: radiusKm, _radiusM: radiusM },
                geometry: _circleGeometry(drawCircleCenter, radiusKm)
            });
            refreshDrawSource();
            stopDrawMode();
            setTimeout(() => showEditPanel(id), 100);
        }
        return;
    }

    // polygon / line: añadir vértice
    drawTempCoords.push(coords);
    refreshDrawSource();
}

function onDrawDblClick(e) {
    e.preventDefault();
    const coords = [e.lngLat.lng, e.lngLat.lat];
    drawTempCoords.push(coords);

    if (drawMode === 'polygon' && drawTempCoords.length >= 3) {
        const id = 'poly_' + Date.now();
        const ring = [...drawTempCoords, drawTempCoords[0]];
        drawFeatures.push({
            type: 'Feature',
            properties: { _id: id, _type: 'polygon', _color: '#2ecc71',
                nombre: '', descripcion: '' },
            geometry: { type: 'Polygon', coordinates: [ring] }
        });
        drawTempCoords = [];
        refreshDrawSource();
        stopDrawMode();
        setTimeout(() => showEditPanel(id), 100);
    } else if (drawMode === 'line' && drawTempCoords.length >= 2) {
        const id = 'line_' + Date.now();
        drawFeatures.push({
            type: 'Feature',
            properties: { _id: id, _type: 'line', _color: '#e67e22',
                nombre: '', descripcion: '' },
            geometry: { type: 'LineString', coordinates: drawTempCoords }
        });
        drawTempCoords = [];
        refreshDrawSource();
        stopDrawMode();
        setTimeout(() => showEditPanel(id), 100);
    }
}

function onDrawMouseMove(e) {
    if (!drawMode || drawTempCoords.length === 0) return;
    const cur = [e.lngLat.lng, e.lngLat.lat];

    if (drawMode === 'circle' && drawCircleCenter) {
        const R = 6371;
        const dLat = (cur[1] - drawCircleCenter[1]) * Math.PI / 180;
        const dLon = (cur[0] - drawCircleCenter[0]) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(drawCircleCenter[1]*Math.PI/180)
            * Math.cos(cur[1]*Math.PI/180) * Math.sin(dLon/2)**2;
        const r = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        refreshDrawSource(null, r);
    } else {
        const preview = [...drawTempCoords, cur];
        refreshDrawSource(preview);
    }
}

// ── Panel de edición de propiedades ──────────────────────────────────────
function showEditPanel(featureId) {
    const f = drawFeatures.find(x => x.properties._id === featureId);
    if (!f) return;
    const p = f.properties;
    const isPoint = p._type === 'point';
    const panel = document.getElementById('draw-feature-panel');
    if (!panel) return;

    const typeLabels = { point:_td('map_draw_point'), polygon:_td('map_draw_polygon'), line:_td('map_draw_line'), circle:_td('map_draw_circle') };
    const typeIcons  = { point:'location-dot', polygon:'draw-polygon', line:'minus', circle:'circle' };
    const colorOpts  = ['#e74c3c','#e67e22','#2ecc71','#3498db','#9b59b6','#1abc9c','#f1c40f','#e91e63','#607d8b'];

    panel.innerHTML = `
    <div style="font-family:Arial,sans-serif;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <span style="font-weight:800;font-size:0.88rem;color:#32325d;">
                <i class="fa-solid fa-${typeIcons[p._type] || 'shapes'}" style="color:#5e72e4;margin-right:5px;"></i>
                ${typeLabels[p._type] || 'Geometría'}
            </span>
            <button onclick="closeEditPanel()" style="background:none;border:none;cursor:pointer;
                font-size:16px;color:#8898aa;padding:2px 6px;">✕</button>
        </div>

        <div style="margin-bottom:8px;">
            <label style="font-size:0.72rem;font-weight:700;color:#8898aa;text-transform:uppercase;
                letter-spacing:.4px;display:block;margin-bottom:3px;">${_td('map_draw_nombre')}</label>
            <input id="draw-prop-nombre" value="${escHtml(p.nombre || '')}"
                placeholder="Nombre del elemento"
                style="width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:7px;
                font-size:0.82rem;box-sizing:border-box;outline:none;"
                oninput="updateDrawFeatureProp('${featureId}','nombre',this.value)">
        </div>

        <div style="margin-bottom:8px;">
            <label style="font-size:0.72rem;font-weight:700;color:#8898aa;text-transform:uppercase;
                letter-spacing:.4px;display:block;margin-bottom:3px;">${_td('map_draw_desc')}</label>
            <textarea id="draw-prop-desc" rows="2" placeholder="Descripción opcional"
                style="width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:7px;
                font-size:0.82rem;box-sizing:border-box;resize:none;outline:none;"
                oninput="updateDrawFeatureProp('${featureId}','descripcion',this.value)">${escHtml(p.descripcion || '')}</textarea>
        </div>

        ${isPoint ? `
        <div style="margin-bottom:8px;">
            <label style="font-size:0.72rem;font-weight:700;color:#8898aa;text-transform:uppercase;
                letter-spacing:.4px;display:block;margin-bottom:3px;">${_td('map_draw_imagen')}</label>
            <div style="display:flex;gap:6px;align-items:center;">
                <button onclick="document.getElementById('draw-img-file-${featureId}').click()"
                    style="flex:1;padding:7px 10px;background:#f0f2ff;border:1px solid #5e72e4;
                    border-radius:7px;cursor:pointer;color:#5e72e4;font-size:0.8rem;
                    display:flex;align-items:center;gap:6px;justify-content:center;">
                    <i class="fa-solid fa-folder-open"></i>
                    ${p.imagen ? _td('map_draw_cambiar') : _td('map_draw_subir')}
                </button>
                ${p.imagen ? `<button onclick="updateDrawFeatureProp('${featureId}','imagen',''); showEditPanel('${featureId}')"
                    style="padding:7px;background:#fff5f5;border:1px solid #f5365c;border-radius:7px;
                    cursor:pointer;color:#f5365c;font-size:0.8rem;">
                    <i class="fa-solid fa-trash"></i>
                </button>` : ''}
            </div>
            <input type="file" id="draw-img-file-${featureId}" accept="image/*" style="display:none;"
                onchange="loadDrawImage('${featureId}',this)">
            ${p.imagen ? `<div style="position:relative;margin-top:6px;">
                <img src="${p.imagen}" style="width:100%;border-radius:8px;max-height:100px;
                    object-fit:cover;display:block;">
            </div>` : `<p style="font-size:0.72rem;color:#b0bec5;margin-top:4px;text-align:center;">
                ${_td('map_draw_sin_imagen')}</p>`}
        </div>` : ''}

        ${p._type === 'circle' && p._center ? `
        <div style="margin-bottom:8px;">
            <label style="font-size:0.72rem;font-weight:700;color:#8898aa;text-transform:uppercase;
                letter-spacing:.4px;display:block;margin-bottom:3px;">
                ${_td('map_draw_radio')}: <span id="draw-radius-val">${Math.round((p._radiusM||100))}</span> m
            </label>
            <input type="range" min="10" max="5000" step="10"
                value="${p._radiusM || 100}"
                style="width:100%;accent-color:#5e72e4;"
                oninput="updateDrawCircleRadius('${featureId}', this.value)">
        </div>` : ''}

        <div style="margin-bottom:10px;">
            <label style="font-size:0.72rem;font-weight:700;color:#8898aa;text-transform:uppercase;
                letter-spacing:.4px;display:block;margin-bottom:5px;">${_td('map_draw_color')}</label>
            <div style="display:flex;gap:5px;flex-wrap:wrap;">
                ${colorOpts.map(c => `
                <div onclick="updateDrawFeatureProp('${featureId}','_color','${c}')"
                    style="width:22px;height:22px;border-radius:50%;background:${c};cursor:pointer;
                    border:${p._color===c?'3px solid #32325d':'2px solid transparent'};
                    transition:border .15s;" title="${c}"></div>`).join('')}
            </div>
        </div>

        <div style="display:flex;gap:6px;">
            <button onclick="closeEditPanel()"
                style="flex:1;padding:7px;background:#5e72e4;color:white;border:none;border-radius:8px;
                font-size:0.8rem;font-weight:700;cursor:pointer;">
                <i class="fa-solid fa-check"></i> ${_td('map_draw_guardar')}
            </button>
            <button onclick="deleteDrawFeature('${featureId}')"
                style="padding:7px 10px;background:#fff5f5;color:#f5365c;border:1px solid #f5365c;
                border-radius:8px;font-size:0.8rem;cursor:pointer;">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    </div>`;
    panel.style.display = 'block';
}

function closeEditPanel() {
    const p = document.getElementById('draw-feature-panel');
    if (p) { p.style.display = 'none'; p.innerHTML = ''; }
    refreshDrawSource();
}

function updateDrawFeatureProp(id, key, value) {
    const f = drawFeatures.find(x => x.properties._id === id);
    if (!f) return;
    f.properties[key] = value;
    if (key === '_color') refreshDrawSource();
    // Redibujar panel solo si cambia color (para actualizar círculos de color)
    if (key === '_color') showEditPanel(id);
}

function deleteDrawFeature(id) {
    drawFeatures = drawFeatures.filter(x => x.properties._id !== id);
    closeEditPanel();
    refreshDrawSource();
}

function loadDrawImage(featureId, input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        updateDrawFeatureProp(featureId, 'imagen', e.target.result);
        showEditPanel(featureId); // refrescar panel con imagen
    };
    reader.readAsDataURL(file);
}

// ── Exportar / Cargar GeoJSON ────────────────────────────────────────────
function saveDrawLayerAsGeojson() {
    if (!drawFeatures.length) {
        if (typeof showToast === 'function') showToast(_td('map_draw_toast_export_empty'));
        return;
    }
    // Exportar limpio (sin propiedades internas _type, _id, etc. → mantenerlas para reimportar)
    const geojson    = { type: 'FeatureCollection', features: drawFeatures };
    const defaultName = 'eurocop_draw_' + new Date().toISOString().slice(0,10);
    const userInput   = window.prompt(_td('map_draw_save_prompt') || 'Nombre del archivo:', defaultName);
    if (userInput === null) return;  // cancelled
    const fileName    = (userInput.trim() || defaultName).replace(/\.geojson$/i, '') + '.geojson';
    const blob        = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    const a           = document.createElement('a');
    a.href            = URL.createObjectURL(blob);
    a.download        = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
}

function loadDrawGeojson(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const gj = JSON.parse(e.target.result);
            if (!gj.features) throw new Error("Formato no válido");
            
            initDrawLayer();
            
            // Cargamos las features manteniendo todas sus propiedades originales
            drawFeatures = gj.features.filter(f => f.properties && (f.properties._type || f.properties.nombre));
            
            // Si el archivo no tiene _id, se lo generamos para que sea editable
            drawFeatures.forEach(f => {
                if (!f.properties._id) f.properties._id = 'loaded_' + Math.random().toString(36).substr(2, 9);
                // Si no tiene tipo asignado, intentamos deducirlo por su geometría
                if (!f.properties._type) {
                    if (f.geometry.type === 'Point') f.properties._type = 'point';
                    else if (f.geometry.type === 'Polygon') f.properties._type = 'polygon';
                    else f.properties._type = 'line';
                }
            });

            refreshDrawSource();

            // Ajustar vista a los elementos cargados
            const bounds = new maplibregl.LngLatBounds();
            const extract = (c) => {
                if (typeof c[0] === 'number') bounds.extend(c);
                else c.forEach(extract);
            };
            drawFeatures.forEach(f => { if (f.geometry) extract(f.geometry.coordinates); });
            if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, maxZoom: 17, duration: 800 });
            
            if (typeof showToast === 'function') showToast(_td('map_draw_loaded',{n:drawFeatures.length}));
            
        } catch (err) { 
            console.error(err);
            if (typeof showToast === 'function') showToast(_td('map_draw_error_load')); 
        }
        input.value = '';
    };
    reader.readAsText(file);
}

function clearDrawLayer() {
    if (!drawFeatures.length) return;
    if (!confirm(_td('map_draw_confirm_clear'))) return;
    drawFeatures = [];
    closeEditPanel();
    refreshDrawSource();
}

// ── Toggle menú editor ───────────────────────────────────────────────────
function toggleDrawMenu() {
    const dd = document.getElementById('draw-dropdown');
    const btn = document.getElementById('btn-draw-menu');
    if (!dd) return;
    const open = dd.style.display === 'block';
    _closeAllDropdowns();
    if (!open) {
        dd.style.display = 'block';
        if (btn) btn.classList.add('active');
    }
}

function setDrawStatus(msg) {
    const el = document.getElementById('draw-status-msg');
    if (el) el.textContent = msg;
}

function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Helper traducción editor de geometrías
function _td(key, vars) {
    const lang = typeof currentLang !== 'undefined' ? currentLang : 'es';
    const tr = (typeof translations !== 'undefined' && translations[lang]) ? translations[lang] : {};
    let s = tr[key] || (translations['es'] && translations['es'][key]) || key;
    if (vars) Object.keys(vars).forEach(k => { s = s.replace('{' + k + '}', vars[k]); });
    return s;
}

// ── FIX 3: actualizar radio del círculo desde slider ──────────────────
function updateDrawCircleRadius(featureId, radiusM) {
    const f = drawFeatures.find(x => x.properties._id === featureId);
    if (!f || !f.properties._center) return;
    const rM = parseInt(radiusM);
    const rKm = rM / 1000;
    f.properties._radiusM = rM;
    f.properties._radiusKm = rKm;
    f.geometry = _circleGeometry(f.properties._center, rKm);
    refreshDrawSource();
    // Actualizar label sin re-renderizar panel
    const lbl = document.getElementById('draw-radius-val');
    if (lbl) lbl.textContent = rM;
}

// ── FIX 4: hover popup en puntos informativos ─────────────────────────
let _drawHoverPopup = null;

function _buildDrawPopupHTML(props) {
    const nombre = props.nombre || '';
    const descripcion = props.descripcion || '';
    const imagen = props.imagen || '';
    if (!nombre && !descripcion && !imagen) return null;
    return `
    <div class="ec-draw-popup">
        ${imagen ? `<img src="${imagen}" alt="">` : ''}
        ${nombre ? `<div class="ec-draw-popup-name">${nombre}</div>` : ''}
        ${descripcion ? `<div class="ec-draw-popup-desc">${descripcion}</div>` : ''}
    </div>`;
}

function initDrawHoverPopup() {
    if (!map) return;

    // ── Puntos (coordenadas directas del feature) ──
    map.on('mouseenter', DRAW_LAYERS.point, (e) => {
        if (drawMode) return;
        map.getCanvas().style.cursor = 'pointer';
        const html = _buildDrawPopupHTML(e.features[0].properties);
        if (!html) return;
        if (_drawHoverPopup) _drawHoverPopup.remove();
        _drawHoverPopup = new maplibregl.Popup({
            closeButton: false, closeOnClick: false, offset: 14, maxWidth: '240px'
        }).setLngLat(e.features[0].geometry.coordinates).setHTML(html).addTo(map);
    });
    map.on('mouseleave', DRAW_LAYERS.point, () => {
        map.getCanvas().style.cursor = '';
        if (_drawHoverPopup) { _drawHoverPopup.remove(); _drawHoverPopup = null; }
    });

    // ── Polígonos (usar punto del cursor) ──
    map.on('mouseenter', DRAW_LAYERS.polygon_fill, (e) => {
        if (drawMode) return;
        map.getCanvas().style.cursor = 'pointer';
        const html = _buildDrawPopupHTML(e.features[0].properties);
        if (!html) return;
        if (_drawHoverPopup) _drawHoverPopup.remove();
        _drawHoverPopup = new maplibregl.Popup({
            closeButton: false, closeOnClick: false, offset: 6, maxWidth: '240px'
        }).setLngLat(e.lngLat).setHTML(html).addTo(map);
    });
    map.on('mousemove', DRAW_LAYERS.polygon_fill, (e) => {
        if (_drawHoverPopup) _drawHoverPopup.setLngLat(e.lngLat);
    });
    map.on('mouseleave', DRAW_LAYERS.polygon_fill, () => {
        map.getCanvas().style.cursor = '';
        if (_drawHoverPopup) { _drawHoverPopup.remove(); _drawHoverPopup = null; }
    });

    // ── Círculos (igual que polígonos) ──
    map.on('mouseenter', DRAW_LAYERS.circle_fill, (e) => {
        if (drawMode) return;
        map.getCanvas().style.cursor = 'pointer';
        const html = _buildDrawPopupHTML(e.features[0].properties);
        if (!html) return;
        if (_drawHoverPopup) _drawHoverPopup.remove();
        _drawHoverPopup = new maplibregl.Popup({
            closeButton: false, closeOnClick: false, offset: 6, maxWidth: '240px'
        }).setLngLat(e.lngLat).setHTML(html).addTo(map);
    });
    map.on('mousemove', DRAW_LAYERS.circle_fill, (e) => {
        if (_drawHoverPopup) _drawHoverPopup.setLngLat(e.lngLat);
    });
    map.on('mouseleave', DRAW_LAYERS.circle_fill, () => {
        map.getCanvas().style.cursor = '';
        if (_drawHoverPopup) { _drawHoverPopup.remove(); _drawHoverPopup = null; }
    });

    // ── Líneas (usar punto del cursor) ──
    map.on('mouseenter', DRAW_LAYERS.line, (e) => {
        if (drawMode) return;
        map.getCanvas().style.cursor = 'pointer';
        const html = _buildDrawPopupHTML(e.features[0].properties);
        if (!html) return;
        if (_drawHoverPopup) _drawHoverPopup.remove();
        _drawHoverPopup = new maplibregl.Popup({
            closeButton: false, closeOnClick: false, offset: 6, maxWidth: '240px'
        }).setLngLat(e.lngLat).setHTML(html).addTo(map);
    });
    map.on('mousemove', DRAW_LAYERS.line, (e) => {
        if (_drawHoverPopup) _drawHoverPopup.setLngLat(e.lngLat);
    });
    map.on('mouseleave', DRAW_LAYERS.line, () => {
        map.getCanvas().style.cursor = '';
        if (_drawHoverPopup) { _drawHoverPopup.remove(); _drawHoverPopup = null; }
    });
}

// Genera el contenido HTML para los popups de las capas
function _buildLayerPopupHTML(props) {
    const nombre = props.nombre || props.Nombre || props.name || "Sin nombre";
    const descripcion = props.descripcion || props.Descripcion || "";
    const imagen = props.imagen || "";

    return `
        <div class="ec-layer-popup">
            ${imagen ? `<img src="${imagen}" alt="">` : ''}
            <div class="ec-layer-popup-title">${nombre}</div>
            ${descripcion ? `<div class="ec-layer-popup-desc">${descripcion}</div>` : ''}
        </div>`;
}