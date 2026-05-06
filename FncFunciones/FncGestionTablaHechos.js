/**
 * EUROCOP ANALYTICS - GESTIÓN TablaHechos
 * Permite al usuario cargar su TablaHechos.xlsx una vez.
 * Queda guardada en localStorage y persiste entre sesiones.
 *
 * Uso:
 *   - Botón visible en la sidebar siempre (icono de árbol)
 *   - Al cargar Incidencias sin tabla: aviso claro con botón de carga
 *   - FncTablaHechos.init() usa window.TABLA_HECHOS_TREE
 */

const FncGestionTablaHechos = (() => {

    const LS_KEY   = 'eurocop_tabla_hechos';
    const BTN_ID   = 'btn-cargar-tabla-hechos';
    const MODAL_ID = 'modal-tabla-hechos';

    // ── API pública ───────────────────────────────────────────────────────
    function estaDisponible() {
        return !!(window.TABLA_HECHOS_TREE && window.TABLA_HECHOS_TREE.length);
    }

    function eliminar() {
        if (!confirm('¿Eliminar la TablaHechos almacenada? Tendrás que volver a cargarla.')) return;
        localStorage.removeItem(LS_KEY);
        window.TABLA_HECHOS_TREE = null;
        if (typeof FncTablaHechos !== 'undefined') FncTablaHechos.reset();
        _actualizarBoton();
        _notificar('TablaHechos eliminada', 'info');
    }

    // ── Mostrar modal de carga ────────────────────────────────────────────
    function mostrarModal(esAviso) {
        let modal = document.getElementById(MODAL_ID);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = MODAL_ID;
            modal.style.cssText = `
                position:fixed;inset:0;z-index:9999;
                background:rgba(0,0,0,.55);backdrop-filter:blur(3px);
                display:flex;align-items:center;justify-content:center;
                animation:fadeIn .2s ease;`;
            modal.innerHTML = `
                <div style="background:white;border-radius:16px;padding:32px;
                    max-width:440px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.25);
                    animation:slideUp .2s ease;">
                    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
                        <div style="width:42px;height:42px;border-radius:10px;
                            background:#e8ebfd;display:flex;align-items:center;justify-content:center;">
                            <i class="fa-solid fa-sitemap" style="color:#5e72e4;font-size:1.1rem;"></i>
                        </div>
                        <div>
                            <div style="font-size:1rem;font-weight:800;color:#1a2a4a;">
                                ${esAviso ? 'TablaHechos requerida' : 'Cargar TablaHechos'}
                            </div>
                            <div style="font-size:0.75rem;color:#8898aa;margin-top:2px;">
                                ${esAviso
                                    ? 'El archivo de incidencias tiene motivos (NIVEL1ID) pero no hay TablaHechos cargada.'
                                    : 'Sube tu archivo TablaHechos.xlsx para activar el filtro de motivos.'}
                            </div>
                        </div>
                    </div>

                    ${estaDisponible() ? `
                    <div style="background:#f0fff4;border:1px solid #b7ebce;border-radius:10px;
                        padding:10px 14px;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
                        <i class="fa-solid fa-circle-check" style="color:#2ecc71;"></i>
                        <span style="font-size:0.78rem;font-weight:600;color:#27ae60;">
                            Tabla cargada: ${window.TABLA_HECHOS_TREE.length} nodos raíz
                        </span>
                        <button onclick="FncGestionTablaHechos.eliminar()" title="Eliminar tabla"
                            style="margin-left:auto;background:none;border:none;cursor:pointer;
                                color:#e74c3c;font-size:0.7rem;font-weight:700;padding:2px 6px;
                                border-radius:4px;transition:background .15s;"
                            onmouseover="this.style.background='#fde8e8'"
                            onmouseout="this.style.background='none'">
                            <i class="fa-solid fa-trash"></i> Eliminar
                        </button>
                    </div>` : ''}

                    <div id="th-drop-zone" style="border:2px dashed #c5cae9;border-radius:12px;
                        padding:28px;text-align:center;cursor:pointer;transition:all .2s;
                        background:#fafbff;"
                        onclick="document.getElementById('th-file-input').click()"
                        ondragover="event.preventDefault();this.style.borderColor='#5e72e4';this.style.background='#eef0fd';"
                        ondragleave="this.style.borderColor='#c5cae9';this.style.background='#fafbff';"
                        ondrop="FncGestionTablaHechos._onDrop(event)">
                        <i class="fa-solid fa-cloud-arrow-up" style="font-size:2rem;color:#5e72e4;margin-bottom:10px;display:block;"></i>
                        <div style="font-size:0.85rem;font-weight:700;color:#32325d;margin-bottom:4px;">
                            Haz clic o arrastra aquí tu TablaHechos.xlsx
                        </div>
                        <div style="font-size:0.72rem;color:#8898aa;">Solo archivos .xlsx</div>
                        <input id="th-file-input" type="file" accept=".xlsx" style="display:none;"
                            onchange="FncGestionTablaHechos._onFileSelected(this.files[0])">
                    </div>

                    <div id="th-progress" style="display:none;margin-top:14px;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                            <i class="fa-solid fa-spinner fa-spin" style="color:#5e72e4;"></i>
                            <span id="th-progress-text" style="font-size:0.78rem;color:#525f7f;font-weight:600;">
                                Procesando…
                            </span>
                        </div>
                        <div style="height:4px;background:#e2e8f0;border-radius:2px;">
                            <div id="th-progress-bar" style="height:100%;width:0%;background:#5e72e4;
                                border-radius:2px;transition:width .3s;"></div>
                        </div>
                    </div>

                    <div id="th-error" style="display:none;margin-top:12px;padding:10px 14px;
                        background:#fff5f5;border:1px solid #fbd0d0;border-radius:8px;
                        font-size:0.75rem;color:#c0392b;font-weight:600;"></div>

                    <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end;">
                        ${!esAviso ? `<button onclick="FncGestionTablaHechos.cerrarModal()"
                            style="padding:9px 18px;background:#f0f2f8;color:#525f7f;
                                border:none;border-radius:8px;font-size:0.8rem;font-weight:700;cursor:pointer;">
                            Cancelar
                        </button>` : ''}
                        <button onclick="document.getElementById('th-file-input').click()"
                            style="padding:9px 18px;background:#5e72e4;color:white;
                                border:none;border-radius:8px;font-size:0.8rem;font-weight:700;
                                cursor:pointer;display:flex;align-items:center;gap:6px;">
                            <i class="fa-solid fa-folder-open"></i> Seleccionar archivo
                        </button>
                    </div>
                </div>`;
            document.body.appendChild(modal);

            // Click fuera cierra (solo si no es aviso obligatorio)
            if (!esAviso) {
                modal.addEventListener('click', e => {
                    if (e.target === modal) cerrarModal();
                });
            }
        }
        modal.style.display = 'flex';
    }

    function cerrarModal() {
        const modal = document.getElementById(MODAL_ID);
        if (modal) modal.style.display = 'none';
    }

    // ── Procesar archivo ──────────────────────────────────────────────────
    function _onDrop(e) {
        e.preventDefault();
        const dz = document.getElementById('th-drop-zone');
        if (dz) { dz.style.borderColor = '#c5cae9'; dz.style.background = '#fafbff'; }
        const file = e.dataTransfer?.files?.[0];
        if (file) _onFileSelected(file);
    }

    function _onFileSelected(file) {
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.xlsx')) {
            _mostrarError('Solo se admiten archivos .xlsx');
            return;
        }
        _mostrarProgreso('Leyendo archivo…', 10);

        const reader = new FileReader();
        reader.onload = (e) => {
            _mostrarProgreso('Parseando Excel…', 40);
            setTimeout(() => {
                try {
                    const wb   = XLSX.read(e.target.result, { type: 'array' });
                    const ws   = wb.Sheets[wb.SheetNames[0]];
                    const data = XLSX.utils.sheet_to_json(ws, { defval: null });
                    _mostrarProgreso('Construyendo árbol…', 70);
                    setTimeout(() => {
                        try {
                            const tree = _buildTree(data);
                            _mostrarProgreso('Guardando…', 90);
                            const json = JSON.stringify(tree);
                            localStorage.setItem(LS_KEY, json);
                            window.TABLA_HECHOS_TREE = tree;
                            _mostrarProgreso('¡Listo!', 100);
                            _actualizarBoton();
                            setTimeout(() => {
                                cerrarModal();
                                _notificar(`TablaHechos cargada: ${tree.length} nodos raíz`, 'ok');
                                // Si hay datos de incidencias activos, reinicializar el árbol
                                if (typeof FncTablaHechos !== 'undefined'
                                    && typeof finalData !== 'undefined' && finalData.length
                                    && finalData.some(r => r.nivel1id || r.nivel2id || r.nivel3id)) {
                                    FncTablaHechos.init(finalData);
                                    if (typeof triggerUpdateWithLoader === 'function') triggerUpdateWithLoader();
                                }
                            }, 600);
                        } catch(err) {
                            _mostrarError('Error al construir el árbol: ' + err.message);
                        }
                    }, 50);
                } catch(err) {
                    _mostrarError('Error al leer el Excel: ' + err.message);
                }
            }, 50);
        };
        reader.readAsArrayBuffer(file);
    }

    // ── Construir árbol desde datos del Excel ─────────────────────────────
    function _buildTree(data) {
        // Columnas esperadas: RUTA_COMPLETA, NIVEL5_ID
        const root = {};
        data.forEach(row => {
            const ruta    = String(row['RUTA_COMPLETA'] || '').trim();
            const leafId  = parseInt(row['NIVEL5_ID']);
            if (!ruta || isNaN(leafId)) return;
            const parts = ruta.split(' + ').map(p => p.trim()).filter(Boolean);
            let node = root;
            parts.forEach((label, i) => {
                if (!node[label]) node[label] = { _id: null, _ids: [], _ch: {} };
                node[label]._ids.push(leafId);
                if (i === parts.length - 1) node[label]._id = leafId;
                node = node[label]._ch;
            });
        });

        function toArray(nodeMap) {
            return Object.entries(nodeMap).map(([label, data]) => ({
                l: label,
                i: data._id,
                d: [...new Set(data._ids)],
                c: toArray(data._ch),
            }));
        }
        return toArray(root);
    }

    // ── UI helpers ────────────────────────────────────────────────────────
    function _mostrarProgreso(texto, pct) {
        const p = document.getElementById('th-progress');
        const t = document.getElementById('th-progress-text');
        const b = document.getElementById('th-progress-bar');
        const e = document.getElementById('th-error');
        if (p) p.style.display = 'block';
        if (t) t.textContent = texto;
        if (b) b.style.width = pct + '%';
        if (e) e.style.display = 'none';
    }

    function _mostrarError(msg) {
        const p = document.getElementById('th-progress');
        const e = document.getElementById('th-error');
        if (p) p.style.display = 'none';
        if (e) { e.style.display = 'block'; e.textContent = '⚠️ ' + msg; }
    }

    function _notificar(msg, tipo) {
        const toast = document.createElement('div');
        const color = tipo === 'ok' ? '#2ecc71' : tipo === 'error' ? '#e74c3c' : '#5e72e4';
        toast.style.cssText = `
            position:fixed;bottom:24px;right:24px;z-index:99999;
            background:${color};color:white;padding:12px 18px;
            border-radius:10px;font-size:0.8rem;font-weight:700;
            box-shadow:0 4px 16px rgba(0,0,0,.2);
            animation:slideUp .3s ease;pointer-events:none;`;
        toast.innerHTML = `<i class="fa-solid ${tipo==='ok'?'fa-check':'fa-info-circle'}" style="margin-right:7px;"></i>${msg}`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // ── Botón en la sidebar ───────────────────────────────────────────────
    function _actualizarBoton() {
        const btn = document.getElementById(BTN_ID);
        if (!btn) return;
        const tiene = estaDisponible();
        btn.title   = tiene ? 'TablaHechos cargada — clic para cambiar' : 'Cargar TablaHechos (requerida para filtro de Motivos)';
        btn.style.borderColor  = tiene ? '#2ecc71' : '#f59e0b';
        btn.style.color        = tiene ? '#27ae60'  : '#92400e';
        btn.style.background   = tiene ? '#f0fff4'  : '#fffbe6';
        btn.querySelector('.th-btn-label').textContent = tiene ? 'Tabla cargada' : 'Cargar tabla';
        btn.querySelector('.th-btn-icon').className    = `fa-solid ${tiene?'fa-circle-check':'fa-circle-exclamation'} th-btn-icon`;
    }

    /**
     * Mostrar el botón solo cuando el archivo cargado tiene NIVEL IDs (es un archivo de incidencias).
     * Ocultar cuando se carga otro tipo de archivo.
     */
    function mostrarBoton(visible) {
        const btn = document.getElementById(BTN_ID);
        if (!btn) return;
        btn.style.display = visible ? 'flex' : 'none';
    }

    function insertarBoton() {
        // Insertar botón en la sidebar-actions junto al PDF
        const actions = document.querySelector('.sidebar-actions');
        if (!actions || document.getElementById(BTN_ID)) return;

        const btn = document.createElement('button');
        btn.id = BTN_ID;
        btn.style.cssText = `
            display:flex;align-items:center;gap:7px;
            width:100%;padding:9px 14px;
            border:1.5px solid #f59e0b;border-radius:10px;
            background:#fffbe6;color:#92400e;
            font-size:0.75rem;font-weight:700;cursor:pointer;
            transition:all .15s;margin-top:8px;`;
        btn.innerHTML = `
            <i class="fa-solid fa-circle-exclamation th-btn-icon" style="font-size:0.85rem;"></i>
            <span class="th-btn-label">Cargar tabla</span>
            <i class="fa-solid fa-sitemap" style="margin-left:auto;opacity:.6;font-size:0.75rem;"></i>`;
        btn.title = 'Cargar TablaHechos (requerida para filtro de Motivos)';
        btn.onclick = () => mostrarModal(false);
        btn.onmouseover = () => { btn.style.filter = 'brightness(.95)'; };
        btn.onmouseout  = () => { btn.style.filter = ''; };
        actions.appendChild(btn);
        btn.style.display = 'none'; // oculto por defecto; se muestra al detectar NIVEL IDs
        _actualizarBoton();
    }

    // ── Aviso cuando se carga Incidencias sin tabla ───────────────────────
    function mostrarAvisoSinTabla() {
        // Toast + modal automático
        const toast = document.createElement('div');
        toast.style.cssText = `
            position:fixed;bottom:24px;right:24px;z-index:99999;
            background:#f59e0b;color:white;padding:12px 18px;
            border-radius:10px;font-size:0.8rem;font-weight:700;
            box-shadow:0 4px 16px rgba(0,0,0,.3);cursor:pointer;
            animation:slideUp .3s ease;max-width:320px;`;
        toast.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="margin-right:7px;"></i>
            Archivo de incidencias cargado sin TablaHechos. <u>Clic para cargarla.</u>`;
        toast.onclick = () => { toast.remove(); mostrarModal(true); };
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 8000);
    }

    // ── Init ──────────────────────────────────────────────────────────────
    function init() {
        // Insertar botón cuando el DOM esté listo
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', insertarBoton);
        } else {
            setTimeout(insertarBoton, 500); // esperar a que se pinte la sidebar
        }
    }

    init();

    return { estaDisponible, mostrarModal, cerrarModal, eliminar, mostrarAvisoSinTabla, mostrarBoton, _onDrop, _onFileSelected };

})();
