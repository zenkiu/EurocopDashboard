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
        if (t[key]) {
            // <option> y elementos con hijos → textContent
            el.textContent = t[key];
        }
    });

    // 1b. Traducir atributos title (data-i18n-title)
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (t[key]) el.title = t[key];
    });

    // 1c2. Traducir placeholder (data-i18n-placeholder)
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (t[key]) el.placeholder = t[key];
    });

    // 1c. Traducir <option> dentro de selects del clima
    const varSelect  = document.getElementById('meteo-var-select');
    const modeSelect = document.getElementById('meteo-mode-select');
    if (varSelect) {
        varSelect.querySelectorAll('option[data-i18n]').forEach(opt => {
            const key = opt.getAttribute('data-i18n');
            if (t[key]) opt.textContent = t[key];
        });
    }
    if (modeSelect) {
        modeSelect.querySelectorAll('option[data-i18n]').forEach(opt => {
            const key = opt.getAttribute('data-i18n');
            if (t[key]) opt.textContent = t[key];
        });
    }

    // 1d. Actualizar texto del botón de clima según estado actual
    const btnMeteo = document.getElementById('btn-meteo-toggle');
    if (btnMeteo) {
        const icon = '<i class="fa-solid fa-cloud-sun"></i> ';
        if (typeof meteoEnabled !== 'undefined' && meteoEnabled) {
            btnMeteo.innerHTML = icon + (t.clima_active || 'Clima Activo');
        } else {
            btnMeteo.innerHTML = icon + (t.clima_activate || 'Activar Clima');
        }
    }

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
