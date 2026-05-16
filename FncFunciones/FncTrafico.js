/**
 * EUROCOP — FncTrafico.js
 * Simulación de tráfico en tiempo real sobre calles OSM (Overpass API)
 * Módulo independiente — activar/desactivar con toggleTrafico()
 */

// ════════════════════════════════════════════════════════════
// ESTADO DEL MÓDULO
// ════════════════════════════════════════════════════════════
const _TC = {
    active:      false,
    animFrame:   null,
    vehicles:    [],
    loading:     false,
    lastBounds:  null,   // evitar recarga si los bounds no cambian
    MIN_ZOOM:    14,
};

// Colores de vehículos según tipo de vía (se asignan aleatoriamente)
const _TC_COLORS = ['#FF5733','#33A1FF','#33FF8A','#FFD133','#FF33C4','#33FFF0'];

// ════════════════════════════════════════════════════════════
// TOGGLE — llamado desde el botón del mapa
// ════════════════════════════════════════════════════════════
function toggleTrafico() {
    _TC.active = !_TC.active;
    const btn = document.getElementById('btn-trafico');

    if (_TC.active) {
        if (btn) { btn.style.background = '#e9ecef'; btn.style.color = '#32325d'; btn.title = _td('map_btn_traffic_off') || 'Desactivar tráfico'; }
        _tcEnsureLayers();
        _tcLoad();
        // Escuchar cambios de vista para recargar calles
        map.on('moveend', _tcOnMoveEnd);
    } else {
        if (btn) { btn.style.background = ''; btn.style.color = ''; btn.title = _td('map_btn_traffic') || 'Tráfico en tiempo real'; }
        map.off('moveend', _tcOnMoveEnd);
        _tcStop();
    }
}

// ════════════════════════════════════════════════════════════
// CAPAS MAPLIBRE
// ════════════════════════════════════════════════════════════
function _tcEnsureLayers() {
    if (!map.getSource('tc-vehicles')) {
        map.addSource('tc-vehicles', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
    }
    // Vehículo: interior negro + perímetro blanco (igual que proyecto de referencia)
    if (!map.getLayer('tc-vehicles')) {
        map.addLayer({
            id: 'tc-vehicles', type: 'circle', source: 'tc-vehicles',
            paint: {
                'circle-radius': 3,
                'circle-color': '#000000',       // interior negro
                'circle-opacity': 1.0,
                'circle-stroke-width': 2.5,
                'circle-stroke-color': '#ffffff' // perímetro blanco
            }
        });
    }
}

function _tcRemoveLayers() {
    ['tc-vehicles', 'tc-shadow'].forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id);
    });
    if (map.getSource('tc-vehicles')) map.removeSource('tc-vehicles');
}

// ════════════════════════════════════════════════════════════
// CARGA DE CALLES VÍA OVERPASS API
// ════════════════════════════════════════════════════════════
function _tcOnMoveEnd() {
    if (!_TC.active) return;
    // Solo recargar si el zoom es suficiente y los bounds cambiaron
    const z = map.getZoom();
    if (z < _TC.MIN_ZOOM) {
        _TC.vehicles = [];
        _tcSetData([]);
        return;
    }
    _tcLoad();
}

async function _tcLoad() {
    if (_TC.loading) return;
    const z = map.getZoom();
    if (z < _TC.MIN_ZOOM) return;

    _TC.loading = true;

    const bounds = map.getBounds();
    const query = `[out:json][timeout:10];
way["highway"]["highway"!~"footway|cycleway|path|service|track|pedestrian|steps|construction"]
(${bounds.getSouth().toFixed(5)},${bounds.getWest().toFixed(5)},${bounds.getNorth().toFixed(5)},${bounds.getEast().toFixed(5)});
out geom;`;

    try {
        const resp = await fetch(
            'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query),
            { signal: AbortSignal.timeout(10000) }
        );
        const data = await resp.json();

        const roads = (data.elements || [])
            .map(e => (e.geometry || []).map(p => [p.lon, p.lat]))
            .filter(r => r.length > 1);

        if (roads.length === 0) { _TC.loading = false; return; }

        // Construir lista ponderada de segmentos (longitud proporcional)
        const segments = [];
        let totalLen = 0;
        for (const path of roads) {
            for (let i = 0; i < path.length - 1; i++) {
                const dx = path[i+1][0] - path[i][0];
                const dy = path[i+1][1] - path[i][1];
                const len = Math.sqrt(dx*dx + dy*dy);
                totalLen += len;
                segments.push({ path, segIdx: i, len, cumLen: totalLen });
            }
        }

        // Número de vehículos según zoom
        const count = z > 17 ? 300 : z > 16 ? 200 : z > 15 ? 150 : 100;

        // Selección ponderada aleatoria
        function pickSegment() {
            const r = Math.random() * totalLen;
            let lo = 0, hi = segments.length - 1;
            while (lo < hi) {
                const mid = (lo + hi) >> 1;
                if (segments[mid].cumLen < r) lo = mid + 1; else hi = mid;
            }
            return segments[lo];
        }

        _TC.vehicles = Array.from({ length: count }, () => {
            const seg = pickSegment();
            return {
                path:    seg.path,
                segment: seg.segIdx,
                t:       Math.random(),
                speed:   0.002 * (0.8 + Math.random() * 0.4),
                color:   _TC_COLORS[Math.floor(Math.random() * _TC_COLORS.length)],
                // sin sentido inverso — todos avanzan en el orden de los nodos OSM
            };
        });

        // Arrancar animación si no estaba corriendo
        if (!_TC.animFrame) {
            _TC.animFrame = requestAnimationFrame(_tcAnimate);
        }

    } catch (e) {
        console.warn('[FncTrafico] Error cargando calles:', e.message);
    }

    _TC.loading = false;
}

// ════════════════════════════════════════════════════════════
// LOOP DE ANIMACIÓN
// ════════════════════════════════════════════════════════════
function _tcAnimate() {
    if (!_TC.active) return;

    const features = _TC.vehicles.map(v => {
        // Avanzar t — exactamente como el proyecto de referencia
        v.t += v.speed;
        if (v.t >= 1) {
            v.t = 0;
            v.segment = (v.segment + 1) % (v.path.length - 1);
        }

        const c = v.path[v.segment];
        const n = v.path[v.segment + 1] || c;

        return {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [
                    c[0] + (n[0] - c[0]) * v.t,
                    c[1] + (n[1] - c[1]) * v.t
                ]
            },
            properties: { color: v.color }
        };
    });

    _tcSetData(features);
    _TC.animFrame = requestAnimationFrame(_tcAnimate);
}

function _tcSetData(features) {
    const src = map.getSource('tc-vehicles');
    if (src) src.setData({ type: 'FeatureCollection', features });
}

// ════════════════════════════════════════════════════════════
// STOP — limpia todo
// ════════════════════════════════════════════════════════════
function _tcStop() {
    if (_TC.animFrame) { cancelAnimationFrame(_TC.animFrame); _TC.animFrame = null; }
    _TC.vehicles = [];
    _tcRemoveLayers();
}
