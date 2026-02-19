/**
 * EUROCOP ANALYTICS - CARGA DE ARCHIVOS
 * Versión blindada: Bloquea años futuros en todos los casos.
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
        dropZone.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
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
                const wb = XLSX.read(dataArr, { type: 'array', cellDates: true });
                const firstSheet = wb.SheetNames[0];
                let data = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], { defval: "" });

                if (data.length === 0) throw new Error("El archivo está vacío");

                // --- [ PASO 1: DETECTAR COLUMNA DE FECHA ] ---
                const analysis = analyzeYearsInDataset(data);
                tempDateColumn = analysis.column;

                // --- [ PASO 2: LIMPIEZA OBLIGATORIA (QUITAR FUTURO) ] ---
                // Esto se aplica SIEMPRE, sea el archivo grande o pequeño.
                data = filterFutureYearsOnly(data, tempDateColumn);

                // --- [ PASO 3: OPTIMIZACIÓN ARCHIVOS GRANDES ] ---
                const ONE_MB = 1024 * 1024;
                if (file.size > ONE_MB && analysis.years.length > 0) {
                    tempLargeData = data;
                    showLargeFileModal(analysis.years);
                    if (loader) loader.classList.remove('active');
                    return; 
                }
                
                // Si es pequeño, procesamos los datos ya limpios de años futuros
                completeLoadingProcess(data);

            } catch (error) {
                console.error("Error:", error);
                alert("Error al procesar el archivo.");
                if (loader) loader.classList.remove('active');
            }
        };
        reader.readAsArrayBuffer(file);
    }, 200);
}

/**
 * Función interna para eliminar registros futuros sin preguntar
 */
function filterFutureYearsOnly(data, colName) {
    if (!colName) return data; // Si no hay columna de fecha, no podemos limpiar
    const currentYear = new Date().getFullYear();
    
    return data.filter(row => {
        const val = row[colName];
        let y = 0;
        if (val instanceof Date) y = val.getFullYear();
        else if (typeof val === 'string') {
            const match = val.match(/(19|20)\d{2}/);
            if (match) y = parseInt(match[0]);
        }
        // Solo permitimos registros del año actual o anteriores
        return y <= currentYear;
    });
}

/**
 * Finaliza la carga y pasa a la vista de Mapeo
 */
function completeLoadingProcess(data) {
    if (typeof showMapping === 'function') showMapping(data);
    const loader = document.getElementById('loading-overlay');
    if (loader) loader.classList.remove('active');
}

// ============================================================
// LÓGICA DE ANALISIS Y FILTRADO SELECCIONADO
// ============================================================

function analyzeYearsInDataset(data) {
    if (!data || data.length === 0) return { years: [], column: null };

    const columns = Object.keys(data[0]);
    const yearCounts = {};
    let bestColumn = null;
    let maxValidDates = 0;
    const currentYear = new Date().getFullYear(); // 2026

    // Aumentamos el muestreo: revisamos hasta 10,000 filas distribuidas
    let indicesToCheck = new Set();
    const totalRows = data.length;
    const sampleLimit = 5000; 

    if (totalRows <= sampleLimit * 2) {
        for (let i = 0; i < totalRows; i++) indicesToCheck.add(i);
    } else {
        // Primeras filas
        for (let i = 0; i < sampleLimit; i++) indicesToCheck.add(i);
        // Filas del medio (distribuidas)
        for (let i = 0; i < sampleLimit; i++) {
            indicesToCheck.add(Math.floor(Math.random() * totalRows));
        }
        // Últimas filas
        for (let i = totalRows - sampleLimit; i < totalRows; i++) indicesToCheck.add(i);
    }

    columns.forEach(col => {
        let validDates = 0;
        const tempYears = new Set();

        indicesToCheck.forEach(i => {
            const val = data[i][col];
            let year = null;

            // Detección 1: Objeto Date
            if (val instanceof Date && !isNaN(val)) {
                year = val.getFullYear();
            } 
            // Detección 2: String (Regex más fuerte para capturar 2026)
            else if (typeof val === 'string' || typeof val === 'number') {
                const strVal = String(val);
                const match = strVal.match(/\b(20\d{2})\b/); // Busca cualquier 20XX
                if (match) year = parseInt(match[1]);
            }

            // Filtro: Solo años lógicos (Desde el 2000 hasta el AÑO ACTUAL)
            if (year && year >= 2000 && year <= currentYear) {
                validDates++;
                tempYears.add(year);
            }
        });

        if (validDates > maxValidDates) {
            maxValidDates = validDates;
            bestColumn = col;
            yearCounts[col] = Array.from(tempYears).sort((a, b) => b - a);
        }
    });

    return { 
        years: bestColumn ? yearCounts[bestColumn] : [], 
        column: bestColumn 
    };
}

function showLargeFileModal(years) {
    const modal = document.getElementById('large-file-modal');
    const select = document.getElementById('large-file-year-select');
    if (!modal || !select) return;

    const lang = (typeof currentLang !== 'undefined') ? currentLang : 'es';
    const t = translations[lang] || {};
    select.innerHTML = '';
    
    // El 'years' ya viene ordenado de mayor a menor y filtrado hasta el año actual.
    // Tomamos los 4 más recientes encontrados en el archivo.
    const recentYears = years.slice(0, 4);

    if (recentYears.length === 0) {
        // Si por algún motivo no hay años (archivo raro), ponemos el actual por defecto
        const currentYear = new Date().getFullYear();
        const opt = document.createElement('option');
        opt.value = currentYear;
        opt.textContent = `${t.modal_large_opt_from || "Desde"} ${currentYear}`;
        select.appendChild(opt);
    } else {
        recentYears.forEach(y => {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = `${t.modal_large_opt_from || "Desde"} ${y}`;
            select.appendChild(opt);
        });
    }

    const optAll = document.createElement('option');
    optAll.value = 'all';
    optAll.textContent = t.modal_large_opt_all || "Todo el histórico (Hasta hoy)";
    optAll.style.color = '#f5365c';
    select.appendChild(optAll);

    modal.classList.add('active');
}

function confirmLargeFileYear() {
    const selectedYear = document.getElementById('large-file-year-select').value;
    document.getElementById('large-file-modal').classList.remove('active');
    const loader = document.getElementById('loading-overlay');
    if (loader) loader.classList.add('active');

    setTimeout(() => {
        if (selectedYear === 'all') {
            // Ya ha sido filtrado de años futuros en processFile
            completeLoadingProcess(tempLargeData);
        } else {
            const minYear = parseInt(selectedYear);
            const filtered = tempLargeData.filter(row => {
                const val = row[tempDateColumn];
                let y = 0;
                if (val instanceof Date) y = val.getFullYear();
                else if (typeof val === 'string') {
                    const match = val.match(/(19|20)\d{2}/);
                    if (match) y = parseInt(match[0]);
                }
                return y >= minYear; // El "techo" del año actual ya se aplicó antes
            });
            completeLoadingProcess(filtered);
        }
        tempLargeData = null;
    }, 100);
}

function cancelLargeFileLoad() {
    document.getElementById('large-file-modal').classList.remove('active');
    tempLargeData = null;
    document.getElementById('file-input').value = ''; 
}