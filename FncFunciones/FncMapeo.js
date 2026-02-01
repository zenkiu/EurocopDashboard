/**
 * EUROCOP ANALYTICS - MAPEO DE COLUMNAS
 * Genera los selectores de columnas, auto-detección inteligente,
 * validación visual (✓ ✕ •) y control de campos configurados.
 */

// ============================================================
// MOSTRAR PANTALLA DE MAPEO
// ============================================================
function showMapping(data) {
    rawData = data;
    const headers = Object.keys(data[0]);
    const mappingIds = ['map-expediente', 'map-fecha', 'map-hora', 'map-lat', 'map-lon', 'map-categoria', 'map-calle'];

    mappingIds.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;

        // Clonar para remover listeners previos (en caso de re-carga)
        const newSel = sel.cloneNode(false);
        sel.parentNode.replaceChild(newSel, sel);
        newSel.addEventListener('change', refreshMappingStatus);

        // Opciones especiales según campo
        if (id === 'map-hora') {
            newSel.innerHTML = '<option value="">-- Sin hora (00:00) --</option>';
        } else if (id === 'map-categoria') {
            newSel.innerHTML = '<option value="" disabled selected>Seleccionar...</option>';
            const optSpecial = document.createElement('option');
            optSpecial.value = "***MULTI_COLUMN***";
            optSpecial.textContent = "📊 [ USAR COLUMNAS COMO CATEGORIAS ]";
            optSpecial.style.fontWeight = "bold";
            optSpecial.style.color = "#fb6340";
            newSel.appendChild(optSpecial);
        } else {
            newSel.innerHTML = '<option value="" disabled selected>Seleccionar...</option>';
        }

        // Poblar con las columnas del archivo
        headers.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h;
            opt.textContent = h;
            newSel.appendChild(opt);
        });

        // ---- AUTO-SELECCIÓN INTELIGENTE ----
        let match = null;
        if (id === 'map-expediente') {
            match = headers.find(h => h.toUpperCase().includes('REFNUM')) ||
                    headers.find(h => h.toUpperCase().includes('EXPEDIENTE')) ||
                    headers.find(h => h.toUpperCase() === 'NUMERO' || h.toUpperCase() === 'ID');
        } else if (id === 'map-fecha') {
            match = headers.find(h => h.toUpperCase().includes('FECHA') || h.toUpperCase().includes('DATE'));
        } else if (id === 'map-hora') {
            match = headers.find(h => h.toUpperCase().includes('HORA') || h.toUpperCase().includes('TIME'));
        } else if (id === 'map-lat') {
            match = headers.find(h => h.toUpperCase() === 'Y' || h.toUpperCase().includes('LAT'));
        } else if (id === 'map-lon') {
            match = headers.find(h => h.toUpperCase() === 'X' || h.toUpperCase().includes('LON') || h.toUpperCase().includes('LNG'));
        } else if (id === 'map-categoria') {
            match = headers.find(h => h.toUpperCase().includes('TIPO') || h.toUpperCase().includes('CAT') || h.toUpperCase().includes('CAUSA'));
        } else if (id === 'map-calle') {
            match = headers.find(h =>
                h.toUpperCase().includes('CALLE') || h.toUpperCase().includes('DIR') ||
                h.toUpperCase().includes('DOMICILIO') || h.toUpperCase().includes('VIA') ||
                h.toUpperCase().includes('EMPLAZAMIENTO')
            );
        }

        if (match) newSel.value = match;
    });

    // Limpiar campo de localidad manual
    const locInput = document.getElementById('map-localidad');
    if (locInput) locInput.value = "";

    refreshMappingStatus();

    // Transición de vistas
    document.getElementById('upload-view').classList.remove('active');
    document.getElementById('mapping-view').classList.add('active');
    window.scrollTo(0, 0);
}

// ============================================================
// REFRESCAR ESTADO VISUAL DE COLUMNAS
// Muestra ✓ (seleccionada), ✕ (usada en otro selector), • (libre)
// ============================================================
function refreshMappingStatus() {
    const mappingIds = ['map-expediente', 'map-fecha', 'map-hora', 'map-lat', 'map-lon', 'map-categoria', 'map-calle'];

    // Obtener valores actualmente seleccionados (excluyendo especiales)
    const currentSelections = mappingIds.map(id => {
        const el = document.getElementById(id);
        return (el && el.value) ? el.value : "";
    }).filter(val => val !== "" && val !== "***MULTI_COLUMN***");

    mappingIds.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;

        Array.from(sel.options).forEach(opt => {
            if (opt.value === "" || opt.disabled || opt.value === "***MULTI_COLUMN***") return;

            const isUsedElsewhere = currentSelections.includes(opt.value) && sel.value !== opt.value;
            let textoLimpio = opt.value.replace('__EMPTY', 'BLANCO');
            const symbol = isUsedElsewhere ? "✕ " : (sel.value === opt.value ? "✓ " : "• ");

            opt.textContent = symbol + textoLimpio;
            opt.style.color = isUsedElsewhere ? "#cbd5e0" : "#5e72e4";
        });
    });
}

// ============================================================
// MOSTRAR / OCULTAR CAMPOS CONFIGURADOS
// ============================================================
function toggleConfiguredFields() {
    const sections = document.querySelectorAll('.configured-fields-section');
    const button   = document.getElementById('toggle-configured-fields');
    const toggleText = document.getElementById('toggle-text');
    const icon     = button.querySelector('i');
    const mappingGrid = document.getElementById('mapping-grid');

    configuredFieldsVisible = !configuredFieldsVisible;

    sections.forEach(section => {
        section.style.display = configuredFieldsVisible ? 'flex' : 'none';
    });

    const isMobile = window.innerWidth <= 768;

    if (configuredFieldsVisible) {
        if (isMobile) {
            mappingGrid.style.display = 'flex';
            mappingGrid.style.flexDirection = 'column';
            mappingGrid.style.gridTemplateColumns = '';
            mappingGrid.style.justifyContent = 'flex-start';
        } else {
            mappingGrid.style.display = 'grid';
            mappingGrid.style.flexDirection = '';
            mappingGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
            mappingGrid.style.justifyContent = 'start';
        }
        const hideText = translations[currentLang]?.btn_hide_configured || 'Ocultar campos configurados';
        toggleText.textContent = hideText;
        icon.className = 'fa-solid fa-eye-slash';
        button.style.background = '#edf2f7';
    } else {
        if (isMobile) {
            mappingGrid.style.display = 'flex';
            mappingGrid.style.flexDirection = 'column';
            mappingGrid.style.gridTemplateColumns = '';
            mappingGrid.style.justifyContent = 'flex-start';
        } else {
            mappingGrid.style.display = 'flex';
            mappingGrid.style.flexDirection = '';
            mappingGrid.style.gridTemplateColumns = '';
            mappingGrid.style.justifyContent = 'center';
        }
        const showText = translations[currentLang]?.btn_show_configured || 'Mostrar campos configurados';
        toggleText.textContent = showText;
        icon.className = 'fa-solid fa-eye';
        button.style.background = '#f7fafc';
    }
}

// ============================================================
// VOLVER AL MAPEO (desde el dashboard)
// ============================================================
function goToMapping() {
    if (document.getElementById('dashboard-view').classList.contains('active')) {
        document.getElementById('dashboard-view').classList.remove('active');
        document.getElementById('mapping-view').classList.add('active');
        window.scrollTo(0, 0);
        setTimeout(() => { if (map) map.resize(); }, 300);
    }
}
