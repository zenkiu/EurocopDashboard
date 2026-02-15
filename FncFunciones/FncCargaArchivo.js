/**
 * EUROCOP ANALYTICS - CARGA DE ARCHIVOS
 * Gestiona el drag & drop, lectura Excel/CSV con XLSX.js y transición al paso de mapeo.
 * Incluye optimización para archivos grandes (>1MB) mostrando los 4 años más recientes.
 */

// Variables temporales para la gestión de archivos grandes
let tempLargeData = null;
let tempDateColumn = null;

// ============================================================
// INICIALIZACIÓN DEL DROP ZONE
// ============================================================
function initCargaArchivo() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    if (!dropZone || !fileInput) return;

    dropZone.onclick = () => fileInput.click();

    fileInput.onchange = (e) => {
        if (e.target.files.length > 0) {
            processFile(e.target.files[0]);
            e.target.value = "";
        }
    };

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) processFile(files[0]);
    });
}

// ============================================================
// PROCESAMIENTO DEL ARCHIVO
// ============================================================
function processFile(file) {
    if (!file) return;

    // Mostrar loader
    const loader = document.getElementById('loading-overlay');
    if (loader) loader.classList.add('active');

    setTimeout(() => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                if (typeof nombreArchivoSubido !== 'undefined') {
                    nombreArchivoSubido = file.name.replace(/\.[^/.]+$/, "").toUpperCase();
                }

                const dataArr = new Uint8Array(e.target.result);
                const wb = XLSX.read(dataArr, {
                    type: 'array',
                    cellDates: true, 
                    cellNF: false,
                    cellText: false
                });

                const firstSheet = wb.SheetNames[0];
                const data = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], { defval: "" });

                if (data.length === 0) throw new Error("El archivo está vacío");

                // ---------------------------------------------------------
                // OPTIMIZACIÓN ARCHIVOS GRANDES (> 1MB)
                // ---------------------------------------------------------
                const ONE_MB = 1024 * 1024;
                
                if (file.size > ONE_MB) {
                    console.log(`Archivo grande detectado: ${(file.size / 1024 / 1024).toFixed(2)} MB. Analizando años...`);
                    
                    const analysis = analyzeYearsInDataset(data);
                    
                    if (analysis.years.length > 0) {
                        tempLargeData = data;
                        tempDateColumn = analysis.column;
                        
                        showLargeFileModal(analysis.years);
                        
                        if (loader) loader.classList.remove('active');
                        return; // PAUSA: Esperamos selección del usuario
                    }
                }
                
                // Si es pequeño o no se detectaron fechas, procesamos normal
                completeLoadingProcess(data);

            } catch (error) {
                console.error("Error procesando Excel:", error);
                alert("Error: No se pudo leer el archivo.");
                if (loader) loader.classList.remove('active');
            }
        };

        reader.onerror = () => {
            alert("Error de lectura del archivo.");
            if (loader) loader.classList.remove('active');
        };

        reader.readAsArrayBuffer(file);
    }, 200);
}

/**
 * Finaliza la carga y pasa a la vista de Mapeo
 */
function completeLoadingProcess(data) {
    // Función global que está en FncMapeo.js (o similar)
    if (typeof showMapping === 'function') {
        showMapping(data);
    } else {
        console.error("Función showMapping no encontrada.");
    }
    
    console.log("Archivo cargado y procesado.");
    const loader = document.getElementById('loading-overlay');
    if (loader) loader.classList.remove('active');
}

// ============================================================
// LÓGICA DE ARCHIVOS GRANDES
// ============================================================

/**
 * Analiza el JSON buscando años.
 * MEJORA: Muestrea el principio Y el final del array para encontrar años recientes
 * si el archivo está ordenado cronológicamente.
 */
function analyzeYearsInDataset(data) {
    if (!data || data.length === 0) return { years: [], column: null };

    const columns = Object.keys(data[0]);
    const yearCounts = {};
    let bestColumn = null;
    let maxValidDates = 0;
    const currentYear = new Date().getFullYear(); // Año actual dinámico

    // Definir índices a muestrear: primeros 2000 y últimos 2000 filas
    // Esto asegura que si el Excel tiene datos de 2010 al principio y 2026 al final, veamos ambos.
    let indicesToCheck = [];
    const limit = 2000;
    
    for (let i = 0; i < Math.min(data.length, limit); i++) {
        indicesToCheck.push(i);
    }
    if (data.length > limit) {
        let start = Math.max(limit, data.length - limit);
        for (let i = start; i < data.length; i++) {
            indicesToCheck.push(i);
        }
    }

    columns.forEach(col => {
        let validDates = 0;
        const tempYears = new Set();

        indicesToCheck.forEach(i => {
            const val = data[i][col];
            let year = null;

            if (val instanceof Date && !isNaN(val)) {
                year = val.getFullYear();
            } else if (typeof val === 'string') {
                const match = val.match(/(19|20)\d{2}/);
                if (match) year = parseInt(match[0]);
            }

            // Validar rango lógico (ej: 2000 hasta Año Actual + 1)
            if (year && year >= 2000 && year <= currentYear + 1) {
                validDates++;
                tempYears.add(year);
            }
        });

        if (validDates > maxValidDates) {
            maxValidDates = validDates;
            bestColumn = col;
            // Ordenar descendente (2026, 2025, 2024...)
            yearCounts[col] = Array.from(tempYears).sort((a, b) => b - a);
        }
    });

    if (bestColumn && maxValidDates > 0) {
        return { years: yearCounts[bestColumn], column: bestColumn };
    }

    return { years: [], column: null };
}

/**
 * Muestra el modal con los ULTIMOS 4 AÑOS (ej: 2026, 2025, 2024, 2023)
 */
/**
 * Muestra el modal con los ULTIMOS 4 AÑOS traducido
 */
function showLargeFileModal(years) {
    const modal = document.getElementById('large-file-modal');
    const select = document.getElementById('large-file-year-select');
    
    if (!modal || !select) return;

    // Obtener idioma actual (global 'currentLang' o defecto 'es')
    const lang = (typeof currentLang !== 'undefined') ? currentLang : 'es';
    const t = translations[lang]; // Acceso directo al objeto de traducciones

    select.innerHTML = '';
    
    const currentYear = new Date().getFullYear();
    const sortedYears = years
        .filter(y => y <= currentYear)
        .sort((a, b) => b - a);

    const recentYears = sortedYears.slice(0, 4); 
    const yearsToShow = recentYears.length > 0 ? recentYears : sortedYears.slice(0, 4);

    // Texto traducido para "Desde"
    const txtFrom = t.modal_large_opt_from || "Desde";

    yearsToShow.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        // Construcción: "Desde 2024" / "Noiztik: 2024" / etc.
        opt.textContent = `${txtFrom} ${y}`;
        select.appendChild(opt);
    });

    // Opción "Cargar todo" traducida
    const optAll = document.createElement('option');
    optAll.value = 'all';
    optAll.textContent = t.modal_large_opt_all || "Cargar todo el histórico";
    optAll.style.color = '#f5365c';
    optAll.style.fontWeight = 'bold';
    select.appendChild(optAll);

    select.selectedIndex = 0;

    // Aplicar traducciones a los textos estáticos del modal por si el idioma cambió antes de abrir
    if (typeof applyLanguage === 'function') {
        applyLanguage(lang);
    }

    modal.classList.add('active');
}

/**
 * Filtra el dataset en memoria y continúa el proceso
 */
function filterLargeData(yearStr) {
    if (!tempLargeData) return;

    if (yearStr === 'all') {
        completeLoadingProcess(tempLargeData);
        tempLargeData = null;
        return;
    }

    const minYear = parseInt(yearStr);
    const col = tempDateColumn;
    
    console.log(`Filtrando datos... Conservar >= ${minYear}`);

    const filteredData = tempLargeData.filter(row => {
        const val = row[col];
        let y = 0;

        if (val instanceof Date) {
            y = val.getFullYear();
        } else if (typeof val === 'string') {
            const match = val.match(/(19|20)\d{2}/);
            if (match) y = parseInt(match[0]);
        }
        return y >= minYear;
    });

    tempLargeData = null;
    tempDateColumn = null;

    if (filteredData.length === 0) {
        // Alerta traducida
        const lang = (typeof currentLang !== 'undefined') ? currentLang : 'es';
        const msg = translations[lang].alert_no_records || "No records found.";
        
        alert(msg);
        
        const loader = document.getElementById('loading-overlay');
        if (loader) loader.classList.remove('active');
        return;
    }

    completeLoadingProcess(filteredData);
}

/**
 * Acción del botón "CANCELAR" del modal
 */
function cancelLargeFileLoad() {
    document.getElementById('large-file-modal').classList.remove('active');
    tempLargeData = null;
    tempDateColumn = null;
    document.getElementById('file-input').value = ''; 
}

/**
 * Acción del botón "CONTINUAR" del modal
 */
function confirmLargeFileYear() {
    const select = document.getElementById('large-file-year-select');
    const selectedYear = select.value;
    const modal = document.getElementById('large-file-modal');
    const loader = document.getElementById('loading-overlay');

    modal.classList.remove('active');
    
    if (loader) loader.classList.add('active');

    setTimeout(() => {
        filterLargeData(selectedYear);
    }, 100);
}

/**
 * Filtra el dataset en memoria y continúa el proceso
 */
function filterLargeData(yearStr) {
    if (!tempLargeData) return;

    if (yearStr === 'all') {
        completeLoadingProcess(tempLargeData);
        tempLargeData = null;
        return;
    }

    const minYear = parseInt(yearStr);
    const col = tempDateColumn;
    
    console.log(`Filtrando datos... Conservar >= ${minYear}`);

    const filteredData = tempLargeData.filter(row => {
        const val = row[col];
        let y = 0;

        if (val instanceof Date) {
            y = val.getFullYear();
        } else if (typeof val === 'string') {
            const match = val.match(/(19|20)\d{2}/);
            if (match) y = parseInt(match[0]);
        }
        return y >= minYear;
    });

    tempLargeData = null;
    tempDateColumn = null;

    if (filteredData.length === 0) {
        // Alerta traducida
        const lang = (typeof currentLang !== 'undefined') ? currentLang : 'es';
        const msg = translations[lang].alert_no_records || "No records found.";
        
        alert(msg);
        
        const loader = document.getElementById('loading-overlay');
        if (loader) loader.classList.remove('active');
        return;
    }

    completeLoadingProcess(filteredData);
}