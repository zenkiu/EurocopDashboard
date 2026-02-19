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
    
    // Si se abre el menú, enfocar el campo de búsqueda
    if (menu.classList.contains('active')) {
        setTimeout(() => {
            const searchInput = document.getElementById('layer-search');
            if (searchInput && searchInput.style.display !== 'none') {
                searchInput.focus();
                // Marcar que estamos en modo de búsqueda
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
    
    let foundFeatures = []; // Ahora almacenamos todas las features encontradas
    let foundLayer = null;
    
    for (const layer of mapLayers) {
        if (!layer.geojson || !layer.geojson.features) continue;
        
        for (const feature of layer.geojson.features) {
            const props = feature.properties || {};
            const nombre = (props.nombre || props.Nombre || '').toLowerCase();
            const descripcion = (props.descripcion || props.Descripcion || '').toLowerCase();
            
            // BÚSQUEDA EXACTA O PARCIAL PERO MÁS PRECISA
            // Buscar coincidencias exactas o que comiencen con la búsqueda
            const searchTerms = query.split(' ').filter(term => term.length > 0);
            let matches = false;
            
            if (searchTerms.length === 1) {
                // Para una sola palabra: buscar coincidencia exacta o que comience con
                matches = nombre === query || 
                         nombre.startsWith(query) || 
                         descripcion === query ||
                         descripcion.startsWith(query);
            } else {
                // Para múltiples palabras: buscar todas las palabras en el nombre o descripción
                matches = searchTerms.every(term => 
                    nombre.includes(term) || descripcion.includes(term)
                );
            }
            
            if (matches) {
                foundFeatures.push({
                    feature: feature,
                    layer: layer,
                    nombre: nombre,
                    descripcion: descripcion
                });
            }
        }
        if (foundFeatures.length > 0 && !foundLayer) {
            foundLayer = layer; // Guardar la primera capa con resultados
        }
    }
    
    if (foundFeatures.length === 0) return;
    
    // Cerrar popup anterior antes de abrir los nuevos
    if (currentSearchPopup) currentSearchPopup.remove();
    
    // Limpiar resaltados anteriores
    clearAllHighlights();
    
    try {
        const bounds = new maplibregl.LngLatBounds();
        
        // Calcular bounds para TODAS las features encontradas
        foundFeatures.forEach(item => {
            const extractCoords = (coords) => {
                if (typeof coords[0] === 'number') bounds.extend(coords);
                else coords.forEach(extractCoords);
            };
            if (item.feature.geometry) extractCoords(item.feature.geometry.coordinates);
        });
        
        if (!bounds.isEmpty()) {
            const center = bounds.getCenter();
            
            map.flyTo({
                center: center,
                zoom: 17.5,
                duration: 1200,
                essential: true
            });
            
            // Resaltar TODAS las features encontradas
            flashAllFoundFeatures(foundFeatures);
            
            // Crear popup con todas las coincidencias
            let htmlContent = `
                <div style="padding:8px; font-family:'Inter', sans-serif; color:#32325d; min-width:180px; max-height:300px; overflow-y:auto;">
                    <b style="text-transform:uppercase; font-size:13px; display:block; margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:4px;">
                        Coincidencias encontradas: ${foundFeatures.length}
                    </b>`;
            
            foundFeatures.forEach((item, index) => {
                const nombre = item.nombre || "Sin nombre";
                const descripcion = item.descripcion || "";
                
                htmlContent += `
                    <div style="margin-bottom:8px; padding-bottom:8px; border-bottom: ${index < foundFeatures.length - 1 ? '1px solid #f0f0f0' : 'none'}">
                        <div style="font-weight:600; font-size:12px; color:#5e72e4;">${nombre}</div>
                        ${descripcion ? `<div style="font-size:11px; color:#525f7f; margin-top:2px;">${descripcion}</div>` : ''}
                    </div>`;
            });
            
            htmlContent += `</div>`;
            
            currentSearchPopup = new maplibregl.Popup({ offset: 10, maxWidth: '250px' })
                .setLngLat(center)
                .setHTML(htmlContent)
                .addTo(map);
        }
    } catch (e) {
        console.warn('Error al navegar a la zona:', e);
    }
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
    
    // Agrupar por capa para optimizar
    const groupedByLayer = {};
    foundItems.forEach(item => {
        if (!groupedByLayer[item.layer.id]) {
            groupedByLayer[item.layer.id] = [];
        }
        groupedByLayer[item.layer.id].push(item);
    });
    
    // Aplicar resaltado a cada grupo
    Object.keys(groupedByLayer).forEach(layerId => {
        const items = groupedByLayer[layerId];
        const layerObj = mapLayers.find(l => l.id === layerId);
        
        if (!layerObj) return;
        
        const fillLayer = layerId + '-fill';
        const lineLayer = layerId + '-line';
        
        if (!map.getLayer(fillLayer)) return;
        
        // Crear filtro para resaltar SOLO las features encontradas
        const featureConditions = items.map(item => {
            const featureName = item.feature.properties.nombre || item.feature.properties.Nombre;
            return ["any", 
                ["==", ["get", "nombre"], featureName],
                ["==", ["get", "Nombre"], featureName]
            ];
        });
        
        // Si hay múltiples condiciones, combinarlas con "any"
        const highlightFilter = featureConditions.length > 1 
            ? ["all", ["any", ...featureConditions]] 
            : ["all", featureConditions[0]];
        
        // Aplicar resaltado
        map.setPaintProperty(fillLayer, 'fill-color', '#FFD700');
        map.setPaintProperty(fillLayer, 'fill-opacity', 0.8);
        map.setFilter(fillLayer, highlightFilter);
        
        // También resaltar las líneas si existen
        if (map.getLayer(lineLayer)) {
            map.setPaintProperty(lineLayer, 'line-color', '#FFD700');
            map.setPaintProperty(lineLayer, 'line-width', 5);
        }
        
        // Configurar para restaurar después de un tiempo
        setTimeout(() => {
            if (map.getLayer(fillLayer)) {
                map.setFilter(fillLayer, ["all"]);
                map.setPaintProperty(fillLayer, 'fill-color', layerObj.color);
                map.setPaintProperty(fillLayer, 'fill-opacity', 0.3);
            }
            
            if (map.getLayer(lineLayer)) {
                map.setPaintProperty(lineLayer, 'line-color', layerObj.color);
                map.setPaintProperty(lineLayer, 'line-width', 3);
            }
        }, 5000); // Restaurar después de 5 segundos
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