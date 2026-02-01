/**
 * EUROCOP ANALYTICS - GEOLOCALIZACIÓN
 * Reverse geocoding del centroide de los datos filtrados
 * usando la API gratuita de BigDataCloud.
 * Incluye protección contra colapso (una petición a la vez + timeout de 3s).
 */

async function updateLocationKPI(data) {
    const el = document.getElementById('kpi-location');
    if (!el) return;

    // Sin datos → resetear
    if (!data || data.length === 0) {
        el.innerText = "Sin Datos";
        return;
    }

    // Si hay localidad manual, usarla directamente (sin llamar a la API)
    if (data[0].locManual && data[0].locManual !== "") {
        el.innerText = data[0].locManual.toUpperCase();
        return;
    }

    // Filtrar datos con coordenadas
    const dataConGeo = data.filter(d => d.hasGeo);
    if (dataConGeo.length === 0) {
        el.innerText = "Sin Ubicación GPS";
        return;
    }

    // Calcular centroide
    let totalLat = 0, totalLon = 0;
    dataConGeo.forEach(d => { totalLat += d.lat; totalLon += d.lon; });
    const centerLat = totalLat / dataConGeo.length;
    const centerLon = totalLon / dataConGeo.length;

    // Mostrar coordenadas temporalmente (fallback si la API falla)
    el.innerText = `${centerLat.toFixed(3)}, ${centerLon.toFixed(3)}`;

    // BLOQUEO: evitar colapso con múltiples peticiones simultáneas
    if (isGeocodingActive) return;
    isGeocodingActive = true;

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 3000); // 3s timeout

    try {
        const langCode = currentLang === 'eu' ? 'eu' : (currentLang === 'ca' ? 'ca' : 'es');
        const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${centerLat}&longitude=${centerLon}&localityLanguage=${langCode}`;

        const res = await fetch(url, { signal: controller.signal });

        if (res.ok) {
            const json = await res.json();
            const lugar = json.locality || json.city || json.principalSubdivision;
            if (lugar) el.innerText = lugar.toUpperCase();
        }
    } catch (er) {
        // Error silencioso: nos quedamos con las coordenadas como fallback
    } finally {
        clearTimeout(timeoutId);
        // Liberar el bloqueo tras 1s para no saturar
        setTimeout(() => { isGeocodingActive = false; }, 1000);
    }
}
