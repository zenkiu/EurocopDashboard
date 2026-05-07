
// ═══════════════════════════════════════════════════════════════
// TOGGLE MODO DÍA / NOCHE
// ═══════════════════════════════════════════════════════════════
(function initTheme() {
    const LS_KEY = 'eurocop_theme';
    const DARK  = 'dark';
    const LIGHT = 'light';

    function applyTheme(theme) {
        const html   = document.documentElement;
        const track  = document.getElementById('theme-track');
        const icon   = document.getElementById('theme-icon');
        const label  = document.getElementById('theme-label');
        const btn    = document.getElementById('btn-theme-toggle');

        html.setAttribute('data-theme', theme);

        // ── Intercambiar logos según tema ──
        document.querySelectorAll('.theme-logo').forEach(function(img) {
            var src = theme === DARK ? img.getAttribute('data-dark') : img.getAttribute('data-light');
            if (src) img.src = src;
        });

        // ── Etiquetas i18n del toggle ──
        const _t = (typeof translations !== 'undefined' && translations[currentLang]) || {};
        if (theme === DARK) {
            if (track)  { track.classList.remove('day'); }
            if (icon)   icon.textContent = '🌙';
            if (label)  label.textContent = _t.theme_night  || 'NOCHE';
            if (btn)    btn.title = _t.theme_toggle_title || 'Cambiar modo día/noche';
        } else {
            if (track)  { track.classList.add('day'); }
            if (icon)   icon.textContent = '☀️';
            if (label)  label.textContent = _t.theme_day    || 'DÍA';
            if (btn)    btn.title = _t.theme_toggle_title || 'Cambiar modo día/noche';
        }

        // Actualizar colores de Chart.js si existen gráficos renderizados
        if (typeof Chart !== 'undefined') {
            const gridColor = theme === DARK ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
            const tickColor = theme === DARK ? '#7d8590' : '#8898aa'; // más claro en dark
            Chart.defaults.color = tickColor;
            Chart.defaults.borderColor = gridColor;
            // Redibujar todos los gráficos activos
            Object.values(Chart.instances || {}).forEach(function(chart) {
                try {
                    if (chart && chart.options) {
                        // Actualizar ejes — pero NO sobreescribir si el tick.color es una función
                        // (el timeline usa callbacks para colorear días de semana)
                        if (chart.options.scales) {
                            Object.values(chart.options.scales).forEach(function(scale) {
                                if (scale.grid && typeof scale.grid.color !== 'function') {
                                    scale.grid.color = gridColor;
                                }
                                if (scale.ticks && typeof scale.ticks.color !== 'function') {
                                    scale.ticks.color = tickColor;
                                }
                            });
                        }
                        // Actualizar tooltip
                        if (chart.options.plugins && chart.options.plugins.tooltip) {
                            var tt = chart.options.plugins.tooltip;
                            tt.backgroundColor = theme === DARK ? '#1c2128' : '#1a1f36';
                            tt.titleColor      = theme === DARK ? '#7d8590' : '#8898aa';
                            tt.bodyColor       = theme === DARK ? '#e6edf3' : '#e8ecff';
                        }
                        chart.update('none');
                    }
                } catch(e) {}
            });
        }

        localStorage.setItem(LS_KEY, theme);
    }

    // Exponer toggle global
    window.toggleTheme = function() {
        var current = document.documentElement.getAttribute('data-theme') || LIGHT;
        applyTheme(current === DARK ? LIGHT : DARK);
    };

    // Aplicar tema guardado o preferencia del sistema al cargar
    var saved = localStorage.getItem(LS_KEY);
    if (!saved) {
        saved = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? DARK : LIGHT;
    }

    // Aplicar inmediatamente (antes del DOMContentLoaded para evitar flash)
    document.documentElement.setAttribute('data-theme', saved);

    // Actualizar UI del botón cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            applyTheme(saved);
            // Inicializar Chart.defaults según tema guardado
            if (typeof Chart !== 'undefined') {
                Chart.defaults.color      = saved === DARK ? '#7d8590' : '#8898aa';
                Chart.defaults.borderColor = saved === DARK ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
            }
        });
    } else {
        applyTheme(saved);
        if (typeof Chart !== 'undefined') {
            Chart.defaults.color      = saved === DARK ? '#7d8590' : '#8898aa';
            Chart.defaults.borderColor = saved === DARK ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
        }
    }
})();

/**
 * EUROCOP ANALYTICS - SCRIPT PRINCIPAL v1.6.9
 * Este archivo solo contiene la inicialización (DOMContentLoaded)
 * y los listeners globales (resize, clicks fuera de dropdowns).
 * 
 * Toda la lógica de negocio vive en FncFunciones/:
 *   FncGlobales.js        → Variables compartidas
 *   FncUtilidades.js      → Helpers genéricos (loader, toast, modales, descargas)
 *   FncCargaArchivo.js    → Drag & drop + lectura Excel/CSV
 *   FncMapeo.js           → Configuración de columnas + auto-detección
 *   FncProcesamiento.js   → Parseo de datos + generación del dashboard
 *   FncFiltros.js         → Filtros, buscador, modo fecha, filtro espacial, updateUI
 *   FncGraficos.js        → Chart.js (timeline, categorías, horas)
 *   FncMapa.js            → MapLibre (puntos, heatmap, capas GeoJSON, hotspots)
 *   FncTablas.js          → 4 tablas con ordenamiento
 *   FncGeolocalizacion.js → Reverse geocoding (BigDataCloud)
 *   FncIdioma.js          → Sistema multi-idioma
 *   FncInfografia.js      → Generador de síntesis + exportación PNG
 *   FncConvertirPdf.js    → Exportación a PDF
 */
// ============================================================
// LÓGICA RESPONSIVE / MENU MÓVIL
// ============================================================
function toggleSidebarMobile() {
    const sidebar  = document.getElementById('sidebar');
    const overlay  = document.getElementById('mobile-overlay');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

window.addEventListener('resize', () => {
    if (window.innerWidth > 920) {
        document.getElementById('sidebar').classList.remove('active');
        document.getElementById('mobile-overlay').classList.remove('active');
    }
    if (map) setTimeout(() => map.resize(), 300);
});

// ============================================================
// INICIALIZACIÓN GLOBAL (una sola vez cuando el DOM esté listo)
// ============================================================
document.addEventListener('DOMContentLoaded', () => {

    // 1. INDICADOR DE VERSIÓN
    const versionBadge = document.getElementById('app-version-badge');
    if (versionBadge && typeof EUROCOP_VERSION !== 'undefined') {
        versionBadge.textContent = 'v' + EUROCOP_VERSION;
    }

    // 1b. TEXTO INFORMATIVO DE MEMORIAS (desde version.js)
    const memoriasInfo = document.getElementById('memorias-info-text');
    if (memoriasInfo && typeof EUROCOP_MEMORIAS_INFO !== 'undefined' && EUROCOP_MEMORIAS_INFO.trim()) {
        memoriasInfo.textContent = EUROCOP_MEMORIAS_INFO;
    }

    // 2. INICIALIZACIÓN DE IDIOMA
    const langSelect = document.getElementById('lang-selector');
    if (langSelect) {
        langSelect.value = currentLang;
        applyLanguage(currentLang);
    }

    // 3. CARGA DE ARCHIVOS (drop zone + file input)
    initCargaArchivo();

    // 4. CONECTAR BOTÓN "VISUALIZAR" → procesamiento
    initProcesamiento();

    // 5. BUSCADOR DE CATEGORÍAS (multitérmino con debounce)
    initBuscadorCategorias();

    // 6. VALIDACIÓN DE INPUTS DÍA/MES
    initValidacionDayMonth();

    // 7. MODALES: listeners de cierre
    const pdfModal = document.getElementById('pdf-modal');
    if (pdfModal) {
        pdfModal.addEventListener('click', function (e) { if (e.target === this) closePdfModal(); });
    }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePdfModal(); });
    // 8. Inicializar el contenedor de filtros dinámicos
    FncMultiselect.init(); 
});

// ============================================================
// CLICK GLOBAL (cerrar dropdowns, sidebar móvil, menú capas)
// ============================================================
// ============================================================
// CLICK GLOBAL (cerrar dropdowns, sidebar móvil, menú capas)
// ============================================================
window.onclick = (e) => {
    // 1. CERRAR FILTROS (Años, Meses, Categorías)
    if (!e.target.closest('.custom-dropdown')) {
        document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('active'));
        document.querySelectorAll('.dropdown-header').forEach(h => h.classList.remove('active'));
        
    }

    // 2. CERRAR SIDEBAR MÓVIL
    const sidebar   = document.getElementById('sidebar');
    const toggleBtn = document.querySelector('.mobile-menu-btn');
    if (sidebar && toggleBtn && window.innerWidth <= 920) {
        if (sidebar.classList.contains('active') && !sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
            toggleSidebarMobile();
        }
    }

    // 3. CERRAR GESTOR DE CAPAS DEL MAPA - CON EXCEPCIÓN PARA EL INPUT DE BÚSQUEDA
    const layerMenu = document.getElementById('layers-dropdown');
    const layerBtn  = document.getElementById('btn-layers-menu');
    const searchInput = document.getElementById('layer-search');
    
    if (layerMenu && layerMenu.classList.contains('active')) {
        // NO cerrar si el clic fue en el input de búsqueda o en sus elementos hijos
        const isClickOnSearchInput = searchInput && (searchInput.contains(e.target) || searchInput === e.target);
        
        if (!isClickOnSearchInput && !layerMenu.contains(e.target) && !layerBtn.contains(e.target)) {
            layerMenu.classList.remove('active');
            if (layerBtn) layerBtn.style.background = '';
        }
    }
};

// ═══════════════════════════════════════════════════════════════
// SIDEBAR RESIZER — arrastra el divisor para cambiar el ancho
// ═══════════════════════════════════════════════════════════════
(function initSidebarResizer() {
    const LS_KEY = 'eurocop_sidebar_width';
    const MIN_W  = 180;
    const MAX_W  = 520;
    const DEFAULT_W = 260;

    function getSidebar()  { return document.getElementById('sidebar'); }
    function getResizer()  { return document.getElementById('sidebar-resizer'); }

    // Aplicar ancho guardado al iniciar
    function applyWidth(w) {
        const sidebar = getSidebar();
        if (!sidebar) return;
        const clamped = Math.min(MAX_W, Math.max(MIN_W, w));
        sidebar.style.width = clamped + 'px';
        // Actualizar la variable CSS global para que otros componentes la lean
        document.documentElement.style.setProperty('--sidebar-width', clamped + 'px');
        // Forzar resize de Chart.js si existe
        if (typeof Chart !== 'undefined') {
            Object.values(Chart.instances || {}).forEach(c => {
                try { c.resize(); } catch(e) {}
            });
        }
        // Forzar resize de MapLibre si existe
        if (typeof map !== 'undefined' && map && typeof map.resize === 'function') {
            try { map.resize(); } catch(e) {}
        }
        return clamped;
    }

    function init() {
        const resizer = getResizer();
        if (!resizer) return;

        // Restaurar ancho guardado
        const saved = parseInt(localStorage.getItem(LS_KEY)) || DEFAULT_W;
        applyWidth(saved);

        let startX, startW, dragging = false;

        resizer.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            const sidebar = getSidebar();
            if (!sidebar) return;
            startX  = e.clientX;
            startW  = sidebar.offsetWidth;
            dragging = true;
            resizer.classList.add('dragging');
            document.body.style.cursor    = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', e => {
            if (!dragging) return;
            const delta  = e.clientX - startX;
            const newW   = applyWidth(startW + delta);
        });

        document.addEventListener('mouseup', e => {
            if (!dragging) return;
            dragging = false;
            resizer.classList.remove('dragging');
            document.body.style.cursor     = '';
            document.body.style.userSelect = '';
            // Guardar ancho
            const sidebar = getSidebar();
            if (sidebar) {
                localStorage.setItem(LS_KEY, sidebar.offsetWidth);
            }
            // Trigger chart resize después de soltar
            setTimeout(() => {
                if (typeof Chart !== 'undefined') {
                    Object.values(Chart.instances || {}).forEach(c => {
                        try { c.resize(); } catch(e) {}
                    });
                }
                if (typeof map !== 'undefined' && map && typeof map.resize === 'function') {
                    try { map.resize(); } catch(e) {}
                }
                if (typeof window.dispatchEvent === 'function') {
                    window.dispatchEvent(new Event('resize'));
                }
            }, 50);
        });

        // Doble clic en el resizer → resetear al ancho por defecto
        resizer.addEventListener('dblclick', () => {
            applyWidth(DEFAULT_W);
            localStorage.setItem(LS_KEY, DEFAULT_W);
            setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
        });
    }

    // Esperar a que el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
