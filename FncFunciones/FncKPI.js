/**
 * EUROCOP ANALYTICS — FncKPI.js
 * ─────────────────────────────────────────────────────────────
 * Módulo completo KPI-02: lógica + UI
 * Activado mediante el botón "Visor KPI" del dashboard
 * (no intercepta la carga — el archivo va al dashboard normal)
 *
 * KPI-02: Registro completo de avisos
 *   Fórmula: Nº avisos completos / Nº avisos visualizados (filtrados) × 100
 *   Aviso completo = PRIORIDAD + PATRULLA no vacíos
 *                  + LATITUD + LONGITUD si existen en el Excel
 *
 * Columnas soportadas:
 *   NUMLLAMADA, ANOLLAMADA, VIA, TIPOLOGIA,
 *   CBPRIORIDADAVISO (o PRIORIDAD), TIPOBYESTADOOPERATIVOID,
 *   PATRULLAASIGNADA, FECHAINICIO, FECHALLEGADA, FECHAFINALIZACION
 *   (opcionales) LATITUD, LONGITUD
 */

const FncKPI = (() => {

    // ════════════════════════════════════════════════════════════
    // TRADUCCIONES
    // ════════════════════════════════════════════════════════════
    const MESES = {
        es: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
        eu: ['Urtarrila','Otsaila','Martxoa','Apirila','Maiatza','Ekaina','Uztaila','Abuztua','Iraila','Urria','Azaroa','Abendua'],
        ca: ['Gener','Febrer','Març','Abril','Maig','Juny','Juliol','Agost','Setembre','Octubre','Novembre','Desembre'],
        gl: ['Xaneiro','Febreiro','Marzo','Abril','Maio','Xuño','Xullo','Agosto','Setembro','Outubro','Novembro','Decembro']
    };

    function t(key) {
        const k = 'kpi_' + key;
        const tr  = typeof translations !== 'undefined' ? translations : null;
        const lng = typeof currentLang  !== 'undefined' ? currentLang  : 'es';
        if (tr && tr[lng]  && tr[lng][k])  return tr[lng][k];
        if (tr && tr['es'] && tr['es'][k]) return tr['es'][k];
        const fb = {
            titulo:'Indicadores KPI', actualizar:'Cuadro de Mando KPI',
            municipio:'Municipio', introducir_anyo:'Introduce año',
            selecciona_mes:'Selecciona mes',
            total_avisos:'Total avisos (filtrados)',
            avisos_completos:'Avisos completos',
            avisos_incompletos:'Avisos incompletos',
            objetivo:'Objetivo', objetivo_val:'≥ 98%', frecuencia:'Mensual',
            cumple:'Cumple', no_cumple:'No cumple', alerta:'Alerta',
            detalle_campos:'Campos verificados',
            campo_lat:'Latitud', campo_lon:'Longitud',
            campo_prioridad:'Prioridad', campo_patrulla:'Patrulla asignada',
            campo_titulo:'Título',
            filtro_prioridad:'Prioridad', filtro_tipologia:'Tipología',
            filtro_patrulla:'Patrulla', todos:'Todos',
            ver_avisos:'Ver avisos', cerrar:'Cerrar',
            aviso_num:'Aviso', aviso_via:'Vía',
            aviso_prioridad:'Prioridad', aviso_patrulla:'Patrulla',
            aviso_fecha:'Fecha inicio', aviso_completo:'Completo',
            si:'Sí', no:'No',
            exportar_pdf:'Exportar PDF', imprimir:'Imprimir',
            sin_datos:'Sin datos para el periodo seleccionado',
            inicio:'Inicio', visor_btn:'Visor KPI',
            volver:'Volver al Dashboard',
            selector_kpi:'KPI',
            filtros_activos_dash:'Filtros activos del dashboard:',
            // KPI-01
            kpi01_nombre:'Llamadas Operativas <30s',
            kpi01_atendidas:'Llamadas operativas',
            kpi01_no_atendidas:'No atendidas <30s',
            kpi01_sin_llegada:'Sin llegada registrada',
            kpi01_distribucion:'DISTRIBUCIÓN DE TIEMPOS',
            kpi01_total:'Total llamadas',
            // KPI-03
            kpi03_nombre:'Incidencias no urgentes ≤72h',
            kpi03_total:'Total no urgentes',
            kpi03_en_plazo:'Cerradas ≤72h',
            kpi03_fuera_plazo:'Cerradas >72h',
            kpi03_sin_cierre:'Sin cierre',
            kpi03_distribucion:'DISTRIBUCIÓN DE TIEMPOS DE CIERRE',
            // KPI-04
            kpi04_nombre:'Emergencias prioritarias ≤10min',
            kpi04_total:'Total servicios A',
            kpi04_en_plazo:'Llegada ≤10min',
            kpi04_fuera_plazo:'Llegada >10min',
            kpi04_distribucion:'DISTRIBUCIÓN DE TIEMPOS DE LLEGADA (A)',
            kpi04_formula:'(Nº servicios A con llegada ≤10min / Nº servicios A) × 100',
            kpi04_formula_sub:'Prioridad A · Tiempo: FECHAASIGNACION → FECHALLEGADA',
            // KPI-05
            kpi05_nombre:'Urgencias ≤20min',
            kpi05_total:'Total servicios B',
            kpi05_en_plazo:'Llegada ≤20min',
            kpi05_fuera_plazo:'Llegada >20min',
            kpi05_distribucion:'DISTRIBUCIÓN DE TIEMPOS DE LLEGADA (B)',
            kpi05_formula:'(Nº servicios B con llegada ≤20min / Nº servicios B) × 100',
            kpi05_formula_sub:'Prioridad B · Tiempo: FECHAASIGNACION → FECHALLEGADA',
            objetivo_85:'≥ 85%',
            sin_llegada_label:'Sin llegada registrada',
            prioridad_a:'Prioridad A',
            prioridad_b:'Prioridad B',
            // Claves nuevas compartidas
            estado:'Estado',
            formula_02:'Nº avisos completos (filtrados) ÷ Nº avisos visualizados (filtrados) × 100',
            formula_01:'Nº llamadas atendidas <30s ÷ Nº total llamadas × 100',
            formula_01_sub:'Tiempo medido: FECHAINICIO → FECHALLEGADA',
            formula_03:'Nº incidencias no urgentes cerradas ≤72h ÷ Nº incidencias no urgentes × 100',
            formula_03_sub:'No urgentes = Prioridad Baja o Media',
            rango_tiempo:'Rango de tiempo',
            objetivo_95:'≥ 95%',
            objetivo_90:'≥ 90%',
            en_plazo:'Cerradas ≤72h',
            fuera_plazo:'Cerradas >72h',
            sin_cierre_label:'Sin cierre',
            total_llamadas:'Total llamadas',
            titulo_lateral:'CUADRO DE MANDO KPI',
            todos_datos:'Todos los datos',
            tipologia_sel:'seleccionadas',
            tipologia_label:'Tipología',
            anos_label:'Años',
            meses_label:'Meses',
            ver_formula:'Toca para ver fórmula',
            ver_info:'Información del KPI',
            kpi01_info:'Mide el porcentaje de llamadas operativas atendidas en menos de 30 segundos. Objetivo ≥ 95%. Tiempo: FECHAINICIO → FECHALLEGADA.',
            kpi02_info:'Mide la completud del registro: avisos con Prioridad, Patrulla, Latitud, Longitud y Título rellenos. Objetivo ≥ 98%.',
            kpi03_info:'Incidencias no urgentes (Baja/Media) cerradas en ≤72h. Objetivo ≥ 90%. Tiempo: FECHAINICIO → FECHAFINALIZACION.',
            kpi04_info:'Emergencias prioritarias (Prioridad A) con llegada ≤10 min. Objetivo ≥ 90%. Tiempo: FECHAASIGNACION → FECHALLEGADA.',
            kpi05_info:'Urgencias (Prioridad B) con llegada ≤20 min. Objetivo ≥ 85%. Tiempo: FECHAASIGNACION → FECHALLEGADA.',
            kpi06_info:'Detecta si los incidentes cerrados generan una nueva llamada en ≤24h. Objetivo ≤ 8% (inverso: menos recontacto = mejor). Columna: VIA.',
            kpi07_info:'Media de satisfacción ciudadana (escala 1–5). Objetivo ≥ 4.2/5. Columna: SATISFACCIONCIUDADANA, formato \'N Nivel Satisfacción\'.',
            kpi08_nombre:'Atención accidentes con lesiones ≤15min',
            kpi08_total:'Total accidentes con lesiones',
            kpi08_en_plazo:'Llegada ≤15min',
            kpi08_fuera_plazo:'Llegada >15min',
            kpi08_sin_llegada:'Sin llegada registrada',
            kpi08_distribucion:'Distribución tiempos de llegada',
            kpi08_formula:'(Nº accidentes con lesiones con llegada ≤15min / Nº accidentes con lesiones) × 100',
            kpi08_formula_sub:'Accidentes con lesiones: DSVLESIONES=True · Tiempo: FECHAINICIO → FECHALLEGADA',
            kpi08_info:'Mide el porcentaje de accidentes de tráfico con lesiones (DSVLESIONES=True) en los que la patrulla llega en ≤15 minutos desde la llamada (FECHAINICIO). Objetivo ≥ 90%.',
            kpi18_nombre:'Tiempo llegada VG/menores ≤8min',
            kpi18_total:'Total servicios VG/menores',
            kpi18_en_plazo:'Llegada ≤8min',
            kpi18_fuera_plazo:'Llegada >8min',
            kpi18_sin_llegada:'Sin llegada registrada',
            kpi18_distribucion:'Distribución tiempos de llegada',
            kpi18_formula:'(Nº servicios VG/menores con llegada ≤8min / Nº servicios VG/menores) × 100',
            kpi18_formula_sub:'VG/menores: TITULO contiene \'VG\' o \'menor\' · Tiempo: FECHAINICIO → FECHALLEGADA',
            kpi18_info:'Servicios de violencia de género (VG) o riesgo para menores con llegada ≤8min. Objetivo ≥ 90%.',
            kpi19_nombre:'Derivación a Servicios Sociales ≤24h',
            kpi19_total:'Total casos que requieren derivación',
            kpi19_en_plazo:'Derivados ≤24h',
            kpi19_fuera_plazo:'Derivados >24h',
            kpi19_sin_tramite:'Sin tramitar',
            kpi19_distribucion:'Distribución tiempos de derivación',
            kpi19_formula:'(Nº casos derivados ≤24h / Nº casos que requieren derivación) × 100',
            kpi19_formula_sub:'Derivación: TRAMITE contiene \'KPI-19\' · Tiempo: FECHAALTAINCIDENCIA → FECHATRAMITE',
            kpi19_info:'Casos VG/menores derivados a Servicios Sociales en ≤24h desde el alta. Objetivo ≥ 95%.',
            kpi19_tipo_incidente:'Tipo incidente',
            kpi19_fecha_alta:'Alta incidencia',
            kpi19_fecha_tramite:'Fecha trámite',
            kpi19_tiempo:'Tiempo',
            kpi20_nombre:'Seguimiento víctimas ≤7 días',
            kpi20_total:'Total casos con seguimiento previsto',
            kpi20_en_plazo:'Seguimiento ≤7 días',
            kpi20_fuera_plazo:'Seguimiento >7 días',
            kpi20_sin_tramite:'Sin seguimiento documentado',
            kpi20_distribucion:'Distribución tiempos de seguimiento',
            kpi20_formula:'(Nº casos con seguimiento ≤7 días / Nº casos con seguimiento previsto) × 100',
            kpi20_formula_sub:'Seguimiento: TRAMITE contiene \'KPI-20\' · Tiempo: FECHAALTAINCIDENCIA → FECHATRAMITE',
            kpi20_info:'Víctimas VG/menores con seguimiento documentado en ≤7 días. Objetivo ≥ 90%.',
            kpi23_nombre:'Quejas/sugerencias respondidas ≤15 días hábiles',
            kpi23_total:'Total quejas/sugerencias recibidas',
            kpi23_en_plazo:'Respondidas ≤15 días hábiles',
            kpi23_fuera_plazo:'Respondidas >15 días hábiles',
            kpi23_sin_tramite:'Sin respuesta',
            kpi23_distribucion:'Distribución días hábiles hasta respuesta',
            kpi23_formula:'(Nº quejas/sugerencias respondidas ≤15 días hábiles / Nº recibidas) × 100',
            kpi23_formula_sub:'Respondida: TRAMITE contiene \'KPI-23\' · Días hábiles: FECHAALTAINCIDENCIA → FECHATRAMITE',
            kpi23_info:'Quejas y sugerencias respondidas en ≤15 días hábiles. Objetivo ≥ 95%.',
            kpi21_nombre:'Formación: media horas por agente/año',
            kpi21_agentes:'Agentes con registro',
            kpi21_con_horas:'Agentes ≥20h/año',
            kpi21_sin_horas:'Agentes <20h o sin horas',
            kpi21_media:'Media h/agente',
            kpi21_total_horas:'Total horas impartidas',
            kpi21_distribucion:'Distribución horas por agente',
            kpi21_agente:'Agente',
            kpi21_horas_agente:'Horas formación',
            kpi21_cursos:'Nº cursos',
            kpi21_formula:'Σ horas formación impartidas / Nº agentes',
            kpi21_formula_sub:'Horas: NUMEROHORAS (suma por agente) · Agentes: NUMEROPROFESIONAL únicos',
            kpi21_info:'Media de horas de formación por agente/año. Objetivo ≥ 20 h/agente/año.',
            kpi09_nombre:'Cierre atestados ≤10 días hábiles',
            kpi09_total:'Total atestados abiertos',
            kpi09_en_plazo:'Remitidos ≤10 días hábiles',
            kpi09_fuera_plazo:'Remitidos >10 días hábiles',
            kpi09_sin_remision:'Sin remitir',
            kpi09_distribucion:'Distribución días hábiles hasta remisión',
            kpi09_formula:'(Nº atestados remitidos ≤10 días hábiles / Nº atestados abiertos) × 100',
            kpi09_formula_sub:'Remitido: FECHAREMISION con contenido · Días hábiles: FECHAAPERTURA → FECHAREMISION',
            kpi09_info:'Atestados finalizados y remitidos en ≤10 días hábiles. Objetivo ≥ 85%.',
            kpi10_nombre:'Calidad documental atestados',
            kpi10_revisados:'Atestados revisados (FINALIZADO=True)',
            kpi10_sin_subsanacion:'Sin subsanación',
            kpi10_con_subsanacion:'Con subsanación',
            kpi10_no_procesados:'Sin revisar',
            kpi10_distribucion:'Estado de subsanación',
            kpi10_formula:'(Nº atestados sin subsanación / Nº atestados revisados) × 100',
            kpi10_formula_sub:'Revisados: FINALIZADO=True · Sin subsanación: SUBSANACION vacío',
            kpi10_info:'Atestados sin requerimientos de subsanación por fiscalía/juzgado/aseguradora. Objetivo ≥ 95%.',
            kpi11_nombre:'Controles planificados ejecutados',
            kpi11_total:'Total controles planificados',
            kpi11_ejecutados:'Controles ejecutados',
            kpi11_no_ejecutados:'No ejecutados',
            kpi11_distribucion:'Distribución por tipo de control',
            kpi11_formula:'(Nº controles ejecutados / Nº controles planificados) × 100',
            kpi11_formula_sub:'Ejecutado: NUMVEHICULOS no vacío y > 0 · Planificado: todos los registros',
            kpi11_info:'Mide el porcentaje de controles de tráfico planificados que se han ejecutado efectivamente. Ejecutado: NUMVEHICULOS > 0. Objetivo ≥ 95%.',
            kpi13_nombre:'Plazo emisión informes policiales ≤10 días',
            kpi13_total:'Total informes solicitados',
            kpi13_en_plazo:'Emitidos ≤10 días hábiles',
            kpi13_fuera_plazo:'Emitidos >10 días hábiles',
            kpi13_sin_emitir:'Sin emitir (sin FECHASALIDA)',
            kpi13_distribucion:'Distribución por tipo de informe',
            kpi13_formula:'(Nº informes emitidos ≤10 días hábiles / Nº informes solicitados) × 100',
            kpi13_formula_sub:'Emitido: FECHASALIDA con contenido · Días hábiles: FECHAREGISTRO → FECHASALIDA',
            kpi13_info:'Informes policiales emitidos en ≤10 días hábiles desde la solicitud. Objetivo ≥ 90%.',
            kpi14_nombre:'Gestión denuncias sin devolución',
            kpi14_total:'Total expedientes incoados',
            kpi14_sin_devolucion:'Sin devolución (Finalizado)',
            kpi14_con_devolucion:'Con devolución / otros estados',
            kpi14_grabado:'En tramitación (Grabado)',
            kpi14_pendiente:'Pendiente de actuación',
            kpi14_distribucion:'Distribución por tipo de expediente',
            kpi14_formula:'(Nº expedientes sin devolución / Nº expedientes incoados) × 100',
            kpi14_formula_sub:'Sin devolución: ESTADO = Finalizado · Incoados: todos los registros',
            kpi14_info:'Expedientes denuncias incoados correctamente sin devolución (ESTADO=Finalizado). Objetivo ≥ 97%.',
            kpi15_nombre:'Eventos con plan operativo ≥72h antes',
            kpi15_total:'Total eventos planificados',
            kpi15_en_plazo:'Plan aprobado ≥72h antes',
            kpi15_fuera_plazo:'Plan aprobado <72h o sin plan',
            kpi15_sin_solicitud:'Sin fecha de solicitud',
            kpi15_distribucion:'Distribución antelación del plan',
            kpi15_formula:'(Nº eventos con plan aprobado ≥72h / Nº eventos planificados) × 100',
            kpi15_formula_sub:'Plan aprobado: TITULO = \'Evento Plan Aprobado KPI-15\' (exacto) · Antelación: FECHASOLICITUD → FECHAINICIO',
            kpi15_info:'Eventos con plan operativo aprobado ≥72h antes del inicio. Objetivo ≥ 95%.',
            // KPI-06
            kpi06_nombre:'Recontacto mismo incidente ≤24h',
            kpi06_total:'Total incidentes cerrados',
            kpi06_recontacto:'Con recontacto ≤24h',
            kpi06_sin_recontacto:'Sin recontacto',
            kpi06_distribucion:'Distribución de recontactos',
            kpi06_formula:'(Nº incidentes con recontacto ≤24h / Nº incidentes cerrados) × 100',
            kpi06_formula_sub:'Recontacto = nueva llamada misma vía/tipología en ≤24h desde cierre',
            // KPI-07
            kpi07_nombre:'Satisfacción ciudadana media',
            kpi07_total:'Encuestas recibidas',
            kpi07_media:'Puntuación media',
            kpi07_satisfechos:'Puntuación ≥ 4',
            kpi07_no_satisfechos:'Puntuación < 4',
            kpi07_distribucion:'Distribución de puntuaciones',
            kpi07_formula:'Σ puntuaciones / Nº respuestas (escala 1–5)',
            kpi07_formula_sub:'Columna: SATISFACCIONCIUDADANA · Formato: N Nivel Satisfacción',
            kpi07_sin_respuesta:'Sin respuesta',
        };
        return fb[key] || key;
    }

    // ════════════════════════════════════════════════════════════
    // ESTADO
    // ════════════════════════════════════════════════════════════
    let _rawData          = [];
    let _rawDataAtestados = [];   // datos del archivo KPI-09/10 (atestados viales)
    let _kpisDisponibles  = new Set(); // KPIs activados según columnas detectadas
    let _rawDataControles = [];          // datos del archivo KPI-11 (controles viales)
    let _rawDataInformes  = [];          // datos del archivo KPI-13 (informes policiales)
    let _rawDataDenuncias = [];          // datos del archivo KPI-14 (denuncias administrativas)
    let _rawDataEventos   = [];          // datos del archivo KPI-15 (eventos/dispositivos)
    let _rawDataVulnerables = [];        // datos del archivo KPI-19/20 (VG/menores derivación y seguimiento)
    let _rawDataFormacion   = [];        // datos del archivo KPI-21 (formación agentes)
    let _años             = [];
    let _añoSel           = null;
    let _mesSel           = null;
    let _tieneLat         = false;
    let _tieneLon         = false;
    let _tieneTitulo      = false;
    let _kpiActivo        = 'kpi02';  // 'kpi02' | 'kpi01' | 'kpi03' | 'kpi04' | 'kpi05' | 'kpi06' | 'kpi07'
    let _filtroPrioridad  = '';
    let _filtroTipologia  = '';
    let _filtroPatrulla   = '';
    let _cargado          = false;    // indica si hay datos KPI disponibles
    let _empresaActual    = '';       // nombre de la empresa extraído del nombre de archivo

    // ════════════════════════════════════════════════════════════
    // DETECCIÓN
    // ════════════════════════════════════════════════════════════
    // Detecta si los datos cargados corresponden a un archivo KPI
    // Se llama DESPUÉS de que el dashboard ha procesado el Excel
    function detectarDesdeData(data, filename) {
        if (!filename) return false;
        const up = filename.toUpperCase();
        if (!data || !data[0]) return false;
        const keys = Object.keys(data[0]).map(k => k.toUpperCase());
        // Detectar archivo formación (KPI-21): tiene NUMEROPROFESIONAL y NUMEROHORAS
        if (keys.includes('NUMEROPROFESIONAL') && keys.includes('NUMEROHORAS')) {
            return true;
        }
        // Detectar archivo vulnerables (KPI-19/20): tiene TRAMITE y FECHAALTAINCIDENCIA
        if (keys.includes('TRAMITE') && keys.includes('FECHAALTAINCIDENCIA') && keys.includes('FECHATRAMITE')) {
            return true;
        }
        // Detectar archivo de eventos (KPI-15): tiene FECHASOLICITUD y FECHAINICIO y FECHAFIN
        if (keys.includes('FECHASOLICITUD') && keys.includes('FECHAINICIO') && keys.includes('FECHAFIN') &&
            !keys.includes('FECHADENUNCIA') && !keys.includes('NUMVEHICULOS') && !keys.includes('FINALIZADO')) {
            return true;
        }
        // Detectar archivo de denuncias (KPI-14): tiene FECHADENUNCIA y ESTADO
        if (keys.includes('FECHADENUNCIA') && keys.includes('ESTADO') &&
            !keys.includes('NUMVEHICULOS') && !keys.includes('FECHASALIDA') && !keys.includes('FINALIZADO')) {
            return true;
        }
        // Detectar archivo de informes (KPI-13): tiene FECHASALIDA y FECHAREGISTRO (sin NUMVEHICULOS ni FINALIZADO)
        if (keys.includes('FECHASALIDA') && keys.includes('FECHAREGISTRO') &&
            !keys.includes('NUMVEHICULOS') && !keys.includes('FINALIZADO')) {
            return true;
        }
        // Detectar archivo de controles (KPI-11): tiene NUMVEHICULOS y FECHAHORAINICIO
        if (keys.includes('NUMVEHICULOS') && keys.includes('FECHAHORAINICIO')) {
            return true;
        }
        // Detectar archivo de atestados (KPI-09/10): tiene FECHAREMISION y FINALIZADO
        if (keys.includes('FECHAREMISION') && keys.includes('FINALIZADO')) {
            return true;
        }
        // KPI operacional si el nombre contiene KPI o tiene columnas esperadas
        if (!up.includes('KPI')) {
            const hasKPIcols = (keys.includes('NUMLLAMADA') || keys.includes('CBPRIORIDADAVISO')
                                || keys.includes('FECHAINICIO'))
                             && (keys.includes('PATRULLAASIGNADA') || keys.includes('PRIORIDAD'));
            if (!hasKPIcols) return false;
        }
        return true;
    }

    // ════════════════════════════════════════════════════════════
    // PARSEO — usando los mismos datos ya cargados en el dashboard
    // ════════════════════════════════════════════════════════════
    function parsearDatos(data) {
        _rawData = data.map(row => {
            const r = {};
            Object.keys(row).forEach(k => { r[k.toUpperCase().trim()] = row[k]; });

            // ── Formato 1: KPI-P01 (nuevo) ───────────────────────────────
            // REFNUM, REFANNO, FECHA (DD/MM/YYYY), HORA, LATITUD, LONGITUD,
            // TITULO, PRIORIDAD, PATRULLAASIGNADA
            // ── Formato 2: KPI-01 (antiguo) ──────────────────────────────
            // NUMLLAMADA, ANOLLAMADA, FECHAINICIO (DD/MM/YYYY HH:MM),
            // TIPOLOGIA, CBPRIORIDADAVISO, PATRULLAASIGNADA

            // Número de aviso
            const num = parseInt(r['REFNUM'] ?? r['NUMLLAMADA']) || 0;

            // Fecha: acepta FECHA (DD/MM/YYYY) o FECHAINICIO (DD/MM/YYYY HH:MM)
            const fechaRaw = String(r['FECHA'] || r['FECHAINICIO'] || '');
            let dia = 0, mes = 0, anyo = 0;
            if (fechaRaw.includes('/')) {
                const p = fechaRaw.split('/');
                dia  = parseInt(p[0]) || 0;
                mes  = parseInt(p[1]) || 0;
                anyo = parseInt(p[2]?.split(' ')[0]) || 0;
            }
            if (!anyo) anyo = parseInt(r['REFANNO'] ?? r['ANOLLAMADA']) || 0;

            // Prioridad: acepta PRIORIDAD o CBPRIORIDADAVISO
            const prioVal = r['PRIORIDAD'] ?? r['CBPRIORIDADAVISO'] ?? '';

            // Tipología/Título: acepta TITULO o TIPOLOGIA
            const tipVal = r['TITULO'] ?? r['TIPOLOGIA'] ?? '';

            const hasVal = (v) => v !== null && v !== undefined && String(v).trim() !== '';

            return {
                num,
                anyo, mes, dia,
                via          : String(r['VIA'] || r['CALLE'] || '').trim(),
                tipologia    : String(tipVal).trim(),
                prioridad    : String(prioVal).trim(),
                estado_op    : String(r['TIPOBYESTADOOPERATIVOID'] || '').trim(),
                patrulla     : String(r['PATRULLAASIGNADA'] || '').trim(),
                fechaInicio  : fechaRaw,
                fechaLlegada : String(r['FECHALLEGADA'] || '').trim(),
                fechaFin     : String(r['FECHAFINALIZACION'] || '').trim(),
                latitud      : r['LATITUD'] ?? null,
                longitud     : r['LONGITUD'] ?? null,
                titulo       : String(r['TITULO'] || '').trim(),
                // Completud: PRIORIDAD + PATRULLA + LAT + LON + TITULO (si existe col)
                _tienePrioridad : hasVal(prioVal),
                _tienePatrulla  : hasVal(r['PATRULLAASIGNADA']),
                _tieneLat       : hasVal(r['LATITUD']),
                _tieneLon       : hasVal(r['LONGITUD']),
                _tieneTitulo    : 'TITULO' in r ? hasVal(r['TITULO']) : null,
                // KPI-01: tiempo FECHAINICIO → FECHALLEGADA en segundos
                _tiempoAtencion : (() => {
                    const fi = r['FECHAINICIO'] || r['FECHA'];
                    const fl = r['FECHALLEGADA'];
                    if (!fi || !fl || String(fl).trim() === '') return null;
                    try {
                        const parseT = (s) => {
                            const p = String(s).split(/[\s\/]/);
                            if (p.length >= 3) {
                                const [d,m,y] = p;
                                const t = p[3] || '00:00';
                                const [hh,mm] = t.split(':');
                                return new Date(+y, +m-1, +d, +hh||0, +mm||0).getTime();
                            }
                            return NaN;
                        };
                        const diff = (parseT(fl) - parseT(fi)) / 1000;
                        return isNaN(diff) ? null : diff;
                    } catch { return null; }
                })(),
                // KPI-03: tiempo FECHAINICIO → FECHAFINALIZACION en horas
                _tiempoCierre : (() => {
                    const fi = r['FECHAINICIO'] || r['FECHA'];
                    const ff = r['FECHAFINALIZACION'];
                    if (!fi || !ff || String(ff).trim() === '') return null;
                    try {
                        const parseT = (s) => {
                            const p = String(s).split(/[\s\/]/);
                            if (p.length >= 3) {
                                const [d,m,y] = p;
                                const t = p[3] || '00:00';
                                const [hh,mm] = t.split(':');
                                return new Date(+y, +m-1, +d, +hh||0, +mm||0).getTime();
                            }
                            return NaN;
                        };
                        const diff = (parseT(ff) - parseT(fi)) / 3600000; // horas
                        return isNaN(diff) || diff < 0 ? null : diff;
                    } catch { return null; }
                })(),
                // KPI-18: servicio VG o menores (TITULO contiene 'VG' o 'menor')
                _esVGMenor : (() => {
                    const tit = String(r['TITULO'] || '').trim();
                    // KPI-18: el TITULO debe contener TANTO VG/Violencia Género
                    // COMO menor — las dos condiciones en el mismo registro
                    const tieneVG    = /\bVG\b/i.test(tit) || /violencia\s+(de\s+)?g[eé]nero/i.test(tit);
                    const tieneMenor = /\bmenor/i.test(tit);
                    return tieneVG && tieneMenor;
                })(),
                // KPI-08: accidente con lesiones (columna DSVLESIONES)
                _dsvLesiones : (() => {
                    const v = r['DSVLESIONES'];
                    if (v === null || v === undefined || String(v).trim() === '') return false;
                    return String(v).toLowerCase() === 'true' || v === true || v === 1;
                })(),
                // KPI-07: puntuación de satisfacción ciudadana (columna SATISFACCIONCIUDADANA)
                _satisfaccion : (() => {
                    const v = r['SATISFACCIONCIUDADANA'];
                    if (v === null || v === undefined || String(v).trim() === '') return null;
                    const s = String(v).trim();
                    // Formatos soportados:
                    // "N Nivel Satisfacción" (antiguo)
                    // "N Nivel Satisfacción KPI-07" (nuevo)
                    // Número puro 1-5
                    const m = s.match(/^(\d+(?:\.\d+)?)\s*Nivel/i);
                    if (m) {
                        const n = parseFloat(m[1]);
                        if (n >= 1 && n <= 5) return n;
                    }
                    const n = parseFloat(s);
                    if (!isNaN(n) && n >= 1 && n <= 5) return n;
                    return null;
                })(),
                // KPI-04/05: tiempo FECHAASIGNACION (o FECHAINICIO) → FECHALLEGADA en minutos
                _tiempoLlegada : (() => {
                    const fa = r['FECHAASIGNACION'] || r['FECHAINICIO'] || r['FECHA'];
                    const fl = r['FECHALLEGADA'];
                    if (!fa || !fl || String(fl).trim() === '') return null;
                    try {
                        const parseT = (s) => {
                            const p = String(s).split(/[\s\/]/);
                            if (p.length >= 3) {
                                const [d,m,y] = p;
                                const t = p[3] || '00:00';
                                const [hh,mm] = t.split(':');
                                return new Date(+y, +m-1, +d, +hh||0, +mm||0).getTime();
                            }
                            return NaN;
                        };
                        const diff = (parseT(fl) - parseT(fa)) / 60000; // minutos
                        return isNaN(diff) || diff < 0 ? null : diff;
                    } catch { return null; }
                })(),
            };
        }).filter(r => r.anyo > 0);

        _tieneLat    = _rawData.some(r => r.latitud !== null);
        _tieneLon    = _rawData.some(r => r.longitud !== null);
        _tieneTitulo = _rawData.some(r => r._tieneTitulo !== null);

        _años = [...new Set(_rawData.map(r => r.anyo))].sort((a,b) => b - a);
        const hoy = new Date();
        const añoActual = hoy.getFullYear();
        _añoSel = _años.find(a => a <= añoActual) || _años[0] || añoActual;
        const mesesConDatos = [...new Set(
            _rawData.filter(r => r.anyo === _añoSel).map(r => r.mes)
        )].filter(Boolean).sort((a,b) => b - a);
        const mesActual = hoy.getMonth() + 1;
        _mesSel = mesesConDatos.includes(mesActual) ? mesActual : (mesesConDatos[0] || mesActual);

        _filtroPrioridad = '';
        _filtroTipologia  = '';
        _filtroPatrulla   = '';

        // Activar KPIs disponibles según columnas detectadas
        _kpisDisponibles.add('kpi01');
        _kpisDisponibles.add('kpi02');
        _kpisDisponibles.add('kpi03');
        _kpisDisponibles.add('kpi04');
        _kpisDisponibles.add('kpi05');
        _kpisDisponibles.add('kpi06');
        if (_rawData.some(r => r._satisfaccion !== null && r._satisfaccion !== undefined)) {
            _kpisDisponibles.add('kpi07');
        }
        if (_rawData.some(r => r._dsvLesiones === true)) {
            _kpisDisponibles.add('kpi08');
        }
        if (_rawData.some(r => r._esVGMenor === true)) {
            _kpisDisponibles.add('kpi18');
        }
        // Si el KPI activo ya no está disponible, ir al primero
        if (!_kpisDisponibles.has(_kpiActivo)) _kpiActivo = [..._kpisDisponibles][0] || 'kpi01';
        _cargado = true;
    }

    // ════════════════════════════════════════════════════════════
    // CÁLCULO KPI-02
    // ════════════════════════════════════════════════════════════
    // Leer filtros activos del dashboard principal (año, mes, categoría)
    function getDashboardFilters() {
        const getChecked = (id) =>
            Array.from(document.querySelectorAll(`#${id} input:checked`)).map(i => i.value);
        const years  = getChecked('items-year').map(Number).filter(Boolean);
        const months = getChecked('items-month').map(Number).filter(Boolean);
        const cats   = getChecked('items-category').filter(Boolean);
        return { years, months, cats };
    }

    function calcular() {
        const df = getDashboardFilters();

        let filas = _rawData;

        // Aplicar filtros de año del dashboard
        if (df.years.length > 0)  filas = filas.filter(r => df.years.includes(r.anyo));
        // Aplicar filtros de mes del dashboard
        if (df.months.length > 0) filas = filas.filter(r => df.months.includes(r.mes));
        // Aplicar filtros de categoría del dashboard (tipología)
        if (df.cats.length > 0)   filas = filas.filter(r => df.cats.includes(r.tipologia));

        // Filtros propios del visor KPI
        if (_filtroPrioridad) filas = filas.filter(r => r.prioridad === _filtroPrioridad);
        if (_filtroPatrulla)  filas = filas.filter(r => r.patrulla  === _filtroPatrulla);

        const totalFiltrados = filas.length;

        const completos = filas.filter(r => {
            const base = r._tienePrioridad && r._tienePatrulla;
            const latOk  = !_tieneLat    || r._tieneLat;
            const lonOk  = !_tieneLon    || r._tieneLon;
            const titOk  = !_tieneTitulo || r._tieneTitulo;
            return base && latOk && lonOk && titOk;
        });

        const nCompletos   = completos.length;
        const nIncompletos = totalFiltrados - nCompletos;
        const porcentaje   = totalFiltrados > 0 ? (nCompletos / totalFiltrados * 100) : 0;
        const objetivo     = 98;

        let estado;
        if (porcentaje >= objetivo)          estado = 'verde';
        else if (porcentaje >= objetivo - 3) estado = 'amarillo';
        else                                 estado = 'rojo';

        const campoStats = {
            prioridad : filas.filter(r => r._tienePrioridad).length,
            patrulla  : filas.filter(r => r._tienePatrulla).length,
            latitud   : _tieneLat    ? filas.filter(r => r._tieneLat).length    : null,
            longitud  : _tieneLon    ? filas.filter(r => r._tieneLon).length    : null,
            titulo    : _tieneTitulo ? filas.filter(r => r._tieneTitulo).length : null,
        };

        const porPrioridad = {};
        filas.forEach(r => {
            const p = r.prioridad || '(Sin prioridad)';
            if (!porPrioridad[p]) porPrioridad[p] = { total:0, completos:0 };
            porPrioridad[p].total++;
            const ok = r._tienePrioridad && r._tienePatrulla &&
                (!_tieneLat || r._tieneLat) && (!_tieneLon || r._tieneLon);
            if (ok) porPrioridad[p].completos++;
        });

        return {
            totalFiltrados, nCompletos, nIncompletos,
            porcentaje, objetivo, estado,
            campoStats, porPrioridad,
            filas, completosSet: new Set(completos.map(r => r.num))
        };
    }

    // ════════════════════════════════════════════════════════════
    // CÁLCULO KPI-01: Llamadas atendidas en < 30s
    // Formula: (Nº llamadas atendidas <30s / Nº total llamadas) × 100
    // ════════════════════════════════════════════════════════════
    function calcularKPI01() {
        const df = getDashboardFilters();
        let filas = _rawData;
        if (df.years.length > 0)  filas = filas.filter(r => df.years.includes(r.anyo));
        if (df.months.length > 0) filas = filas.filter(r => df.months.includes(r.mes));
        if (df.cats.length > 0)   filas = filas.filter(r => df.cats.includes(r.tipologia));
        if (_filtroPrioridad) filas = filas.filter(r => r.prioridad === _filtroPrioridad);
        if (_filtroPatrulla)  filas = filas.filter(r => r.patrulla  === _filtroPatrulla);

        const total        = filas.length;
        // KPI-01: llamada OPERATIVA = tiene PATRULLAASIGNADA con valor (no nulo, no vacío)
        const operativas   = filas.filter(r => r.patrulla && r.patrulla.trim() !== '');
        const nOperativas  = operativas.length;
        const nNoOperativas= total - nOperativas;
        const porcentaje   = total > 0 ? (nOperativas / total * 100) : 0;
        const objetivo     = 95;

        let estado;
        if (porcentaje >= objetivo)          estado = 'verde';
        else if (porcentaje >= objetivo - 5) estado = 'amarillo';
        else                                 estado = 'rojo';

        // Desglose por prioridad
        const porPrioridad = {};
        filas.forEach(r => {
            const p = r.prioridad || '(Sin prioridad)';
            if (!porPrioridad[p]) porPrioridad[p] = { total:0, menores30:0, sinTiempo:0 };
            porPrioridad[p].total++;
            if (r.patrulla && r.patrulla.trim() !== '') porPrioridad[p].menores30++;
            else porPrioridad[p].sinTiempo++;
        });

        const distribucion = [
            { label: t('kpi01_atendidas'),    count: nOperativas   },
            { label: t('kpi01_no_atendidas'), count: nNoOperativas },
        ];

        return {
            total, nMenores30: nOperativas, nMayores30: 0, nSinTiempo: nNoOperativas,
            conTiempo: nOperativas,
            porcentaje, objetivo, estado,
            porPrioridad, distribucion,
            filas,
            menores30Set: new Set(operativas.map(r => r.num))
        };
    }

    // ════════════════════════════════════════════════════════════
    // CÁLCULO KPI-03: Incidencias no urgentes cerradas <= 72h
    // Fórmula: (Nº incidencias no urgentes cerradas <=72h /
    //           Nº total incidencias no urgentes) × 100
    // No urgentes = prioridad Baja o Media
    // ════════════════════════════════════════════════════════════
    function calcularKPI03() {
        const df = getDashboardFilters();
        let filas = _rawData;
        if (df.years.length > 0)  filas = filas.filter(r => df.years.includes(r.anyo));
        if (df.months.length > 0) filas = filas.filter(r => df.months.includes(r.mes));
        if (df.cats.length > 0)   filas = filas.filter(r => df.cats.includes(r.tipologia));
        if (_filtroPatrulla) filas = filas.filter(r => r.patrulla === _filtroPatrulla);

        // Solo no urgentes (Baja + Media)
        const noUrgentes = filas.filter(r => {
            const p = r.prioridad.toLowerCase();
            return p === 'baja' || p === 'media';
        });

        const total       = noUrgentes.length;
        const cerradas    = noUrgentes.filter(r => r._tiempoCierre !== null);
        const enPlazo     = cerradas.filter(r => r._tiempoCierre <= 72);
        const fueraPlazo  = cerradas.filter(r => r._tiempoCierre > 72);
        const sinCierre   = noUrgentes.filter(r => r._tiempoCierre === null);

        const nEnPlazo    = enPlazo.length;
        const nFuera      = fueraPlazo.length;
        const nSinCierre  = sinCierre.length;

        const porcentaje  = total > 0 ? (nEnPlazo / total * 100) : 0;
        const objetivo    = 90;

        let estado;
        if (porcentaje >= objetivo)          estado = 'verde';
        else if (porcentaje >= objetivo - 5) estado = 'amarillo';
        else                                 estado = 'rojo';

        // Desglose por prioridad (solo Baja/Media)
        const porPrioridad = {};
        noUrgentes.forEach(r => {
            const p = r.prioridad || '(Sin prioridad)';
            if (!porPrioridad[p]) porPrioridad[p] = { total:0, enPlazo:0, fueraPlazo:0, sinCierre:0 };
            porPrioridad[p].total++;
            if (r._tiempoCierre !== null && r._tiempoCierre <= 72) porPrioridad[p].enPlazo++;
            else if (r._tiempoCierre !== null)                      porPrioridad[p].fueraPlazo++;
            else                                                     porPrioridad[p].sinCierre++;
        });

        // Distribución de tiempos de cierre
        const rangos = [
            { label: '≤ 24h',     min:0,  max:24  },
            { label: '24h–48h',   min:24, max:48   },
            { label: '48h–72h',   min:48, max:72   },
            { label: '72h–1sem',  min:72, max:168  },
            { label: '> 1 sem',   min:168,max:Infinity },
        ];
        const distribucion = rangos.map(rng => ({
            label : rng.label,
            enPlazo: rng.max <= 72,
            count : cerradas.filter(r => r._tiempoCierre >= rng.min && r._tiempoCierre < rng.max).length
        }));

        return {
            total, nEnPlazo, nFuera, nSinCierre,
            cerradas: cerradas.length,
            porcentaje, objetivo, estado,
            porPrioridad, distribucion,
            filas: noUrgentes,
            enPlazoSet: new Set(enPlazo.map(r => r.num))
        };
    }

    // ════════════════════════════════════════════════════════════
    // OPCIONES DE FILTRO
    // ════════════════════════════════════════════════════════════
    function getOpciones(campo) {
        // Opciones basadas en los filtros activos del dashboard
        const df = getDashboardFilters();
        let filas = _rawData;
        if (df.years.length > 0)  filas = filas.filter(r => df.years.includes(r.anyo));
        if (df.months.length > 0) filas = filas.filter(r => df.months.includes(r.mes));
        if (df.cats.length > 0)   filas = filas.filter(r => df.cats.includes(r.tipologia));
        return [...new Set(filas.map(r => r[campo]).filter(Boolean))].sort();
    }

    // ════════════════════════════════════════════════════════════
    // HELPER: BARRA DE FILTROS + BANNER DE FILTROS ACTIVOS (COMÚN)
    // ════════════════════════════════════════════════════════════
    function _renderFilterbar(kpiActivo, conPrioridad = true) {
        const mkOpts = (arr, val) =>
            `<option value="">${t('todos')}</option>` +
            arr.map(o => `<option value="${o}" ${o===val?'selected':''}>${o||'—'}</option>`).join('');
        return `
        <div class="at-filterbar" style="flex-wrap:wrap;margin-bottom:10px;position:relative;">
            <div style="width:100%;text-align:center;margin-bottom:6px;padding-bottom:6px;
                border-bottom:1px solid #e2e8f0;">
                <span style="font-size:1rem;font-weight:900;color:#8898aa;letter-spacing:3px;
                    text-transform:uppercase;font-family:'Georgia',serif;font-style:italic;
                    user-select:none;">${t('titulo_lateral')}</span>
                ${_empresaActual ? `<span style="display:inline-block;margin-left:10px;padding:2px 10px;
                    background:#1a2a4a;color:white;border-radius:20px;font-size:0.68rem;
                    font-weight:800;letter-spacing:1.5px;text-transform:uppercase;
                    vertical-align:middle;font-style:normal;">${_empresaActual}</span>` : ''}
            </div>
            <div class="at-filter-item">
                <label style="font-weight:800;color:#1a2a4a;">${t('selector_kpi')}</label>
                <select class="at-select" style="font-weight:700;border-color:#1a2a4a;width:100%;max-width:280px;"
                    onchange="FncKPI._onKpiChange(this.value);">
                    ${(() => {
                        const KPI_CATALOG = [
                            {id:'kpi01', label:'KPI-01 - '+t('kpi01_nombre')},
                            {id:'kpi02', label:'KPI-02 - '+t('avisos_completos')},
                            {id:'kpi03', label:'KPI-03 - '+t('kpi03_nombre')},
                            {id:'kpi04', label:'KPI-04 - '+t('kpi04_nombre')},
                            {id:'kpi05', label:'KPI-05 - '+t('kpi05_nombre')},
                            {id:'kpi06', label:'KPI-06 - '+t('kpi06_nombre')},
                            {id:'kpi07', label:'KPI-07 - '+t('kpi07_nombre')},
                            {id:'kpi08', label:'KPI-08 - '+t('kpi08_nombre')},
                            {id:'kpi09', label:'KPI-09 - '+t('kpi09_nombre')},
                            {id:'kpi10', label:'KPI-10 - '+t('kpi10_nombre')},
                            {id:'kpi11', label:'KPI-11 - '+t('kpi11_nombre')},
                            {id:'kpi13', label:'KPI-13 - '+t('kpi13_nombre')},
                            {id:'kpi14', label:'KPI-14 - '+t('kpi14_nombre')},
                            {id:'kpi15', label:'KPI-15 - '+t('kpi15_nombre')},
                            {id:'kpi18', label:'KPI-18 - '+t('kpi18_nombre')},
                            {id:'kpi19', label:'KPI-19 - '+t('kpi19_nombre')},
                            {id:'kpi20', label:'KPI-20 - '+t('kpi20_nombre')},
                            {id:'kpi21', label:'KPI-21 - '+t('kpi21_nombre')},
                            {id:'kpi23', label:'KPI-23 - '+t('kpi23_nombre')},
                        ];
                        return KPI_CATALOG
                            .filter(k => _kpisDisponibles.has(k.id))
                            .map(k => `<option value="${k.id}" ${k.id===kpiActivo?'selected':''}>${k.label}</option>`)
                            .join('');
                    })()}
                </select>
            </div>
            ${conPrioridad ? `
            <div class="at-filter-item">
                <label>${t('filtro_prioridad')}</label>
                <select class="at-select" onchange="FncKPI._onFiltro('prioridad',this.value);">
                    ${mkOpts(getOpciones('prioridad'), _filtroPrioridad)}
                </select>
            </div>` : ''}
            <div class="at-filter-item">
                <label>${t('filtro_patrulla')}</label>
                <select class="at-select" onchange="FncKPI._onFiltro('patrulla',this.value);">
                    ${mkOpts(getOpciones('patrulla'), _filtroPatrulla)}
                </select>
            </div>
            <div style="display:flex;gap:6px;align-items:flex-end;padding-bottom:2px;">
                <button class="at-btn-pdf" onclick="FncKPI._exportarPdfKpi('${kpiActivo}')" title="${t('exportar_pdf')}"
                    style="width:34px;height:34px;display:flex;align-items:center;justify-content:center;">
                    <i class="fa-solid fa-file-pdf"></i>
                </button>
                <button class="pj-btn-print" onclick="FncKPI._imprimirKpi('${kpiActivo}')" title="${t('imprimir')}"
                    style="width:34px;height:34px;display:flex;align-items:center;justify-content:center;">
                    <i class="fa-solid fa-print"></i>
                </button>


            </div>
            <div style="margin-left:auto;display:flex;align-items:flex-end;padding-bottom:2px;">
                <button onclick="FncKPI.cerrarVisor()"
                    style="display:inline-flex;align-items:center;gap:6px;padding:7px 16px;
                    background:white;border:1.5px solid #1a2a4a;border-radius:8px;
                    color:#1a2a4a;font-size:0.82rem;font-weight:700;cursor:pointer;white-space:nowrap;"
                    onmouseover="this.style.background='#1a2a4a';this.style.color='white';"
                    onmouseout="this.style.background='white';this.style.color='#1a2a4a';">
                    <i class="fa-solid fa-arrow-left"></i> ${t('volver')}
                </button>
            </div>
        </div>
        <div style="font-size:0.73rem;color:#525f7f;margin-bottom:12px;padding:6px 12px;
            background:#f8f9ff;border-radius:8px;border:1px solid #e2e8f0;">
            <i class="fa-solid fa-filter" style="margin-right:4px;color:#5e72e4;"></i>
            <strong>${t('filtros_activos_dash')}</strong>
            <span id="kpi-df-info" style="color:#32325d;"></span>
        </div>`;
    }

    // ── Helper: renderiza filas de distribución (evita duplicación en 13+ KPIs) ──
    // cfg.plazoMax: valor máximo que se considera "en plazo" para colorear verde
    // Si no se pasa plazoMax, usa d.enPlazo (booleano ya calculado en distribución)
    function _renderDistRows(distribucion, nTotal, opts) {
        opts = opts || {};
        return distribucion.map(d => {
            const pct2 = nTotal > 0 ? (d.count / nTotal * 100).toFixed(1) : '0.0';
            const w    = Math.min(100, parseFloat(pct2));
            const verde = d.enPlazo !== undefined ? d.enPlazo : (opts.cumple ? opts.cumple(d) : true);
            const bc   = verde ? '#2ecc71' : (d.count === 0 && !verde ? '#95a5a6' : '#e74c3c');
            const labelWidth = opts.labelWidth ? `width:${opts.labelWidth};` : '';
            return `<div class="kpinv-dist-row">
                <span class="kpinv-dist-label" style="${labelWidth}font-size:0.72rem;">${d.label}</span>
                <div class="kpinv-dist-track"><div style="height:100%;width:${w}%;background:${bc};border-radius:6px;transition:width .5s;"></div></div>
                <span class="kpinv-dist-val">${d.count} <small>(${pct2}%)</small></span>
            </div>`;
        }).join('');
    }

    // ── Helper: renderiza sección de distribución completa ──────────────────
    function _renderSeccionDist(titulo, icon, distRows) {
        return `<div class="kpi-section"><div class="kpinv-section-header">
            <i class="fa-solid ${icon||'fa-chart-bar'}" style="margin-right:7px;opacity:.8;"></i>${titulo}
            </div><div style="padding:14px 16px;">${distRows}</div></div>`;
    }

    // ── Helper: botón "Ver avisos" estándar ─────────────────────────────────
    function _btnVerAvisos(fnName) {
        return `<div style="display:flex;align-items:center;justify-content:center;padding:4px;">
            <button onclick="FncKPI.${fnName}()"
                style="padding:10px 16px;background:#1a2a4a;color:white;border:none;border-radius:10px;
                    font-size:0.8rem;font-weight:700;cursor:pointer;display:flex;align-items:center;
                    gap:6px;white-space:nowrap;"
                onmouseover="this.style.background='#253d6b'"
                onmouseout="this.style.background='#1a2a4a'">
                <i class="fa-solid fa-table-list"></i> ${t('ver_avisos')}
            </button></div>`;
    }

        function _gaugeCircular(porcentaje, color, objPct, labelEstado, formulaId, objSymbol) {
        const R = 72, CX = 100, CY = 100;
        const circ     = 2 * Math.PI * R;
        const pct      = Math.min(100, porcentaje);
        const fillDash = circ * pct / 100;
        const objAngle = ((objPct / 100) * 360 - 90) * Math.PI / 180;
        const mxOuter  = CX + (R + 10) * Math.cos(objAngle);
        const myOuter  = CY + (R + 10) * Math.sin(objAngle);
        const mxInner  = CX + (R - 10) * Math.cos(objAngle);
        const myInner  = CY + (R - 10) * Math.sin(objAngle);
        const gradId = 'gc_' + Math.random().toString(36).slice(2,7);
        // Calcular posición vertical centrada para todos los textos internos
        const lines = labelEstado.toUpperCase().split(' ');
        // Bloque total de texto: pct(28) + gap(8) + "OBJETIVO"(8) + gap(6) + lines*11
        const blockH  = 28 + 8 + 8 + 6 + lines.length * 11;
        const blockTop = CY - blockH / 2;
        const pctY     = blockTop + 22;          // baseline porcentaje
        const objY     = pctY + 12;              // baseline "OBJETIVO"
        const stateY1  = objY + 14;              // baseline primera línea estado
        const stateLines = lines.map((l, i) =>
            `<text x="${CX}" y="${stateY1 + i * 13}" text-anchor="middle"
                font-size="10" font-weight="900" fill="${color}"
                font-family="Arial,sans-serif">${l}</text>`
        ).join('');
        return `<svg viewBox="0 0 200 200" width="200" height="200"
            style="flex-shrink:0;display:block;cursor:pointer;"
            onclick="FncKPI._toggleInfo()"
            title="${t('ver_info')||'Información del KPI'}"
            data-formula="${formulaId}">
            <defs>
                <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#1a2a4a"/>
                    <stop offset="50%" stop-color="${color}" stop-opacity=".75"/>
                    <stop offset="100%" stop-color="${color}"/>
                </linearGradient>
            </defs>
            <!-- Sombra track -->
            <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#dde3f0" stroke-width="18"/>
            <!-- Arco progreso -->
            <circle cx="${CX}" cy="${CY}" r="${R}" fill="none"
                stroke="url(#${gradId})" stroke-width="18"
                stroke-linecap="round"
                stroke-dasharray="${fillDash.toFixed(2)} ${circ.toFixed(2)}"
                transform="rotate(-90 ${CX} ${CY})"
                style="transition:stroke-dasharray 1s ease;"/>
            <!-- Marcador objetivo -->
            <line x1="${mxInner.toFixed(1)}" y1="${myInner.toFixed(1)}"
                  x2="${mxOuter.toFixed(1)}" y2="${myOuter.toFixed(1)}"
                  stroke="#1a2a4a" stroke-width="3.5" stroke-linecap="round"/>
            <!-- Porcentaje central -->
            <text x="${CX}" y="${pctY}" text-anchor="middle"
                font-size="28" font-weight="900" fill="${color}"
                font-family="Arial,sans-serif">${porcentaje.toFixed(1)}%</text>
            <!-- Texto OBJETIVO con símbolo correcto -->
            <text x="${CX}" y="${objY}" text-anchor="middle"
                font-size="8" font-weight="700" fill="${color}" opacity=".6"
                font-family="Arial,sans-serif" letter-spacing="1">${objSymbol||'≥'} ${objPct}%</text>
            <!-- Estado -->
            ${stateLines}
            <!-- Icono hint fórmula (esquina inferior derecha del gauge) -->
            <circle cx="168" cy="168" r="12" fill="${color}" opacity=".15"/>
            <text x="168" y="172" text-anchor="middle" font-size="11" fill="${color}"
                font-family="Arial,sans-serif" font-weight="700">ℹ</text>
        </svg>`;
    }

    // ════════════════════════════════════════════════════════════
    // HELPER: SEMÁFORO SVG (nuevo diseño)
    // ════════════════════════════════════════════════════════════
    function _semaforoSvg(v, umbrales) {
        // umbrales: { verde, amarillo } — por encima de verde=verde, entre=amarillo, debajo=rojo
        const isVerde   = v >= umbrales.verde;
        const isAmarillo = v >= umbrales.amarillo && v < umbrales.verde;
        return `<svg width="18" height="36" viewBox="0 0 18 36" style="flex-shrink:0;">
            <rect x="2" y="1" width="14" height="34" rx="4" fill="#2c3344"/>
            <circle cx="9" cy="8"  r="4" fill="${(!isVerde && !isAmarillo) ? '#e74c3c' : '#1a1a2a'}"/>
            <circle cx="9" cy="18" r="4" fill="${isAmarillo ? '#f59e0b' : '#1a1a2a'}"/>
            <circle cx="9" cy="28" r="4" fill="${isVerde ? '#2ecc71' : '#1a1a2a'}"/>
        </svg>`;
    }

    // ════════════════════════════════════════════════════════════
    // HELPER: BADGE KPI% con barra (nuevo diseño tabla)
    // ════════════════════════════════════════════════════════════
    function _badgePct(v, umbralVerde, umbralAmarillo) {
        const c = v >= umbralVerde ? '#2ecc71' : v >= umbralAmarillo ? '#f59e0b' : '#e74c3c';
        const bg = v >= umbralVerde ? '#eafaf1' : v >= umbralAmarillo ? '#fef9ec' : '#fef0f0';
        const w = Math.min(100, v);
        return `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;
            border-radius:20px;background:${bg};font-size:0.78rem;font-weight:800;color:${c};
            min-width:70px;justify-content:center;">
            <span style="display:inline-block;width:${w * 0.4}px;height:8px;background:${c};
                border-radius:4px;flex-shrink:0;min-width:4px;max-width:40px;"></span>
            ${v.toFixed(1)}%
        </span>`;
    }

    // ════════════════════════════════════════════════════════════
    // HELPER: RENDER CARD PRINCIPAL (nuevo diseño unificado)
    // kpiId, stats, cfg = { nombre, idLabel, formula, formulaSub,
    //   objetivo, objeLabel, stats1{icon,num,label,color?},
    //   stats2{icon,num,label,color}, stats3{icon,num,label,color},
    //   stats4{icon,num,label,color?},

    // ════════════════════════════════════════════════════════════
    // HELPER: ACTUALIZAR BANNER FILTROS ACTIVOS
    // ════════════════════════════════════════════════════════════
    function _updateDfInfo() {
        setTimeout(() => {
            const df   = getDashboardFilters();
            const lang = typeof currentLang !== 'undefined' ? currentLang : 'es';
            const mns  = MESES[lang] || MESES.es;
            const parts = [];
            if (df.years.length)  parts.push(`${t('anos_label')}: ${df.years.join(', ')}`);
            if (df.months.length) parts.push(`${t('meses_label')}: ${df.months.map(m => mns[m-1]||m).join(', ')}`);
            if (df.cats.length)   parts.push(`${t('tipologia_label')}: ${df.cats.length} ${t('tipologia_sel')}`);
            const info = document.getElementById('kpi-df-info');
            if (info) info.textContent = parts.length ? ' ' + parts.join(' · ') : ' ' + t('todos_datos');
        }, 50);
    }

    // ════════════════════════════════════════════════════════════
    // HELPER: RENDERIZAR HTML EN #atestados-view
    // ════════════════════════════════════════════════════════════
    function _renderView(html) {
        const view = document.getElementById('atestados-view');
        if (view) {
            view.innerHTML = html;
            view.classList.add('active');
            _updateDfInfo();
            // Reiniciar animación del badge de estado en cada render
            const badge = view.querySelector('.kpinv-estado-wrap .kpi-card-estado') ||
                          view.querySelector('.kpi-card-estado');
            if (badge) {
                badge.style.animation = 'none';
                void badge.offsetHeight;
                badge.style.animation = '';
            }
        }
    }

    //   btnExtra (HTML string opcional),
    //   seccionExtra (HTML string sección extra bajo la card),
    //   tablaHtml (HTML de tabla completa) }
    // ════════════════════════════════════════════════════════════
    function _renderKpiCard(kpiId, stats_pct, color, labelEstado, cfg) {
        const estadoBg  = color === '#e74c3c' ? '#fff5f5' : color === '#f1c40f' ? '#fffbe6' : '#f0fff4';
        const faIcon    = color === '#e74c3c' ? 'fa-circle-xmark' : color === '#f1c40f' ? 'fa-triangle-exclamation' : 'fa-circle-check';
        const pct       = Math.min(100, stats_pct);

        const uid = 'kf_' + Math.random().toString(36).slice(2,7);
        return `
<div class="kpi-root-layout">
    <div class="kpi-main-content">

        ${_renderFilterbar(kpiId, cfg.conPrioridad !== false)}

        <div class="kpi-card-main kpi-card-nuevo">

            <!-- ── LAYOUT PRINCIPAL: izquierda gauge | derecha info+barra+stats ── -->
            <div class="kpinv-layout">

                <!-- COLUMNA IZQUIERDA: gauge grande + hint -->
                <div class="kpinv-col-gauge">
                    ${_gaugeCircular(stats_pct, color, cfg.objetivo, labelEstado, uid, cfg.objSymbol||'≥')}
                    <div class="kpinv-gauge-hint" style="color:${color};">
                        <i class="fa-solid fa-circle-info"></i>
                        ${t('ver_info') || 'Toca para ver información'}
                    </div>
                </div>

                <!-- COLUMNA DERECHA: info + barra + stats + badge -->
                <div class="kpinv-col-right">

                    <!-- ID + Nombre + objetivo + badge en misma fila -->
                    <div class="kpinv-header-row">
                        <div>
                            <div class="kpinv-id">${cfg.idLabel}</div>
                            <div class="kpinv-nombre">${cfg.nombre}</div>
                            <div class="kpinv-meta">${t('objetivo')}: ${cfg.objSymbol||'≥'} ${cfg.objetivo}% · ${t('frecuencia')}</div>
                        </div>
                        <!-- Badge estado: en esquina derecha de la info -->
                        <div class="kpi-card-estado kpinv-estado"
                            style="background:${estadoBg};border:2px solid ${color};--kpi-estado-color:${color};">
                            <i class="fa-solid ${faIcon}" style="font-size:1.6rem;color:${color};"></i>
                            <div class="kpinv-estado-label" style="color:${color};">${labelEstado}</div>
                        </div>
                    </div>

                    <!-- Barra de progreso -->
                    <div class="kpinv-barra-wrap">
                        <div class="kpinv-barra-track">
                            <div class="kpinv-barra-fill" style="width:${pct}%;background:${color};"></div>
                            <div class="kpinv-barra-obj" style="left:${cfg.objetivo}%;"></div>
                        </div>
                        <div class="kpinv-barra-labels">
                            <span>0%</span>
                            <span>${t('objetivo')}: ${cfg.objSymbol||'≥'} ${cfg.objetivo}%</span>
                            <span>${cfg.objetivo}%</span>
                        </div>
                    </div>

                    <!-- Stats rápidos -->
                    <div class="kpinv-stats">
                        ${[cfg.stat1, cfg.stat2, cfg.stat3, cfg.stat4].filter(Boolean).map(s => `
                        <div class="kpinv-stat-card" style="${s.bg?'background:'+s.bg+';border-color:'+s.border+';':''}">
                            <i class="fa-solid ${s.icon}" style="color:${s.iconColor||'#5e72e4'};font-size:0.9rem;margin-bottom:2px;display:block;"></i>
                            <div class="kpinv-stat-num" style="color:${s.numColor||'#1a2a4a'};">${s.num}</div>
                            <div class="kpinv-stat-label">${s.label}</div>
                        </div>`).join('')}
                        ${cfg.btnExtra || ''}
                    </div>

                </div><!-- fin col-right -->
            </div><!-- fin layout -->

            <!-- FÓRMULA: oculta por defecto, se muestra al clic en gauge -->
            <div id="${uid}" class="kpinv-formula-panel" style="display:none;">
                <button class="kpinv-formula-close" onclick="this.parentElement.style.display='none'">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                <strong style="color:#1a2a4a;">Fórmula ${cfg.idLabel}:</strong>
                ${cfg.formula}
                <br><small>${cfg.formulaSub}</small>
            </div>

            <!-- PANEL INFO: descripción del KPI, toggle con botón ℹ -->
            ${cfg.infoText ? `
            <div id="${uid}_info" class="kpinv-info-panel" style="display:none;">
                <button class="kpinv-formula-close" onclick="this.parentElement.style.display='none'">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                <div class="kpinv-info-content">
                    <i class="fa-solid fa-circle-info" style="color:#5e72e4;margin-right:6px;"></i>
                    <strong style="color:#1a2a4a;">${cfg.idLabel} — ${cfg.nombre}</strong>
                </div>
                <p style="margin:8px 0 0;font-size:0.78rem;color:#525f7f;line-height:1.6;">${cfg.infoText}</p>
            </div>` : ''}

        </div>

        ${cfg.seccionExtra || ''}
        ${cfg.tablaHtml ? `
        <div class="kpi-section">
            <div class="kpinv-section-header" style="background:#1a2a4a;">
                <i class="fa-solid fa-layer-group" style="margin-right:7px;opacity:.8;"></i>
                ${t('filtro_prioridad')}
            </div>
            <div style="overflow-x:auto;">${cfg.tablaHtml}</div>
        </div>` : ''}

    </div>
</div>`;
    }


    // ════════════════════════════════════════════════════════════
    // RENDER KPI-01  — Llamadas atendidas < 30s
    // ════════════════════════════════════════════════════════════
    function renderKPI01() {
        const stats  = calcularKPI01();
        const color  = { verde:'#2ecc71', amarillo:'#f1c40f', rojo:'#e74c3c' }[stats.estado];
        const labelE = t({ verde:'cumple', amarillo:'alerta', rojo:'no_cumple' }[stats.estado]);
        const distRows = stats.distribucion.map((d, i) => {
            const pct2 = stats.total > 0 ? (d.count/stats.total*100).toFixed(1) : '0.0';
            const w = Math.min(100, parseFloat(pct2));
            const bc = i === 0 ? '#2ecc71' : '#e74c3c';
            return `<div class="kpinv-dist-row">
                <span class="kpinv-dist-label">${d.label}</span>
                <div class="kpinv-dist-track"><div style="height:100%;width:${w}%;background:${bc};border-radius:6px;transition:width .5s;"></div></div>
                <span class="kpinv-dist-val">${d.count} <small>(${pct2}%)</small></span>
            </div>`;
        }).join('');
        const tablaRows = Object.entries(stats.porPrioridad).map(([p, d], i) => {
            const v = d.total > 0 ? d.menores30/d.total*100 : 0;
            return `<tr style="background:${i%2===0?'white':'#fafbff'};border-bottom:1px solid #f0f2f8;">
                <td style="padding:8px 12px;font-size:0.82rem;color:#32325d;">${p||'—'}</td>
                <td style="padding:8px 12px;text-align:center;">${_semaforoSvg(v,{verde:95,amarillo:90})}</td>
                <td style="padding:8px 12px;text-align:right;font-weight:700;color:#1a2a4a;">${d.total}</td>
                <td style="padding:8px 12px;text-align:right;font-weight:700;color:#27ae60;">${d.menores30}</td>
                <td style="padding:8px 12px;text-align:right;font-weight:700;color:#e74c3c;">${d.sinTiempo}</td>
                <td style="padding:8px 12px;text-align:center;">${_badgePct(v,95,90)}</td>
            </tr>`;
        }).join('');
        const tabla = `<table style="width:100%;border-collapse:collapse;min-width:420px;">
            <thead><tr style="background:#f0f2f8;">
                <th style="padding:9px 12px;text-align:left;font-size:0.75rem;color:#1a2a4a;font-weight:700;">${t('filtro_prioridad')}</th>
                <th style="padding:9px 12px;text-align:center;font-size:0.75rem;color:#1a2a4a;font-weight:700;">${t('estado')}</th>
                <th style="padding:9px 12px;text-align:right;font-size:0.75rem;color:#1a2a4a;font-weight:700;">${t('kpi01_total')}</th>
                <th style="padding:9px 12px;text-align:right;font-size:0.75rem;color:#27ae60;font-weight:700;">${t('kpi01_atendidas')}</th>
                <th style="padding:9px 12px;text-align:right;font-size:0.75rem;color:#e74c3c;font-weight:700;">${t('kpi01_no_atendidas')}</th>
                <th style="padding:9px 12px;text-align:center;font-size:0.75rem;color:#1a2a4a;font-weight:700;">KPI-01 %</th>
            </tr></thead>
            <tbody>${tablaRows||`<tr><td colspan="6" style="text-align:center;color:#8898aa;padding:14px;">${t('sin_datos')}</td></tr>`}</tbody>
        </table>`;
        const seccion = `<div class="kpi-section"><div class="kpinv-section-header"><i class="fa-solid fa-chart-bar" style="margin-right:7px;opacity:.8;"></i>${t('kpi01_distribucion')}</div><div style="padding:14px 16px;">${distRows}</div></div>`;
        _renderView(_renderKpiCard('kpi01', stats.porcentaje, color, labelE, {
            idLabel:'KPI-01', nombre:t('kpi01_nombre'), formula:t('formula_01'), formulaSub:t('formula_01_sub'), objetivo:95,
            stat1:{icon:'fa-phone',        iconColor:'#5e72e4',numColor:'#1a2a4a',num:stats.total,       label:t('kpi01_total')},
            stat2:{icon:'fa-circle-check', iconColor:'#2ecc71',numColor:'#27ae60',num:stats.nMenores30,   label:t('kpi01_atendidas'),    bg:'#f0fff4',border:'#b7ebce'},
            stat3:{icon:'fa-circle-xmark', iconColor:'#e74c3c',numColor:'#e74c3c',num:stats.nSinTiempo,  label:t('kpi01_no_atendidas'), bg:'#fff5f5',border:'#fbd0d0'},
            btnExtra: `<div style="display:flex;align-items:center;justify-content:center;padding:4px;"><button onclick="FncKPI.verRegistrosKPI01()" style="padding:10px 16px;background:#1a2a4a;color:white;border:none;border-radius:10px;font-size:0.8rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;white-space:nowrap;" onmouseover="this.style.background='#253d6b'" onmouseout="this.style.background='#1a2a4a'"><i class="fa-solid fa-table-list"></i> ${t('ver_avisos')}</button></div>`,
            infoText:t('kpi01_info'),
            seccionExtra:seccion, tablaHtml:tabla,
        }));
    }

    // ════════════════════════════════════════════════════════════
    // RENDER KPI-03  — Incidencias no urgentes ≤ 72h
    // ════════════════════════════════════════════════════════════
    function renderKPI03() {
        const stats  = calcularKPI03();
        const color  = { verde:'#2ecc71', amarillo:'#f1c40f', rojo:'#e74c3c' }[stats.estado];
        const labelE = t({ verde:'cumple', amarillo:'alerta', rojo:'no_cumple' }[stats.estado]);
        const distRows = stats.distribucion.map(d => {
            const pct2 = stats.cerradas > 0 ? (d.count/stats.cerradas*100).toFixed(1) : '0.0';
            const w = Math.min(100, parseFloat(pct2));
            const bc = d.enPlazo ? '#2ecc71' : '#e74c3c';
            return `<div class="kpinv-dist-row">
                <span class="kpinv-dist-label">${d.label}</span>
                <div class="kpinv-dist-track"><div style="height:100%;width:${w}%;background:${bc};border-radius:6px;transition:width .5s;"></div></div>
                <span class="kpinv-dist-val">${d.count} <small>(${pct2}%)</small></span>
            </div>`;
        }).join('');
        const tablaRows = Object.entries(stats.porPrioridad).map(([p, d], i) => {
            const v = d.total > 0 ? d.enPlazo/d.total*100 : 0;
            return `<tr style="background:${i%2===0?'white':'#fafbff'};border-bottom:1px solid #f0f2f8;">
                <td style="padding:8px 12px;font-size:0.82rem;color:#32325d;">${p||'—'}</td>
                <td style="padding:8px 12px;text-align:center;">${_semaforoSvg(v,{verde:90,amarillo:85})}</td>
                <td style="padding:8px 12px;text-align:right;font-weight:700;color:#1a2a4a;">${d.total}</td>
                <td style="padding:8px 12px;text-align:right;font-weight:700;color:#27ae60;">${d.enPlazo}</td>
                <td style="padding:8px 12px;text-align:right;font-weight:700;color:#e74c3c;">${d.fueraPlazo}</td>
                <td style="padding:8px 12px;text-align:right;color:#8898aa;">${d.sinCierre}</td>
                <td style="padding:8px 12px;text-align:center;">${_badgePct(v,90,85)}</td>
            </tr>`;
        }).join('');
        const tabla = `<table style="width:100%;border-collapse:collapse;min-width:460px;">
            <thead><tr style="background:#f0f2f8;">
                <th style="padding:9px 12px;text-align:left;font-size:0.75rem;color:#1a2a4a;font-weight:700;">${t('filtro_prioridad')}</th>
                <th style="padding:9px 12px;text-align:center;font-size:0.75rem;color:#1a2a4a;font-weight:700;">${t('estado')}</th>
                <th style="padding:9px 12px;text-align:right;font-size:0.75rem;color:#1a2a4a;font-weight:700;">${t('kpi03_total')}</th>
                <th style="padding:9px 12px;text-align:right;font-size:0.75rem;color:#27ae60;font-weight:700;">${t('kpi03_en_plazo')}</th>
                <th style="padding:9px 12px;text-align:right;font-size:0.75rem;color:#e74c3c;font-weight:700;">${t('kpi03_fuera_plazo')}</th>
                <th style="padding:9px 12px;text-align:right;font-size:0.75rem;color:#8898aa;font-weight:700;">${t('kpi03_sin_cierre')}</th>
                <th style="padding:9px 12px;text-align:center;font-size:0.75rem;color:#1a2a4a;font-weight:700;">KPI-03 %</th>
            </tr></thead>
            <tbody>${tablaRows||`<tr><td colspan="7" style="text-align:center;color:#8898aa;padding:14px;">${t('sin_datos')}</td></tr>`}</tbody>
        </table>`;
        const seccion = `<div class="kpi-section"><div class="kpinv-section-header"><i class="fa-solid fa-chart-bar" style="margin-right:7px;opacity:.8;"></i>${t('kpi03_distribucion')}</div><div style="padding:14px 16px;">${distRows}</div></div>`;
        _renderView(_renderKpiCard('kpi03', stats.porcentaje, color, labelE, {
            idLabel:'KPI-03', nombre:t('kpi03_nombre'), formula:t('formula_03'), formulaSub:t('formula_03_sub'), objetivo:90,
            stat1:{icon:'fa-triangle-exclamation',iconColor:'#5e72e4',numColor:'#1a2a4a',num:stats.total,     label:t('kpi03_total')},
            stat2:{icon:'fa-circle-check',        iconColor:'#2ecc71',numColor:'#27ae60',num:stats.nEnPlazo,  label:t('kpi03_en_plazo'),   bg:'#f0fff4',border:'#b7ebce'},
            stat3:{icon:'fa-clock',               iconColor:'#e74c3c',numColor:'#e74c3c',num:stats.nFuera,    label:t('kpi03_fuera_plazo'),bg:'#fff5f5',border:'#fbd0d0'},
            stat4:{icon:'fa-ban',                 iconColor:'#8898aa',numColor:'#8898aa',num:stats.nSinCierre,label:t('kpi03_sin_cierre')},
            btnExtra: `<div style="display:flex;align-items:center;justify-content:center;padding:4px;"><button onclick="FncKPI.verRegistrosKPI03()" style="padding:10px 16px;background:#1a2a4a;color:white;border:none;border-radius:10px;font-size:0.8rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;white-space:nowrap;" onmouseover="this.style.background='#253d6b'" onmouseout="this.style.background='#1a2a4a'"><i class="fa-solid fa-table-list"></i> ${t('ver_avisos')}</button></div>`,
            infoText:t('kpi03_info'),
            seccionExtra:seccion, tablaHtml:tabla,
        }));
    }

    // ════════════════════════════════════════════════════════════
    // RENDER KPI-04 / KPI-05  — Respuesta operativa
    // ════════════════════════════════════════════════════════════
    function _renderKPI_Respuesta(kpiId, stats, nombres) {
        const color  = { verde:'#2ecc71', amarillo:'#f1c40f', rojo:'#e74c3c' }[stats.estado];
        const labelE = t({ verde:'cumple', amarillo:'alerta', rojo:'no_cumple' }[stats.estado]);
        const distRows = _renderDistRows(stats.distribucion, stats.conTiempo);
        const seccion = `<div class="kpi-section"><div class="kpinv-section-header"><i class="fa-solid fa-chart-bar" style="margin-right:7px;opacity:.8;"></i>${nombres.distribucion}</div><div style="padding:14px 16px;">${distRows}</div></div>`;
        const idLabel = kpiId.replace('kpi','KPI-').toUpperCase();
        _renderView(_renderKpiCard(kpiId, stats.porcentaje, color, labelE, {
            idLabel, nombre:nombres.nombre, formula:nombres.formula, formulaSub:nombres.formulaSub,
            objetivo:stats.objetivo, conPrioridad:false,
            stat1:{icon:'fa-truck-fast',   iconColor:'#5e72e4',numColor:'#1a2a4a',num:stats.total,      label:nombres.total},
            stat2:{icon:'fa-circle-check', iconColor:'#2ecc71',numColor:'#27ae60',num:stats.enPlazo,    label:nombres.enPlazo,    bg:'#f0fff4',border:'#b7ebce'},
            stat3:{icon:'fa-clock',        iconColor:'#e74c3c',numColor:'#e74c3c',num:stats.fueraPlazo, label:nombres.fueraPlazo, bg:'#fff5f5',border:'#fbd0d0'},
            stat4:{icon:'fa-ban',          iconColor:'#8898aa',numColor:'#8898aa',num:stats.sinLlegada, label:t('sin_llegada_label')},
            btnExtra: kpiId === 'kpi04'
                ? `<div style="display:flex;align-items:center;justify-content:center;padding:4px;"><button onclick="FncKPI.verRegistrosKPI04()" style="padding:10px 16px;background:#1a2a4a;color:white;border:none;border-radius:10px;font-size:0.8rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;white-space:nowrap;" onmouseover="this.style.background='#253d6b'" onmouseout="this.style.background='#1a2a4a'"><i class="fa-solid fa-table-list"></i> ${t('ver_avisos')}</button></div>`
                : `<div style="display:flex;align-items:center;justify-content:center;padding:4px;"><button onclick="FncKPI.verRegistrosKPI05()" style="padding:10px 16px;background:#1a2a4a;color:white;border:none;border-radius:10px;font-size:0.8rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;white-space:nowrap;" onmouseover="this.style.background='#253d6b'" onmouseout="this.style.background='#1a2a4a'"><i class="fa-solid fa-table-list"></i> ${t('ver_avisos')}</button></div>`,
            infoText:kpiId==='kpi04'?t('kpi04_info'):t('kpi05_info'),
            seccionExtra:seccion,
        }));
    }


    // ════════════════════════════════════════════════════════════
    // CÁLCULO KPI-06: Recontacto mismo incidente ≤ 24h
    // Objetivo: ≤ 8% (inverso: menos recontacto = mejor)
    // ════════════════════════════════════════════════════════════
    function calcularKPI06() {
        const df = getDashboardFilters();
        let filas = _rawData;
        if (df.years.length > 0)  filas = filas.filter(r => df.years.includes(r.anyo));
        if (df.months.length > 0) filas = filas.filter(r => df.months.includes(r.mes));
        if (df.cats.length > 0)   filas = filas.filter(r => df.cats.includes(r.tipologia));
        if (_filtroPatrulla) filas = filas.filter(r => r.patrulla === _filtroPatrulla);

        const cerrados = filas.filter(r => r.fechaFin && r.fechaFin.trim() !== '');
        const total = cerrados.length;
        if (total === 0) return { total:0, nRecontacto:0, nSinRecontacto:0, porcentaje:0, objetivo:8, estado:'verde', distribucion:[], filas:[] };

        const parseT = (s) => {
            if (!s) return NaN;
            const p = String(s).split(/[\s\/]/);
            if (p.length < 3) return NaN;
            const [d, m, y] = p;
            const tm = p[3] || '00:00';
            const [hh, mm] = tm.split(':');
            return new Date(+y, +m-1, +d, +hh||0, +mm||0).getTime();
        };

        // Índice por VIA para búsqueda rápida
        const porVia = {};
        filas.forEach(r => {
            const via = (r.via || r.tipologia || '').trim().toLowerCase();
            if (!via) return;
            if (!porVia[via]) porVia[via] = [];
            porVia[via].push(r);
        });

        const recontactoSet = new Set();
        const tiemposRecontacto = [];
        cerrados.forEach(r => {
            const tFin = parseT(r.fechaFin);
            if (isNaN(tFin)) return;
            const via = (r.via || r.tipologia || '').trim().toLowerCase();
            const vecinos = porVia[via] || [];
            const minHoras = vecinos.reduce((min, r2) => {
                if (r2 === r) return min;
                const t2 = parseT(r2.fechaInicio);
                if (isNaN(t2) || t2 <= tFin) return min;
                const diff = (t2 - tFin) / 3600000;
                return diff <= 24 && diff < min ? diff : min;
            }, Infinity);
            if (minHoras < Infinity) {
                recontactoSet.add(r);
                tiemposRecontacto.push(minHoras);
            }
        });

        const nRecontacto    = recontactoSet.size;
        const nSinRecontacto = total - nRecontacto;
        const porcentaje     = total > 0 ? (nRecontacto / total * 100) : 0;
        const objetivo       = 8;
        let estado;
        if (porcentaje <= objetivo)          estado = 'verde';
        else if (porcentaje <= objetivo + 4) estado = 'amarillo';
        else                                 estado = 'rojo';

        const rangos = [{label:'0–6h',min:0,max:6},{label:'6–12h',min:6,max:12},{label:'12–18h',min:12,max:18},{label:'18–24h',min:18,max:24}];
        const distribucion = rangos.map(rng => ({
            label:'↩ ' + rng.label, enPlazo:false,
            count: tiemposRecontacto.filter(h => h >= rng.min && h < rng.max).length,
        }));

        return { total, nRecontacto, nSinRecontacto, porcentaje, objetivo, estado, distribucion, filas:cerrados };
    }

    // ════════════════════════════════════════════════════════════
    // CÁLCULO KPI-07: Satisfacción ciudadana media (escala 1–5)
    // Objetivo: ≥ 4.2/5
    // ════════════════════════════════════════════════════════════
    function calcularKPI07() {
        const df = getDashboardFilters();
        let filas = _rawData;
        if (df.years.length > 0)  filas = filas.filter(r => df.years.includes(r.anyo));
        if (df.months.length > 0) filas = filas.filter(r => df.months.includes(r.mes));
        if (df.cats.length > 0)   filas = filas.filter(r => df.cats.includes(r.tipologia));
        if (_filtroPatrulla) filas = filas.filter(r => r.patrulla === _filtroPatrulla);

        const puntuaciones = filas.map(r => r._satisfaccion).filter(v => v !== null && v !== undefined);
        const total  = puntuaciones.length;
        const suma   = puntuaciones.reduce((a, b) => a + b, 0);
        const media  = total > 0 ? suma / total : 0;
        const objetivo = 4.2;
        let estado;
        if (media >= objetivo)            estado = 'verde';
        else if (media >= objetivo - 0.3) estado = 'amarillo';
        else                              estado = 'rojo';

        const distribucion = [1,2,3,4,5].map(n => ({
            label:`${n} ${'★'.repeat(n)}`, enPlazo: n >= 4,
            count: puntuaciones.filter(v => Math.round(v) === n).length,
        }));

        return {
            total, suma, media,
            nSatisfechos  : puntuaciones.filter(v => v >= 4).length,
            nNoSatisfechos: puntuaciones.filter(v => v < 4).length,
            sinRespuesta  : filas.length - total,
            objetivo, estado, distribucion, filas,
        };
    }

    // ════════════════════════════════════════════════════════════
    // RENDER KPI-06
    // ════════════════════════════════════════════════════════════
    function renderKPI06() {
        const stats  = calcularKPI06();
        const color  = { verde:'#2ecc71', amarillo:'#f1c40f', rojo:'#e74c3c' }[stats.estado];
        const labelE = t({ verde:'cumple', amarillo:'alerta', rojo:'no_cumple' }[stats.estado]);
        const distRows = stats.distribucion.map(d => {
            const pct2 = stats.nRecontacto > 0 ? (d.count/stats.nRecontacto*100).toFixed(1) : '0.0';
            const w = Math.min(100, parseFloat(pct2));
            return `<div class="kpinv-dist-row">
                <span class="kpinv-dist-label">${d.label}</span>
                <div class="kpinv-dist-track"><div style="height:100%;width:${w}%;background:#f59e0b;border-radius:6px;transition:width .5s;"></div></div>
                <span class="kpinv-dist-val">${d.count} <small>(${pct2}%)</small></span>
            </div>`;
        }).join('');
        const seccion = `<div class="kpi-section"><div class="kpinv-section-header"><i class="fa-solid fa-chart-bar" style="margin-right:7px;opacity:.8;"></i>${t('kpi06_distribucion')}</div><div style="padding:14px 16px;">${distRows}</div></div>`;
        _renderView(_renderKpiCard('kpi06', stats.porcentaje, color, labelE, {
            idLabel:'KPI-06', nombre:t('kpi06_nombre'), formula:t('kpi06_formula'), formulaSub:t('kpi06_formula_sub'),
            objetivo:8, objSymbol:'≤', conPrioridad:false,
            stat1:{icon:'fa-check-double',  iconColor:'#5e72e4', numColor:'#1a2a4a', num:stats.total,          label:t('kpi06_total')},
            stat2:{icon:'fa-rotate-right',  iconColor:'#e74c3c', numColor:'#e74c3c', num:stats.nRecontacto,    label:t('kpi06_recontacto'),    bg:'#fff5f5',border:'#fbd0d0'},
            stat3:{icon:'fa-circle-check',  iconColor:'#2ecc71', numColor:'#27ae60', num:stats.nSinRecontacto, label:t('kpi06_sin_recontacto'),bg:'#f0fff4',border:'#b7ebce'},
            btnExtra:_btnVerAvisos('verRegistrosKPI06'),
            infoText:t('kpi06_info'),
            seccionExtra:seccion,
        }));
    }

    // ════════════════════════════════════════════════════════════
    // RENDER KPI-07
    // ════════════════════════════════════════════════════════════
    function renderKPI07() {
        const stats  = calcularKPI07();
        const color  = { verde:'#2ecc71', amarillo:'#f1c40f', rojo:'#e74c3c' }[stats.estado];
        const labelE = t({ verde:'cumple', amarillo:'alerta', rojo:'no_cumple' }[stats.estado]);
        const pctGauge = stats.total > 0 ? (stats.media / 5 * 100) : 0;
        const mediaDisplay = stats.total > 0 ? stats.media.toFixed(2) + '/5' : '—/5';
        const distRows = _renderDistRows(stats.distribucion, stats.total);
        const seccion = `<div class="kpi-section"><div class="kpinv-section-header"><i class="fa-solid fa-star" style="margin-right:7px;opacity:.8;"></i>${t('kpi07_distribucion')}</div><div style="padding:14px 16px;">${distRows}</div></div>`;
        _renderView(_renderKpiCard('kpi07', pctGauge, color, labelE, {
            idLabel:'KPI-07', nombre:t('kpi07_nombre'), formula:t('kpi07_formula'), formulaSub:t('kpi07_formula_sub'),
            objetivo:84, conPrioridad:false,
            stat1:{icon:'fa-star',           iconColor:'#f59e0b', numColor:'#f59e0b', num:mediaDisplay,          label:t('kpi07_media')},
            stat2:{icon:'fa-face-smile',      iconColor:'#2ecc71', numColor:'#27ae60', num:stats.nSatisfechos,    label:t('kpi07_satisfechos'),   bg:'#f0fff4',border:'#b7ebce'},
            stat3:{icon:'fa-face-frown',      iconColor:'#e74c3c', numColor:'#e74c3c', num:stats.nNoSatisfechos,  label:t('kpi07_no_satisfechos'),bg:'#fff5f5',border:'#fbd0d0'},
            stat4:{icon:'fa-question-circle', iconColor:'#8898aa', numColor:'#8898aa', num:stats.sinRespuesta,    label:t('kpi07_sin_respuesta')},
            btnExtra:_btnVerAvisos('verRegistrosKPI07'),
            infoText:t('kpi07_info'),
            seccionExtra:seccion,
        }));
    }


    // ════════════════════════════════════════════════════════════
    // CÁLCULO KPI-08: Atención accidentes con lesiones ≤ 15min
    // Fórmula: (Nº accidentes con lesiones llegada ≤15min / Nº accidentes con lesiones) × 100
    // Objetivo: ≥ 90%
    // Filtro: DSVLESIONES = True
    // Tiempo: FECHAINICIO → FECHALLEGADA (en minutos)
    // ════════════════════════════════════════════════════════════
    function calcularKPI08() {
        const df = getDashboardFilters();
        let filas = _rawData;
        if (df.years.length > 0)  filas = filas.filter(r => df.years.includes(r.anyo));
        if (df.months.length > 0) filas = filas.filter(r => df.months.includes(r.mes));
        if (df.cats.length > 0)   filas = filas.filter(r => df.cats.includes(r.tipologia));
        if (_filtroPatrulla) filas = filas.filter(r => r.patrulla === _filtroPatrulla);

        // Solo accidentes con lesiones
        const conLesiones = filas.filter(r => r._dsvLesiones === true);
        const total = conLesiones.length;

        const conLlegada    = conLesiones.filter(r => r._tiempoAtencion !== null);
        const enPlazo       = conLlegada.filter(r => r._tiempoAtencion <= 900);   // 15 min = 900s
        const fueraPlazo    = conLlegada.filter(r => r._tiempoAtencion > 900);
        const sinLlegada    = conLesiones.filter(r => r._tiempoAtencion === null);

        const porcentaje = total > 0 ? (enPlazo.length / total * 100) : 0;
        const objetivo   = 90;
        let estado;
        if (porcentaje >= objetivo)          estado = 'verde';
        else if (porcentaje >= objetivo - 5) estado = 'amarillo';
        else                                 estado = 'rojo';

        const rangos = [
            { label: '≤ 5min',   min:0,    max:300   },
            { label: '5–10min',  min:300,  max:600   },
            { label: '10–15min', min:600,  max:900   },
            { label: '15–20min', min:900,  max:1200  },
            { label: '> 20min',  min:1200, max:Infinity },
        ];
        const distribucion = rangos.map(rng => ({
            label  : rng.label,
            enPlazo: rng.max <= 900,
            count  : conLlegada.filter(r => r._tiempoAtencion >= rng.min && r._tiempoAtencion < rng.max).length,
        }));

        return {
            total, enPlazo: enPlazo.length, fueraPlazo: fueraPlazo.length,
            sinLlegada: sinLlegada.length, conTiempo: conLlegada.length,
            porcentaje, objetivo, estado,
            distribucion, filas: conLesiones,
        };
    }

    // ════════════════════════════════════════════════════════════
    // RENDER KPI-08
    // ════════════════════════════════════════════════════════════
    function renderKPI08() {
        const stats  = calcularKPI08();
        const color  = { verde:'#2ecc71', amarillo:'#f1c40f', rojo:'#e74c3c' }[stats.estado];
        const labelE = t({ verde:'cumple', amarillo:'alerta', rojo:'no_cumple' }[stats.estado]);

        const distRows = _renderDistRows(stats.distribucion, stats.conTiempo);

        const seccion = _renderSeccionDist(t('kpi08_distribucion'), 'fa-chart-bar', distRows);

        _renderView(_renderKpiCard('kpi08', stats.porcentaje, color, labelE, {
            idLabel:'KPI-08', nombre:t('kpi08_nombre'),
            formula:t('kpi08_formula'), formulaSub:t('kpi08_formula_sub'),
            objetivo:90, conPrioridad:false,
            infoText:t('kpi08_info'),
            stat1:{icon:'fa-car-burst',     iconColor:'#5e72e4', numColor:'#1a2a4a', num:stats.total,      label:t('kpi08_total')},
            stat2:{icon:'fa-circle-check',  iconColor:'#2ecc71', numColor:'#27ae60', num:stats.enPlazo,    label:t('kpi08_en_plazo'),    bg:'#f0fff4', border:'#b7ebce'},
            stat3:{icon:'fa-clock',         iconColor:'#e74c3c', numColor:'#e74c3c', num:stats.fueraPlazo, label:t('kpi08_fuera_plazo'), bg:'#fff5f5', border:'#fbd0d0'},
            stat4:{icon:'fa-ban',           iconColor:'#8898aa', numColor:'#8898aa', num:stats.sinLlegada, label:t('kpi08_sin_llegada')},
            btnExtra:_btnVerAvisos('verRegistrosKPI08'),
            seccionExtra:seccion,
        }));
    }


    // ════════════════════════════════════════════════════════════
    // PARSEO — Archivo de atestados viales (KPI-09 / KPI-10)
    // Columnas: REFNUM, REFANNO, FECHA, HORA, FECHAAPERTURA,
    //           FECHAREMISION, REMITIDO, SUBSANACION, FINALIZADO
    // ════════════════════════════════════════════════════════════
    function parsearDatosAtestados(data) {
        const parseF = (v) => {
            if (!v || v === '') return null;
            if (v instanceof Date) return v;
            const s = String(v).trim();
            // Formato DD/MM/YYYY HH:MM o DD/MM/YYYY
            const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
            if (!m) return null;
            return new Date(+m[3], +m[2]-1, +m[1], +(m[4]||0), +(m[5]||0));
        };

        // Días hábiles entre dos fechas (sin festivos — aproximación)
        const diasHabiles = (d1, d2) => {
            if (!d1 || !d2) return null;
            let count = 0;
            const cur = new Date(d1);
            cur.setHours(0,0,0,0);
            const end = new Date(d2);
            end.setHours(0,0,0,0);
            if (end < cur) return null;
            while (cur < end) {
                const dow = cur.getDay();
                if (dow !== 0 && dow !== 6) count++;
                cur.setDate(cur.getDate() + 1);
            }
            return count;
        };

        _rawDataAtestados = data.map((r, idx) => {
            const fechaAp  = parseF(r['FECHAAPERTURA'] || r['FECHA']);
            const fechaRem = parseF(r['FECHAREMISION']);
            const dh = diasHabiles(fechaAp, fechaRem);
            const finVal  = r['FINALIZADO'];
            const subVal  = r['SUBSANACION'];
            const anyo = fechaAp ? fechaAp.getFullYear() : (r['REFANNO'] ? +r['REFANNO'] : null);
            const mes  = fechaAp ? fechaAp.getMonth() + 1 : null;
            return {
                num          : +r['REFNUM'] || (idx + 1),
                anyo, mes,
                fechaApertura: r['FECHAAPERTURA'] || r['FECHA'] || '',
                fechaRemision: r['FECHAREMISION'] || '',
                remitido     : String(r['REMITIDO']).toLowerCase() === 'true' || r['REMITIDO'] === true,
                _tieneRemision: fechaRem !== null,        // KPI-09: tiene FECHAREMISION
                _diasHabiles : dh,                        // KPI-09: días hábiles apertura→remisión
                _subsanacion : subVal !== null && subVal !== undefined && String(subVal).trim() !== '', // KPI-10: tiene subsanación
                _finalizado  : String(finVal).toLowerCase() === 'true' || finVal === true || finVal === 1,
            };
        });

        _kpisDisponibles.add('kpi09');
        _kpisDisponibles.add('kpi10');
        if (!_kpisDisponibles.has(_kpiActivo)) _kpiActivo = [..._kpisDisponibles][0] || 'kpi09';
        _cargado = true;
        console.log(`[KPI] Atestados cargados: ${_rawDataAtestados.length} registros`);
    }

    // ════════════════════════════════════════════════════════════
    // HELPER: filtros para rawDataAtestados
    // ════════════════════════════════════════════════════════════
    function getFilasAtestados() {
        const df = getDashboardFilters();
        let filas = _rawDataAtestados;
        if (df.years.length > 0)  filas = filas.filter(r => df.years.includes(r.anyo));
        if (df.months.length > 0) filas = filas.filter(r => df.months.includes(r.mes));
        return filas;
    }

    // ════════════════════════════════════════════════════════════
    // CÁLCULO KPI-09: Cierre atestados ≤ 10 días hábiles
    // Fórmula: (Nº atestados remitidos ≤10 días hábiles / Nº total abiertos) × 100
    // Atestados remitidos: FECHAREMISION tiene contenido
    // Objetivo: ≥ 85%
    // ════════════════════════════════════════════════════════════
    function calcularKPI09() {
        const filas = getFilasAtestados();
        const total = filas.length;
        const remitidos      = filas.filter(r => r._tieneRemision);
        const enPlazo        = remitidos.filter(r => r._diasHabiles !== null && r._diasHabiles <= 10);
        const fueraPlazo     = remitidos.filter(r => r._diasHabiles !== null && r._diasHabiles > 10);
        const sinRemision    = filas.filter(r => !r._tieneRemision);
        // Denominador: atestados remitidos (con FECHAREMISION), no el total abierto
        const nRemitidos     = remitidos.length;
        const porcentaje     = nRemitidos > 0 ? (enPlazo.length / nRemitidos * 100) : 0;
        const objetivo       = 85;
        let estado;
        if (porcentaje >= objetivo)          estado = 'verde';
        else if (porcentaje >= objetivo - 5) estado = 'amarillo';
        else                                 estado = 'rojo';

        const rangos = [
            {label:'≤ 5 días', min:0,  max:6  },
            {label:'6–10 días',min:6,  max:11 },
            {label:'11–15 días',min:11,max:16 },
            {label:'16–20 días',min:16,max:21 },
            {label:'> 20 días', min:21,max:Infinity},
        ];
        const distribucion = rangos.map(rng => ({
            label: rng.label, enPlazo: rng.max <= 11,
            count: remitidos.filter(r => r._diasHabiles !== null && r._diasHabiles >= rng.min && r._diasHabiles < rng.max).length,
        }));

        return { total, nRemitidos:remitidos.length, nEnPlazo:enPlazo.length,
                 nFueraPlazo:fueraPlazo.length, nSinRemision:sinRemision.length,
                 porcentaje, objetivo, estado, distribucion, filas };
    }

    // ════════════════════════════════════════════════════════════
    // CÁLCULO KPI-10: Calidad documental — atestados sin subsanación
    // Fórmula: (Nº atestados sin subsanación / Nº atestados revisados) × 100
    // Sin subsanación: SUBSANACION vacío
    // Revisados: FINALIZADO = true
    // Objetivo: ≥ 95%
    // ════════════════════════════════════════════════════════════
    function calcularKPI10() {
        const filas = getFilasAtestados();
        const revisados      = filas.filter(r => r._finalizado);
        const sinSubsanacion = revisados.filter(r => !r._subsanacion);
        const conSubsanacion = revisados.filter(r => r._subsanacion);
        const noProcesados   = filas.filter(r => !r._finalizado);
        const total          = revisados.length;
        const porcentaje     = total > 0 ? (sinSubsanacion.length / total * 100) : 0;
        const objetivo       = 95;
        let estado;
        if (porcentaje >= objetivo)          estado = 'verde';
        else if (porcentaje >= objetivo - 3) estado = 'amarillo';
        else                                 estado = 'rojo';

        return { total, nSinSubsanacion:sinSubsanacion.length, nConSubsanacion:conSubsanacion.length,
                 noProcesados:noProcesados.length,
                 porcentaje, objetivo, estado, filas };
    }

    // ════════════════════════════════════════════════════════════
    // RENDER KPI-09
    // ════════════════════════════════════════════════════════════
    function renderKPI09() {
        const stats  = calcularKPI09();
        const color  = { verde:'#2ecc71', amarillo:'#f1c40f', rojo:'#e74c3c' }[stats.estado];
        const labelE = t({ verde:'cumple', amarillo:'alerta', rojo:'no_cumple' }[stats.estado]);

        const distRows = _renderDistRows(stats.distribucion, stats.nRemitidos);

        const seccion = _renderSeccionDist(t('kpi09_distribucion'), 'fa-chart-bar', distRows);

        _renderView(_renderKpiCard('kpi09', stats.porcentaje, color, labelE, {
            idLabel:'KPI-09', nombre:t('kpi09_nombre'), formula:t('kpi09_formula'), formulaSub:t('kpi09_formula_sub'),
            objetivo:85, conPrioridad:false, infoText:t('kpi09_info'),
            stat1:{icon:'fa-folder-open',  iconColor:'#5e72e4', numColor:'#1a2a4a', num:stats.total,          label:t('kpi09_total')},
            stat2:{icon:'fa-circle-check', iconColor:'#2ecc71', numColor:'#27ae60', num:stats.nEnPlazo,        label:t('kpi09_en_plazo'),    bg:'#f0fff4', border:'#b7ebce'},
            stat3:{icon:'fa-clock',        iconColor:'#e74c3c', numColor:'#e74c3c', num:stats.nFueraPlazo,     label:t('kpi09_fuera_plazo'), bg:'#fff5f5', border:'#fbd0d0'},
            stat4:{icon:'fa-file-circle-question', iconColor:'#8898aa', numColor:'#8898aa', num:stats.nSinRemision, label:t('kpi09_sin_remision')},
            btnExtra:_btnVerAvisos('verRegistrosKPI09'),
            seccionExtra:seccion,
        }));
    }

    // ════════════════════════════════════════════════════════════
    // RENDER KPI-10
    // ════════════════════════════════════════════════════════════
    function renderKPI10() {
        const stats  = calcularKPI10();
        const color  = { verde:'#2ecc71', amarillo:'#f1c40f', rojo:'#e74c3c' }[stats.estado];
        const labelE = t({ verde:'cumple', amarillo:'alerta', rojo:'no_cumple' }[stats.estado]);

        const distRows = [
            { label:t('kpi10_sin_subsanacion'), count:stats.nSinSubsanacion, bc:'#2ecc71' },
            { label:t('kpi10_con_subsanacion'), count:stats.nConSubsanacion, bc:'#e74c3c' },
        ].map(d => {
            const pct2 = stats.total > 0 ? (d.count/stats.total*100).toFixed(1) : '0.0';
            const w = Math.min(100, parseFloat(pct2));
            return `<div class="kpinv-dist-row">
                <span class="kpinv-dist-label">${d.label}</span>
                <div class="kpinv-dist-track"><div style="height:100%;width:${w}%;background:${d.bc};border-radius:6px;transition:width .5s;"></div></div>
                <span class="kpinv-dist-val">${d.count} <small>(${pct2}%)</small></span>
            </div>`;
        }).join('');

        const seccion = `<div class="kpi-section"><div class="kpinv-section-header"><i class="fa-solid fa-scale-balanced" style="margin-right:7px;opacity:.8;"></i>${t('kpi10_distribucion')}</div><div style="padding:14px 16px;">${distRows}</div></div>`;

        _renderView(_renderKpiCard('kpi10', stats.porcentaje, color, labelE, {
            idLabel:'KPI-10', nombre:t('kpi10_nombre'), formula:t('kpi10_formula'), formulaSub:t('kpi10_formula_sub'),
            objetivo:95, conPrioridad:false, infoText:t('kpi10_info'),
            stat1:{icon:'fa-file-contract',  iconColor:'#5e72e4', numColor:'#1a2a4a', num:stats.total,             label:t('kpi10_revisados')},
            stat2:{icon:'fa-circle-check',   iconColor:'#2ecc71', numColor:'#27ae60', num:stats.nSinSubsanacion,    label:t('kpi10_sin_subsanacion'), bg:'#f0fff4', border:'#b7ebce'},
            stat3:{icon:'fa-triangle-exclamation', iconColor:'#e74c3c', numColor:'#e74c3c', num:stats.nConSubsanacion, label:t('kpi10_con_subsanacion'), bg:'#fff5f5', border:'#fbd0d0'},
            stat4:{icon:'fa-hourglass-half', iconColor:'#8898aa', numColor:'#8898aa', num:stats.noProcesados,       label:t('kpi10_no_procesados')},
            btnExtra:_btnVerAvisos('verRegistrosKPI10'),
            seccionExtra:seccion,
        }));
    }


    // ════════════════════════════════════════════════════════════
    // PARSEO — Archivo controles KPI-11
    // Columnas: REFNUM, REFANNO, FECHA, HORA, CALLE, LONGITUD, LATITUD,
    //           TITULO, FECHAHORAINICIO, FECHAHORAFIN, ESTADO, NUMVEHICULOS
    // ════════════════════════════════════════════════════════════
    function parsearDatosControles(data) {
        _rawDataControles = data.map((r, idx) => {
            const numVeh = parseFloat(r['NUMVEHICULOS']);
            const ejecutado = !isNaN(numVeh) && numVeh > 0;
            const anyo = +r['REFANNO'] || null;
            const fechaStr = r['FECHA'] || r['FECHAHORAINICIO'] || '';
            let mes = null;
            const mM = String(fechaStr).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
            if (mM) mes = +mM[2];
            return {
                num          : +r['REFNUM'] || (idx + 1),
                anyo, mes,
                titulo       : String(r['TITULO'] || '').trim(),
                calle        : String(r['CALLE']  || '').trim(),
                estado       : String(r['ESTADO'] || '').trim(),
                fechaInicio  : r['FECHAHORAINICIO'] || r['FECHA'] || '',
                numVehiculos : isNaN(numVeh) ? null : numVeh,
                _ejecutado   : ejecutado,
            };
        });
        _kpisDisponibles.add('kpi11');
        if (!_kpisDisponibles.has(_kpiActivo)) _kpiActivo = 'kpi11';
        _cargado = true;
        console.log(`[KPI] Controles cargados: ${_rawDataControles.length} registros`);
    }

    function getFilasControles() {
        const df = getDashboardFilters();
        let filas = _rawDataControles;
        if (df.years.length > 0)  filas = filas.filter(r => df.years.includes(r.anyo));
        if (df.months.length > 0) filas = filas.filter(r => df.months.includes(r.mes));
        return filas;
    }

    // ════════════════════════════════════════════════════════════
    // CÁLCULO KPI-11: Controles planificados ejecutados
    // Planificado = todos los registros
    // Ejecutado   = NUMVEHICULOS no vacío y > 0
    // Objetivo: ≥ 95%
    // ════════════════════════════════════════════════════════════
    function calcularKPI11() {
        const filas      = getFilasControles();
        const total      = filas.length;
        const ejecutados = filas.filter(r => r._ejecutado);
        const noEjec     = filas.filter(r => !r._ejecutado);
        const porcentaje = total > 0 ? (ejecutados.length / total * 100) : 0;
        const objetivo   = 95;
        let estado;
        if (porcentaje >= objetivo)          estado = 'verde';
        else if (porcentaje >= objetivo - 5) estado = 'amarillo';
        else                                 estado = 'rojo';

        // Distribución por tipo de control (TITULO)
        const porTipo = {};
        filas.forEach(r => {
            const tipo = r.titulo || '—';
            if (!porTipo[tipo]) porTipo[tipo] = { total:0, ejecutados:0 };
            porTipo[tipo].total++;
            if (r._ejecutado) porTipo[tipo].ejecutados++;
        });

        return {
            total, nEjecutados:ejecutados.length, nNoEjecutados:noEjec.length,
            porcentaje, objetivo, estado, porTipo, filas,
        };
    }

    // ════════════════════════════════════════════════════════════
    // RENDER KPI-11
    // ════════════════════════════════════════════════════════════
    function renderKPI11() {
        const stats  = calcularKPI11();
        const color  = { verde:'#2ecc71', amarillo:'#f1c40f', rojo:'#e74c3c' }[stats.estado];
        const labelE = t({ verde:'cumple', amarillo:'alerta', rojo:'no_cumple' }[stats.estado]);

        // Distribución por tipo de control
        const tipoRows = Object.entries(stats.porTipo)
            .sort(([,a],[,b]) => b.total - a.total)
            .map(([tipo, d]) => {
                const pct  = d.total > 0 ? (d.ejecutados/d.total*100).toFixed(1) : '0.0';
                const w    = Math.min(100, parseFloat(pct));
                const bc   = parseFloat(pct) >= 95 ? '#2ecc71' : parseFloat(pct) >= 90 ? '#f59e0b' : '#e74c3c';
                return `<div class="kpinv-dist-row">
                    <span class="kpinv-dist-label" style="width:120px;font-size:0.72rem;">${tipo}</span>
                    <div class="kpinv-dist-track"><div style="height:100%;width:${w}%;background:${bc};border-radius:6px;transition:width .5s;"></div></div>
                    <span class="kpinv-dist-val">${d.ejecutados}/${d.total} <small>(${pct}%)</small></span>
                </div>`;
            }).join('');

        const seccion = `<div class="kpi-section"><div class="kpinv-section-header"><i class="fa-solid fa-chart-bar" style="margin-right:7px;opacity:.8;"></i>${t('kpi11_distribucion')}</div><div style="padding:14px 16px;">${tipoRows}</div></div>`;

        _renderView(_renderKpiCard('kpi11', stats.porcentaje, color, labelE, {
            idLabel:'KPI-11', nombre:t('kpi11_nombre'),
            formula:t('kpi11_formula'), formulaSub:t('kpi11_formula_sub'),
            objetivo:95, conPrioridad:false, infoText:t('kpi11_info'),
            stat1:{icon:'fa-traffic-cone',  iconColor:'#5e72e4', numColor:'#1a2a4a', num:stats.total,          label:t('kpi11_total')},
            stat2:{icon:'fa-circle-check',  iconColor:'#2ecc71', numColor:'#27ae60', num:stats.nEjecutados,    label:t('kpi11_ejecutados'),    bg:'#f0fff4', border:'#b7ebce'},
            stat3:{icon:'fa-circle-xmark',  iconColor:'#e74c3c', numColor:'#e74c3c', num:stats.nNoEjecutados,  label:t('kpi11_no_ejecutados'), bg:'#fff5f5', border:'#fbd0d0'},
            btnExtra:_btnVerAvisos('verRegistrosKPI11'),
            seccionExtra:seccion,
        }));
    }


    // ════════════════════════════════════════════════════════════
    // PARSEO — Archivo informes policiales (KPI-13)
    // Columnas: REFNUM, REFANNO, FECHA, HORA, FECHAREGISTRO, TITULO, FECHASALIDA
    // ════════════════════════════════════════════════════════════
    function parsearDatosInformes(data) {
        const parseF = (v) => {
            if (!v || v === '') return null;
            if (v instanceof Date) return v;
            const s = String(v).trim();
            const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
            if (!m) return null;
            return new Date(+m[3], +m[2]-1, +m[1], +(m[4]||0), +(m[5]||0));
        };

        const diasHabiles = (d1, d2) => {
            if (!d1 || !d2) return null;
            let count = 0;
            const cur = new Date(d1); cur.setHours(0,0,0,0);
            const end = new Date(d2); end.setHours(0,0,0,0);
            if (end < cur) return 0;
            while (cur < end) {
                const dow = cur.getDay();
                if (dow !== 0 && dow !== 6) count++;
                cur.setDate(cur.getDate() + 1);
            }
            return count;
        };

        _rawDataInformes = data.map((r, idx) => {
            const anyo = +r['REFANNO'] || null;
            const fechaReg = parseF(r['FECHAREGISTRO'] || r['FECHA']);
            const fechaSal = parseF(r['FECHASALIDA']);
            const mes = fechaReg ? fechaReg.getMonth() + 1 : null;
            const dh  = diasHabiles(fechaReg, fechaSal);
            return {
                num           : +r['REFNUM'] || (idx + 1),
                anyo, mes,
                titulo        : String(r['TITULO'] || '').trim() || '—',
                fechaRegistro : r['FECHAREGISTRO'] || r['FECHA'] || '',
                fechaSalida   : r['FECHASALIDA'] || '',
                _tieneEmision : fechaSal !== null,
                _diasHabiles  : dh,
                _enPlazo      : dh !== null && dh <= 10,
            };
        });

        _kpisDisponibles.add('kpi13');
        if (!_kpisDisponibles.has(_kpiActivo)) _kpiActivo = 'kpi13';
        _cargado = true;
        console.log(`[KPI] Informes cargados: ${_rawDataInformes.length} registros`);
    }

    function getFilasInformes() {
        const df = getDashboardFilters();
        let filas = _rawDataInformes;
        if (df.years.length > 0)  filas = filas.filter(r => df.years.includes(r.anyo));
        if (df.months.length > 0) filas = filas.filter(r => df.months.includes(r.mes));
        return filas;
    }

    // ════════════════════════════════════════════════════════════
    // CÁLCULO KPI-13
    // ════════════════════════════════════════════════════════════
    function calcularKPI13() {
        const filas       = getFilasInformes();
        const total       = filas.length;
        const conEmision  = filas.filter(r => r._tieneEmision);
        const enPlazo     = conEmision.filter(r => r._enPlazo);
        const fueraPlazo  = conEmision.filter(r => !r._enPlazo);
        const sinEmitir   = filas.filter(r => !r._tieneEmision);
        const porcentaje  = total > 0 ? (enPlazo.length / total * 100) : 0;
        const objetivo    = 90;
        let estado;
        if (porcentaje >= objetivo)          estado = 'verde';
        else if (porcentaje >= objetivo - 5) estado = 'amarillo';
        else                                 estado = 'rojo';

        // Distribución por tipo de informe (TITULO)
        const porTipo = {};
        filas.forEach(r => {
            const tipo = r.titulo || '—';
            if (!porTipo[tipo]) porTipo[tipo] = { total:0, enPlazo:0 };
            porTipo[tipo].total++;
            if (r._enPlazo) porTipo[tipo].enPlazo++;
        });

        // Distribución por rangos de días
        const rangos = [
            {label:'0 días',   min:0, max:1  },
            {label:'1–5 días', min:1, max:6  },
            {label:'6–10 días',min:6, max:11 },
            {label:'11–20 días',min:11,max:21},
            {label:'> 20 días', min:21,max:Infinity},
        ];
        const distribucion = rangos.map(rng => ({
            label: rng.label, enPlazo: rng.max <= 11,
            count: conEmision.filter(r => r._diasHabiles !== null && r._diasHabiles >= rng.min && r._diasHabiles < rng.max).length,
        }));

        return {
            total, nConEmision:conEmision.length, nEnPlazo:enPlazo.length,
            nFueraPlazo:fueraPlazo.length, nSinEmitir:sinEmitir.length,
            porcentaje, objetivo, estado, distribucion, porTipo, filas,
        };
    }

    // ════════════════════════════════════════════════════════════
    // RENDER KPI-13
    // ════════════════════════════════════════════════════════════
    function renderKPI13() {
        const stats  = calcularKPI13();
        const color  = { verde:'#2ecc71', amarillo:'#f1c40f', rojo:'#e74c3c' }[stats.estado];
        const labelE = t({ verde:'cumple', amarillo:'alerta', rojo:'no_cumple' }[stats.estado]);

        // Distribución por rangos de días
        const distRows = _renderDistRows(stats.distribucion, stats.nConEmision);

        // Tabla por tipo de informe
        const tipoRows = Object.entries(stats.porTipo)
            .sort(([,a],[,b]) => b.total - a.total)
            .map(([tipo, d], i) => {
                const v = d.total > 0 ? d.enPlazo/d.total*100 : 0;
                return `<tr style="background:${i%2===0?'white':'#fafbff'};border-bottom:1px solid #f0f2f8;">
                    <td style="padding:8px 12px;font-size:0.82rem;color:#32325d;">${tipo}</td>
                    <td style="padding:8px 12px;text-align:center;">${_semaforoSvg(v,{verde:90,amarillo:80})}</td>
                    <td style="padding:8px 12px;text-align:right;font-weight:700;color:#1a2a4a;">${d.total}</td>
                    <td style="padding:8px 12px;text-align:right;font-weight:700;color:#27ae60;">${d.enPlazo}</td>
                    <td style="padding:8px 12px;text-align:right;font-weight:700;color:#e74c3c;">${d.total-d.enPlazo}</td>
                    <td style="padding:8px 12px;text-align:center;">${_badgePct(v,90,80)}</td>
                </tr>`;
            }).join('');

        const tabla = `<table style="width:100%;border-collapse:collapse;min-width:420px;">
            <thead><tr style="background:#f0f2f8;">
                <th style="padding:9px 12px;text-align:left;font-size:0.75rem;color:#1a2a4a;font-weight:700;">Tipo informe</th>
                <th style="padding:9px 12px;text-align:center;font-size:0.75rem;color:#1a2a4a;font-weight:700;">${t('estado')}</th>
                <th style="padding:9px 12px;text-align:right;font-size:0.75rem;color:#1a2a4a;font-weight:700;">${t('kpi13_total')}</th>
                <th style="padding:9px 12px;text-align:right;font-size:0.75rem;color:#27ae60;font-weight:700;">${t('kpi13_en_plazo')}</th>
                <th style="padding:9px 12px;text-align:right;font-size:0.75rem;color:#e74c3c;font-weight:700;">${t('kpi13_fuera_plazo')}</th>
                <th style="padding:9px 12px;text-align:center;font-size:0.75rem;color:#1a2a4a;font-weight:700;">KPI-13 %</th>
            </tr></thead>
            <tbody>${tipoRows||`<tr><td colspan="6" style="text-align:center;color:#8898aa;padding:14px;">${t('sin_datos')}</td></tr>`}</tbody>
        </table>`;

        const seccion = _renderSeccionDist(t('kpi13_distribucion'), 'fa-chart-bar', distRows);

        _renderView(_renderKpiCard('kpi13', stats.porcentaje, color, labelE, {
            idLabel:'KPI-13', nombre:t('kpi13_nombre'),
            formula:t('kpi13_formula'), formulaSub:t('kpi13_formula_sub'),
            objetivo:90, conPrioridad:false, infoText:t('kpi13_info'),
            stat1:{icon:'fa-file-lines',   iconColor:'#5e72e4', numColor:'#1a2a4a', num:stats.total,         label:t('kpi13_total')},
            stat2:{icon:'fa-circle-check', iconColor:'#2ecc71', numColor:'#27ae60', num:stats.nEnPlazo,      label:t('kpi13_en_plazo'),    bg:'#f0fff4', border:'#b7ebce'},
            stat3:{icon:'fa-clock',        iconColor:'#e74c3c', numColor:'#e74c3c', num:stats.nFueraPlazo,   label:t('kpi13_fuera_plazo'), bg:'#fff5f5', border:'#fbd0d0'},
            stat4:{icon:'fa-file-circle-question', iconColor:'#8898aa', numColor:'#8898aa', num:stats.nSinEmitir, label:t('kpi13_sin_emitir')},
            btnExtra:_btnVerAvisos('verRegistrosKPI13'),
            seccionExtra:seccion, tablaHtml:tabla,
        }));
    }

    // ════════════════════════════════════════════════════════════
    // VER REGISTROS KPI-13
    // ════════════════════════════════════════════════════════════
    function verRegistrosKPI13() {
        const stats = calcularKPI13();
        const df    = getDashboardFilters();
        const periodoLabel = df.years.length ? df.years.join(', ') : '';
        _verRegistros({
            titulo  : `KPI-13${periodoLabel ? ' · '+periodoLabel : ''}`,
            resumen : `${stats.nEnPlazo}/${stats.total} ${t('kpi13_en_plazo').toLowerCase()}`,
            filas   : stats.filas,
            rowBg   : (r) => r._enPlazo ? 'white' : (r._tieneEmision ? '#fff5f5' : '#fffbe6'),
            columnas: [
                { key:'num',           label:t('aviso_num'),           align:'left',   render:(r,i)=>`<strong>${r.num>0?r.num:i+1}</strong>` },
                { key:'titulo',        label:'Tipo informe',            align:'left' },
                { key:'fechaRegistro', label:'Fecha registro',          align:'center' },
                { key:'fechaSalida',   label:'Fecha emisión',           align:'center', render:(r) => r.fechaSalida || `<span style="color:#8898aa;">—</span>` },
                { key:'_diasHabiles',  label:'Días hábiles',            align:'center',
                  render:(r) => r._diasHabiles === null ? `<span style="color:#8898aa;">—</span>`
                    : `<span style="font-weight:700;color:${r._enPlazo?'#27ae60':'#e74c3c'};">${r._diasHabiles} días</span>` },
                { key:'_ok13',         label:t('kpi13_en_plazo'),       align:'center',
                  render:(r) => {
                    if (!r._tieneEmision) return `<span style="padding:2px 8px;border-radius:20px;font-size:0.7rem;font-weight:700;background:#fef9ec;color:#92400e;">Pendiente</span>`;
                    return `<span style="padding:2px 8px;border-radius:20px;font-size:0.7rem;font-weight:700;background:${r._enPlazo?'#d4edda':'#fde8e8'};color:${r._enPlazo?'#155724':'#721c24'};">${r._enPlazo?t('si'):t('no')}</span>`;
                  }},
            ],
        });
    }


    // ════════════════════════════════════════════════════════════
    // PARSEO — Archivo denuncias administrativas (KPI-14)
    // Columnas: REFNUM, REFANNO, FECHA, HORA, FECHADENUNCIA, ESTADO, TITULO
    // ════════════════════════════════════════════════════════════
    function parsearDatosDenuncias(data) {
        _rawDataDenuncias = data.map((r, idx) => {
            const anyo = +r['REFANNO'] || null;
            const fechaStr = r['FECHADENUNCIA'] || r['FECHA'] || '';
            let mes = null;
            const mM = String(fechaStr).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
            if (mM) mes = +mM[2];
            const estado = String(r['ESTADO'] || '').trim();
            const titulo = String(r['TITULO'] || '').trim();
            // Sin devolución = TITULO no contiene "devolucion" (case-insensitive)
            const sinDevolucion = !/devolu/i.test(titulo);
            return {
                num           : +r['REFNUM'] || (idx + 1),
                anyo, mes,
                titulo        : titulo || '—',
                fechaDenuncia : r['FECHADENUNCIA'] || r['FECHA'] || '',
                estado,
                _sinDevolucion: sinDevolucion,
                _grabado      : estado === 'Grabado',
                _pendiente    : estado === 'Pendiente de Actuación',
            };
        });
        _kpisDisponibles.add('kpi14');
        if (!_kpisDisponibles.has(_kpiActivo)) _kpiActivo = 'kpi14';
        _cargado = true;
        console.log(`[KPI] Denuncias cargadas: ${_rawDataDenuncias.length} registros`);
    }

    function getFilasDenuncias() {
        const df = getDashboardFilters();
        let filas = _rawDataDenuncias;
        if (df.years.length > 0)  filas = filas.filter(r => df.years.includes(r.anyo));
        if (df.months.length > 0) filas = filas.filter(r => df.months.includes(r.mes));
        return filas;
    }

    // ════════════════════════════════════════════════════════════
    // CÁLCULO KPI-14
    // ════════════════════════════════════════════════════════════
    function calcularKPI14() {
        const filas        = getFilasDenuncias();
        const total        = filas.length;
        const sinDevolucion= filas.filter(r => r._sinDevolucion);
        const conDevolucion= filas.filter(r => !r._sinDevolucion);
        const grabados     = filas.filter(r => r._grabado);
        const pendientes   = filas.filter(r => r._pendiente);
        const porcentaje   = total > 0 ? (sinDevolucion.length / total * 100) : 0;
        const objetivo     = 97;
        let estado;
        if (porcentaje >= objetivo)          estado = 'verde';
        else if (porcentaje >= objetivo - 3) estado = 'amarillo';
        else                                 estado = 'rojo';

        // Distribución por tipo (TITULO)
        const porTipo = {};
        filas.forEach(r => {
            const tipo = r.titulo || '—';
            if (!porTipo[tipo]) porTipo[tipo] = { total:0, sinDev:0 };
            porTipo[tipo].total++;
            if (r._sinDevolucion) porTipo[tipo].sinDev++;
        });

        return {
            total, nSinDevolucion:sinDevolucion.length, nConDevolucion:conDevolucion.length,
            nGrabados:grabados.length, nPendientes:pendientes.length,
            porcentaje, objetivo, estado, porTipo, filas,
        };
    }

    // ════════════════════════════════════════════════════════════
    // RENDER KPI-14
    // ════════════════════════════════════════════════════════════
    function renderKPI14() {
        const stats  = calcularKPI14();
        const color  = { verde:'#2ecc71', amarillo:'#f1c40f', rojo:'#e74c3c' }[stats.estado];
        const labelE = t({ verde:'cumple', amarillo:'alerta', rojo:'no_cumple' }[stats.estado]);

        // Distribución por estado
        const estadoRows = [
            { label:t('kpi14_sin_devolucion'), count:stats.nSinDevolucion, bc:'#2ecc71' },
            { label:t('kpi14_grabado'),        count:stats.nGrabados,      bc:'#5e72e4' },
            { label:t('kpi14_pendiente'),      count:stats.nPendientes,    bc:'#f59e0b' },
            { label:t('kpi14_con_devolucion'), count:stats.nConDevolucion - stats.nGrabados - stats.nPendientes, bc:'#e74c3c' },
        ].filter(d => d.count > 0).map(d => {
            const pct2 = stats.total > 0 ? (d.count/stats.total*100).toFixed(1) : '0.0';
            const w = Math.min(100, parseFloat(pct2));
            return `<div class="kpinv-dist-row">
                <span class="kpinv-dist-label" style="width:160px;font-size:0.72rem;">${d.label}</span>
                <div class="kpinv-dist-track"><div style="height:100%;width:${w}%;background:${d.bc};border-radius:6px;transition:width .5s;"></div></div>
                <span class="kpinv-dist-val">${d.count} <small>(${pct2}%)</small></span>
            </div>`;
        }).join('');

        // Tabla por tipo de expediente
        const tipoRows = Object.entries(stats.porTipo)
            .sort(([,a],[,b]) => b.total - a.total)
            .slice(0, 15)
            .map(([tipo, d], i) => {
                const v = d.total > 0 ? d.sinDev/d.total*100 : 0;
                return `<tr style="background:${i%2===0?'white':'#fafbff'};border-bottom:1px solid #f0f2f8;">
                    <td style="padding:8px 12px;font-size:0.82rem;color:#32325d;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${tipo}">${tipo}</td>
                    <td style="padding:8px 12px;text-align:center;">${_semaforoSvg(v,{verde:97,amarillo:90})}</td>
                    <td style="padding:8px 12px;text-align:right;font-weight:700;color:#1a2a4a;">${d.total}</td>
                    <td style="padding:8px 12px;text-align:right;font-weight:700;color:#27ae60;">${d.sinDev}</td>
                    <td style="padding:8px 12px;text-align:right;font-weight:700;color:#e74c3c;">${d.total - d.sinDev}</td>
                    <td style="padding:8px 12px;text-align:center;">${_badgePct(v,97,90)}</td>
                </tr>`;
            }).join('');

        const tabla = `<table style="width:100%;border-collapse:collapse;min-width:420px;">
            <thead><tr style="background:#f0f2f8;">
                <th style="padding:9px 12px;text-align:left;font-size:0.75rem;color:#1a2a4a;font-weight:700;">Tipo expediente</th>
                <th style="padding:9px 12px;text-align:center;font-size:0.75rem;color:#1a2a4a;font-weight:700;">${t('estado')}</th>
                <th style="padding:9px 12px;text-align:right;font-size:0.75rem;color:#1a2a4a;font-weight:700;">${t('kpi14_total')}</th>
                <th style="padding:9px 12px;text-align:right;font-size:0.75rem;color:#27ae60;font-weight:700;">${t('kpi14_sin_devolucion')}</th>
                <th style="padding:9px 12px;text-align:right;font-size:0.75rem;color:#e74c3c;font-weight:700;">${t('kpi14_con_devolucion')}</th>
                <th style="padding:9px 12px;text-align:center;font-size:0.75rem;color:#1a2a4a;font-weight:700;">KPI-14 %</th>
            </tr></thead>
            <tbody>${tipoRows||`<tr><td colspan="6" style="text-align:center;color:#8898aa;padding:14px;">${t('sin_datos')}</td></tr>`}</tbody>
        </table>`;

        const seccion = _renderSeccionDist(t('kpi14_distribucion'), 'fa-chart-pie', estadoRows);

        _renderView(_renderKpiCard('kpi14', stats.porcentaje, color, labelE, {
            idLabel:'KPI-14', nombre:t('kpi14_nombre'),
            formula:t('kpi14_formula'), formulaSub:t('kpi14_formula_sub'),
            objetivo:97, conPrioridad:false, infoText:t('kpi14_info'),
            stat1:{icon:'fa-folder-open',   iconColor:'#5e72e4', numColor:'#1a2a4a', num:stats.total,           label:t('kpi14_total')},
            stat2:{icon:'fa-circle-check',  iconColor:'#2ecc71', numColor:'#27ae60', num:stats.nSinDevolucion,  label:t('kpi14_sin_devolucion'), bg:'#f0fff4', border:'#b7ebce'},
            stat3:{icon:'fa-rotate-left',   iconColor:'#e74c3c', numColor:'#e74c3c', num:stats.nConDevolucion,  label:t('kpi14_con_devolucion'), bg:'#fff5f5', border:'#fbd0d0'},
            stat4:{icon:'fa-hourglass-half',iconColor:'#8898aa', numColor:'#8898aa', num:stats.nGrabados + stats.nPendientes, label:t('kpi14_grabado')},
            btnExtra:_btnVerAvisos('verRegistrosKPI14'),
            seccionExtra:seccion, tablaHtml:tabla,
        }));
    }

    // ════════════════════════════════════════════════════════════
    // VER REGISTROS KPI-14
    // ════════════════════════════════════════════════════════════
    function verRegistrosKPI14() {
        const stats = calcularKPI14();
        const df    = getDashboardFilters();
        const periodoLabel = df.years.length ? df.years.join(', ') : '';
        _verRegistros({
            titulo  : `KPI-14${periodoLabel ? ' · '+periodoLabel : ''}`,
            resumen : `${stats.nSinDevolucion}/${stats.total} ${t('kpi14_sin_devolucion').toLowerCase()}`,
            filas   : stats.filas,
            rowBg   : (r) => r._sinDevolucion ? 'white' : (r._pendiente ? '#fffbe6' : '#fff5f5'),
            columnas: [
                { key:'num',          label:t('aviso_num'),              align:'left',   render:(r,i)=>`<strong>${r.num>0?r.num:i+1}</strong>` },
                { key:'titulo',       label:'Tipo expediente',            align:'left' },
                { key:'fechaDenuncia',label:'Fecha denuncia',             align:'center' },
                { key:'estado',       label:'Estado',                     align:'center',
                  render:(r) => {
                    const c = r._sinDevolucion ? '#27ae60' : r._pendiente ? '#92400e' : '#e74c3c';
                    const bg = r._sinDevolucion ? '#d4edda' : r._pendiente ? '#fef9ec' : '#fde8e8';
                    return `<span style="padding:2px 8px;border-radius:20px;font-size:0.7rem;font-weight:700;background:${bg};color:${c};">${r.estado||'—'}</span>`;
                  }},
                { key:'_ok14',        label:t('kpi14_sin_devolucion'),    align:'center',
                  render:(r) => `<span style="padding:2px 8px;border-radius:20px;font-size:0.7rem;font-weight:700;background:${r._sinDevolucion?'#d4edda':'#fde8e8'};color:${r._sinDevolucion?'#155724':'#721c24'};">${r._sinDevolucion?t('si'):t('no')}</span>` },
            ],
        });
    }


    // ════════════════════════════════════════════════════════════
    // PARSEO — Archivo eventos/dispositivos (KPI-15)
    // Columnas: REFNUM, REFANNO, FECHASOLICITUD, FECHA, HORA,
    //           TITULO, FECHAINICIO, FECHAFIN
    // Plan aprobado: TITULO = "Evento Plan Aprobado KPI-15" (exacto)
    // Antelación: FECHAINICIO - FECHASOLICITUD ≥ 72h
    // ════════════════════════════════════════════════════════════
    function parsearDatosEventos(data) {
        const parseF = (v) => {
            if (!v || v === '') return null;
            if (v instanceof Date) return v;
            const s = String(v).trim();
            const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
            if (!m) return null;
            return new Date(+m[3], +m[2]-1, +m[1], +(m[4]||0), +(m[5]||0));
        };

        _rawDataEventos = data.map((r, idx) => {
            const anyo = +r['REFANNO'] || null;
            const fechaSol  = parseF(r['FECHASOLICITUD']);
            const fechaIni  = parseF(r['FECHAINICIO'] || r['FECHA']);
            const mes = fechaIni ? fechaIni.getMonth() + 1 : (fechaSol ? fechaSol.getMonth() + 1 : null);
            // Antelación en horas: FECHAINICIO - FECHASOLICITUD
            let horasAntelacion = null;
            if (fechaSol && fechaIni) {
                horasAntelacion = (fechaIni.getTime() - fechaSol.getTime()) / 3600000;
            }
            const titulo        = String(r['TITULO'] || '').trim();
            const planAprobado  = titulo === 'Evento Plan Aprobado KPI-15';
            const enPlazo       = planAprobado && horasAntelacion !== null && horasAntelacion >= 72;
            return {
                num             : +r['REFNUM'] || (idx + 1),
                anyo, mes,
                titulo          : titulo || '—',
                fechaSolicitud  : r['FECHASOLICITUD'] || '',
                fechaInicio     : r['FECHAINICIO'] || r['FECHA'] || '',
                fechaFin        : r['FECHAFIN'] || '',
                horasAntelacion,
                _planAprobado   : planAprobado,
                _tieneSolicitud : fechaSol !== null,
                _enPlazo        : enPlazo,
            };
        });

        _kpisDisponibles.add('kpi15');
        if (!_kpisDisponibles.has(_kpiActivo)) _kpiActivo = 'kpi15';
        _cargado = true;
        console.log(`[KPI] Eventos cargados: ${_rawDataEventos.length} registros`);
    }

    function getFilasEventos() {
        const df = getDashboardFilters();
        let filas = _rawDataEventos;
        if (df.years.length > 0)  filas = filas.filter(r => df.years.includes(r.anyo));
        if (df.months.length > 0) filas = filas.filter(r => df.months.includes(r.mes));
        return filas;
    }

    // ════════════════════════════════════════════════════════════
    // CÁLCULO KPI-15
    // Total planificados: todos los registros
    // Con plan aprobado ≥72h: TITULO="Evento Plan Aprobado KPI-15" (exacto) y antelación ≥72h
    // Objetivo: ≥ 95%
    // ════════════════════════════════════════════════════════════
    function calcularKPI15() {
        const filas       = getFilasEventos();
        const total       = filas.length;
        const conPlan     = filas.filter(r => r._planAprobado);
        const enPlazo     = filas.filter(r => r._enPlazo);
        const conPlanFuera= conPlan.filter(r => !r._enPlazo);   // plan aprobado pero <72h
        const sinPlan     = filas.filter(r => !r._planAprobado);
        const sinSolicitud= filas.filter(r => !r._tieneSolicitud);
        const porcentaje  = total > 0 ? (enPlazo.length / total * 100) : 0;
        const objetivo    = 95;
        let estado;
        if (porcentaje >= objetivo)          estado = 'verde';
        else if (porcentaje >= objetivo - 5) estado = 'amarillo';
        else                                 estado = 'rojo';

        // Distribución por rangos de antelación (solo registros con plan aprobado)
        const rangos = [
            { label:'≥ 7 días',   min:168, max:Infinity },
            { label:'3–7 días',   min:72,  max:168  },
            { label:'24–72h',     min:24,  max:72   },
            { label:'< 24h',      min:0,   max:24   },
            { label:'Sin antelac.',min:-Infinity, max:0 },
        ];
        const distribucion = rangos.map(rng => ({
            label  : rng.label,
            enPlazo: rng.min >= 72,
            count  : conPlan.filter(r => {
                if (r.horasAntelacion === null) return rng.min === -Infinity;
                return r.horasAntelacion >= rng.min && r.horasAntelacion < rng.max;
            }).length,
        }));

        // Distribución por tipo de evento (TITULO, excluyendo el especial KPI-15)
        const porTipo = {};
        filas.forEach(r => {
            const tipo = r.titulo === 'Evento Plan Aprobado(KPI-15)' ? '✅ Plan aprobado KPI-15' : r.titulo || '—';
            if (!porTipo[tipo]) porTipo[tipo] = { total:0, enPlazo:0 };
            porTipo[tipo].total++;
            if (r._enPlazo) porTipo[tipo].enPlazo++;
        });

        return {
            total, nConPlan:conPlan.length, nEnPlazo:enPlazo.length,
            nConPlanFuera:conPlanFuera.length, nSinPlan:sinPlan.length,
            nSinSolicitud:sinSolicitud.length,
            porcentaje, objetivo, estado, distribucion, porTipo, filas,
        };
    }

    // ════════════════════════════════════════════════════════════
    // RENDER KPI-15
    // ════════════════════════════════════════════════════════════
    function renderKPI15() {
        const stats  = calcularKPI15();
        const color  = { verde:'#2ecc71', amarillo:'#f1c40f', rojo:'#e74c3c' }[stats.estado];
        const labelE = t({ verde:'cumple', amarillo:'alerta', rojo:'no_cumple' }[stats.estado]);

        const distRows = stats.distribucion.map(d => {
            const pct2 = stats.nConPlan > 0 ? (d.count/stats.nConPlan*100).toFixed(1) : '0.0';
            const w = Math.min(100, parseFloat(pct2));
            const bc = d.enPlazo ? '#2ecc71' : '#e74c3c';
            return `<div class="kpinv-dist-row">
                <span class="kpinv-dist-label" style="width:110px;">${d.label}</span>
                <div class="kpinv-dist-track"><div style="height:100%;width:${w}%;background:${bc};border-radius:6px;transition:width .5s;"></div></div>
                <span class="kpinv-dist-val">${d.count} <small>(${pct2}%)</small></span>
            </div>`;
        }).join('');

        const tipoRows = Object.entries(stats.porTipo)
            .sort(([,a],[,b]) => b.total - a.total)
            .slice(0, 12)
            .map(([tipo, d], i) => {
                const v = d.total > 0 ? d.enPlazo/d.total*100 : 0;
                return `<tr style="background:${i%2===0?'white':'#fafbff'};border-bottom:1px solid #f0f2f8;">
                    <td style="padding:8px 12px;font-size:0.82rem;color:#32325d;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${tipo}">${tipo}</td>
                    <td style="padding:8px 12px;text-align:right;font-weight:700;color:#1a2a4a;">${d.total}</td>
                    <td style="padding:8px 12px;text-align:right;font-weight:700;color:#27ae60;">${d.enPlazo}</td>
                    <td style="padding:8px 12px;text-align:right;font-weight:700;color:#e74c3c;">${d.total - d.enPlazo}</td>
                    <td style="padding:8px 12px;text-align:center;">${_badgePct(v,95,85)}</td>
                </tr>`;
            }).join('');

        const tabla = `<table style="width:100%;border-collapse:collapse;min-width:380px;">
            <thead><tr style="background:#f0f2f8;">
                <th style="padding:9px 12px;text-align:left;font-size:0.75rem;color:#1a2a4a;font-weight:700;">Tipo evento</th>
                <th style="padding:9px 12px;text-align:right;font-size:0.75rem;color:#1a2a4a;font-weight:700;">${t('kpi15_total')}</th>
                <th style="padding:9px 12px;text-align:right;font-size:0.75rem;color:#27ae60;font-weight:700;">${t('kpi15_en_plazo')}</th>
                <th style="padding:9px 12px;text-align:right;font-size:0.75rem;color:#e74c3c;font-weight:700;">${t('kpi15_fuera_plazo')}</th>
                <th style="padding:9px 12px;text-align:center;font-size:0.75rem;color:#1a2a4a;font-weight:700;">KPI-15 %</th>
            </tr></thead>
            <tbody>${tipoRows||`<tr><td colspan="5" style="text-align:center;color:#8898aa;padding:14px;">${t('sin_datos')}</td></tr>`}</tbody>
        </table>`;

        const seccion = _renderSeccionDist(t('kpi15_distribucion'), 'fa-clock-rotate-left', distRows);

        _renderView(_renderKpiCard('kpi15', stats.porcentaje, color, labelE, {
            idLabel:'KPI-15', nombre:t('kpi15_nombre'),
            formula:t('kpi15_formula'), formulaSub:t('kpi15_formula_sub'),
            objetivo:95, conPrioridad:false, infoText:t('kpi15_info'),
            stat1:{icon:'fa-calendar-days',  iconColor:'#5e72e4', numColor:'#1a2a4a', num:stats.total,           label:t('kpi15_total')},
            stat2:{icon:'fa-circle-check',   iconColor:'#2ecc71', numColor:'#27ae60', num:stats.nEnPlazo,        label:t('kpi15_en_plazo'),    bg:'#f0fff4', border:'#b7ebce'},
            stat3:{icon:'fa-triangle-exclamation', iconColor:'#e74c3c', numColor:'#e74c3c', num:stats.nSinPlan + stats.nConPlanFuera, label:t('kpi15_fuera_plazo'), bg:'#fff5f5', border:'#fbd0d0'},
            stat4:{icon:'fa-ban',            iconColor:'#8898aa', numColor:'#8898aa', num:stats.nSinSolicitud,   label:t('kpi15_sin_solicitud')},
            btnExtra:_btnVerAvisos('verRegistrosKPI15'),
            seccionExtra:seccion, tablaHtml:tabla,
        }));
    }

    // ════════════════════════════════════════════════════════════
    // VER REGISTROS KPI-15
    // ════════════════════════════════════════════════════════════
    function verRegistrosKPI15() {
        const stats = calcularKPI15();
        const df    = getDashboardFilters();
        const periodoLabel = df.years.length ? df.years.join(', ') : '';
        _verRegistros({
            titulo  : `KPI-15${periodoLabel ? ' · '+periodoLabel : ''}`,
            resumen : `${stats.nEnPlazo}/${stats.total} ${t('kpi15_en_plazo').toLowerCase()}`,
            filas   : stats.filas,
            rowBg   : (r) => r._enPlazo ? 'white' : (r._planAprobado ? '#fffbe6' : '#fff5f5'),
            columnas: [
                { key:'num',           label:t('aviso_num'),              align:'left',   render:(r,i)=>`<strong>${r.num>0?r.num:i+1}</strong>` },
                { key:'titulo',        label:'Tipo evento',                align:'left' },
                { key:'fechaSolicitud',label:'Fecha solicitud',            align:'center' },
                { key:'fechaInicio',   label:'Fecha inicio',               align:'center' },
                { key:'horasAntelacion',label:'Antelación (h)',            align:'center',
                  render:(r) => {
                    if (r.horasAntelacion === null) return `<span style="color:#8898aa;">—</span>`;
                    const h = r.horasAntelacion.toFixed(1);
                    const c = r.horasAntelacion >= 72 ? '#27ae60' : r.horasAntelacion >= 24 ? '#f59e0b' : '#e74c3c';
                    return `<span style="font-weight:700;color:${c};">${h}h</span>`;
                  }},
                { key:'_ok15',         label:t('kpi15_en_plazo'),          align:'center',
                  render:(r) => {
                    if (!r._planAprobado) return `<span style="padding:2px 8px;border-radius:20px;font-size:0.7rem;font-weight:700;background:#f0f0f0;color:#666;">Sin plan</span>`;
                    return `<span style="padding:2px 8px;border-radius:20px;font-size:0.7rem;font-weight:700;background:${r._enPlazo?'#d4edda':'#fde8e8'};color:${r._enPlazo?'#155724':'#721c24'};">${r._enPlazo?t('si'):t('no')}</span>`;
                  }},
            ],
        });
    }


    // ════════════════════════════════════════════════════════════
    // CÁLCULO KPI-18: Tiempo llegada VG/menores ≤ 8 min
    // Filtro: TITULO contiene 'VG' (palabra completa) o 'menor' (cualquier posición)
    // Tiempo: FECHAINICIO → FECHALLEGADA en segundos (_tiempoAtencion)
    // Objetivo: ≥ 90%
    // ════════════════════════════════════════════════════════════
    function calcularKPI18() {
        const df = getDashboardFilters();
        let filas = _rawData;
        if (df.years.length > 0)  filas = filas.filter(r => df.years.includes(r.anyo));
        if (df.months.length > 0) filas = filas.filter(r => df.months.includes(r.mes));
        if (df.cats.length > 0)   filas = filas.filter(r => df.cats.includes(r.tipologia));
        if (_filtroPatrulla) filas = filas.filter(r => r.patrulla === _filtroPatrulla);

        // Solo servicios VG/menores
        const vgMenores = filas.filter(r => r._esVGMenor === true);
        const total     = vgMenores.length;

        // _tiempoAtencion está en segundos; umbral 8 min = 480 s
        const conTiempo  = vgMenores.filter(r => r._tiempoAtencion !== null);
        const enPlazo    = conTiempo.filter(r => r._tiempoAtencion <= 480);
        const fueraPlazo = conTiempo.filter(r => r._tiempoAtencion > 480);
        const sinLlegada = vgMenores.filter(r => r._tiempoAtencion === null);

        const porcentaje = total > 0 ? (enPlazo.length / total * 100) : 0;
        const objetivo   = 90;
        let estado;
        if (porcentaje >= objetivo)          estado = 'verde';
        else if (porcentaje >= objetivo - 5) estado = 'amarillo';
        else                                 estado = 'rojo';

        const rangos = [
            { label:'≤ 2min',  min:0,    max:120  },
            { label:'2–5min',  min:120,  max:300  },
            { label:'5–8min',  min:300,  max:480  },
            { label:'8–12min', min:480,  max:720  },
            { label:'> 12min', min:720,  max:Infinity },
        ];
        const distribucion = rangos.map(rng => ({
            label  : rng.label,
            enPlazo: rng.max <= 480,
            count  : conTiempo.filter(r => r._tiempoAtencion >= rng.min && r._tiempoAtencion < rng.max).length,
        }));

        // Distribución por tipo (VG vs Menores)
        const nVG     = vgMenores.filter(r => /\bvg\b/i.test(r.tipologia || '')).length;
        const nMenores= vgMenores.filter(r => /menor/i.test(r.tipologia || '')).length;

        return {
            total, enPlazo:enPlazo.length, fueraPlazo:fueraPlazo.length,
            sinLlegada:sinLlegada.length, conTiempo:conTiempo.length,
            porcentaje, objetivo, estado,
            distribucion, filas:vgMenores,
        };
    }

    // ════════════════════════════════════════════════════════════
    // RENDER KPI-18
    // ════════════════════════════════════════════════════════════
    function renderKPI18() {
        const stats  = calcularKPI18();
        const color  = { verde:'#2ecc71', amarillo:'#f1c40f', rojo:'#e74c3c' }[stats.estado];
        const labelE = t({ verde:'cumple', amarillo:'alerta', rojo:'no_cumple' }[stats.estado]);

        const distRows = _renderDistRows(stats.distribucion, stats.conTiempo);

        const seccion = _renderSeccionDist(t('kpi18_distribucion'), 'fa-chart-bar', distRows);

        _renderView(_renderKpiCard('kpi18', stats.porcentaje, color, labelE, {
            idLabel:'KPI-18', nombre:t('kpi18_nombre'),
            formula:t('kpi18_formula'), formulaSub:t('kpi18_formula_sub'),
            objetivo:90, conPrioridad:false, infoText:t('kpi18_info'),
            stat1:{icon:'fa-shield-heart',  iconColor:'#5e72e4', numColor:'#1a2a4a', num:stats.total,      label:t('kpi18_total')},
            stat2:{icon:'fa-circle-check',  iconColor:'#2ecc71', numColor:'#27ae60', num:stats.enPlazo,    label:t('kpi18_en_plazo'),    bg:'#f0fff4', border:'#b7ebce'},
            stat3:{icon:'fa-clock',         iconColor:'#e74c3c', numColor:'#e74c3c', num:stats.fueraPlazo, label:t('kpi18_fuera_plazo'), bg:'#fff5f5', border:'#fbd0d0'},
            stat4:{icon:'fa-ban',           iconColor:'#8898aa', numColor:'#8898aa', num:stats.sinLlegada, label:t('kpi18_sin_llegada')},
            btnExtra:_btnVerAvisos('verRegistrosKPI18'),
            seccionExtra:seccion,
        }));
    }

    // ════════════════════════════════════════════════════════════
    // VER REGISTROS KPI-18
    // ════════════════════════════════════════════════════════════
    function verRegistrosKPI18() {
        const stats = calcularKPI18();
        const df    = getDashboardFilters();
        const periodoLabel = df.years.length ? df.years.join(', ') : '';
        _verRegistros({
            titulo  : `KPI-18${periodoLabel ? ' · '+periodoLabel : ''}`,
            resumen : `${stats.enPlazo}/${stats.total} ${t('kpi18_en_plazo').toLowerCase()}`,
            filas   : stats.filas,
            rowBg   : (r) => (r._tiempoAtencion !== null && r._tiempoAtencion <= 480) ? 'white' : '#fff5f5',
            columnas: [
                { key:'num',       label:t('aviso_num'),          align:'left',   render:(r,i)=>`<strong>${r.num>0?r.num:i+1}</strong>` },
                { key:'tipologia', label:'Tipo servicio',          align:'left',   render:(r)=>`<span style="font-size:0.75rem;">${r.tipologia||'—'}</span>` },
                { key:'prioridad', label:t('aviso_prioridad'),     align:'center' },
                { key:'patrulla',  label:t('aviso_patrulla'),      align:'left' },
                { key:'fechaInicio',label:t('aviso_fecha'),        align:'center' },
                { key:'_tiempoAtencion', label:'Tiempo (min)',     align:'center',
                  render:(r) => {
                    if (r._tiempoAtencion === null) return `<span style="color:#8898aa;">—</span>`;
                    const min  = (r._tiempoAtencion / 60).toFixed(1);
                    const ok   = r._tiempoAtencion <= 480;
                    const c    = ok ? '#27ae60' : r._tiempoAtencion <= 720 ? '#f59e0b' : '#e74c3c';
                    return `<span style="font-weight:700;color:${c};">${min} min</span>`;
                  }},
                { key:'_ok18', label:t('kpi18_en_plazo'), align:'center',
                  render:(r) => {
                    const ok = r._tiempoAtencion !== null && r._tiempoAtencion <= 480;
                    return `<span style="padding:2px 8px;border-radius:20px;font-size:0.7rem;font-weight:700;background:${ok?'#d4edda':'#fde8e8'};color:${ok?'#155724':'#721c24'};">${ok?t('si'):t('no')}</span>`;
                  }},
            ],
        });
    }


    // ════════════════════════════════════════════════════════════
    // PARSEO — Archivo vulnerables (KPI-19 / KPI-20)
    // Columnas: REFNUM, REFANNO, TITULO, FECHAALTAINCIDENCIA,
    //           FECHATRAMITE, TRAMITE, OBSERVACIONES
    // KPI-19: TRAMITE contiene "KPI-19" → derivación ≤24h
    // KPI-20: TRAMITE contiene "KPI-20" → seguimiento ≤7 días
    // ════════════════════════════════════════════════════════════
    function parsearDatosVulnerables(data) {
        const parseF = (v) => {
            if (!v || String(v).trim() === '') return null;
            if (v instanceof Date) return v;
            const s = String(v).trim();
            const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
            if (!m) return null;
            return new Date(+m[3], +m[2]-1, +m[1], +(m[4]||0), +(m[5]||0));
        };

        _rawDataVulnerables = data.map((r, idx) => {
            const anyo     = +r['REFANNO'] || null;
            const fechaAlta= parseF(r['FECHAALTAINCIDENCIA']);
            const fechaTram= parseF(r['FECHATRAMITE']);
            const tramite  = String(r['TRAMITE'] || '').trim();
            const mes      = fechaAlta ? fechaAlta.getMonth() + 1 : null;

            // Tiempo en horas entre alta y trámite
            let horasDiff = null;
            if (fechaAlta && fechaTram) {
                horasDiff = (fechaTram.getTime() - fechaAlta.getTime()) / 3600000;
                if (horasDiff < 0) horasDiff = null; // descartamos negativos
            }

            const esKPI19 = /KPI-19/i.test(tramite);
            const esKPI20 = /KPI-20/i.test(tramite);
            const esKPI23 = /KPI-23/i.test(tramite);

            return {
                num           : +r['REFNUM'] || (idx + 1),
                anyo, mes,
                titulo        : String(r['TITULO'] || '').trim(),
                tramite,
                observaciones : String(r['OBSERVACIONES'] || '').trim(),
                fechaAlta     : r['FECHAALTAINCIDENCIA'] || '',
                fechaTramite  : r['FECHATRAMITE'] || '',
                horasDiff,
                _esKPI19      : esKPI19,
                _esKPI20      : esKPI20,
                _esKPI23      : esKPI23,
                _enPlazo19    : esKPI19 && horasDiff !== null && horasDiff <= 24,
                _enPlazo20    : esKPI20 && horasDiff !== null && horasDiff <= 168, // 7 días = 168h
                _diasHabilesVul: esKPI23 ? (() => {
                    // Días hábiles para KPI-23 (lun-vie)
                    if (!fechaAlta || !fechaTram) return null;
                    let count = 0, cur = new Date(fechaAlta); cur.setHours(0,0,0,0);
                    const end = new Date(fechaTram); end.setHours(0,0,0,0);
                    if (end < cur) return null;
                    while (cur < end) { const d = cur.getDay(); if(d!==0&&d!==6) count++; cur.setDate(cur.getDate()+1); }
                    return count;
                })() : null,
                _enPlazo23    : (() => {
                    if (!esKPI23) return false;
                    const dh = (() => {
                        if (!fechaAlta || !fechaTram) return null;
                        let count = 0, cur = new Date(fechaAlta); cur.setHours(0,0,0,0);
                        const end = new Date(fechaTram); end.setHours(0,0,0,0);
                        if (end < cur) return null;
                        while (cur < end) { const d = cur.getDay(); if(d!==0&&d!==6) count++; cur.setDate(cur.getDate()+1); }
                        return count;
                    })();
                    return dh !== null && dh <= 15;
                })(),
            };
        });

        _kpisDisponibles.add('kpi19');
        _kpisDisponibles.add('kpi20');
        if (_rawDataVulnerables.some(r => r._esKPI23)) _kpisDisponibles.add('kpi23');
        if (!_kpisDisponibles.has(_kpiActivo)) _kpiActivo = 'kpi19';
        _cargado = true;
        console.log(`[KPI] Vulnerables cargados: ${_rawDataVulnerables.length} registros`);
    }

    function getFilasVulnerables() {
        const df = getDashboardFilters();
        let filas = _rawDataVulnerables;
        if (df.years.length > 0)  filas = filas.filter(r => df.years.includes(r.anyo));
        if (df.months.length > 0) filas = filas.filter(r => df.months.includes(r.mes));
        return filas;
    }

    // ════════════════════════════════════════════════════════════
    // CÁLCULO KPI-19: Derivación a SS ≤ 24h
    // ════════════════════════════════════════════════════════════
    function calcularKPI19() {
        const filas      = getFilasVulnerables().filter(r => r._esKPI19);
        const total      = filas.length;
        const enPlazo    = filas.filter(r => r._enPlazo19);
        const fueraPlazo = filas.filter(r => !r._enPlazo19 && r.horasDiff !== null);
        const sinTramite = filas.filter(r => r.horasDiff === null);
        const porcentaje = total > 0 ? (enPlazo.length / total * 100) : 0;
        const objetivo   = 95;
        let estado;
        if (porcentaje >= objetivo)          estado = 'verde';
        else if (porcentaje >= objetivo - 5) estado = 'amarillo';
        else                                 estado = 'rojo';

        const rangos = [
            {label:'< 6h',   min:0,   max:6  },
            {label:'6–12h',  min:6,   max:12 },
            {label:'12–24h', min:12,  max:24 },
            {label:'24–48h', min:24,  max:48 },
            {label:'> 48h',  min:48,  max:Infinity},
        ];
        const distribucion = rangos.map(rng => ({
            label: rng.label, enPlazo: rng.max <= 24,
            count: filas.filter(r => r.horasDiff !== null && r.horasDiff >= rng.min && r.horasDiff < rng.max).length,
        }));

        return { total, nEnPlazo:enPlazo.length, nFueraPlazo:fueraPlazo.length,
                 nSinTramite:sinTramite.length, porcentaje, objetivo, estado, distribucion, filas };
    }

    // ════════════════════════════════════════════════════════════
    // CÁLCULO KPI-20: Seguimiento víctimas ≤ 7 días
    // ════════════════════════════════════════════════════════════
    function calcularKPI20() {
        const filas      = getFilasVulnerables().filter(r => r._esKPI20);
        const total      = filas.length;
        const enPlazo    = filas.filter(r => r._enPlazo20);
        const fueraPlazo = filas.filter(r => !r._enPlazo20 && r.horasDiff !== null);
        const sinTramite = filas.filter(r => r.horasDiff === null);
        const porcentaje = total > 0 ? (enPlazo.length / total * 100) : 0;
        const objetivo   = 90;
        let estado;
        if (porcentaje >= objetivo)          estado = 'verde';
        else if (porcentaje >= objetivo - 5) estado = 'amarillo';
        else                                 estado = 'rojo';

        const rangos = [
            {label:'≤ 1 día',   min:0,   max:24  },
            {label:'2–3 días',  min:24,  max:72  },
            {label:'4–7 días',  min:72,  max:168 },
            {label:'8–14 días', min:168, max:336 },
            {label:'> 14 días', min:336, max:Infinity},
        ];
        const distribucion = rangos.map(rng => ({
            label: rng.label, enPlazo: rng.max <= 168,
            count: filas.filter(r => r.horasDiff !== null && r.horasDiff >= rng.min && r.horasDiff < rng.max).length,
        }));

        return { total, nEnPlazo:enPlazo.length, nFueraPlazo:fueraPlazo.length,
                 nSinTramite:sinTramite.length, porcentaje, objetivo, estado, distribucion, filas };
    }

    // ════════════════════════════════════════════════════════════
    // RENDER KPI-19
    // ════════════════════════════════════════════════════════════
    function renderKPI19() {
        const stats  = calcularKPI19();
        const color  = { verde:'#2ecc71', amarillo:'#f1c40f', rojo:'#e74c3c' }[stats.estado];
        const labelE = t({ verde:'cumple', amarillo:'alerta', rojo:'no_cumple' }[stats.estado]);

        const distRows = _renderDistRows(stats.distribucion, stats.total);

        const seccion = _renderSeccionDist(t('kpi19_distribucion'), 'fa-chart-bar', distRows);

        _renderView(_renderKpiCard('kpi19', stats.porcentaje, color, labelE, {
            idLabel:'KPI-19', nombre:t('kpi19_nombre'),
            formula:t('kpi19_formula'), formulaSub:t('kpi19_formula_sub'),
            objetivo:95, conPrioridad:false, infoText:t('kpi19_info'),
            stat1:{icon:'fa-people-arrows',  iconColor:'#5e72e4', numColor:'#1a2a4a', num:stats.total,        label:t('kpi19_total')},
            stat2:{icon:'fa-circle-check',   iconColor:'#2ecc71', numColor:'#27ae60', num:stats.nEnPlazo,     label:t('kpi19_en_plazo'),    bg:'#f0fff4', border:'#b7ebce'},
            stat3:{icon:'fa-clock',          iconColor:'#e74c3c', numColor:'#e74c3c', num:stats.nFueraPlazo,  label:t('kpi19_fuera_plazo'), bg:'#fff5f5', border:'#fbd0d0'},
            stat4:{icon:'fa-ban',            iconColor:'#8898aa', numColor:'#8898aa', num:stats.nSinTramite,  label:t('kpi19_sin_tramite')},
            btnExtra:_btnVerAvisos('verRegistrosKPI19'),
            seccionExtra:seccion,
        }));
    }

    // ════════════════════════════════════════════════════════════
    // RENDER KPI-20
    // ════════════════════════════════════════════════════════════
    function renderKPI20() {
        const stats  = calcularKPI20();
        const color  = { verde:'#2ecc71', amarillo:'#f1c40f', rojo:'#e74c3c' }[stats.estado];
        const labelE = t({ verde:'cumple', amarillo:'alerta', rojo:'no_cumple' }[stats.estado]);

        const distRows = _renderDistRows(stats.distribucion, stats.total);

        const seccion = _renderSeccionDist(t('kpi20_distribucion'), 'fa-chart-bar', distRows);

        _renderView(_renderKpiCard('kpi20', stats.porcentaje, color, labelE, {
            idLabel:'KPI-20', nombre:t('kpi20_nombre'),
            formula:t('kpi20_formula'), formulaSub:t('kpi20_formula_sub'),
            objetivo:90, conPrioridad:false, infoText:t('kpi20_info'),
            stat1:{icon:'fa-user-shield',    iconColor:'#5e72e4', numColor:'#1a2a4a', num:stats.total,        label:t('kpi20_total')},
            stat2:{icon:'fa-circle-check',   iconColor:'#2ecc71', numColor:'#27ae60', num:stats.nEnPlazo,     label:t('kpi20_en_plazo'),    bg:'#f0fff4', border:'#b7ebce'},
            stat3:{icon:'fa-clock',          iconColor:'#e74c3c', numColor:'#e74c3c', num:stats.nFueraPlazo,  label:t('kpi20_fuera_plazo'), bg:'#fff5f5', border:'#fbd0d0'},
            stat4:{icon:'fa-ban',            iconColor:'#8898aa', numColor:'#8898aa', num:stats.nSinTramite,  label:t('kpi20_sin_tramite')},
            btnExtra:_btnVerAvisos('verRegistrosKPI20'),
            seccionExtra:seccion,
        }));
    }

    // ════════════════════════════════════════════════════════════
    // VER REGISTROS KPI-19 / KPI-20
    // ════════════════════════════════════════════════════════════
    function _verRegistrosVulnerables(kpiNum, filas, enPlazoKey, plazoLabel, periodoLabel) {
        _verRegistros({
            titulo  : `KPI-${kpiNum}${periodoLabel ? ' · '+periodoLabel : ''}`,
            resumen : `${filas.filter(r => r[enPlazoKey]).length}/${filas.length} ${plazoLabel.toLowerCase()}`,
            filas,
            rowBg   : (r) => r[enPlazoKey] ? 'white' : (r.horasDiff === null ? '#fffbe6' : '#fff5f5'),
            columnas: [
                { key:'num',         label:t('aviso_num'),             align:'left',
                  render:(r,i)=>`<strong style="white-space:nowrap;">${r.num>0?r.num:i+1}</strong>` },
                { key:'titulo',      label:t('kpi19_tipo_incidente'),  align:'left',
                  render:(r)=>`<span style="font-size:0.72rem;display:block;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.titulo||''}">${r.titulo||'—'}</span>` },
                { key:'fechaAlta',   label:t('kpi19_fecha_alta'),      align:'center',
                  render:(r)=>`<span style="white-space:nowrap;font-size:0.75rem;">${r.fechaAlta||'—'}</span>` },
                { key:'fechaTramite',label:t('kpi19_fecha_tramite'),   align:'center',
                  render:(r)=>`<span style="white-space:nowrap;font-size:0.75rem;">${r.fechaTramite||'—'}</span>` },
                { key:'horasDiff',   label:t('kpi19_tiempo'),          align:'center',
                  render:(r) => {
                    if (r.horasDiff === null) return `<span style="color:#8898aa;">—</span>`;
                    const val = r.horasDiff < 48 ? `${r.horasDiff.toFixed(1)}h` : `${(r.horasDiff/24).toFixed(1)}d`;
                    const ok  = r[enPlazoKey];
                    return `<span style="font-weight:700;color:${ok?'#27ae60':'#e74c3c'};white-space:nowrap;">${val}</span>`;
                  }},
                { key:'_ok',         label:plazoLabel,                 align:'center',
                  render:(r) => `<span style="padding:2px 8px;border-radius:20px;font-size:0.7rem;font-weight:700;white-space:nowrap;background:${r[enPlazoKey]?'#d4edda':'#fde8e8'};color:${r[enPlazoKey]?'#155724':'#721c24'};">${r[enPlazoKey]?t('si'):t('no')}</span>` },
            ],
        });
    }

    function verRegistrosKPI19() {
        const stats = calcularKPI19();
        const df    = getDashboardFilters();
        _verRegistrosVulnerables('19', stats.filas, '_enPlazo19', t('kpi19_en_plazo'), df.years.join(', '));
    }

    function verRegistrosKPI20() {
        const stats = calcularKPI20();
        const df    = getDashboardFilters();
        _verRegistrosVulnerables('20', stats.filas, '_enPlazo20', t('kpi20_en_plazo'), df.years.join(', '));
    }


    // ════════════════════════════════════════════════════════════
    // CÁLCULO KPI-23: Quejas/sugerencias respondidas ≤ 15 días hábiles
    // Objetivo: ≥ 95%
    // ════════════════════════════════════════════════════════════
    function calcularKPI23() {
        const filas      = getFilasVulnerables().filter(r => r._esKPI23);
        const total      = filas.length;
        const enPlazo    = filas.filter(r => r._enPlazo23);
        const fueraPlazo = filas.filter(r => !r._enPlazo23 && r._diasHabilesVul !== null);
        const sinTramite = filas.filter(r => r._diasHabilesVul === null);
        const porcentaje = total > 0 ? (enPlazo.length / total * 100) : 0;
        const objetivo   = 95;
        let estado;
        if (porcentaje >= objetivo)          estado = 'verde';
        else if (porcentaje >= objetivo - 5) estado = 'amarillo';
        else                                 estado = 'rojo';

        const rangos = [
            {label:'≤ 5 días',   min:0,  max:6  },
            {label:'6–10 días',  min:6,  max:11 },
            {label:'11–15 días', min:11, max:16 },
            {label:'16–30 días', min:16, max:31 },
            {label:'> 30 días',  min:31, max:Infinity},
        ];
        const distribucion = rangos.map(rng => ({
            label: rng.label, enPlazo: rng.max <= 16,
            count: filas.filter(r => r._diasHabilesVul !== null && r._diasHabilesVul >= rng.min && r._diasHabilesVul < rng.max).length,
        }));

        return { total, nEnPlazo:enPlazo.length, nFueraPlazo:fueraPlazo.length,
                 nSinTramite:sinTramite.length, porcentaje, objetivo, estado, distribucion, filas };
    }

    // ════════════════════════════════════════════════════════════
    // RENDER KPI-23
    // ════════════════════════════════════════════════════════════
    function renderKPI23() {
        const stats  = calcularKPI23();
        const color  = { verde:'#2ecc71', amarillo:'#f1c40f', rojo:'#e74c3c' }[stats.estado];
        const labelE = t({ verde:'cumple', amarillo:'alerta', rojo:'no_cumple' }[stats.estado]);

        const distRows = _renderDistRows(stats.distribucion, stats.total);

        const seccion = _renderSeccionDist(t('kpi23_distribucion'), 'fa-chart-bar', distRows);

        _renderView(_renderKpiCard('kpi23', stats.porcentaje, color, labelE, {
            idLabel:'KPI-23', nombre:t('kpi23_nombre'),
            formula:t('kpi23_formula'), formulaSub:t('kpi23_formula_sub'),
            objetivo:95, conPrioridad:false, infoText:t('kpi23_info'),
            stat1:{icon:'fa-comments',      iconColor:'#5e72e4', numColor:'#1a2a4a', num:stats.total,       label:t('kpi23_total')},
            stat2:{icon:'fa-circle-check',  iconColor:'#2ecc71', numColor:'#27ae60', num:stats.nEnPlazo,    label:t('kpi23_en_plazo'),    bg:'#f0fff4', border:'#b7ebce'},
            stat3:{icon:'fa-clock',         iconColor:'#e74c3c', numColor:'#e74c3c', num:stats.nFueraPlazo, label:t('kpi23_fuera_plazo'), bg:'#fff5f5', border:'#fbd0d0'},
            stat4:{icon:'fa-ban',           iconColor:'#8898aa', numColor:'#8898aa', num:stats.nSinTramite, label:t('kpi23_sin_tramite')},
            btnExtra:_btnVerAvisos('verRegistrosKPI23'),
            seccionExtra:seccion,
        }));
    }

    // ════════════════════════════════════════════════════════════
    // VER REGISTROS KPI-23
    // ════════════════════════════════════════════════════════════
    function verRegistrosKPI23() {
        const stats = calcularKPI23();
        const df    = getDashboardFilters();
        const periodoLabel = df.years.length ? df.years.join(', ') : '';
        _verRegistros({
            titulo  : `KPI-23${periodoLabel ? ' · '+periodoLabel : ''}`,
            resumen : `${stats.nEnPlazo}/${stats.total} ${t('kpi23_en_plazo').toLowerCase()}`,
            filas   : stats.filas,
            rowBg   : (r) => r._enPlazo23 ? 'white' : (r._diasHabilesVul === null ? '#fffbe6' : '#fff5f5'),
            columnas: [
                { key:'num',         label:t('aviso_num'),           align:'left',   render:(r,i)=>`<strong style="white-space:nowrap;">${r.num>0?r.num:i+1}</strong>` },
                { key:'titulo',      label:t('kpi19_tipo_incidente'),align:'left',   render:(r)=>`<span style="font-size:0.72rem;display:block;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.titulo||''}">${r.titulo||'—'}</span>` },
                { key:'fechaAlta',   label:t('kpi19_fecha_alta'),    align:'center', render:(r)=>`<span style="white-space:nowrap;font-size:0.75rem;">${r.fechaAlta||'—'}</span>` },
                { key:'fechaTramite',label:t('kpi19_fecha_tramite'), align:'center', render:(r)=>`<span style="white-space:nowrap;font-size:0.75rem;">${r.fechaTramite||'—'}</span>` },
                { key:'_diasHab',    label:'Días hábiles',           align:'center',
                  render:(r) => {
                    if (r._diasHabilesVul === null) return `<span style="color:#8898aa;">—</span>`;
                    const ok = r._enPlazo23;
                    return `<span style="font-weight:700;color:${ok?'#27ae60':'#e74c3c'};white-space:nowrap;">${r._diasHabilesVul} días</span>`;
                  }},
                { key:'_ok23', label:t('kpi23_en_plazo'), align:'center',
                  render:(r) => `<span style="padding:2px 8px;border-radius:20px;font-size:0.7rem;font-weight:700;white-space:nowrap;background:${r._enPlazo23?'#d4edda':'#fde8e8'};color:${r._enPlazo23?'#155724':'#721c24'};">${r._enPlazo23?t('si'):t('no')}</span>` },
            ],
        });
    }


    // ════════════════════════════════════════════════════════════
    // PARSEO — Archivo formación agentes (KPI-21)
    // Columnas: NUMEROPROFESIONAL, TIPOBYPERTENENCIAID, TIPOBYESTADOID,
    //           FECHA, DESCRIPCIONCURSO, NUMEROHORAS
    // Métrica: Σ NUMEROHORAS / Nº agentes únicos
    // Objetivo: ≥ 20 h/agente/año
    // ════════════════════════════════════════════════════════════
    function parsearDatosFormacion(data) {
        // Guardar registros crudos con año extraído de FECHA
        // La agrupación por agente se hace en calcularKPI21 para que el filtro de año funcione
        _rawDataFormacion = data.map((r) => {
            const s = String(r['FECHA'] || '');
            const mf = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            const anyo = mf ? +mf[3] : (() => {
                const m2 = s.match(/(20\d{2})/); return m2 ? +m2[1] : null;
            })();
            const h = parseFloat(r['NUMEROHORAS']);
            return {
                anyo,
                mes         : mf ? +mf[2] : null,
                agente      : String(r['NUMEROPROFESIONAL'] || '').trim(),
                pertenencia : String(r['TIPOBYPERTENENCIAID'] || '').trim(),
                estado      : String(r['TIPOBYESTADOID'] || '').trim(),
                horas       : (!isNaN(h) && h > 0) ? h : 0,
                curso       : String(r['DESCRIPCIONCURSO'] || '').trim(),
                _tieneHoras : (!isNaN(h) && h > 0),
            };
        }).filter(r => r.agente !== '');

        _kpisDisponibles.add('kpi21');
        if (!_kpisDisponibles.has(_kpiActivo)) _kpiActivo = 'kpi21';
        _cargado = true;
        console.log(`[KPI] Formación cargada: ${_rawDataFormacion.length} registros`);
    }

    // Helper: agrupa registros crudos por agente respetando filtros de año
    function _agruparFormacionPorAgente(registros) {
        const mapa = {};
        registros.forEach(r => {
            if (!r.agente) return;
            if (!mapa[r.agente]) {
                mapa[r.agente] = {
                    agente: r.agente, pertenencia: r.pertenencia, estado: r.estado,
                    horas: 0, cursos: 0, cursosDetalle: [],
                };
            }
            mapa[r.agente].horas += r.horas;
            if (r.curso) { mapa[r.agente].cursos++; mapa[r.agente].cursosDetalle.push(r.curso); }
        });
        return Object.values(mapa).map(a => ({
            ...a,
            num: 0, anyo: null, mes: null,
            _cumple  : a.horas >= 20,
            _sinHoras: a.horas === 0,
        }));
    }

    // ════════════════════════════════════════════════════════════
    // CÁLCULO KPI-21
    // Métrica principal: media h/agente (vs objetivo 20h)
    // El gauge muestra la media como porcentaje del objetivo
    // ════════════════════════════════════════════════════════════
    function calcularKPI21() {
        const df = getDashboardFilters();
        // Filtrar registros crudos por año/mes antes de agrupar
        let registros = _rawDataFormacion;
        if (df.years.length > 0)  registros = registros.filter(r => df.years.includes(r.anyo));
        if (df.months.length > 0) registros = registros.filter(r => df.months.includes(r.mes));
        // Agrupar por agente con los registros ya filtrados
        let filas = _agruparFormacionPorAgente(registros);

        const nAgentes    = filas.length;
        const totalHoras  = filas.reduce((s, r) => s + r.horas, 0);
        const media       = nAgentes > 0 ? totalHoras / nAgentes : 0;
        const conHoras    = filas.filter(r => r._cumple);
        const sinHoras    = filas.filter(r => r._sinHoras);
        const bajas       = filas.filter(r => !r._cumple && !r._sinHoras);
        const objetivo    = 20; // h/agente/año

        // El gauge muestra media/objetivo como % (capped a 100 para la barra)
        const porcentaje  = objetivo > 0 ? Math.min(media / objetivo * 100, 100) : 0;
        const cumpleMedia = media >= objetivo;
        let estado;
        if (media >= objetivo)           estado = 'verde';
        else if (media >= objetivo * 0.8) estado = 'amarillo';
        else                              estado = 'rojo';

        const rangos = [
            {label:'0h (sin horas)', min:0,   max:0.01},
            {label:'1–10h',          min:0.01,max:10  },
            {label:'10–20h',         min:10,  max:20  },
            {label:'20–40h',         min:20,  max:40  },
            {label:'> 40h',          min:40,  max:Infinity},
        ];
        const distribucion = rangos.map(rng => ({
            label  : rng.label,
            cumple : rng.min >= 20,
            count  : filas.filter(r => r.horas >= rng.min && r.horas < rng.max).length,
        }));

        return {
            nAgentes, totalHoras, media, objetivo,
            nConHoras:conHoras.length, nSinHoras:sinHoras.length, nBajas:bajas.length,
            porcentaje, estado, cumpleMedia,
            distribucion, filas,
        };
    }

    // ════════════════════════════════════════════════════════════
    // RENDER KPI-21 — gauge muestra media vs objetivo 20h
    // ════════════════════════════════════════════════════════════
    function renderKPI21() {
        const stats  = calcularKPI21();
        const color  = { verde:'#2ecc71', amarillo:'#f1c40f', rojo:'#e74c3c' }[stats.estado];
        const labelE = t({ verde:'cumple', amarillo:'alerta', rojo:'no_cumple' }[stats.estado]);

        // Distribución por rangos de horas
        const distRows = stats.distribucion.map(d => {
            const pct2 = stats.nAgentes > 0 ? (d.count/stats.nAgentes*100).toFixed(1) : '0.0';
            const w = Math.min(100, parseFloat(pct2));
            const bc = d.cumple ? '#2ecc71' : (d.label.startsWith('0h') ? '#95a5a6' : '#e74c3c');
            return `<div class="kpinv-dist-row">
                <span class="kpinv-dist-label">${d.label}</span>
                <div class="kpinv-dist-track"><div style="height:100%;width:${w}%;background:${bc};border-radius:6px;transition:width .5s;"></div></div>
                <span class="kpinv-dist-val">${d.count} <small>(${pct2}%)</small></span>
            </div>`;
        }).join('');

        const seccion = _renderSeccionDist(t('kpi21_distribucion'), 'fa-graduation-cap', distRows);

        // Para KPI-21 el gauge muestra la media real (no un %) y el objetivo es 20h
        // Usamos _gaugeCircular con el % calculado (media/20*100)
        _renderView(_renderKpiCard('kpi21', stats.porcentaje, color, labelE, {
            idLabel:'KPI-21', nombre:t('kpi21_nombre'),
            formula:t('kpi21_formula'), formulaSub:t('kpi21_formula_sub'),
            objetivo:100, // 100% = 20h/agente (el gauge ya usa porcentaje calculado)
            objSymbol:'≥', objLabel:`≥ 20 ${t('kpi21_media')||'h/agente'}`,
            conPrioridad:false, infoText:t('kpi21_info'),
            // Sobreescribir el label del gauge para mostrar las horas reales
            gaugeLabel:`${stats.media.toFixed(1)} h`,
            stat1:{icon:'fa-users',         iconColor:'#5e72e4', numColor:'#1a2a4a', num:stats.nAgentes,   label:t('kpi21_agentes')},
            stat2:{icon:'fa-circle-check',  iconColor:'#2ecc71', numColor:'#27ae60', num:stats.nConHoras,  label:t('kpi21_con_horas'),  bg:'#f0fff4', border:'#b7ebce'},
            stat3:{icon:'fa-triangle-exclamation', iconColor:'#e74c3c', numColor:'#e74c3c', num:stats.nBajas+stats.nSinHoras, label:t('kpi21_sin_horas'), bg:'#fff5f5', border:'#fbd0d0'},
            stat4:{icon:'fa-clock',         iconColor:'#8898aa', numColor:'#1a2a4a', num:Math.round(stats.totalHoras), label:t('kpi21_total_horas')},
            btnExtra:_btnVerAvisos('verRegistrosKPI21'),
            seccionExtra:seccion,
        }));
    }

    // ════════════════════════════════════════════════════════════
    // VER REGISTROS KPI-21
    // ════════════════════════════════════════════════════════════
    function verRegistrosKPI21() {
        const stats = calcularKPI21();
        // Ordenar: primero los que no cumplen, luego los que cumplen
        const filasOrdenadas = [...stats.filas].sort((a, b) => a.horas - b.horas);
        _verRegistros({
            titulo  : `KPI-21 · ${stats.nAgentes} ${t('kpi21_agentes')} · ${t('kpi21_media')}: ${stats.media.toFixed(1)}h`,
            resumen : `${stats.nConHoras}/${stats.nAgentes} ${t('kpi21_con_horas').toLowerCase()}`,
            filas   : filasOrdenadas,
            rowBg   : (r) => r._sinHoras ? '#fff5f5' : (r._cumple ? 'white' : '#fffbe6'),
            columnas: [
                { key:'agente',  label:t('kpi21_agente'),      align:'left',
                  render:(r)=>`<span style="font-weight:700;font-size:0.82rem;">${r.agente}</span>` },
                { key:'cursos',  label:t('kpi21_cursos'),      align:'center',
                  render:(r)=>`<span style="color:#5e72e4;font-weight:700;">${r.cursos}</span>` },
                { key:'horas',   label:t('kpi21_horas_agente'),align:'center',
                  render:(r) => {
                    if (r._sinHoras) return `<span style="padding:2px 10px;border-radius:20px;font-size:0.72rem;font-weight:700;background:#fde8e8;color:#721c24;">0h — sin datos</span>`;
                    const c = r._cumple ? '#27ae60' : '#f59e0b';
                    return `<span style="font-weight:700;color:${c};font-size:0.9rem;">${r.horas}h</span>`;
                  }},
                { key:'_ok21',   label:'≥ 20h',                align:'center',
                  render:(r) => {
                    if (r._sinHoras) return `<span style="padding:2px 8px;border-radius:20px;font-size:0.7rem;font-weight:700;background:#fde8e8;color:#721c24;">❌ Sin horas</span>`;
                    return `<span style="padding:2px 8px;border-radius:20px;font-size:0.7rem;font-weight:700;background:${r._cumple?'#d4edda':'#fef9ec'};color:${r._cumple?'#155724':'#92400e'};">${r._cumple?'✅ '+t('si'):'⚠️ '+r.horas+'h'}</span>`;
                  }},
            ],
        });
    }


    // ════════════════════════════════════════════════════════════
    // RENDER VISOR
    // ════════════════════════════════════════════════════════════
    // ════════════════════════════════════════════════════════════
    // CÁLCULO KPI-04: Emergencias prioritarias (A) llegada ≤ 10 min
    // Fórmula: (Nº servicios A con llegada ≤10min / Nº servicios A) × 100
    // Prioridad A = campo PRIORIDAD contiene 'A' o valor numérico 1 / texto 'Alta'
    // Tiempo: FECHAASIGNACION (o FECHAINICIO) → FECHALLEGADA en minutos
    // ════════════════════════════════════════════════════════════
    function calcularKPI04() {
        const df = getDashboardFilters();
        let filas = _rawData;
        if (df.years.length > 0)  filas = filas.filter(r => df.years.includes(r.anyo));
        if (df.months.length > 0) filas = filas.filter(r => df.months.includes(r.mes));
        if (df.cats.length > 0)   filas = filas.filter(r => df.cats.includes(r.tipologia));
        if (_filtroPatrulla) filas = filas.filter(r => r.patrulla === _filtroPatrulla);

        // Servicios A: prioridad contiene 'A', '1', 'Alta', 'ALTA', 'a'
        const esA = (p) => /^(A|1|Alta|ALTA|a)$/i.test(String(p).trim());
        const serviciosA = filas.filter(r => esA(r.prioridad));

        const total = serviciosA.length;
        const conTiempoLlegada = serviciosA.filter(r => r._tiempoLlegada !== null);
        const enPlazo    = conTiempoLlegada.filter(r => r._tiempoLlegada <= 10);
        const fueraPlazo = conTiempoLlegada.filter(r => r._tiempoLlegada > 10);
        const sinLlegada = serviciosA.filter(r => r._tiempoLlegada === null);

        const porcentaje = total > 0 ? (enPlazo.length / total * 100) : 0;
        const objetivo   = 90;
        let estado;
        if (porcentaje >= objetivo)          estado = 'verde';
        else if (porcentaje >= objetivo - 5) estado = 'amarillo';
        else                                 estado = 'rojo';

        // Distribución de tiempos (en minutos)
        const rangos = [
            { label: '≤ 5min',   min:0,  max:5   },
            { label: '5–10min',  min:5,  max:10  },
            { label: '10–15min', min:10, max:15  },
            { label: '15–20min', min:15, max:20  },
            { label: '> 20min',  min:20, max:Infinity },
        ];
        const distribucion = rangos.map(rng => ({
            label    : rng.label,
            enPlazo  : rng.max <= 10,
            count    : conTiempoLlegada.filter(r => r._tiempoLlegada >= rng.min && r._tiempoLlegada < rng.max).length
        }));

        return {
            total, enPlazo: enPlazo.length, fueraPlazo: fueraPlazo.length,
            sinLlegada: sinLlegada.length,
            conTiempo: conTiempoLlegada.length,
            porcentaje, objetivo, estado,
            distribucion,
            filas: serviciosA,
        };
    }

    // ════════════════════════════════════════════════════════════
    // CÁLCULO KPI-05: Urgencias (B) llegada ≤ 20 min
    // Prioridad B = campo PRIORIDAD contiene 'B' o valor numérico 2 / texto 'Media'
    // ════════════════════════════════════════════════════════════
    function calcularKPI05() {
        const df = getDashboardFilters();
        let filas = _rawData;
        if (df.years.length > 0)  filas = filas.filter(r => df.years.includes(r.anyo));
        if (df.months.length > 0) filas = filas.filter(r => df.months.includes(r.mes));
        if (df.cats.length > 0)   filas = filas.filter(r => df.cats.includes(r.tipologia));
        if (_filtroPatrulla) filas = filas.filter(r => r.patrulla === _filtroPatrulla);

        const esB = (p) => /^(B|2|Media|MEDIA|b|Urgente|URGENTE)$/i.test(String(p).trim());
        const serviciosB = filas.filter(r => esB(r.prioridad));

        const total = serviciosB.length;
        const conTiempoLlegada = serviciosB.filter(r => r._tiempoLlegada !== null);
        const enPlazo    = conTiempoLlegada.filter(r => r._tiempoLlegada <= 20);
        const fueraPlazo = conTiempoLlegada.filter(r => r._tiempoLlegada > 20);
        const sinLlegada = serviciosB.filter(r => r._tiempoLlegada === null);

        const porcentaje = total > 0 ? (enPlazo.length / total * 100) : 0;
        const objetivo   = 85;
        let estado;
        if (porcentaje >= objetivo)          estado = 'verde';
        else if (porcentaje >= objetivo - 5) estado = 'amarillo';
        else                                 estado = 'rojo';

        const rangos = [
            { label: '≤ 10min',  min:0,  max:10  },
            { label: '10–15min', min:10, max:15  },
            { label: '15–20min', min:15, max:20  },
            { label: '20–30min', min:20, max:30  },
            { label: '> 30min',  min:30, max:Infinity },
        ];
        const distribucion = rangos.map(rng => ({
            label   : rng.label,
            enPlazo : rng.max <= 20,
            count   : conTiempoLlegada.filter(r => r._tiempoLlegada >= rng.min && r._tiempoLlegada < rng.max).length
        }));

        return {
            total, enPlazo: enPlazo.length, fueraPlazo: fueraPlazo.length,
            sinLlegada: sinLlegada.length,
            conTiempo: conTiempoLlegada.length,
            porcentaje, objetivo, estado,
            distribucion,
            filas: serviciosB,
        };
    }

    // ════════════════════════════════════════════════════════════
    // HELPER RENDER COMPARTIDO KPI-04 / KPI-05
    // ════════════════════════════════════════════════════════════
    function renderKPI04() {
        const stats = calcularKPI04();
        _renderKPI_Respuesta('kpi04', stats, {
            nombre      : t('kpi04_nombre'),
            formula     : t('kpi04_formula'),
            formulaSub  : t('kpi04_formula_sub'),
            total       : t('kpi04_total'),
            enPlazo     : t('kpi04_en_plazo'),
            fueraPlazo  : t('kpi04_fuera_plazo'),
            distribucion: t('kpi04_distribucion'),
        });
    }

    function renderKPI05() {
        const stats = calcularKPI05();
        _renderKPI_Respuesta('kpi05', stats, {
            nombre      : t('kpi05_nombre'),
            formula     : t('kpi05_formula'),
            formulaSub  : t('kpi05_formula_sub'),
            total       : t('kpi05_total'),
            enPlazo     : t('kpi05_en_plazo'),
            fueraPlazo  : t('kpi05_fuera_plazo'),
            distribucion: t('kpi05_distribucion'),
        });
    }


    // ════════════════════════════════════════════════════════════
    // RENDER KPI-02 (extraído de renderVisor para consistencia)
    // ════════════════════════════════════════════════════════════
    function renderKPI02() {
    // ── KPI-02: Avisos completos ──────────────────────────────
    const stats  = calcular();
    const color  = { verde:'#2ecc71', amarillo:'#f1c40f', rojo:'#e74c3c' }[stats.estado];
    const labelE = t({ verde:'cumple', amarillo:'alerta', rojo:'no_cumple' }[stats.estado]);

    // Tabla campos verificados
    const campos = [
        { label:t('campo_prioridad'), n:stats.campoStats.prioridad, icon:'fa-shield-halved' },
        { label:t('campo_patrulla'),  n:stats.campoStats.patrulla,  icon:'fa-car-side'      },
    ];
    if (_tieneLat)    campos.push({ label:t('campo_lat'),    n:stats.campoStats.latitud,  icon:'fa-location-dot' });
    if (_tieneLon)    campos.push({ label:t('campo_lon'),    n:stats.campoStats.longitud, icon:'fa-crosshairs'   });
    if (_tieneTitulo) campos.push({ label:t('campo_titulo'), n:stats.campoStats.titulo,   icon:'fa-file-lines'   });

    const campoRows = campos.map(c => {
        const pv = stats.totalFiltrados > 0 ? (c.n/stats.totalFiltrados*100).toFixed(1) : '0.0';
        const wv = Math.min(100, parseFloat(pv));
        const bc = wv >= 98 ? '#2ecc71' : wv >= 90 ? '#f59e0b' : '#e74c3c';
        return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <i class="fa-solid ${c.icon}" style="color:#1a2a4a;width:14px;flex-shrink:0;font-size:0.85rem;"></i>
        <span class="kpi-campo-label">${c.label}</span>
        <div class="kpi-campo-bar-wrap"><div class="kpi-campo-bar" style="width:${wv}%;background:${bc};"></div></div>
        <span class="kpi-campo-val" style="color:${bc};">${c.n} <small>(${pv}%)</small></span>
        </div>`;
    }).join('');

    // Tabla prioridad con semáforos
    const prioRows = Object.entries(stats.porPrioridad).map(([p, d], i) => {
        const v = d.total > 0 ? d.completos/d.total*100 : 0;
        return `<tr style="background:${i%2===0?'white':'#fafbff'};border-bottom:1px solid #f0f2f8;">
        <td style="padding:8px 12px;font-size:0.82rem;color:#32325d;">${p||'—'}</td>
        <td style="padding:8px 12px;text-align:center;">${_semaforoSvg(v,{verde:98,amarillo:95})}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:700;color:#1a2a4a;">${d.total}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:700;color:#27ae60;">${d.completos}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:700;color:#e74c3c;">${d.total-d.completos}</td>
        <td style="padding:8px 12px;text-align:center;">${_badgePct(v,98,95)}</td>
        </tr>`;
    }).join('');

    const tabla = `<table style="width:100%;border-collapse:collapse;min-width:420px;">
        <thead><tr style="background:#f0f2f8;">
        <th style="padding:9px 12px;text-align:left;font-size:0.75rem;color:#1a2a4a;font-weight:700;">${t('filtro_prioridad')}</th>
        <th style="padding:9px 12px;text-align:center;font-size:0.75rem;color:#1a2a4a;font-weight:700;">${t('estado')}</th>
        <th style="padding:9px 12px;text-align:right;font-size:0.75rem;color:#1a2a4a;font-weight:700;">${t('total_avisos')}</th>
        <th style="padding:9px 12px;text-align:right;font-size:0.75rem;color:#27ae60;font-weight:700;">${t('avisos_completos')}</th>
        <th style="padding:9px 12px;text-align:right;font-size:0.75rem;color:#e74c3c;font-weight:700;">${t('avisos_incompletos')}</th>
        <th style="padding:9px 12px;text-align:center;font-size:0.75rem;color:#1a2a4a;font-weight:700;">KPI-02 %</th>
        </tr></thead>
        <tbody>${prioRows||`<tr><td colspan="6" style="text-align:center;color:#8898aa;padding:14px;">${t('sin_datos')}</td></tr>`}</tbody>
    </table>`;

    const seccion = `<div class="kpi-section">
        <div class="kpinv-section-header" style="background:#1a2a4a;">
        <i class="fa-solid fa-shield-check" style="margin-right:7px;opacity:.8;"></i>
        ${t('detalle_campos')}
        </div>
        <div class="kpi-campos-list">${campoRows}</div>
    </div>`;

    const btnVer = `<div style="display:flex;align-items:center;justify-content:center;padding:4px;">
        <button onclick="FncKPI.verAvisos()"
        style="padding:10px 16px;background:#1a2a4a;color:white;border:none;
        border-radius:10px;font-size:0.8rem;font-weight:700;cursor:pointer;
        display:flex;align-items:center;gap:6px;white-space:nowrap;"
        onmouseover="this.style.background='#253d6b'"
        onmouseout="this.style.background='#1a2a4a'">
        <i class="fa-solid fa-list-check"></i> ${t('ver_avisos')}
        </button>
    </div>`;

    _renderView(_renderKpiCard('kpi02', stats.porcentaje, color, labelE, {
        idLabel:'KPI-02', nombre:t('avisos_completos'), formula:t('formula_02'),
        formulaSub:`${t('detalle_campos')}: ${campos.map(c=>c.label).join(' + ')}`,
        objetivo:98,
        stat1:{icon:'fa-globe',          iconColor:'#5e72e4',numColor:'#1a2a4a',num:stats.totalFiltrados,label:t('total_avisos')},
        stat2:{icon:'fa-circle-check',    iconColor:'#2ecc71',numColor:'#27ae60',num:stats.nCompletos,    label:t('avisos_completos'),  bg:'#f0fff4',border:'#b7ebce'},
        stat3:{icon:'fa-triangle-exclamation',iconColor:'#e74c3c',numColor:'#e74c3c',num:stats.nIncompletos,  label:t('avisos_incompletos'),bg:'#fff5f5',border:'#fbd0d0'},
        btnExtra: btnVer,
        infoText: t('kpi02_info'),
        seccionExtra: seccion, tablaHtml: tabla,
    }));
    }

    function renderVisor() {
        // Dispatch automático: añadir nuevos KPIs solo aquí
        const RENDER_MAP = {
            kpi01:renderKPI01, kpi02:renderKPI02, kpi03:renderKPI03,
            kpi04:renderKPI04, kpi05:renderKPI05, kpi06:renderKPI06,
            kpi07:renderKPI07, kpi08:renderKPI08, kpi09:renderKPI09,
            kpi10:renderKPI10, kpi11:renderKPI11, kpi13:renderKPI13,
            kpi14:renderKPI14, kpi15:renderKPI15, kpi18:renderKPI18,
            kpi19:renderKPI19, kpi20:renderKPI20, kpi21:renderKPI21,
            kpi23:renderKPI23,
        };
        if (RENDER_MAP[_kpiActivo]) { RENDER_MAP[_kpiActivo](); return; }


    }

    function verRegistrosKPI11() {
        const stats = calcularKPI11();
        const df    = getDashboardFilters();
        const periodoLabel = df.years.length ? df.years.join(', ') : '';
        _verRegistros({
            titulo  : `KPI-11${periodoLabel ? ' · '+periodoLabel : ''}`,
            resumen : `${stats.nEjecutados}/${stats.total} ${t('kpi11_ejecutados').toLowerCase()}`,
            filas   : stats.filas,
            rowBg   : (r) => r._ejecutado ? 'white' : '#fff5f5',
            columnas: [
                { key:'num',          label:t('aviso_num'),          align:'left',   render:(r,i)=>`<strong>${r.num>0?r.num:i+1}</strong>` },
                { key:'titulo',       label:'Tipo control',           align:'left' },
                { key:'calle',        label:'Ubicación',              align:'left' },
                { key:'fechaInicio',  label:'Fecha/hora inicio',      align:'center' },
                { key:'estado',       label:'Estado',                 align:'center' },
                { key:'numVehiculos', label:'Vehículos controlados',  align:'center',
                  render:(r) => r.numVehiculos !== null
                    ? `<span style="font-weight:700;color:#27ae60;">${r.numVehiculos}</span>`
                    : `<span style="color:#8898aa;">—</span>` },
                { key:'_ej',          label:t('kpi11_ejecutados'),    align:'center',
                  render:(r) => `<span style="padding:2px 8px;border-radius:20px;font-size:0.7rem;font-weight:700;background:${r._ejecutado?'#d4edda':'#fde8e8'};color:${r._ejecutado?'#155724':'#721c24'};">${r._ejecutado?t('si'):t('no')}</span>` },
            ],
        });
    }

    // ── KPI-09: Cierre atestados ─────────────────────────────
    function verRegistrosKPI09() {
        const stats = calcularKPI09();
        const df    = getDashboardFilters();
        const periodoLabel = df.years.length ? df.years.join(', ') : '';
        _verRegistros({
            titulo  : `KPI-09${periodoLabel ? ' · '+periodoLabel : ''}`,
            resumen : `${stats.nEnPlazo}/${stats.total} ${t('kpi09_en_plazo').toLowerCase()}`,
            filas   : stats.filas,
            rowBg   : (r) => (r._tieneRemision && r._diasHabiles !== null && r._diasHabiles <= 10) ? 'white' : '#fff5f5',
            columnas: [
                { key:'num',          label:t('aviso_num'),   align:'left',   render:(r,i)=>`<strong>${r.num>0?r.num:i+1}</strong>` },
                { key:'fechaApertura',label:'Apertura',       align:'center' },
                { key:'fechaRemision',label:'Remisión',       align:'center' },
                { key:'_diasHabiles', label:'Días hábiles',   align:'center',
                  render:(r) => r._diasHabiles === null ? `<span style="color:#8898aa;">—</span>`
                    : `<span style="font-weight:700;color:${r._diasHabiles<=10?'#27ae60':'#e74c3c'};">${r._diasHabiles} días</span>` },
                { key:'_ok09',        label:t('kpi09_en_plazo'), align:'center',
                  render:(r) => {
                    const ok = r._tieneRemision && r._diasHabiles !== null && r._diasHabiles <= 10;
                    return `<span style="padding:2px 8px;border-radius:20px;font-size:0.7rem;font-weight:700;background:${ok?'#d4edda':'#fde8e8'};color:${ok?'#155724':'#721c24'};">${ok?t('si'):t('no')}</span>`;
                  }},
            ],
        });
    }

    // ── KPI-10: Calidad documental ────────────────────────────
    function verRegistrosKPI10() {
        const stats = calcularKPI10();
        const df    = getDashboardFilters();
        const periodoLabel = df.years.length ? df.years.join(', ') : '';
        _verRegistros({
            titulo  : `KPI-10${periodoLabel ? ' · '+periodoLabel : ''}`,
            resumen : `${stats.nSinSubsanacion}/${stats.total} ${t('kpi10_sin_subsanacion').toLowerCase()}`,
            filas   : stats.filas.filter(r => r._finalizado),
            rowBg   : (r) => !r._subsanacion ? 'white' : '#fff5f5',
            columnas: [
                { key:'num',          label:t('aviso_num'),   align:'left',   render:(r,i)=>`<strong>${r.num>0?r.num:i+1}</strong>` },
                { key:'fechaApertura',label:'Apertura',       align:'center' },
                { key:'fechaRemision',label:'Remisión',       align:'center' },
                { key:'_subsanacion_val', label:t('kpi10_con_subsanacion'), align:'center',
                  render:(r) => r._subsanacion
                    ? `<span style="padding:2px 8px;border-radius:20px;font-size:0.7rem;font-weight:700;background:#fde8e8;color:#721c24;">Sí</span>`
                    : `<span style="padding:2px 8px;border-radius:20px;font-size:0.7rem;font-weight:700;background:#d4edda;color:#155724;">No</span>` },
            ],
        });
    }

    // ── KPI-08: Accidentes con lesiones ──────────────────────
    function verRegistrosKPI08() {
        const stats = calcularKPI08();
        const df    = getDashboardFilters();
        const periodoLabel = df.years.length ? df.years.join(', ') : '';
        _verRegistros({
            titulo  : `KPI-08${periodoLabel ? ' · '+periodoLabel : ''}`,
            resumen : `${stats.enPlazo}/${stats.total} ${t('kpi08_en_plazo').toLowerCase()}`,
            filas   : stats.filas,
            rowBg   : (r) => (r._tiempoAtencion !== null && r._tiempoAtencion <= 900) ? 'white' : '#fff5f5',
            columnas: [
                { key:'num',       label:t('aviso_num'),         align:'left',   render:(r,i)=>`<strong>${r.num>0?r.num:i+1}</strong>` },
                { key:'via',       label:t('aviso_via'),         align:'left' },
                { key:'prioridad', label:t('aviso_prioridad'),   align:'center' },
                { key:'patrulla',  label:t('aviso_patrulla'),    align:'left' },
                { key:'fechaInicio', label:t('aviso_fecha'),     align:'center' },
                { key:'_tiempoAtencion', label:'Tiempo (min)',   align:'center',
                  render:(r) => {
                    if (r._tiempoAtencion === null) return `<span style="color:#8898aa;">—</span>`;
                    const min = (r._tiempoAtencion / 60).toFixed(1);
                    const ok  = r._tiempoAtencion <= 900;
                    return `<span style="font-weight:700;color:${ok?'#27ae60':'#e74c3c'};">${min} min</span>`;
                  }},
                { key:'_ok08',     label:t('kpi08_en_plazo'),    align:'center',
                  render:(r) => {
                    const ok = r._tiempoAtencion !== null && r._tiempoAtencion <= 900;
                    return `<span style="padding:2px 8px;border-radius:20px;font-size:0.7rem;font-weight:700;
                        background:${ok?'#d4edda':'#fde8e8'};color:${ok?'#155724':'#721c24'};">
                        ${ok?t('si'):t('no')}</span>`;
                  }},
            ],
        });
    }

    // ── KPI-06: Recontacto ──────────────────────────────────
    function verRegistrosKPI06() {
        const stats = calcularKPI06();
        const df    = getDashboardFilters();
        const periodoLabel = df.years.length ? df.years.join(', ') : '';
        _verRegistros({
            titulo  : `KPI-06${periodoLabel ? ' · '+periodoLabel : ''}`,
            resumen : `${stats.nRecontacto}/${stats.total} ${t('kpi06_recontacto').toLowerCase()}`,
            filas   : stats.filas,
            rowBg   : (r) => {
                const tFin = r.fechaFin ? new Date(r.fechaFin.split(' ')[0].split('/').reverse().join('-')).getTime() : NaN;
                return 'white';
            },
            columnas: [
                { key:'num',       label:t('aviso_num'),       align:'left',   render:(r,i)=>`<strong>${r.num>0?r.num:i+1}</strong>` },
                { key:'via',       label:t('aviso_via'),       align:'left' },
                { key:'prioridad', label:t('aviso_prioridad'), align:'center' },
                { key:'patrulla',  label:t('aviso_patrulla'),  align:'left' },
                { key:'fechaInicio', label:t('aviso_fecha'),   align:'center' },
                { key:'fechaFin',  label:t('kpi03_distribucion')||'Cierre', align:'center' },
            ],
        });
    }

    // ── KPI-07: Satisfacción ─────────────────────────────────
    function verRegistrosKPI07() {
        const stats = calcularKPI07();
        const df    = getDashboardFilters();
        const periodoLabel = df.years.length ? df.years.join(', ') : '';
        const conSat = stats.filas.filter(r => r._satisfaccion !== null && r._satisfaccion !== undefined);
        _verRegistros({
            titulo  : `KPI-07${periodoLabel ? ' · '+periodoLabel : ''}`,
            resumen : `${stats.total} ${t('kpi07_total').toLowerCase()} · ${t('kpi07_media')}: ${stats.total>0?stats.media.toFixed(2):'—'}`,
            filas   : conSat,
            rowBg   : (r) => (r._satisfaccion >= 4) ? 'white' : '#fff5f5',
            columnas: [
                { key:'num',       label:t('aviso_num'),       align:'left',   render:(r,i)=>`<strong>${r.num>0?r.num:i+1}</strong>` },
                { key:'via',       label:t('aviso_via'),       align:'left' },
                { key:'prioridad', label:t('aviso_prioridad'), align:'center' },
                { key:'patrulla',  label:t('aviso_patrulla'),  align:'left' },
                { key:'fechaInicio', label:t('aviso_fecha'),   align:'center' },
                { key:'_satisfaccion', label:t('kpi07_media'), align:'center',
                  render:(r) => {
                    const v = r._satisfaccion;
                    if (v === null || v === undefined) return '<span style="color:#8898aa;">—</span>';
                    const stars = '★'.repeat(Math.round(v)) + '☆'.repeat(5 - Math.round(v));
                    const c = v >= 4 ? '#27ae60' : v >= 3 ? '#f59e0b' : '#e74c3c';
                    return `<span style="font-weight:700;color:${c};">${v.toFixed(1)} ${stars}</span>`;
                  }},
            ],
        });
    }

    // ════════════════════════════════════════════════════════════
    // MODAL VER REGISTROS — genérico para todos los KPIs
    // cfg.titulo    : string título del modal
    // cfg.columnas  : array de { key, label, align, render(r,idx) }
    // cfg.filas     : array de registros
    // cfg.resumen   : string opcional (ej. "1666/1948 completos")
    // ════════════════════════════════════════════════════════════
    function _verRegistros(cfg) {
        if (!cfg.filas || cfg.filas.length === 0) {
            if (typeof showToast === 'function') showToast(t('sin_datos'));
            return;
        }

        const rows = cfg.filas.map((r, idx) => {
            const celdas = cfg.columnas.map(c => {
                const val = c.render ? c.render(r, idx) : (r[c.key] !== undefined ? r[c.key] : '—');
                const align = c.align || 'left';
                return `<td style="padding:6px 9px;font-size:0.78rem;color:#32325d;text-align:${align};white-space:nowrap;">${val||'—'}</td>`;
            }).join('');
            const rowBg = cfg.rowBg ? cfg.rowBg(r) : (idx % 2 === 0 ? 'white' : '#fafbff');
            return `<tr style="background:${rowBg};border-bottom:1px solid #f0f2f8;">${celdas}</tr>`;
        }).join('');

        const prev = document.getElementById('kpi-avisos-modal');
        if (prev) prev.remove();

        const overlay = document.createElement('div');
        overlay.id = 'kpi-avisos-modal';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(30,35,80,.55);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(3px);';

        const theads = cfg.columnas.map((c, i) => {
            const align = c.align || 'left';
            return `<th style="padding:8px 10px;text-align:${align};cursor:pointer;user-select:none;white-space:nowrap;"
                onmouseover="this.style.background='#4a5cc7'" onmouseout="this.style.background='transparent'"
                onclick="FncKPI._sortAvisos('col${i}')">
                ${c.label}
                <span id="kpi-sort-icon-col${i}" style="font-size:0.65rem;margin-left:3px;opacity:.7;"></span>
            </th>`;
        }).join('');

        overlay.innerHTML = `
        <div class="atd-modal" style="max-width:860px;">
            <div class="atd-modal-header">
                <div class="atd-modal-title">
                    <i class="fa-solid fa-table-list"></i>
                    ${cfg.titulo}
                    ${cfg.resumen ? `<span style="font-size:0.78rem;font-weight:400;opacity:.8;"> · ${cfg.resumen}</span>` : ''}
                </div>
                <div style="display:flex;gap:8px;">
                    <button class="atd-btn-print" onclick="FncKPI._printAvisos()">
                        <i class="fa-solid fa-print"></i> ${t('imprimir')}
                    </button>
                    <button class="atd-btn-close" onclick="FncKPI._closeModal()">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
            <div class="atd-modal-body" style="padding:0;">
                <table style="width:100%;border-collapse:collapse;font-size:0.8rem;" id="kpi-avisos-table">
                    <thead>
                        <tr style="background:#1a2a4a;color:white;position:sticky;top:0;z-index:1;">
                            ${theads}
                        </tr>
                    </thead>
                    <tbody id="kpi-avisos-tbody">${rows}</tbody>
                </table>
            </div>
        </div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) _closeModal(); });
    }

    // ── KPI-02: Avisos completos ─────────────────────────────────
    function verAvisos() {
        const stats = calcular();
        const df    = getDashboardFilters();
        const lang  = typeof currentLang !== 'undefined' ? currentLang : 'es';
        const periodoLabel = df.years.length ? df.years.join(', ') : '';
        const esCompleto = (r) =>
            r._tienePrioridad && r._tienePatrulla &&
            (!_tieneLat || r._tieneLat) && (!_tieneLon || r._tieneLon) && (!_tieneTitulo || r._tieneTitulo);
        const nOk = stats.filas.filter(esCompleto).length;
        _verRegistros({
            titulo  : `KPI-02${periodoLabel ? ' · '+periodoLabel : ''}`,
            resumen : `${nOk}/${stats.filas.length} ${t('avisos_completos').toLowerCase()}`,
            filas   : stats.filas,
            rowBg   : (r) => esCompleto(r) ? 'white' : '#fff5f5',
            columnas: [
                { key:'num',       label:t('aviso_num'),       align:'left',
                  render:(r,i) => `<strong>${r.num>0?r.num:i+1}</strong>` },
                { key:'via',       label:t('aviso_via'),       align:'left',
                  render:(r) => `<span style="max-width:180px;overflow:hidden;text-overflow:ellipsis;display:inline-block;" title="${r.via}">${r.via||'—'}</span>` },
                { key:'prioridad', label:t('aviso_prioridad'), align:'center' },
                { key:'patrulla',  label:t('aviso_patrulla'),  align:'left' },
                { key:'fechaInicio', label:t('aviso_fecha'),   align:'center' },
                { key:'_ok',       label:t('aviso_completo'),  align:'center',
                  render:(r) => {
                    const ok = esCompleto(r);
                    return `<span style="padding:2px 8px;border-radius:20px;font-size:0.7rem;font-weight:700;
                        background:${ok?'#d4edda':'#fde8e8'};color:${ok?'#155724':'#721c24'};">
                        ${ok?t('si'):t('no')}</span>`;
                  }},
            ],
        });
    }

    // ── KPI-01: Llamadas < 30s ──────────────────────────────────
    function verRegistrosKPI01() {
        const stats = calcularKPI01();
        const df    = getDashboardFilters();
        const periodoLabel = df.years.length ? df.years.join(', ') : '';
        const nOk = stats.filas.filter(r => r._tiempoAtencion !== null && r._tiempoAtencion <= 30).length;
        _verRegistros({
            titulo  : `KPI-01${periodoLabel ? ' · '+periodoLabel : ''}`,
            resumen : `${nOk}/${stats.filas.length} ${t('kpi01_atendidas').toLowerCase()}`,
            filas   : stats.filas,
            rowBg   : (r) => (r._tiempoAtencion !== null && r._tiempoAtencion <= 30) ? 'white' : '#fff5f5',
            columnas: [
                { key:'num',       label:t('aviso_num'),       align:'left',
                  render:(r,i) => `<strong>${r.num>0?r.num:i+1}</strong>` },
                { key:'via',       label:t('aviso_via'),       align:'left' },
                { key:'prioridad', label:t('aviso_prioridad'), align:'center' },
                { key:'patrulla',  label:t('aviso_patrulla'),  align:'left' },
                { key:'fechaInicio', label:t('aviso_fecha'),   align:'center' },
                { key:'fechaInicio',  label:'FECHAINICIO',          align:'center' },
                { key:'_ok01',        label:t('kpi01_atendidas'),   align:'center',
                  render:(r) => {
                    const ok = r.patrulla && r.patrulla.trim() !== '';
                    return `<span style="padding:2px 8px;border-radius:20px;font-size:0.7rem;font-weight:700;
                        background:${ok?'#d4edda':'#fde8e8'};color:${ok?'#155724':'#721c24'};">
                        ${ok?t('si'):t('no')}</span>`;
                  }},
            ],
        });
    }

    // ── KPI-03: Incidencias ≤ 72h ───────────────────────────────
    function verRegistrosKPI03() {
        const stats = calcularKPI03();
        const df    = getDashboardFilters();
        const periodoLabel = df.years.length ? df.years.join(', ') : '';
        const nOk = stats.filas.filter(r => r._tiempoCierre !== null && r._tiempoCierre <= 72).length;
        _verRegistros({
            titulo  : `KPI-03${periodoLabel ? ' · '+periodoLabel : ''}`,
            resumen : `${nOk}/${stats.filas.length} ${t('kpi03_en_plazo').toLowerCase()}`,
            filas   : stats.filas,
            rowBg   : (r) => (r._tiempoCierre !== null && r._tiempoCierre <= 72) ? 'white' : '#fff5f5',
            columnas: [
                { key:'num',       label:t('aviso_num'),       align:'left',
                  render:(r,i) => `<strong>${r.num>0?r.num:i+1}</strong>` },
                { key:'via',       label:t('aviso_via'),       align:'left' },
                { key:'prioridad', label:t('aviso_prioridad'), align:'center' },
                { key:'patrulla',  label:t('aviso_patrulla'),  align:'left' },
                { key:'fechaInicio', label:t('aviso_fecha'),   align:'center' },
                { key:'_tiempoCierre', label:t('kpi03_distribucion')||'Tiempo cierre', align:'center',
                  render:(r) => r._tiempoCierre !== null
                    ? `<span style="font-weight:700;color:${r._tiempoCierre<=72?'#27ae60':'#e74c3c'};">${r._tiempoCierre.toFixed(1)}h</span>`
                    : `<span style="color:#8898aa;">—</span>` },
                { key:'_ok03',     label:t('kpi03_en_plazo'),  align:'center',
                  render:(r) => {
                    const ok = r._tiempoCierre !== null && r._tiempoCierre <= 72;
                    return `<span style="padding:2px 8px;border-radius:20px;font-size:0.7rem;font-weight:700;
                        background:${ok?'#d4edda':'#fde8e8'};color:${ok?'#155724':'#721c24'};">
                        ${ok?t('si'):t('no')}</span>`;
                  }},
            ],
        });
    }

    // ── KPI-04 / KPI-05: Respuesta operativa ────────────────────
    function verRegistrosKPI04() {
        const stats = calcularKPI04();
        const df    = getDashboardFilters();
        const periodoLabel = df.years.length ? df.years.join(', ') : '';
        const nOk = stats.filas.filter(r => r._tiempoLlegada !== null && r._tiempoLlegada <= 10).length;
        _verRegistros({
            titulo  : `KPI-04${periodoLabel ? ' · '+periodoLabel : ''}`,
            resumen : `${nOk}/${stats.filas.length} ${t('kpi04_en_plazo').toLowerCase()}`,
            filas   : stats.filas,
            rowBg   : (r) => (r._tiempoLlegada !== null && r._tiempoLlegada <= 10) ? 'white' : '#fff5f5',
            columnas: [
                { key:'num',       label:t('aviso_num'),       align:'left',
                  render:(r,i) => `<strong>${r.num>0?r.num:i+1}</strong>` },
                { key:'via',       label:t('aviso_via'),       align:'left' },
                { key:'prioridad', label:t('aviso_prioridad'), align:'center' },
                { key:'patrulla',  label:t('aviso_patrulla'),  align:'left' },
                { key:'fechaInicio', label:t('aviso_fecha'),   align:'center' },
                { key:'_tiempoLlegada', label:'Tiempo llegada', align:'center',
                  render:(r) => r._tiempoLlegada !== null
                    ? `<span style="font-weight:700;color:${r._tiempoLlegada<=10?'#27ae60':'#e74c3c'};">${r._tiempoLlegada.toFixed(1)} min</span>`
                    : `<span style="color:#8898aa;">—</span>` },
                { key:'_ok04',     label:t('kpi04_en_plazo'),  align:'center',
                  render:(r) => {
                    const ok = r._tiempoLlegada !== null && r._tiempoLlegada <= 10;
                    return `<span style="padding:2px 8px;border-radius:20px;font-size:0.7rem;font-weight:700;
                        background:${ok?'#d4edda':'#fde8e8'};color:${ok?'#155724':'#721c24'};">
                        ${ok?t('si'):t('no')}</span>`;
                  }},
            ],
        });
    }

    function verRegistrosKPI05() {
        const stats = calcularKPI05();
        const df    = getDashboardFilters();
        const periodoLabel = df.years.length ? df.years.join(', ') : '';
        const nOk = stats.filas.filter(r => r._tiempoLlegada !== null && r._tiempoLlegada <= 20).length;
        _verRegistros({
            titulo  : `KPI-05${periodoLabel ? ' · '+periodoLabel : ''}`,
            resumen : `${nOk}/${stats.filas.length} ${t('kpi05_en_plazo').toLowerCase()}`,
            filas   : stats.filas,
            rowBg   : (r) => (r._tiempoLlegada !== null && r._tiempoLlegada <= 20) ? 'white' : '#fff5f5',
            columnas: [
                { key:'num',       label:t('aviso_num'),       align:'left',
                  render:(r,i) => `<strong>${r.num>0?r.num:i+1}</strong>` },
                { key:'via',       label:t('aviso_via'),       align:'left' },
                { key:'prioridad', label:t('aviso_prioridad'), align:'center' },
                { key:'patrulla',  label:t('aviso_patrulla'),  align:'left' },
                { key:'fechaInicio', label:t('aviso_fecha'),   align:'center' },
                { key:'_tiempoLlegada', label:'Tiempo llegada', align:'center',
                  render:(r) => r._tiempoLlegada !== null
                    ? `<span style="font-weight:700;color:${r._tiempoLlegada<=20?'#27ae60':'#e74c3c'};">${r._tiempoLlegada.toFixed(1)} min</span>`
                    : `<span style="color:#8898aa;">—</span>` },
                { key:'_ok05',     label:t('kpi05_en_plazo'),  align:'center',
                  render:(r) => {
                    const ok = r._tiempoLlegada !== null && r._tiempoLlegada <= 20;
                    return `<span style="padding:2px 8px;border-radius:20px;font-size:0.7rem;font-weight:700;
                        background:${ok?'#d4edda':'#fde8e8'};color:${ok?'#155724':'#721c24'};">
                        ${ok?t('si'):t('no')}</span>`;
                  }},
            ],
        });
    }

    // ════════════════════════════════════════════════════════════
    // EXPORTAR PDF
    // ════════════════════════════════════════════════════════════
    function exportarPdf() {
        const lang  = typeof currentLang !== 'undefined' ? currentLang : 'es';
        const meses = MESES[lang] || MESES.es;
        const stats = calcular();
        const nombreMes = meses[_mesSel-1] || _mesSel;
        const fecha = new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric'});

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const mL = 15, mR = 15, contW = pageW - mL - mR;

        doc.setFillColor(94,114,228); doc.rect(0,0,pageW,26,'F');
        doc.setTextColor(255,255,255);
        doc.setFontSize(13); doc.setFont('helvetica','bold');
        doc.text('EUROCOP ANALYTICS', mL, 10);
        doc.setFontSize(8); doc.setFont('helvetica','normal');
        doc.text(t('actualizar'), mL, 17);
        doc.text(fecha, pageW-mR, 10, {align:'right'});
        doc.text(`${nombreMes} ${_añoSel}`, pageW-mR, 17, {align:'right'});

        let y = 32;
        const color = stats.estado==='verde'?[46,204,113]:stats.estado==='amarillo'?[241,196,15]:[231,76,60];
        doc.setFillColor(...color);
        doc.circle(mL+8, y+8, 8, 'F');
        doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(8);
        doc.text(stats.porcentaje.toFixed(0)+'%', mL+8, y+9.5, {align:'center'});
        doc.setTextColor(50,50,93); doc.setFont('helvetica','bold'); doc.setFontSize(11);
        doc.text('KPI-02 — '+t('avisos_completos'), mL+20, y+6);
        doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(80,80,120);
        doc.text(`${t('objetivo')}: ${t('objetivo_val')} · ${t('frecuencia')}`, mL+20, y+12);
        y += 22;

        const summaryRows = [
            [t('total_avisos'), stats.totalFiltrados],
            [t('avisos_completos'), stats.nCompletos],
            [t('avisos_incompletos'), stats.nIncompletos],
            ['KPI-02 (%)', stats.porcentaje.toFixed(1)+'%'],
        ];
        summaryRows.forEach((row, i) => {
            const isTot = i===3;
            if (isTot) { doc.setFillColor(224,228,252); doc.rect(mL,y,contW,6.5,'F'); }
            else if (i%2===0) { doc.setFillColor(248,249,255); doc.rect(mL,y,contW,6.5,'F'); }
            doc.setDrawColor(225,228,245); doc.line(mL,y+6.5,mL+contW,y+6.5);
            doc.setFont('helvetica',isTot?'bold':'normal'); doc.setFontSize(8);
            doc.setTextColor(isTot?61:50, isTot?77:50, isTot?183:80);
            doc.text(String(row[0]), mL+3, y+4.5);
            doc.setFont('helvetica','bold'); doc.setTextColor(94,114,228);
            doc.text(String(row[1]), mL+contW-3, y+4.5, {align:'right'});
            y += 6.5;
        });

        y += 6;
        doc.setFillColor(240,242,255); doc.rect(mL,y,contW,7,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(61,77,183);
        doc.text(t('filtro_prioridad').toUpperCase(), mL+2, y+5);
        y += 9;
        Object.entries(stats.porPrioridad).forEach(([prio,d],i) => {
            if (i%2===0) { doc.setFillColor(248,249,255); doc.rect(mL,y,contW,6.5,'F'); }
            doc.setDrawColor(225,228,245); doc.line(mL,y+6.5,mL+contW,y+6.5);
            doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(50,50,80);
            doc.text(prio, mL+3, y+4.5);
            const pct2 = d.total>0?(d.completos/d.total*100).toFixed(1)+'%':'—';
            doc.setFont('helvetica','bold'); doc.setTextColor(94,114,228);
            doc.text(`${d.completos}/${d.total} (${pct2})`, mL+contW-3, y+4.5, {align:'right'});
            y += 6.5;
        });

        doc.setFillColor(240,242,255); doc.rect(0,pageH-9,pageW,9,'F');
        doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(130,130,160);
        doc.text('Generado por Eurocop Analytics · zzenkiu.com', mL, pageH-3);
        doc.text(fecha, pageW-mR, pageH-3, {align:'right'});
        doc.save(`KPI02_${_añoSel}_${String(_mesSel).padStart(2,'0')}.pdf`);
    }

    // ════════════════════════════════════════════════════════════
    // IMPRIMIR
    // ════════════════════════════════════════════════════════════
    function imprimirVista() {
        const lang = typeof currentLang !== 'undefined' ? currentLang : 'es';
        const stats = calcular();
        const nombreMes = (MESES[lang]||MESES.es)[_mesSel-1] || _mesSel;
        const fecha = new Date().toLocaleDateString('es-ES');
        const color = stats.estado==='verde'?'#2ecc71':stats.estado==='amarillo'?'#f1c40f':'#e74c3c';
        const prioHtml = Object.entries(stats.porPrioridad).map(([p,d]) => {
            const pct2 = d.total>0?(d.completos/d.total*100).toFixed(1):'0.0';
            return `<tr><td>${p||'—'}</td><td>${d.total}</td><td>${d.completos}</td>
                <td>${d.total-d.completos}</td>
                <td style="color:${parseFloat(pct2)>=98?'green':'red'};font-weight:700;">${pct2}%</td></tr>`;
        }).join('');
        const w = window.open('','_blank','width=800,height=600');
        w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
        <title>KPI-02 · ${nombreMes} ${_añoSel}</title>
        <style>
            body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a2e;padding:16px;}
            .hdr{display:flex;justify-content:space-between;border-bottom:3px solid #5e72e4;
                padding-bottom:10px;margin-bottom:14px;}
            .h1{font-size:15px;font-weight:900;color:#5e72e4;}
            .h2{font-size:10px;color:#525f7f;margin-top:3px;}
            .card{display:flex;gap:16px;align-items:center;background:#f8f9ff;
                border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:12px;}
            .sem{width:60px;height:60px;border-radius:50%;background:${color};
                display:flex;flex-direction:column;align-items:center;
                justify-content:center;color:white;font-weight:900;}
            table{width:100%;border-collapse:collapse;margin-bottom:12px;}
            th{background:#5e72e4;color:white;padding:6px 8px;text-align:left;font-size:10px;}
            td{padding:5px 8px;border-bottom:1px solid #f0f1f8;font-size:10px;}
            tr:nth-child(even) td{background:#f8f9ff;}
            .ftr{margin-top:12px;font-size:9px;color:#aaaacc;border-top:1px solid #e2e8f0;padding-top:6px;}
            @media print{@page{size:A4 portrait;margin:1.2cm;}}
        </style></head><body>
        <div class="hdr">
            <div><div class="h1">EUROCOP ANALYTICS</div>
            <div class="h2">${t('actualizar')} · KPI-02</div></div>
            <div style="font-size:10px;color:#8898aa;">${nombreMes} ${_añoSel}<br>${fecha}</div>
        </div>
        <div class="card">
            <div class="sem"><div style="font-size:16px;">${stats.porcentaje.toFixed(1)}%</div></div>
            <div>
                <div style="font-weight:800;font-size:13px;">KPI-02 — ${t('avisos_completos')}</div>
                <div style="font-size:10px;color:#8898aa;">${t('objetivo')}: ${t('objetivo_val')}</div>
                <div style="margin-top:6px;font-size:10px;">
                    ${t('total_avisos')}: <b>${stats.totalFiltrados}</b> ·
                    ${t('avisos_completos')}: <b style="color:green;">${stats.nCompletos}</b> ·
                    ${t('avisos_incompletos')}: <b style="color:red;">${stats.nIncompletos}</b>
                </div>
            </div>
        </div>
        <table>
            <thead><tr><th>${t('filtro_prioridad')}</th><th>Total</th>
                <th>Completos</th><th>Incompletos</th><th>KPI-02%</th></tr></thead>
            <tbody>${prioHtml}</tbody>
        </table>
        <div class="ftr">Generado por Eurocop Analytics · zzenkiu.com</div>
        <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script>
        </body></html>`);
        w.document.close();
    }

    // ════════════════════════════════════════════════════════════
    // CICLO DE VIDA — ahora el KPI se abre desde el dashboard
    // ════════════════════════════════════════════════════════════

    // Llamado desde FncCargaArchivo después de cargar cualquier Excel
    // para detectar si tiene estructura KPI y mostrar el botón
    function onDatosCargados(data, filename) {
        if (!detectarDesdeData(data, filename)) return;
        // Extraer nombre de empresa del filename: "CERTEX_KPI-01..." → "CERTEX"
        // Soporta cualquier prefijo antes de _KPI (case-insensitive)
        if (filename) {
            const m = filename.match(/^([^_]+)_KPI[-_]/i);
            if (m) {
                _empresaActual = m[1].trim();
            } else if (!_empresaActual) {
                _empresaActual = '';
            }
        }
        // Detectar tipo de archivo por columnas
        const keys = data && data[0] ? Object.keys(data[0]).map(k => k.toUpperCase()) : [];
        if (keys.includes('NUMEROPROFESIONAL') && keys.includes('NUMEROHORAS')) {
            parsearDatosFormacion(data);
        } else if (keys.includes('TRAMITE') && keys.includes('FECHAALTAINCIDENCIA') && keys.includes('FECHATRAMITE')) {
            parsearDatosVulnerables(data);
        } else if (keys.includes('FECHASOLICITUD') && keys.includes('FECHAINICIO') && keys.includes('FECHAFIN') &&
            !keys.includes('FECHADENUNCIA') && !keys.includes('NUMVEHICULOS') && !keys.includes('FINALIZADO')) {
            parsearDatosEventos(data);
        } else if (keys.includes('FECHADENUNCIA') && keys.includes('ESTADO') &&
            !keys.includes('NUMVEHICULOS') && !keys.includes('FECHASALIDA') && !keys.includes('FINALIZADO')) {
            parsearDatosDenuncias(data);
        } else if (keys.includes('FECHASALIDA') && keys.includes('FECHAREGISTRO') &&
            !keys.includes('NUMVEHICULOS') && !keys.includes('FINALIZADO')) {
            parsearDatosInformes(data);
        } else if (keys.includes('NUMVEHICULOS') && keys.includes('FECHAHORAINICIO')) {
            parsearDatosControles(data);
        } else if (keys.includes('FECHAREMISION') && keys.includes('FINALIZADO')) {
            parsearDatosAtestados(data);
        } else {
            parsearDatos(data);
        }
        // Mostrar botón Visor KPI en el dashboard
        const btn = document.getElementById('btn-visor-kpi');
        if (btn) btn.style.display = 'inline-flex';
    }

    // Abrir visor KPI (llamado desde botón en dashboard)
    function abrirVisor() {
        if (!_cargado) { if(typeof showToast==='function') showToast('Carga primero un archivo KPI.'); return; }
        // Ocultar otras vistas
        ['upload-view','mapping-view','dashboard-view'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('active');
        });
        // Activar clase en body para desbloquear scroll
        document.body.classList.add('kpi-active');
        // Scroll al inicio de la página
        window.scrollTo(0, 0);
        renderVisor();
    }

    // Cerrar visor y volver al dashboard
    function cerrarVisor() {
        document.body.classList.remove('kpi-active');
        const view = document.getElementById('atestados-view');
        if (view) { view.classList.remove('active'); view.innerHTML = ''; }
        const dashboard = document.getElementById('dashboard-view');
        if (dashboard) dashboard.classList.add('active');
        // Restaurar scroll al top
        window.scrollTo(0, 0);
    }

    // ════════════════════════════════════════════════════════════
    // HELPERS INTERNOS
    // ════════════════════════════════════════════════════════════
    // ── Sort state for modal table ──────────────────────────────────────────
    let _sortCol = 'num';
    let _sortAsc  = true;

    function _sortAvisos(col) {
        if (_sortCol === col) _sortAsc = !_sortAsc;
        else { _sortCol = col; _sortAsc = true; }

        const tbody = document.getElementById('kpi-avisos-tbody');
        if (!tbody) return;

        const rows = Array.from(tbody.querySelectorAll('tr'));
        const dir  = _sortAsc ? 1 : -1;

        const colIndex = { num:0, via:1, prioridad:2, patrulla:3, fecha:4, completo:5 };
        const idx = colIndex[col] ?? 0;

        rows.sort((a, b) => {
            const aVal = a.cells[idx]?.textContent.trim() || '';
            const bVal = b.cells[idx]?.textContent.trim() || '';
            // Numeric sort for num column
            if (col === 'num') return (parseInt(aVal)||0) - (parseInt(bVal)||0) * dir;
            return aVal.localeCompare(bVal, 'es', {numeric:true}) * dir;
        });

        rows.forEach(r => tbody.appendChild(r));

        // Update sort icons
        document.querySelectorAll('[id^="kpi-sort-icon-"]').forEach(el => el.textContent = '');
        const icon = document.getElementById('kpi-sort-icon-' + col);
        if (icon) icon.textContent = _sortAsc ? '▲' : '▼';
    }

    function _closeModal() {
        const m = document.getElementById('kpi-avisos-modal');
        if (m) m.remove();
    }
    function _printAvisos() {
        const tbl = document.getElementById('kpi-avisos-table');
        if (!tbl) return;
        const w = window.open('','_blank','width=900,height=600');
        w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
        <title>KPI-02 Avisos</title>
        <style>body{font-family:Arial,sans-serif;font-size:10px;}
        table{width:100%;border-collapse:collapse;}
        th{background:#5e72e4;color:white;padding:5px 7px;}
        td{padding:4px 7px;border-bottom:1px solid #eee;}
        @media print{@page{size:A4 landscape;margin:1cm;}}</style></head><body>
        ${tbl.outerHTML}
        <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script>
        </body></html>`);
        w.document.close();
    }

    // ════════════════════════════════════════════════════════════
    // API PÚBLICA
    // ════════════════════════════════════════════════════════════
    return {
        // Ciclo de vida
        onDatosCargados,
        abrirVisor,
        cerrarVisor,
        // Ver registros por KPI
        verRegistrosKPI01,
        verRegistrosKPI03,
        verRegistrosKPI04,
        verRegistrosKPI05,
        verRegistrosKPI06,
        verRegistrosKPI07,
        verRegistrosKPI08,
        verRegistrosKPI18,
        verRegistrosKPI19,
        verRegistrosKPI20,
        verRegistrosKPI21,
        verRegistrosKPI23,
        verRegistrosKPI09,
        verRegistrosKPI11,
        verRegistrosKPI13,
        verRegistrosKPI14,
        verRegistrosKPI15,
        verRegistrosKPI10,
        // Toggle fórmula al hacer clic en el gauge
        _toggleInfo : () => {
            const card  = document.querySelector('.kpi-card-nuevo');
            const panel = card ? card.querySelector('.kpinv-info-panel') : null;
            if (!panel) return;
            // Cerrar fórmula si estuviera abierta
            const fp = card.querySelector('.kpinv-formula-panel');
            if (fp && fp.style.display !== 'none') fp.style.display = 'none';
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        },
        _toggleFormula : (svgEl) => {
            const panelId = svgEl.getAttribute('data-formula');
            const panel   = panelId ? document.getElementById(panelId) : null;
            if (!panel) {
                // Fallback: buscar en el card padre
                const card = svgEl.closest('.kpi-card-nuevo');
                const p = card ? card.querySelector('.kpinv-formula-panel') : null;
                if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
                return;
            }
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        },

        // Visor
        verAvisos,
        exportarPdf,
        imprimirVista,
        // Handlers UI
        _onFiltro    : (k,v) => {
            if(k==='prioridad') _filtroPrioridad=v;
            if(k==='patrulla')   _filtroPatrulla=v;
            renderVisor();
        },
        _onKpiChange : (v) => { _kpiActivo = v; _filtroPrioridad=''; _filtroPatrulla=''; renderVisor(); },
        _exportarPdfKpi : (kpi) => {
            if      (kpi === 'kpi01') FncKPI.imprimirKPI01();
            else if (kpi === 'kpi03') FncKPI.imprimirKPI03();
            else if (kpi === 'kpi04') FncKPI.imprimirKPI04();
            else if (kpi === 'kpi05') FncKPI.imprimirKPI05();
            else                      exportarPdf();
        },
        _imprimirKpi : (kpi) => {
            if      (kpi === 'kpi01') FncKPI.imprimirKPI01();
            else if (kpi === 'kpi03') FncKPI.imprimirKPI03();
            else if (kpi === 'kpi04') FncKPI.imprimirKPI04();
            else if (kpi === 'kpi05') FncKPI.imprimirKPI05();
            else                      imprimirVista();
        },
        imprimirKPI03 : () => {
            const stats  = calcularKPI03();
            const lang   = typeof currentLang!=='undefined'?currentLang:'es';
            const meses  = MESES[lang]||MESES.es;
            const df     = getDashboardFilters();
            const color  = {verde:'#2ecc71',amarillo:'#f1c40f',rojo:'#e74c3c'}[stats.estado];
            const fecha  = new Date().toLocaleDateString(lang==='eu'?'eu-ES':lang==='ca'?'ca-ES':lang==='gl'?'gl-ES':'es-ES');
            const periodo = df.months.length===1?`${meses[df.months[0]-1]} ${df.years[0]||''}`:df.years.join(', ');
            const enPlazoLabel   = t('kpi03_en_plazo')      || '≤72h';
            const fueraPlazoLabel= t('kpi03_fuera_plazo')   || '>72h';
            const sinCierreLabel = t('kpi03_sin_cierre')    || t('kpi_sin_cierre_label') || 'Sin cierre';
            const rangoLabel     = t('rango_tiempo')        || t('kpi_rango_tiempo')     || 'Rango';
            const prioHtml = Object.entries(stats.porPrioridad).map(([p,d]) => {
                const pct = d.total>0?(d.enPlazo/d.total*100).toFixed(1):'0.0';
                return `<tr><td>${p||'—'}</td><td>${d.total}</td><td>${d.enPlazo}</td>
                    <td>${d.fueraPlazo}</td><td>${d.sinCierre}</td>
                    <td style="color:${parseFloat(pct)>=90?'green':'red'};font-weight:700;">${pct}%</td></tr>`;
            }).join('');
            const distHtml = stats.distribucion.map(d => {
                const pct = stats.cerradas>0?(d.count/stats.cerradas*100).toFixed(1):'0.0';
                const plazoLabel = d.enPlazo ? `✓ ${enPlazoLabel}` : `⚠ ${fueraPlazoLabel}`;
                return `<tr><td>${d.label}</td><td>${d.count}</td><td>${pct}%</td>
                    <td style="color:${d.enPlazo?'green':'red'}">${plazoLabel}</td></tr>`;
            }).join('');
            const w = window.open('','_blank','width=800,height=600');
            w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
            <title>KPI-03 · ${periodo}</title>
            <style>body{font-family:Arial,sans-serif;font-size:11px;padding:16px;}
            .hdr{display:flex;justify-content:space-between;border-bottom:3px solid #1a2a4a;padding-bottom:10px;margin-bottom:14px;}
            .h1{font-size:15px;font-weight:900;color:#1a2a4a;}
            .card{display:flex;gap:16px;align-items:center;background:#f8f9ff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:12px;}
            .sem{width:60px;height:60px;border-radius:50%;background:${color};display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;font-weight:900;}
            table{width:100%;border-collapse:collapse;margin-bottom:12px;}
            th{background:#1a2a4a;color:white;padding:6px 8px;text-align:left;}
            td{padding:5px 8px;border-bottom:1px solid #f0f1f8;}
            tr:nth-child(even) td{background:#f8f9ff;}
            @media print{@page{size:A4 portrait;margin:1.2cm;}}</style></head><body>
            <div class="hdr"><div><div class="h1">EUROCOP ANALYTICS</div>
            <div style="font-size:10px;color:#525f7f;">KPI-03 · ${t('kpi03_nombre')}</div></div>
            <div style="font-size:10px;color:#8898aa;">${periodo}<br>${fecha}</div></div>
            <div class="card"><div class="sem"><div style="font-size:16px;">${stats.porcentaje.toFixed(1)}%</div></div>
            <div><div style="font-weight:800;font-size:13px;">KPI-03 · ${t('kpi03_nombre')}</div>
            <div style="font-size:10px;color:#8898aa;">${t('objetivo')}: ≥ 90% · ${t('frecuencia')}</div>
            <div style="margin-top:6px;font-size:10px;">${t('kpi03_total')}: <b>${stats.total}</b> · ${enPlazoLabel}: <b style="color:green;">${stats.nEnPlazo}</b> · ${fueraPlazoLabel}: <b style="color:red;">${stats.nFuera}</b> · ${sinCierreLabel}: <b style="color:#888;">${stats.nSinCierre}</b></div></div></div>
            <table><thead><tr><th>${rangoLabel}</th><th>${t('kpi03_total')}</th><th>%</th><th>${t('objetivo')}</th></tr></thead><tbody>${distHtml}</tbody></table>
            <table><thead><tr><th>${t('filtro_prioridad')}</th><th>Total</th><th>${enPlazoLabel}</th><th>${fueraPlazoLabel}</th><th>${sinCierreLabel}</th><th>KPI-03%</th></tr></thead><tbody>${prioHtml}</tbody></table>
            <div style="font-size:9px;color:#aaa;border-top:1px solid #e2e8f0;padding-top:6px;margin-top:12px;">Eurocop Analytics · zzenkiu.com</div>
            <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script>
            </body></html>`);
            w.document.close();
        },
        exportarPdfKPI01 : () => { FncKPI.imprimirKPI01(); },
        imprimirKPI01 : () => {
            const stats  = calcularKPI01();
            const lang   = typeof currentLang!=='undefined'?currentLang:'es';
            const meses  = MESES[lang]||MESES.es;
            const df     = getDashboardFilters();
            const color  = {verde:'#2ecc71',amarillo:'#f1c40f',rojo:'#e74c3c'}[stats.estado];
            const fecha  = new Date().toLocaleDateString(lang==='eu'?'eu-ES':lang==='ca'?'ca-ES':lang==='gl'?'gl-ES':'es-ES');
            const periodo = df.months.length===1 ? `${meses[df.months[0]-1]} ${df.years[0]||''}` : df.years.join(', ');
            const atendidasLabel   = t('kpi01_atendidas');
            const noAtendidasLabel = t('kpi01_no_atendidas');
            const rangoLabel       = t('rango_tiempo');
            const prioHtml = Object.entries(stats.porPrioridad).map(([p,d]) => {
                const pct = d.total>0?(d.menores30/d.total*100).toFixed(1):'0.0';
                return `<tr><td>${p||'—'}</td><td>${d.total}</td><td>${d.menores30}</td>
                    <td>${d.total-d.menores30}</td>
                    <td style="color:${parseFloat(pct)>=95?'green':'red'};font-weight:700;">${pct}%</td></tr>`;
            }).join('');
            const distHtml = stats.distribucion.map(d => {
                const pct = stats.conTiempo>0?(d.count/stats.conTiempo*100).toFixed(1):'0.0';
                return `<tr><td>${d.label}</td><td>${d.count}</td><td>${pct}%</td></tr>`;
            }).join('');
            const w = window.open('','_blank','width=800,height=600');
            w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
            <title>KPI-01 · ${periodo}</title>
            <style>body{font-family:Arial,sans-serif;font-size:11px;padding:16px;}
            .hdr{display:flex;justify-content:space-between;border-bottom:3px solid #1a2a4a;padding-bottom:10px;margin-bottom:14px;}
            .h1{font-size:15px;font-weight:900;color:#1a2a4a;}
            .card{display:flex;gap:16px;align-items:center;background:#f8f9ff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:12px;}
            .sem{width:60px;height:60px;border-radius:50%;background:${color};display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;font-weight:900;}
            table{width:100%;border-collapse:collapse;margin-bottom:12px;}
            th{background:#1a2a4a;color:white;padding:6px 8px;text-align:left;}
            td{padding:5px 8px;border-bottom:1px solid #f0f1f8;}
            tr:nth-child(even) td{background:#f8f9ff;}
            @media print{@page{size:A4 portrait;margin:1.2cm;}}</style></head><body>
            <div class="hdr"><div><div class="h1">EUROCOP ANALYTICS</div>
            <div style="font-size:10px;color:#525f7f;">KPI-01 · ${t('kpi01_nombre')}</div></div>
            <div style="font-size:10px;color:#8898aa;">${periodo}<br>${fecha}</div></div>
            <div class="card"><div class="sem"><div style="font-size:16px;">${stats.porcentaje.toFixed(1)}%</div></div>
            <div><div style="font-weight:800;font-size:13px;">KPI-01 · ${t('kpi01_nombre')}</div>
            <div style="font-size:10px;color:#8898aa;">${t('objetivo')}: ≥ 95% · ${t('frecuencia')}</div>
            <div style="margin-top:6px;font-size:10px;">${t('kpi01_total')||'Total'}: <b>${stats.total}</b> · ${atendidasLabel}: <b style="color:green;">${stats.nMenores30}</b> · ${noAtendidasLabel}: <b style="color:red;">${stats.nMayores30+stats.nSinTiempo}</b></div></div></div>
            <table><thead><tr><th>${rangoLabel}</th><th>${t('kpi01_total')}</th><th>%</th></tr></thead><tbody>${distHtml}</tbody></table>
            <table><thead><tr><th>${t('filtro_prioridad')}</th><th>Total</th><th>${atendidasLabel}</th><th>${noAtendidasLabel}</th><th>KPI-01%</th></tr></thead><tbody>${prioHtml}</tbody></table>
            <div style="font-size:9px;color:#aaa;border-top:1px solid #e2e8f0;padding-top:6px;margin-top:12px;">Eurocop Analytics · zzenkiu.com</div>
            <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script>
            </body></html>`);
            w.document.close();
        },
        imprimirKPI04 : () => {
            const stats  = calcularKPI04();
            const lang   = typeof currentLang!=='undefined'?currentLang:'es';
            const meses  = MESES[lang]||MESES.es;
            const df     = getDashboardFilters();
            const color  = {verde:'#2ecc71',amarillo:'#f1c40f',rojo:'#e74c3c'}[stats.estado];
            const fecha  = new Date().toLocaleDateString('es-ES');
            const periodo = df.months.length===1?`${meses[df.months[0]-1]} ${df.years[0]||''}`:df.years.join(', ');
            const distHtml = stats.distribucion.map(d => {
                const pct = stats.conTiempo>0?(d.count/stats.conTiempo*100).toFixed(1):'0.0';
                return `<tr><td>${d.label}</td><td>${d.count}</td><td>${pct}%</td>
                    <td style="color:${d.enPlazo?'green':'red'}">${d.enPlazo?'✓ ≤10min':'⚠ >10min'}</td></tr>`;
            }).join('');
            const w = window.open('','_blank','width=800,height=600');
            w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
            <title>KPI-04 · ${periodo}</title>
            <style>body{font-family:Arial,sans-serif;font-size:11px;padding:16px;}
            .hdr{display:flex;justify-content:space-between;border-bottom:3px solid #1a2a4a;padding-bottom:10px;margin-bottom:14px;}
            .h1{font-size:15px;font-weight:900;color:#1a2a4a;}
            .card{display:flex;gap:16px;align-items:center;background:#f8f9ff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:12px;}
            .sem{width:60px;height:60px;border-radius:50%;background:${color};display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;font-weight:900;}
            table{width:100%;border-collapse:collapse;margin-bottom:12px;}
            th{background:#1a2a4a;color:white;padding:6px 8px;text-align:left;}
            td{padding:5px 8px;border-bottom:1px solid #f0f1f8;}
            tr:nth-child(even) td{background:#f8f9ff;}
            @media print{@page{size:A4 portrait;margin:1.2cm;}}</style></head><body>
            <div class="hdr"><div><div class="h1">EUROCOP ANALYTICS</div>
            <div style="font-size:10px;color:#525f7f;">KPI-04 · ${t('kpi04_nombre')}</div></div>
            <div style="font-size:10px;color:#8898aa;">${periodo}<br>${fecha}</div></div>
            <div class="card"><div class="sem"><div style="font-size:16px;">${stats.porcentaje.toFixed(1)}%</div></div>
            <div><div style="font-weight:800;font-size:13px;">KPI-04 · ${t('kpi04_nombre')}</div>
            <div style="font-size:10px;color:#8898aa;">${t('objetivo')}: ≥ 90% · ${t('frecuencia')}</div>
            <div style="margin-top:6px;font-size:10px;">${t('kpi04_total')}: <b>${stats.total}</b> · ${t('kpi04_en_plazo')}: <b style="color:green;">${stats.enPlazo}</b> · ${t('kpi04_fuera_plazo')}: <b style="color:red;">${stats.fueraPlazo}</b></div></div></div>
            <table><thead><tr><th>${t('rango_tiempo')}</th><th>${t('kpi04_total')}</th><th>%</th><th>${t('objetivo')}</th></tr></thead><tbody>${distHtml}</tbody></table>
            <div style="font-size:9px;color:#aaa;border-top:1px solid #e2e8f0;padding-top:6px;margin-top:12px;">Eurocop Analytics · zzenkiu.com</div>
            <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script>
            </body></html>`);
            w.document.close();
        },
        imprimirKPI05 : () => {
            const stats  = calcularKPI05();
            const lang   = typeof currentLang!=='undefined'?currentLang:'es';
            const meses  = MESES[lang]||MESES.es;
            const df     = getDashboardFilters();
            const color  = {verde:'#2ecc71',amarillo:'#f1c40f',rojo:'#e74c3c'}[stats.estado];
            const fecha  = new Date().toLocaleDateString('es-ES');
            const periodo = df.months.length===1?`${meses[df.months[0]-1]} ${df.years[0]||''}`:df.years.join(', ');
            const distHtml = stats.distribucion.map(d => {
                const pct = stats.conTiempo>0?(d.count/stats.conTiempo*100).toFixed(1):'0.0';
                return `<tr><td>${d.label}</td><td>${d.count}</td><td>${pct}%</td>
                    <td style="color:${d.enPlazo?'green':'red'}">${d.enPlazo?'✓ ≤20min':'⚠ >20min'}</td></tr>`;
            }).join('');
            const w = window.open('','_blank','width=800,height=600');
            w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
            <title>KPI-05 · ${periodo}</title>
            <style>body{font-family:Arial,sans-serif;font-size:11px;padding:16px;}
            .hdr{display:flex;justify-content:space-between;border-bottom:3px solid #1a2a4a;padding-bottom:10px;margin-bottom:14px;}
            .h1{font-size:15px;font-weight:900;color:#1a2a4a;}
            .card{display:flex;gap:16px;align-items:center;background:#f8f9ff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:12px;}
            .sem{width:60px;height:60px;border-radius:50%;background:${color};display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;font-weight:900;}
            table{width:100%;border-collapse:collapse;margin-bottom:12px;}
            th{background:#1a2a4a;color:white;padding:6px 8px;text-align:left;}
            td{padding:5px 8px;border-bottom:1px solid #f0f1f8;}
            tr:nth-child(even) td{background:#f8f9ff;}
            @media print{@page{size:A4 portrait;margin:1.2cm;}}</style></head><body>
            <div class="hdr"><div><div class="h1">EUROCOP ANALYTICS</div>
            <div style="font-size:10px;color:#525f7f;">KPI-05 · ${t('kpi05_nombre')}</div></div>
            <div style="font-size:10px;color:#8898aa;">${periodo}<br>${fecha}</div></div>
            <div class="card"><div class="sem"><div style="font-size:16px;">${stats.porcentaje.toFixed(1)}%</div></div>
            <div><div style="font-weight:800;font-size:13px;">KPI-05 · ${t('kpi05_nombre')}</div>
            <div style="font-size:10px;color:#8898aa;">${t('objetivo')}: ≥ 85% · ${t('frecuencia')}</div>
            <div style="margin-top:6px;font-size:10px;">${t('kpi05_total')}: <b>${stats.total}</b> · ${t('kpi05_en_plazo')}: <b style="color:green;">${stats.enPlazo}</b> · ${t('kpi05_fuera_plazo')}: <b style="color:red;">${stats.fueraPlazo}</b></div></div></div>
            <table><thead><tr><th>${t('rango_tiempo')}</th><th>${t('kpi05_total')}</th><th>%</th><th>${t('objetivo')}</th></tr></thead><tbody>${distHtml}</tbody></table>
            <div style="font-size:9px;color:#aaa;border-top:1px solid #e2e8f0;padding-top:6px;margin-top:12px;">Eurocop Analytics · zzenkiu.com</div>
            <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script>
            </body></html>`);
            w.document.close();
        },
        _closeModal,
        _printAvisos,
        _sortAvisos,
        _rerender: () => renderVisor(),
        // Estado
        isCargado: () => _cargado,
        getEmpresa: () => _empresaActual,
        getKpisDisponibles: () => [..._kpisDisponibles],
    };

})();
