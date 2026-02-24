/**
 * EUROCOP ANALYTICS - MÓDULO METEOROLOGÍA
 * Integración con Open-Meteo Historical Weather API.
 * Solo activo en vista "Diario".
 * Coordenadas: centroide de los registros con GPS del dataset filtrado,
 * igual que FncGeolocalizacion.js. El usuario puede sobreescribirlas.
 */

// ============================================================
// ESTADO
// ============================================================
let meteoEnabled  = false;
let meteoData     = null;   // Mapa { 'DD/MM/YY': { tempMax, tempMin, precip, wind, snow } }
let meteoLoading  = false;
let chartMeteo    = null;   // Instancia Chart.js del panel separado

// Colores por variable
const METEO_COLORS = {
    temp:   { color: '#ff6b35', fill: 'rgba(255,107,53,0.12)',  label: 'Temp. Máx (°C)' },
    precip: { color: '#4ecdc4', fill: 'rgba(78,205,196,0.12)',  label: 'Precipitación (mm)' },
    wind:   { color: '#74b9ff', fill: 'rgba(116,185,255,0.12)', label: 'Viento máx (km/h)' },
    snow:   { color: '#a29bfe', fill: 'rgba(162,155,254,0.12)', label: 'Nieve (cm)' }
};

// ============================================================
// OBTENER CENTROIDE — igual que FncGeolocalizacion
// ============================================================
function meteoCentroide() {
    const latEl = document.getElementById('meteo-lat');
    const lonEl = document.getElementById('meteo-lon');

    // 1. Coordenadas guardadas (usuario seleccionó municipio o editó manualmente)
    if (latEl && lonEl && latEl.value.trim() && lonEl.value.trim()) {
        const lat = parseFloat(latEl.value);
        const lon = parseFloat(lonEl.value);
        if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
    }

    // 2. Centroide GPS del dataset filtrado
    if (typeof lastFilteredData !== 'undefined' && lastFilteredData.length > 0) {
        const geo = lastFilteredData.filter(d => d.hasGeo && d.lat !== 0 && d.lon !== 0);
        if (geo.length > 0) {
            const lat = geo.reduce((s, d) => s + d.lat, 0) / geo.length;
            const lon = geo.reduce((s, d) => s + d.lon, 0) / geo.length;
            if (latEl) latEl.value = lat.toFixed(4);
            if (lonEl) lonEl.value = lon.toFixed(4);
            _meteoReverseGeocode(lat, lon);
            return { lat, lon };
        }
    }

    // 3. Sin GPS: geocodificar desde ZONA (async) y devolver null por ahora
    _meteoGeocodificarDesdeZona();
    return null;
}

/** Geocodifica el nombre de ZONA para obtener coords cuando no hay GPS en el dataset */
async function _meteoGeocodificarDesdeZona() {
    const latEl   = document.getElementById('meteo-lat');
    const lonEl   = document.getElementById('meteo-lon');
    const inputEl = document.getElementById('meteo-municipio');

    // Si ya hay coordenadas guardadas, no hacer nada
    if (latEl && latEl.value.trim()) return;

    // Obtener nombre de zona: del KPI visible o de locManual del primer registro
    let zonaNombre = '';
    const kpiEl = document.getElementById('kpi-location');
    if (kpiEl && kpiEl.innerText &&
        kpiEl.innerText !== 'Sin Datos' &&
        kpiEl.innerText !== 'Sin Ubicación GPS' &&
        kpiEl.innerText !== '----') {
        zonaNombre = kpiEl.innerText.trim();
    }
    if (!zonaNombre && typeof lastFilteredData !== 'undefined' && lastFilteredData.length > 0) {
        zonaNombre = (lastFilteredData[0].locManual || '').trim();
    }
    if (!zonaNombre) return;

    // Pre-rellenar campo con el nombre mientras buscamos
    if (inputEl && !inputEl.value.trim()) inputEl.value = zonaNombre;

    try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(zonaNombre)}&countrycodes=es&format=json&limit=1&addressdetails=1`;
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), 4000);
        const res = await fetch(url, {
            signal: ctrl.signal,
            headers: { 'Accept-Language': currentLang || 'es', 'User-Agent': 'EurocopAnalytics/2.0' }
        });
        clearTimeout(tid);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.length) return;

        const item  = data[0];
        const lat   = parseFloat(item.lat);
        const lon   = parseFloat(item.lon);
        const addr  = item.address || {};
        const city  = addr.city || addr.town || addr.village || addr.municipality || item.display_name.split(',')[0];
        const prov  = addr.county || addr.state_district || addr.state || '';

        // Guardar coords en campos ocultos
        if (latEl) latEl.value = lat.toFixed(4);
        if (lonEl) lonEl.value = lon.toFixed(4);
        if (inputEl) inputEl.value = prov ? `${city}, ${prov}` : city;

        // Si clima activo → recargar con nuevas coords
        if (typeof meteoEnabled !== 'undefined' && meteoEnabled) {
            await _meteoFetch();
            _meteoApply();
        } else {
            // Highlight botón en verde: coords listas, puede activar clima
            const btn = document.getElementById('btn-meteo-toggle');
            if (btn) {
                btn.style.borderColor = '#2dce89';
                btn.style.color       = '#2dce89';
            }
        }
    } catch (e) { /* silencioso */ }
}

/** Reverse geocoding con BigDataCloud (misma API que FncGeolocalizacion.js) */
async function _meteoReverseGeocode(lat, lon) {
    const input = document.getElementById('meteo-municipio');
    if (!input) return;
    // Solo sobreescribir si el campo está vacío o tiene coordenadas crudas (no nombre)
    const current = input.value.trim();
    const hasCoordPattern = /^-?[\d.]+,\s*-?[\d.]+$/.test(current);
    if (current && !hasCoordPattern) return; // Tiene nombre → no sobreescribir
    try {
        const langCode = currentLang === 'eu' ? 'eu' : (currentLang === 'ca' ? 'ca' : 'es');
        const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${langCode}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        // BigDataCloud: locality → principalSubdivision (Bizkaia, etc.)
        const city = data.locality || data.city || data.localityInfo?.administrative?.[3]?.name || '';
        const prov = data.principalSubdivisionCode
            ? (data.principalSubdivision || '')
            : (data.countryName || '');
        if (city) input.value = prov ? `${city}, ${prov}` : city;
    } catch (e) { /* silencioso */ }
}

/** Fuerza actualización del municipio desde las coordenadas actuales */
function _meteoRefreshMunicipio() {
    const latEl = document.getElementById('meteo-lat');
    const lonEl = document.getElementById('meteo-lon');
    if (!latEl || !lonEl || !latEl.value || !lonEl.value) {
        // Sin coords guardadas → calcular centroide y geocodificar
        if (typeof lastFilteredData !== 'undefined' && lastFilteredData.length > 0) {
            const geo = lastFilteredData.filter(d => d.hasGeo && d.lat !== 0 && d.lon !== 0);
            if (geo.length > 0) {
                const lat = geo.reduce((s, d) => s + d.lat, 0) / geo.length;
                const lon = geo.reduce((s, d) => s + d.lon, 0) / geo.length;
                _meteoReverseGeocode(lat, lon);
            }
        }
        return;
    }
    _meteoReverseGeocode(parseFloat(latEl.value), parseFloat(lonEl.value));
}

// ============================================================
// BÚSQUEDA DE MUNICIPIO (Nominatim - España)
// ============================================================
let _meteoMunicipioTimer = null;

function onMeteoMunicipioInput(value) {
    clearTimeout(_meteoMunicipioTimer);
    const results = document.getElementById('meteo-municipio-results');
    if (!value || value.trim().length < 3) {
        if (results) results.style.display = 'none';
        return;
    }
    _meteoMunicipioTimer = setTimeout(() => _meteoSearchMunicipio(value.trim()), 400);
}

async function _meteoSearchMunicipio(query) {
    const results = document.getElementById('meteo-municipio-results');
    if (!results) return;
    results.style.display = 'block';
    results.innerHTML = '<div style="padding:8px 12px; font-size:0.72rem; color:#8898aa;">Buscando...</div>';

    try {
        // Nominatim: buscar en España, municipios
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=es&featuretype=settlement&format=json&limit=6&addressdetails=1&accept-language=${currentLang || 'es'}`;
        const ctrl2 = new AbortController();
        const tid2  = setTimeout(() => ctrl2.abort(), 5000);
        const res = await fetch(url, {
            signal: ctrl2.signal,
            headers: { 'Accept-Language': currentLang || 'es', 'User-Agent': 'EurocopAnalytics/2.0' }
        });
        clearTimeout(tid2);
        if (!res.ok) throw new Error('API error');
        const data = await res.json();

        if (!data.length) {
            results.innerHTML = '<div style="padding:8px 12px; font-size:0.72rem; color:#8898aa;">Sin resultados</div>';
            return;
        }

        results.innerHTML = '';
        data.forEach(item => {
            const addr    = item.address || {};
            const city    = addr.city || addr.town || addr.village || addr.municipality || item.display_name.split(',')[0];
            const prov    = addr.county || addr.state_district || '';
            const state   = addr.state || '';
            const label   = prov ? `${city}, ${prov}` : `${city}, ${state}`;
            const lat     = parseFloat(item.lat);
            const lon     = parseFloat(item.lon);

            const div = document.createElement('div');
            div.style.cssText = 'padding:7px 12px; font-size:0.75rem; cursor:pointer; border-bottom:1px solid #f3f4f6; color:#32325d; line-height:1.3;';
            div.innerHTML = `<span style="font-weight:700">${city}</span><br><span style="color:#8898aa; font-size:0.68rem">${prov || state}</span>`;
            div.addEventListener('mouseenter', () => div.style.background = '#f8f9fa');
            div.addEventListener('mouseleave', () => div.style.background = '');
            div.addEventListener('click', () => {
                document.getElementById('meteo-lat').value = lat.toFixed(4);
                document.getElementById('meteo-lon').value = lon.toFixed(4);
                const input = document.getElementById('meteo-municipio');
                if (input) input.value = label;
                results.style.display = 'none';
                // Recargar clima con nuevas coordenadas si está activo
                if (meteoEnabled) onMeteoReload();
            });
            results.appendChild(div);
        });
    } catch (e) {
        results.innerHTML = '<div style="padding:8px 12px; font-size:0.72rem; color:#f5365c;">Error de conexión</div>';
    }
}

// Cerrar dropdown al hacer clic fuera
document.addEventListener('click', function(e) {
    const results = document.getElementById('meteo-municipio-results');
    const input   = document.getElementById('meteo-municipio');
    if (results && !results.contains(e.target) && e.target !== input) {
        results.style.display = 'none';
    }
});

// ============================================================
// RANGO DE FECHAS DE LOS DATOS ACTUALES
// ============================================================
function meteoRangoFechas() {
    if (typeof lastFilteredData === 'undefined' || lastFilteredData.length === 0) return null;
    const ts = lastFilteredData.map(d => d.date && d.date.getTime()).filter(Boolean);
    if (ts.length === 0) return null;
    const fmt = ms => {
        const d = new Date(ms);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    };
    return { start: fmt(Math.min(...ts)), end: fmt(Math.max(...ts)) };
}

// ============================================================
// MOSTRAR / OCULTAR BARRA METEOROLOGÍA
// ============================================================
function initMeteoUI() {
    const bar = document.getElementById('meteo-bar');
    if (bar) bar.style.display = 'flex';

    const input = document.getElementById('meteo-municipio');
    const latEl = document.getElementById('meteo-lat');

    if (input && !input.value.trim()) {
        // ¿Hay GPS en el dataset? → reverse geocoding
        // ¿No hay GPS? → intentar geocodificar desde ZONA
        const hasGPS = typeof lastFilteredData !== 'undefined' &&
            lastFilteredData.some(d => d.hasGeo && d.lat !== 0 && d.lon !== 0);
        if (hasGPS && latEl && latEl.value.trim()) {
            _meteoRefreshMunicipio();
        } else {
            _meteoGeocodificarDesdeZona();
        }
    }
}

function hideMeteoUI() {
    const bar = document.getElementById('meteo-bar');
    if (bar) bar.style.display = 'none';
    const panel = document.getElementById('container-meteo');
    if (panel) panel.style.display = 'none';
    if (meteoEnabled) {
        meteoEnabled = false;
        meteoData    = null;
        _meteoRedrawTimeline();
    }
}

// ============================================================
// TOGGLE ON / OFF
// ============================================================
async function toggleMeteo() {
    if (meteoLoading) return;
    meteoEnabled = !meteoEnabled;
    const btn = document.getElementById('btn-meteo-toggle');

    if (!meteoEnabled) {
        const _t1 = (typeof translations !== 'undefined' && translations[currentLang]) || {};
    if (btn) { btn.classList.remove('active'); btn.innerHTML = '<i class="fa-solid fa-cloud-sun"></i> ' + (_t1.clima_activate || 'Activar Clima'); }
        meteoData = null;
        const panel = document.getElementById('container-meteo');
        if (panel) panel.style.display = 'none';
        _meteoRedrawTimeline();
        return;
    }

    const _t2 = (typeof translations !== 'undefined' && translations[currentLang]) || {};
    if (btn) { btn.classList.add('active'); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + (_t2.clima_loading || 'Cargando...'); }
    meteoLoading = true;

    try {
        await _meteoFetch();
        const _t3 = (typeof translations !== 'undefined' && translations[currentLang]) || {};
        if (btn) btn.innerHTML = '<i class="fa-solid fa-cloud-sun"></i> ' + (_t3.clima_active || 'Clima Activo');
        _meteoApply();
    } catch (e) {
        console.error('Meteo error:', e);
        meteoEnabled = false;
        const _te = (typeof translations !== 'undefined' && translations[currentLang]) || {};
            if (btn) { btn.classList.remove('active'); btn.innerHTML = '<i class="fa-solid fa-cloud-sun"></i> ' + (_te.clima_error || 'Error - Reintentar'); }
        alert('No se pudieron cargar datos climáticos.\n' + e.message);
    } finally {
        meteoLoading = false;
    }
}

// ============================================================
// LLAMADA A OPEN-METEO
// ============================================================
async function _meteoFetch() {
    const coords = meteoCentroide();
    if (!coords) throw new Error('Sin coordenadas GPS en los datos cargados.');

    const range = meteoRangoFechas();
    if (!range) throw new Error('Sin rango de fechas disponible.');

    const { lat, lon } = coords;
    const vars = 'temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,snowfall_sum';
    // models=best_match → Open-Meteo elige el modelo de mayor resolución para la región
    // Para España selecciona datos de AEMET/EC Earth (~10km vs ~25km del ERA5 genérico)
    const url  = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&start_date=${range.start}&end_date=${range.end}&daily=${vars}&timezone=auto&models=best_match`;

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Open-Meteo respondió ${resp.status}`);
    const json = await resp.json();
    if (!json.daily || !json.daily.time) throw new Error('Respuesta inesperada de Open-Meteo.');

    // Construir mapa fecha → valores
    // Guardamos con clave DD/MM/YY (2 dígitos año) para casar con etiquetas del gráfico
    // y también con clave DD/MM/YYYY (4 dígitos) como fallback
    meteoData = {};
    json.daily.time.forEach((iso, i) => {
        const [y, m, d] = iso.split('-').map(Number);
        const dd  = String(d).padStart(2, '0');
        const mm  = String(m).padStart(2, '0');
        const yy2 = String(y).slice(-2);   // 2 dígitos — coincide con etiquetas del gráfico
        const yy4 = String(y);             // 4 dígitos — fallback
        const rawTempMax = json.daily.temperature_2m_max[i];
        const rawTempMin = json.daily.temperature_2m_min[i];
        const rawSnow    = json.daily.snowfall_sum[i] || 0;
        // Filtro de calidad: la nieve del modelo de reanálisis sobreestima en zonas montañosas.
        // Solo consideramos nevada real si:
        //   - El modelo reporta >= 1.5 cm  (elimina "ruido" de 0.1-0.9 cm del modelo)
        //   - Y la temperatura mínima fue <= 4°C (condición térmica plausible para nieve)
        const snowQuality = rawSnow >= 1.5 && rawTempMin !== null && rawTempMin <= 4.0;
        const entry = {
            tempMax: rawTempMax,
            tempMin: rawTempMin,
            precip:  json.daily.precipitation_sum[i],
            wind:    json.daily.windspeed_10m_max[i],
            snow:    snowQuality ? rawSnow : 0  // 0 si no cumple criterio de calidad
        };
        meteoData[`${dd}/${mm}/${yy2}`] = entry; // Clave corta: DD/MM/YY
        meteoData[`${dd}/${mm}/${yy4}`] = entry; // Clave larga: DD/MM/YYYY (por si acaso)
    });
}

// ============================================================
// APLICAR: superpuesto u panel separado
// ============================================================
function _meteoApply() {
    if (!meteoEnabled || !meteoData) return;
    const mode = _meteoMode();
    if (mode === 'panel') {
        _meteoRedrawTimeline(); // Quita overlay si había
        _meteoRenderPanel();
    } else {
        const panel = document.getElementById('container-meteo');
        if (panel) panel.style.display = 'none';
        _meteoRedrawTimeline(); // Redibuja con overlay inyectado
    }
}

function _meteoMode() {
    const el = document.getElementById('meteo-mode-select');
    return el ? el.value : 'overlay';
}

function _meteoVar() {
    const el = document.getElementById('meteo-var-select');
    return el ? el.value : 'temp';
}

// ============================================================
// REDIBUJAR TIMELINE PRINCIPAL (llama a updateCharts del core)
// ============================================================
function _meteoRedrawTimeline() {
    if (typeof updateCharts === 'function' && typeof lastFilteredData !== 'undefined') {
        updateCharts(lastFilteredData, []);
    }
}

// ============================================================
// SINCRONIZAR METEO cuando cambia el rango de fechas
// Llamar desde updateUI tras actualizar lastFilteredData
// ============================================================
async function syncMeteoIfActive() {
    if (!meteoEnabled || meteoLoading) return;
    // Verificar si el rango ha cambiado
    const range = meteoRangoFechas();
    if (!range) return;
    const newKey = range.start + '_' + range.end;
    if (syncMeteoIfActive._lastKey === newKey) return; // Sin cambio
    syncMeteoIfActive._lastKey = newKey;
    // Recargar datos silenciosamente
    try {
        meteoLoading = true;
        await _meteoFetch();
        _meteoApply();
    } catch(e) {
        console.warn('Meteo auto-sync error:', e.message);
    } finally {
        meteoLoading = false;
    }
}

// ============================================================
// GENERAR DATASETS DE CLIMA para inyectar en el timeline
// (llamado desde FncGraficos.js vía getMeteoOverlayConfig)
// ============================================================
function getMeteoOverlayConfig(baseLabelTexts) {
    if (!meteoEnabled || !meteoData) return { datasets: [], yAxis: null };
    if (_meteoMode() !== 'overlay')   return { datasets: [], yAxis: null };

    const climaType = (chartTimelineType === 'bar') ? 'line' : 'bar';
    const datasets  = _meteoBuildDatasets(baseLabelTexts, climaType);
    if (datasets.length === 0) return { datasets: [], yAxis: null };

    const yAxis = {
        yMeteo: {
            type: 'linear',
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { color: '#ff6b35', font: { size: 9 } },
            title: { display: true, text: '🌡 Clima', color: '#ff6b35', font: { size: 10 } }
        }
    };

    return { datasets, yAxis };
}

// ============================================================
// CONSTRUIR DATASETS según variable seleccionada
// ============================================================
function _meteoBuildDatasets(labels, tipo) {
    const varSel = _meteoVar();

    const makeDS = (varKey, colorKey) => {
        const c = METEO_COLORS[colorKey];
        const values = labels.map(label => {
            // La etiqueta tiene formato "DD/MM/YY L" o "DD/MM/YY"
            // Extraer la parte de fecha (primeros 8 chars = DD/MM/YY)
            const keyShort = label.substring(0, 8);   // DD/MM/YY
            const entry = meteoData[keyShort];
            if (!entry) return null;
            const v = entry[varKey];
            return (v !== null && v !== undefined) ? v : null;
        });
        return {
            label:           c.label,
            data:            values,
            type:            tipo,
            backgroundColor: c.fill,
            borderColor:     c.color,
            borderWidth:     2,
            fill:            tipo === 'line',
            tension:         0.4,
            pointRadius:     tipo === 'line' ? 3 : 0,
            pointHoverRadius: 5,
            yAxisID:         'yMeteo',
            stack:           'meteo',
            spanGaps:        true,
            order:           -1
        };
    };

    if (varSel === 'all') {
        return [
            makeDS('tempMax', 'temp'),
            makeDS('precip',  'precip'),
            makeDS('wind',    'wind'),
            makeDS('snow',    'snow')
        ];
    }

    const map = {
        temp:   () => makeDS('tempMax', 'temp'),
        precip: () => makeDS('precip',  'precip'),
        wind:   () => makeDS('wind',    'wind'),
        snow:   () => makeDS('snow',    'snow')
    };

    return map[varSel] ? [map[varSel]()] : [];
}

// ============================================================
// RENDERIZAR PANEL SEPARADO SINCRONIZADO
// ============================================================
function _meteoRenderPanel() {
    if (!meteoEnabled || !meteoData) return;
    // Solo mostrar panel si estamos en vista Diario
    if (typeof temporalView !== 'undefined' && temporalView !== 'daily') return;

    const panel = document.getElementById('container-meteo');
    if (!panel) return;
    panel.style.display = 'flex';

    // Obtener etiquetas del gráfico principal
    if (!chartTimeline) return;
    const labels    = chartTimeline.data.labels;
    const climaType = (chartTimelineType === 'bar') ? 'line' : 'bar';
    const datasets  = _meteoBuildDatasets(labels, climaType);

    const ctx = document.getElementById('chart-meteo');
    if (!ctx) return;
    if (chartMeteo) chartMeteo.destroy();

    chartMeteo = new Chart(ctx, {
        type: climaType,
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { boxWidth: 12, font: { size: 10 } }
                },
                tooltip: { mode: 'nearest', intersect: true }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { maxRotation: 45, font: { size: 9 } }
                },
                y: { beginAtZero: false, ticks: { precision: 1 } }
            }
        }
    });


}

// ============================================================
// CALLBACKS DE CAMBIO EN UI
// ============================================================
function onMeteoVarChange()  { if (meteoEnabled && meteoData) _meteoApply(); }
function onMeteoModeChange() { if (meteoEnabled && meteoData) _meteoApply(); }

async function onMeteoReload() {
    if (!meteoEnabled || meteoLoading) return;
    meteoLoading = true;
    const btn = document.getElementById('btn-meteo-toggle');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Recargando...';
    try {
        await _meteoFetch();
        _meteoApply();
    } catch(e) {
        alert('Error al recargar: ' + e.message);
    } finally {
        meteoLoading = false;
        const _t3 = (typeof translations !== 'undefined' && translations[currentLang]) || {};
        if (btn) btn.innerHTML = '<i class="fa-solid fa-cloud-sun"></i> ' + (_t3.clima_active || 'Clima Activo');
    }
}
