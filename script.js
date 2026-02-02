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
    if (window.innerWidth > 768) {
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
    if (sidebar && toggleBtn && window.innerWidth <= 768) {
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
