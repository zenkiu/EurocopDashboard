/**
 * EUROCOP ANALYTICS - MAPEO DE COLUMNAS
 * Versión: Filtros Extra sin predeterminar y renombrado a FILTROS_EXTRA.
 */

// ============================================================
// MOSTRAR PANTALLA DE MAPEO
// ============================================================
function showMapping(data) {
    if (!data || data.length === 0) return;
    
    rawData = data;
    const headers = Object.keys(data[0]);
    
    // Lista completa de IDs de selectores
    const mappingIds = [
        'map-expediente', 'map-fecha', 'map-hora', 
        'map-lat', 'map-lon', 'map-categoria', 'map-calle',
        'map-filtro-1', 'map-filtro-2'
    ];

    mappingIds.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel || sel.tagName !== 'SELECT') return;

        // Clonar para remover listeners previos y asegurar limpieza total
        const newSel = sel.cloneNode(false);
        sel.parentNode.replaceChild(newSel, sel);
        
        // Listener estándar para refrescar los checks (✓ ✕ •)
        newSel.addEventListener('change', refreshMappingStatus);

        // --- LÓGICA DEL INTERRUPTOR DE FILTROS ---
        // Dentro de mappingIds.forEach en FncMapeo.js...
        if (id === 'map-categoria') {
            newSel.addEventListener('change', function() {
                if (this.value === "***FILTROS_EXTRA***") {
                    const container = document.getElementById('extra-filters-config-group');
                    if (container) {
                        // Si está oculto lo muestra, si está visible lo oculta
                        const isHidden = container.style.display === 'none';
                        container.style.display = isHidden ? 'flex' : 'none';
                    }
                    // Importante: Reseteamos el select a vacío para que el usuario pueda elegir categoría real
                    this.value = ""; 
                    refreshMappingStatus();
                }
            });
        }

        // --- CONFIGURACIÓN DE OPCIONES INICIALES (PLACEHOLDERS) ---
        if (id === 'map-hora') {
            newSel.innerHTML = '<option value="">-- Sin hora (00:00) --</option>';
        } else if (id === 'map-categoria') {
            newSel.innerHTML = `
                <option value="" disabled selected>Seleccionar...</option>
                <option value="***MULTI_COLUMN***" style="font-weight:bold; color:#fb6340;">📊 [ USAR COLUMNAS COMO CATEGORIAS ]</option>
                <option value="***FILTROS_EXTRA***" style="font-weight:bold; color:#5e72e4;">🔧 [ CONFIGURAR FILTROS EXTRA ]</option>
            `;
        } else if (id.includes('filtro')) {
            // Los filtros extra NO predeterminan nada, siempre empiezan en "No usar"
            newSel.innerHTML = '<option value="" selected>-- No usar --</option>';
        } else {
            newSel.innerHTML = '<option value="" disabled selected>Seleccionar...</option>';
        }

        // Poblar con las columnas reales del archivo Excel
        headers.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h;
            opt.textContent = h;
            newSel.appendChild(opt);
        });

        // ---- AUTO-SELECCIÓN INTELIGENTE (SOLO CAMPOS BASE) ----
        let match = null;

        if (id === 'map-expediente') {
            match = headers.find(h => h.toUpperCase().includes('REFNUM') || h.toUpperCase().includes('EXPEDIENTE') || h.toUpperCase() === 'NUMERO' || h.toUpperCase() === 'ID');
        } else if (id === 'map-fecha') {
            match = headers.find(h => h.toUpperCase().includes('FECHA') || h.toUpperCase().includes('DATE'));
        } else if (id === 'map-hora') {
            match = headers.find(h => h.toUpperCase().includes('HORA') || h.toUpperCase().includes('TIME'));
        } else if (id === 'map-lat') {
            match = headers.find(h => h.toUpperCase() === 'Y' || h.toUpperCase().includes('LAT') || h.toUpperCase() === 'LATITUD');
        } else if (id === 'map-lon') {
            match = headers.find(h => h.toUpperCase() === 'X' || h.toUpperCase().includes('LON') || h.toUpperCase() === 'LNG' || h.toUpperCase() === 'LONGITUD');
        } else if (id === 'map-categoria') {
            match = headers.find(h => h.toUpperCase().includes('TIPO') || h.toUpperCase().includes('CAT') || h.toUpperCase().includes('HECHO') || h.toUpperCase().includes('CAUSA'));
        } else if (id === 'map-calle') {
            match = headers.find(h => h.toUpperCase().includes('CALLE') || h.toUpperCase().includes('DIR') || h.toUpperCase().includes('DOMICILIO') || h.toUpperCase().includes('VIA'));
        }
        
        // NOTA: Para map-filtro-1 y map-filtro-2 NO buscamos coincidencias automáticas
        // para cumplir con el requisito de que no se predeterminen campos.

        if (match) newSel.value = match;
    });

    // Limpiar campo de localidad manual si existe
    const locInput = document.getElementById('map-localidad');
    if (locInput && locInput.tagName === 'INPUT') locInput.value = "";

    refreshMappingStatus();

    // Transición de vistas
    document.getElementById('upload-view').classList.remove('active');
    document.getElementById('mapping-view').classList.add('active');
    window.scrollTo(0, 0);
}

// ============================================================
// REFRESCAR ESTADO VISUAL DE COLUMNAS (✓ ✕ •)
// ============================================================
function refreshMappingStatus() {
    const mappingIds = [
        'map-expediente', 'map-fecha', 'map-hora', 
        'map-lat', 'map-lon', 'map-categoria', 'map-calle',
        'map-filtro-1', 'map-filtro-2'
    ];

    // Obtener valores actualmente seleccionados (excluyendo comandos especiales)
    const currentSelections = mappingIds.map(id => {
        const el = document.getElementById(id);
        return (el && el.value) ? el.value : "";
    }).filter(val => val !== "" && !val.startsWith("***"));

    mappingIds.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel || sel.tagName !== 'SELECT') return;

        Array.from(sel.options).forEach(opt => {
            // No procesar opciones vacías, deshabilitadas o comandos de sistema
            if (opt.value === "" || opt.disabled || opt.value.startsWith("***")) return;

            const isUsedElsewhere = currentSelections.includes(opt.value) && sel.value !== opt.value;
            let textoLimpio = opt.value.replace('__EMPTY', 'BLANCO');
            const symbol = isUsedElsewhere ? "✕ " : (sel.value === opt.value ? "✓ " : "• ");

            opt.textContent = symbol + textoLimpio;
            opt.style.color = isUsedElsewhere ? "#cbd5e0" : "#5e72e4";
        });
    });
}

// ============================================================
// MOSTRAR / OCULTAR CAMPOS CONFIGURADOS (Opcionales)
// ============================================================
function toggleConfiguredFields() {
    const sections = document.querySelectorAll('.configured-fields-section');
    const button   = document.getElementById('toggle-configured-fields');
    const toggleText = document.getElementById('toggle-text');
    const icon     = button ? button.querySelector('i') : null;
    const mappingGrid = document.getElementById('mapping-grid');

    if (typeof configuredFieldsVisible === 'undefined') window.configuredFieldsVisible = false;
    configuredFieldsVisible = !configuredFieldsVisible;

    sections.forEach(section => {
        section.style.display = configuredFieldsVisible ? 'flex' : 'none';
    });

    // <= 768px = móvil puro | 769–920px = Fold 6 desplegado (usa grid como desktop)
    const isMobile = window.innerWidth <= 768;

    if (configuredFieldsVisible) {
        if (isMobile) {
            mappingGrid.style.display = 'flex';
            mappingGrid.style.flexDirection = 'column';
            mappingGrid.style.justifyContent = 'flex-start';
            mappingGrid.style.gridTemplateColumns = '';
        } else {
            mappingGrid.style.display = 'grid';
            mappingGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
            mappingGrid.style.justifyContent = 'start';
        }
        
        const t = (typeof translations !== 'undefined' && translations[currentLang]) ? translations[currentLang] : {};
        if (toggleText) toggleText.textContent = t.btn_hide_configured || 'Ocultar campos configurados';
        if (icon) icon.className = 'fa-solid fa-eye-slash';
        if (button) button.style.background = '#edf2f7';
    } else {
        if (isMobile) {
            mappingGrid.style.display = 'flex';
            mappingGrid.style.flexDirection = 'column';
            mappingGrid.style.justifyContent = 'flex-start';
        } else {
            mappingGrid.style.display = 'flex';
            mappingGrid.style.justifyContent = 'center';
            mappingGrid.style.gridTemplateColumns = '';
        }

        const t = (typeof translations !== 'undefined' && translations[currentLang]) ? translations[currentLang] : {};
        if (toggleText) toggleText.textContent = t.btn_show_configured || 'Mostrar campos configurados';
        if (icon) icon.className = 'fa-solid fa-eye';
        if (button) button.style.background = '#f7fafc';
    }
}

// ============================================================
// VOLVER AL MAPEO (desde el dashboard)
// ============================================================
function goToMapping() {
    const dashboard = document.getElementById('dashboard-view');
    const mapping   = document.getElementById('mapping-view');

    if (dashboard && dashboard.classList.contains('active')) {
        dashboard.classList.remove('active');
        if (mapping) mapping.classList.add('active');
        window.scrollTo(0, 0);
        setTimeout(() => { if (typeof map !== 'undefined' && map) map.resize(); }, 300);
    }
}