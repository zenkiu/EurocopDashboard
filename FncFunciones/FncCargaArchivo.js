/**
 * EUROCOP ANALYTICS - CARGA DE ARCHIVOS
 * Gestiona el drag & drop, lectura Excel/CSV con XLSX.js y transición al paso de mapeo.
 */

// ============================================================
// INICIALIZACIÓN DEL DROP ZONE
// Llamada desde el DOMContentLoaded central en script.js
// ============================================================
function initCargaArchivo() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    if (!dropZone || !fileInput) return;

    // Abrir selector al hacer clic en el área
    dropZone.onclick = () => fileInput.click();

    // Listener cuando se selecciona un archivo por el explorador
    fileInput.onchange = (e) => {
        if (e.target.files.length > 0) {
            processFile(e.target.files[0]);
            // LIMPIEZA CRÍTICA: permite volver a subir el mismo archivo
            e.target.value = "";
        }
    };

    // Prevención de comportamiento por defecto en todos los eventos de arrastre
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    // Efectos visuales de arrastre
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    // Listener cuando se suelta un archivo
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

    // Mostrar loader inmediatamente
    document.getElementById('loading-overlay').classList.add('active');

    // Pequeño retardo para que el navegador dibuje el spinner
    setTimeout(() => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                nombreArchivoSubido = file.name.replace(/\.[^/.]+$/, "").toUpperCase();
                const dataArr = new Uint8Array(e.target.result);

                // Carga del libro con optimización de memoria
                const wb = XLSX.read(dataArr, {
                    type: 'array',
                    cellDates: true,
                    cellNF: false,
                    cellText: false
                });

                const firstSheet = wb.SheetNames[0];
                const data = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], { defval: "" });

                if (data.length === 0) {
                    throw new Error("El archivo está vacío");
                }

                // Transición al paso de mapeo
                showMapping(data);
                console.log("Archivo cargado con éxito:", nombreArchivoSubido);

            } catch (error) {
                console.error("Error procesando Excel:", error);
                alert("Error: No se pudo leer el archivo. Asegúrate de que es un Excel o CSV válido.");
            } finally {
                document.getElementById('loading-overlay').classList.remove('active');
            }
        };

        reader.onerror = () => {
            alert("Error de lectura del archivo.");
            document.getElementById('loading-overlay').classList.remove('active');
        };

        reader.readAsArrayBuffer(file);
    }, 200);
}
