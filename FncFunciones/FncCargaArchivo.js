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

/**
 * Muestra un mensaje amigable en la zona de carga (sin alert del navegador).
 * type: 'warning' | 'error' | 'info'
 */
function _showFileMessage(title, message, type) {
    const icons   = { warning: '⚠️', error: '❌', info: 'ℹ️' };
    const colors  = { warning: '#f39c12', error: '#e74c3c', info: '#5e72e4' };
    const bgColors = { warning: '#fffbf0', error: '#fff5f5', info: '#f0f2ff' };
    const color   = colors[type]  || colors.info;
    const bg      = bgColors[type] || bgColors.info;
    const icon    = icons[type]   || icons.info;

    // Intentar mostrar en el dropzone o crear un toast
    const dropzone = document.getElementById('drop-zone') || document.getElementById('dropzone') || document.getElementById('upload-area');
    if (dropzone) {
        // Insertar mensaje encima del dropzone
        let msgBox = document.getElementById('_ec_file_msg');
        if (!msgBox) {
            msgBox = document.createElement('div');
            msgBox.id = '_ec_file_msg';
            dropzone.parentNode.insertBefore(msgBox, dropzone);
        }
        msgBox.innerHTML = `
            <div style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;
                background:${bg};border:1px solid ${color};border-radius:10px;
                margin-bottom:12px;font-family:Arial,sans-serif;">
                <span style="font-size:1.3rem;line-height:1;">${icon}</span>
                <div>
                    <div style="font-weight:800;font-size:0.85rem;color:${color};margin-bottom:3px;">${title}</div>
                    <div style="font-size:0.8rem;color:#525f7f;line-height:1.4;">${message}</div>
                </div>
                <button onclick="document.getElementById('_ec_file_msg').innerHTML=''"
                    style="margin-left:auto;background:none;border:none;cursor:pointer;
                    color:#aaa;font-size:1rem;padding:0 4px;line-height:1;">✕</button>
            </div>`;
        // Auto-ocultar tras 8 segundos
        setTimeout(() => { if (msgBox) msgBox.innerHTML = ''; }, 8000);
    } else {
        // Fallback: toast flotante
        let toast = document.createElement('div');
        toast.style.cssText = `position:fixed;top:80px;left:50%;transform:translateX(-50%);
            z-index:9999;padding:14px 20px;background:${bg};border:1px solid ${color};
            border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.15);max-width:420px;
            font-family:Arial,sans-serif;text-align:center;`;
        toast.innerHTML = `<div style="font-weight:800;color:${color};">${icon} ${title}</div>
            <div style="font-size:0.8rem;color:#525f7f;margin-top:5px;">${message}</div>`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 8000);
    }
}

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

                // --- [ PASO 0: VERIFICAR QUE HAY DATOS ] ---
                if (data.length === 0) {
                    if (loader) loader.classList.remove('active');
                    _showFileMessage(
                        _td('file_empty_title') || 'Archivo sin datos',
                        _td('file_empty_msg')   || 'El archivo se ha leído correctamente pero no contiene filas de datos. Comprueba que el Excel tiene registros además de la cabecera.',
                        'warning'
                    );
                    return;
                }

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
                
                // --- [ PASO 4: VERIFICAR QUE QUEDAN DATOS TRAS FILTRAR FUTUROS ] ---
                if (data.length === 0) {
                    if (loader) loader.classList.remove('active');
                    _showFileMessage(
                        _td('file_empty_title') || 'Archivo sin datos',
                        _td('file_future_msg')  || 'El archivo solo contiene registros con fecha futura y han sido descartados. Comprueba las fechas del Excel.',
                        'warning'
                    );
                    return;
                }
                // Si es pequeño, procesamos los datos ya limpios de años futuros
                completeLoadingProcess(data);

            } catch (error) {
                console.error("Error:", error);
                if (loader) loader.classList.remove('active');
                _showFileMessage(
                    _td('file_error_title') || 'Error al procesar el archivo',
                    _td('file_error_msg')   || 'No se ha podido leer el archivo. Asegúrate de que es un Excel (.xlsx / .xls) válido y no está dañado.',
                    'error'
                );
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
    // Detección de archivos especiales (Atestados PJ)
    if (typeof FncAtestadosPJ !== 'undefined' &&
        FncAtestadosPJ.esArchivoPJ(typeof nombreArchivoSubido !== 'undefined' ? nombreArchivoSubido : '')) {
        FncAtestadosPJ.init(data, nombreArchivoSubido);
        return;
    }
    // Detección de archivos especiales (Atestados DSV-GV)
    if (typeof FncAtestados !== 'undefined' &&
        FncAtestados.esArchivoAtestados(typeof nombreArchivoSubido !== 'undefined' ? nombreArchivoSubido : '')) {
        FncAtestados.init(data, nombreArchivoSubido);
        return; // FncAtestados toma el control completo
    }

    // Notificar al módulo KPI para detectar si tiene estructura KPI
    // (no intercepta — solo registra los datos y muestra el botón si corresponde)
    if (typeof FncKPI !== 'undefined') {
        FncKPI.onDatosCargados(data, typeof nombreArchivoSubido !== 'undefined' ? nombreArchivoSubido : '');
    }
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
        let fullDateMatches = 0; // Cuenta cuántos valores parecen fechas COMPLETAS (DD/MM/YYYY)
        const tempYears = new Set();

        indicesToCheck.forEach(i => {
            const val = data[i][col];
            let year = null;
            let isFullDate = false;

            // Detección 1: Objeto Date (XLSX con cellDates:true)
            if (val instanceof Date && !isNaN(val)) {
                year = val.getFullYear();
                isFullDate = true;
            }
            // Detección 2: String con separadores de fecha (DD/MM/YYYY, YYYY-MM-DD...)
            else if (typeof val === 'string') {
                const strVal = val.trim();
                if (strVal.includes('/') || strVal.includes('-')) {
                    const match = strVal.match(/\b(20\d{2})\b/);
                    if (match) { year = parseInt(match[1]); isFullDate = true; }
                }
            }
            // Detección 3: Número puro — puede ser año solo (2024) o serial Excel
            else if (typeof val === 'number') {
                const strVal = String(val);
                const match = strVal.match(/^(20\d{2})$/); // Solo si ES exactamente un año
                if (match) year = parseInt(match[1]);
                // isFullDate queda false → no puntúa como fecha completa
            }

            if (year && year >= 2000 && year <= currentYear) {
                validDates++;
                if (isFullDate) fullDateMatches++;
                tempYears.add(year);
            }
        });

        // Usamos fullDateMatches como criterio principal para evitar que columnas
        // con solo el año (REFANNO) ganen sobre columnas con fecha completa (FECHA)
        const score = fullDateMatches * 10000 + validDates;
        if (score > maxValidDates) {
            maxValidDates = score;
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