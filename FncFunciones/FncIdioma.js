/**
 * EUROCOP ANALYTICS - SISTEMA DE IDIOMAS
 * Cambia el idioma activo, aplica traducciones a todos los
 * elementos data-i18n, y refrescar componentes dependientes.
 */

// ============================================================
// CAMBIAR IDIOMA (desde el selector del sidebar)
// ============================================================
function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('eurocop_lang', lang);
    applyLanguage(lang);
}

// ============================================================
// APLICAR TRADUCCIONES
// ============================================================
function applyLanguage(lang) {
    const t = translations[lang];
    if (!t) return;

    // 1. Traducción estándar: todos los elementos con data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.textContent = t[key];
    });

    // 2. Traducir title del botón de subir capa
    const btnAdd = document.getElementById('btn-add-layer-icon');
    if (btnAdd && t.btn_add_layer_title) {
        btnAdd.title = t.btn_add_layer_title;
    }

    // 3. Refrescar lista de capas (puede tener texto "Sin capas" traducible)
    if (typeof renderLayerList === 'function') {
        renderLayerList();
    }

    // 4. Actualizar los labels de los meses en el filtro
    updateMonthLabels();

    // 5. Si ya hay datos cargados, refrescar toda la UI
    if (finalData.length > 0) updateUI();
}
