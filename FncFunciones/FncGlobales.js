/**
 * EUROCOP ANALYTICS - VARIABLES GLOBALES
 * Todas las variables compartidas entre módulos.
 * Este archivo debe cargarse PRIMERO, antes que cualquier otro módulo.
 */

// ============================================================
// DATOS PRINCIPALES
// ============================================================
let rawData = [];
let finalData = [];
let lastFilteredData = [];

// ============================================================
// GRÁFICOS (Chart.js)
// ============================================================
let chartTimeline, chartCategory, chartHours;

// ============================================================
// MAPA (MapLibre)
// ============================================================
let map;
let isSatelite = false;
let isHeatmap = false;

// ============================================================
// NOMBRE DEL ARCHIVO SUBIDO
// ============================================================
let nombreArchivoSubido = "INFORME ANALYTICS";

// ============================================================
// ESTADO DE GRÁFICO TIMELINE
// ============================================================
let chartTimelineType = 'bar';   // 'bar' o 'line'
let temporalView = 'year';       // 'year' | 'month' | 'quarter' | 'day'

// ============================================================
// IDIOMA
// ============================================================
let currentLang = localStorage.getItem('eurocop_lang') || 'es';

// ============================================================
// VARIABLES DE TABLAS
// ============================================================
// Tabla Timeline
let isTableView = false;
let tableDataCache = [];
let currentSort = { col: 'index', dir: 'desc' };

// Tabla Categorías
let isTableCatView = false;
let tableCatDataCache = [];
let currentSortCat = { col: 'count', dir: 'desc' };

// Tabla Horas
let isTableHoursView = false;
let tableHoursDataCache = [];
let currentSortHours = { col: 'hour', dir: 'asc' };

// Tabla Calles
let isTableStreetsView = false;
let tableStreetsDataCache = [];
let currentSortStreets = { col: 'count', dir: 'desc' };

// ============================================================
// MODO DE FILTRO DE FECHAS
// ============================================================
let dateFilterMode = 'month'; // 'month' (mes tradicional) o 'daymonth' (día/mes desde-hasta)

// ============================================================
// DATOS DE HORA
// ============================================================
let hasHourData = false;

// ============================================================
// CAPAS DEL MAPA (GeoJSON)
// ============================================================
let mapLayers = [];  // Almacena objetos: { id, name, visible, color, geojson }

// ============================================================
// POLÍGONOS LEGACY (se mantiene por compatibilidad)
// ============================================================
let isPolygonLoaded = false;
let isPolygonVisible = false;

// ============================================================
// GEOLOCALIZACIÓN
// ============================================================
let isGeocodingActive = false;

// ============================================================
// BÚSQUEDA DE CATEGORÍAS (debounce)
// ============================================================
let searchTimeout = null;

// ============================================================
// CAMPOS CONFIGURADOS (Mapping)
// ============================================================
let configuredFieldsVisible = false;

// ============================================================
// PALETAS DE COLORES
// ============================================================
const yearColors = [
    { bg: 'rgba(255, 49, 49, 0.8)',  border: '#FF3131' },   // Rojo Neón
    { bg: 'rgba(255, 110, 0, 0.8)',  border: '#FF6E00' },   // Naranja Brillante
    { bg: 'rgba(255, 0, 127, 0.8)',  border: '#FF007F' },   // Rosa Fucsia
    { bg: 'rgba(0, 255, 242, 0.8)',  border: '#00FFF2' },   // Cian Neón
    { bg: 'rgba(188, 0, 255, 0.8)', border: '#BC00FF' }     // Violeta Eléctrico
];

// ============================================================
// CONFIGURACIÓN DE MESES
// ============================================================
const monthsConfig = [
    { id: 1,  abbr: 'Ene' }, { id: 2,  abbr: 'Feb' }, { id: 3,  abbr: 'Mar' },
    { id: 4,  abbr: 'Abr' }, { id: 5,  abbr: 'May' }, { id: 6,  abbr: 'Jun' },
    { id: 7,  abbr: 'Jul' }, { id: 8,  abbr: 'Ago' }, { id: 9,  abbr: 'Sep' },
    { id: 10, abbr: 'Oct' }, { id: 11, abbr: 'Nov' }, { id: 12, abbr: 'Dic' }
];
