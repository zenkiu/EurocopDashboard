/**
 * EUROCOP ANALYTICS - GENERADOR DE INFOGRAFÍA (VERSIÓN CORREGIDA)
 */

function generateSmartInfographic() {
    const t = translations[currentLang] || translations['es'];
    
    // 1. OBTENER DATOS (Respetando todos los filtros actuales)
    // Usamos el mismo motor que updateUI
    const selYears = Array.from(document.querySelectorAll('#items-year input:checked')).map(i => Number(i.value));
    const selCats  = Array.from(document.querySelectorAll('#items-category input:checked')).map(i => i.value);
    
    let data = finalData.filter(d => {
        if (!selYears.includes(d.year) || !selCats.includes(d.cat)) return false;
        
        if (dateFilterMode === 'daymonth') {
            const f = document.getElementById('daymonth-from-input')?.value || '01/01';
            const t = document.getElementById('daymonth-to-input')?.value || '31/12';
            const from = { day: parseInt(f.split('/')[0]), month: parseInt(f.split('/')[1]) };
            const to = { day: parseInt(t.split('/')[0]), month: parseInt(t.split('/')[1]) };
            const recDM = (d.date.getMonth() + 1) * 100 + d.date.getDate();
            const fromDM = from.month * 100 + from.day;
            const toDM = to.month * 100 + to.day;
            return fromDM <= toDM ? (recDM >= fromDM && recDM <= toDM) : (recDM >= fromDM || recDM <= toDM);
        } else {
            const selMonths = Array.from(document.querySelectorAll('#items-month input:checked')).map(i => Number(i.value));
            return selMonths.includes(d.month);
        }
    });

    // --- IMPORTANTE: Aplicar Filtros Extra (Siglas/Talde) ---
    if (typeof FncMultiselect !== 'undefined') {
        data = FncMultiselect.applyFilters(data);
    }

    if (data.length === 0) {
        alert(t.hotspot_insufficient || "No hay datos para la síntesis");
        return;
    }

    document.getElementById('loading-overlay').classList.add('active');

    // 2. CÁLCULOS
    const total = data.length;
    const catCounts = {};
    data.forEach(d => { catCounts[d.cat] = (catCounts[d.cat] || 0) + 1; });
    const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
    const topCat = sortedCats[0];
    const percent = Math.round((topCat[1] / total) * 100);

    const streetCounts = {};
    data.forEach(d => { if(d.calle && d.calle !== "SIN CALLE / GPS") streetCounts[d.calle] = (streetCounts[d.calle] || 0) + 1; });
    const sortedStreets = Object.entries(streetCounts).sort((a, b) => b[1] - a[1]);

    const hourCounts = Array(24).fill(0);
    data.forEach(d => { hourCounts[d.hour]++; });
    const maxHour = hourCounts.indexOf(Math.max(...hourCounts));
    const peakTime = `${maxHour}:00 - ${maxHour+1}:00`;

    // 3. INYECTAR EN EL DOM
    const container = document.getElementById('ai-infographic-container');
    if (!container) {
        alert("Error: No se encuentra la plantilla de infografía.");
        document.getElementById('loading-overlay').classList.remove('active');
        return;
    }

    document.getElementById('info-title').innerText = `${t.info_report_title || 'Informe'} - ${total} REG.`;
    document.getElementById('info-date').innerText = new Date().toLocaleDateString();
    
    const insightText = (t.info_insight_text || "Categoría líder: {cat}")
        .replace('{archivo}', nombreArchivoSubido)
        .replace('{cat}', `<span style="color:#5e72e4">${topCat[0]}</span>`)
        .replace('{percent}', percent);
    document.getElementById('info-insight-main').innerHTML = insightText;

    document.getElementById('info-stat-total').innerText = total.toLocaleString();
    document.getElementById('info-stat-peak').innerText = peakTime;
    document.getElementById('info-stat-day').innerText = t.days_full ? t.days_full[data[0].date.getDay()] : "---";

    // Listados
    const listCat = document.getElementById('info-top-list');
    listCat.innerHTML = sortedCats.slice(0,3).map(c => `<li><span>${c[0]}</span><span>${c[1]}</span></li>`).join('');

    const listStreet = document.getElementById('info-street-list');
    listStreet.innerHTML = sortedStreets.slice(0,3).map(s => `<li><span>${s[0]}</span><span>${s[1]}</span></li>`).join('');

    // Gráfico Dominancia
    document.getElementById('info-pie-percent').innerText = `${percent}%`;
    document.getElementById('info-lbl-leader').innerText = topCat[0];
    document.getElementById('info-pie-subtext').innerText = `${topCat[1]} vs ${total - topCat[1]}`;
    
    const circle = document.getElementById('svg-pie-progress');
    if (circle) {
        const circum = 2 * Math.PI * 54;
        circle.style.strokeDashoffset = circum - (percent / 100) * circum;
    }

    // 4. METEOROLOGÍA (solo en vista Diario con meteoData)
    if (typeof buildMeteoSintesis === 'function') buildMeteoSintesis(data);

    // 5. EXPORTAR A IMAGEN
    setTimeout(() => {
        html2canvas(container, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#f3f4f6',
            onclone: (cloned) => {
                cloned.getElementById('ai-infographic-container').style.position = 'relative';
                cloned.getElementById('ai-infographic-container').style.left = '0';
            }
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = `Sintesis_${nombreArchivoSubido}_${new Date().getTime()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).finally(() => {
            document.getElementById('loading-overlay').classList.remove('active');
        });
    }, 500);
}
// ============================================================
// ANÁLISIS METEOROLÓGICO PARA SÍNTESIS
// ============================================================

/** Helper traducción clima */
function _ct(key, fallback) {
    const t = (typeof translations !== 'undefined' && translations[currentLang]) || {};
    return t[key] || fallback;
}

/** Clasifica precipitación i18n */
function descLluvia(mm) {
    if (mm === null || mm === undefined || mm < 0.1) return null;
    if (mm < 2)   return { texto: _ct('d_lluvia_ligera',  'Lluvia ligera'),    badge: 'badge-lluvia-ligera',  icono: '🌦' };
    if (mm < 10)  return { texto: _ct('d_lluvia_mod',     'Lluvia moderada'),  badge: 'badge-lluvia-mod',     icono: '🌧' };
    if (mm < 30)  return { texto: _ct('d_lluvia_fuerte',  'Lluvia fuerte'),    badge: 'badge-lluvia-fuerte',  icono: '⛈' };
    return             { texto: _ct('d_lluvia_mfuerte', 'Lluvia muy fuerte'), badge: 'badge-lluvia-fuerte',  icono: '🌊' };
}

/** Clasifica viento i18n */
function descViento(kmh) {
    if (kmh === null || kmh === undefined || kmh < 0) return null;
    if (kmh < 20)  return { texto: _ct('d_viento_calma',   'Calma'),            badge: 'badge-normal',        icono: '🌬' };
    if (kmh < 40)  return { texto: _ct('d_viento_brisa',   'Brisa moderada'),   badge: 'badge-viento-mod',    icono: '💨' };
    if (kmh < 60)  return { texto: _ct('d_viento_fuerte',  'Viento fuerte'),    badge: 'badge-viento-fuerte', icono: '💨' };
    return              { texto: _ct('d_viento_mfuerte', 'Viento muy fuerte'), badge: 'badge-viento-fuerte', icono: '🌀' };
}

/** Clasifica temperatura i18n */
function descTemperatura(c) {
    if (c === null || c === undefined) return null;
    if (c < 0)   return { texto: _ct('d_temp_helada',    'Helada'),       badge: 'badge-frio',   icono: '🥶' };
    if (c < 8)   return { texto: _ct('d_temp_frio',      'Frío'),         badge: 'badge-frio',   icono: '❄' };
    if (c < 18)  return { texto: _ct('d_temp_fresco',    'Fresco'),       badge: 'badge-normal', icono: '🌤' };
    if (c < 28)  return { texto: _ct('d_temp_agradable', 'Agradable'),    badge: 'badge-normal', icono: '☀' };
    if (c < 35)  return { texto: _ct('d_temp_calor',     'Calor'),        badge: 'badge-calor',  icono: '🌡' };
    return            { texto: _ct('d_temp_extremo',   'Calor extremo'), badge: 'badge-calor',  icono: '🔥' };
}

/** Clasifica nieve i18n */
function descNieve(cm) {
    if (cm === null || cm === undefined || cm < 0.1) return null;
    if (cm < 2)  return { texto: _ct('d_nieve_ligera', 'Nevada ligera'),   badge: 'badge-nieve', icono: '🌨' };
    if (cm < 10) return { texto: _ct('d_nieve_mod',    'Nevada moderada'), badge: 'badge-nieve', icono: '❄' };
    return            { texto: _ct('d_nieve_intensa', 'Nevada intensa'),   badge: 'badge-nieve', icono: '🌨' };
}

/** Genera el bloque HTML de meteorología en la síntesis */
function buildMeteoSintesis(data) {
    const t   = (typeof translations !== 'undefined' && translations[currentLang]) || {};
    const card = document.getElementById('info-meteo-card');
    const body = document.getElementById('info-meteo-body');
    if (!card || !body) return;

    if (temporalView !== 'daily' || !meteoEnabled || !meteoData || Object.keys(meteoData).length === 0) {
        card.style.display = 'none';
        return;
    }

    // ── CALCULAR ESTADÍSTICAS DEL PERÍODO ──
    const periodDays = [...new Set(data.map(d => {
        const dd = String(d.date.getDate()).padStart(2,'0');
        const mm = String(d.date.getMonth()+1).padStart(2,'0');
        const yy = String(d.date.getFullYear()).slice(-2);
        return `${dd}/${mm}/${yy}`;
    }))];

    let totalPrecip = 0, maxViento = 0, sumTemp = 0, totalNieve = 0;
    let diasLluvia = 0, diasVientoFuerte = 0, diasNieve = 0, countTemp = 0;
    let tempMin = Infinity, tempMax = -Infinity;

    const incByDay = {};
    data.forEach(d => {
        const dd = String(d.date.getDate()).padStart(2,'0');
        const mm = String(d.date.getMonth()+1).padStart(2,'0');
        const yy = String(d.date.getFullYear()).slice(-2);
        const key = `${dd}/${mm}/${yy}`;
        incByDay[key] = (incByDay[key] || 0) + 1;
    });

    periodDays.forEach(key => {
        const m = meteoData[key];
        if (!m) return;
        if (m.precip > 0.1) { totalPrecip += m.precip; diasLluvia++; }
        if (m.wind > maxViento) maxViento = m.wind;
        if (m.wind > 40) diasVientoFuerte++;
        if (m.snow > 0.1) { totalNieve += m.snow; diasNieve++; }
        if (m.tempMax !== null) { sumTemp += m.tempMax; countTemp++; if(m.tempMax > tempMax) tempMax = m.tempMax; }
        if (m.tempMin !== null && m.tempMin < tempMin) tempMin = m.tempMin;
    });

    const tempMedia = countTemp > 0 ? (sumTemp / countTemp) : null;

    // ── CORRELACIÓN ──
    const topDays = Object.entries(incByDay).sort((a,b) => b[1]-a[1]).slice(0, 3);
    const correlaciones = topDays.map(([day, count]) => {
        const m = meteoData[day];
        if (!m) return null;
        const factores = [];
        if (m.precip > 0.1) factores.push(descLluvia(m.precip)?.texto);
        if (m.wind > 40)    factores.push(descViento(m.wind)?.texto);
        if (m.snow > 0.1)   factores.push(descNieve(m.snow)?.texto);
        if (m.tempMax > 30) factores.push(_ct('d_temp_extremo', 'Calor extremo'));
        if (m.tempMax < 5)  factores.push(_ct('d_temp_frio', 'Frío intenso'));
        return { day, count, factores, m };
    }).filter(Boolean);

    // ── TEXTO NARRATIVO i18n ──
    const partes = [];
    if (diasLluvia > 0)
        partes.push((t.clima_period_days || '{n} día(s) con precipitación ({mm} mm)')
            .replace('{n}', diasLluvia).replace('{mm}', totalPrecip.toFixed(1)));
    if (diasVientoFuerte > 0)
        partes.push((t.clima_period_wind || 'viento fuerte en {n} día(s) (máx. {kmh} km/h)')
            .replace('{n}', diasVientoFuerte).replace('{kmh}', maxViento.toFixed(0)));
    if (diasNieve > 0)
        partes.push((t.clima_period_snow || 'nevada en {n} día(s) ({cm} cm)')
            .replace('{n}', diasNieve).replace('{cm}', totalNieve.toFixed(1)));
    if (tempMedia !== null)
        partes.push((t.clima_period_temp || 'temperatura media {c}°C')
            .replace('{c}', tempMedia.toFixed(1)));

    const prefix = t.clima_period_prefix || 'El período analizado registró';
    const narrativa = partes.length > 0
        ? `${prefix} ${partes.join(', ')}.`
        : (t.clima_period_stable || 'El período analizado presentó condiciones meteorológicas estables.');

    // ── CORRELACIÓN texto ──
    let correlText = '';
    if (correlaciones.length > 0) {
        const top = correlaciones[0];
        const factStr = top.factores.length > 0
            ? ` ${t.clima_corr_with || 'coincidiendo con'} <strong>${top.factores.join(' y ')}</strong>`
            : ` ${t.clima_corr_none || 'sin condición meteorológica adversa destacable'}`;
        correlText = `${(t.clima_corr_top || 'El día de mayor actividad fue {day} con {n} incidencias')
            .replace('{day}', `<strong>${top.day}</strong>`)
            .replace('{n}', `<strong>${top.count}</strong>`)}${factStr}. `;
        if (correlaciones[1]) {
            const t2 = correlaciones[1];
            const f2 = t2.factores.length > 0 ? ` (${t2.factores.join(', ')})` : '';
            correlText += (t.clima_corr_second || 'Le siguió {day} con {n} incidencias')
                .replace('{day}', `<strong>${t2.day}</strong>`)
                .replace('{n}', t2.count) + f2 + '.';
        }
    }

    // ── BUILD HTML ──
    const tempDesc   = descTemperatura(tempMedia);
    const lluviaDesc = diasLluvia > 0 ? descLluvia(totalPrecip / diasLluvia) : null;
    const vientoDesc = descViento(maxViento);
    const nieveDesc  = diasNieve > 0 ? descNieve(totalNieve / diasNieve) : null;
    const badge      = (d) => d ? `<span class="meteo-badge ${d.badge}">${d.icono} ${d.texto}</span>`
                                : `<span class="meteo-badge badge-normal">—</span>`;

    const topDaysTable = correlaciones.slice(0, 3).map(c => {
        const iconos = [];
        if (c.m.precip > 0.1) iconos.push(descLluvia(c.m.precip)?.icono || '🌧');
        if (c.m.wind > 40)    iconos.push('💨');
        if (c.m.snow > 0.1)   iconos.push('❄');
        if (c.m.tempMax > 30) iconos.push('🌡');
        if (c.m.tempMax < 5)  iconos.push('🥶');
        const condStr = c.factores.length > 0
            ? c.factores.join(' · ')
            : _ct('clima_no_adverse', 'Sin condición adversa');
        return `<div class="meteo-day-row">
            <span class="meteo-day-date">${c.day}</span>
            <span class="meteo-day-icons">${iconos.join(' ') || '☀'}</span>
            <span class="meteo-day-cond">${condStr}</span>
            <span class="meteo-day-count">${c.count} ${_ct('clima_inc','inc.')}</span>
        </div>`;
    }).join('');

    const minTxt = tempMin !== Infinity  ? tempMin.toFixed(1)+'°C' : '--';
    const maxTxt = tempMax !== -Infinity ? tempMax.toFixed(1)+'°C' : '--';

    body.innerHTML = `
        <!-- COL 1: Narrativa + Top días -->
        <div>
            <p class="meteo-summary-text">${narrativa}</p>
            ${correlText ? `<p style="font-size:0.78rem; color:rgba(255,255,255,0.75); line-height:1.5; margin:0 0 8px 0;">${correlText}</p>` : ''}
            ${topDaysTable ? `<div class="meteo-days-table">${topDaysTable}</div>` : ''}
        </div>

        <!-- COL 2: Temperatura + Precipitación -->
        <div class="meteo-stat-group">
            <div class="meteo-stat-mini">
                <span class="meteo-mini-icon">🌡</span>
                <div>
                    <div class="meteo-mini-label">${_ct('clima_stat_temp','TEMPERATURA MEDIA')}</div>
                    <div class="meteo-mini-value">${tempMedia !== null ? tempMedia.toFixed(1)+'°C' : '--'}</div>
                    <div class="meteo-mini-range">Min ${minTxt} / Max ${maxTxt}</div>
                    ${badge(tempDesc)}
                </div>
            </div>
            <div class="meteo-stat-mini">
                <span class="meteo-mini-icon">🌧</span>
                <div>
                    <div class="meteo-mini-label">${_ct('clima_stat_precip','PRECIPITACIÓN TOTAL')}</div>
                    <div class="meteo-mini-value">${totalPrecip.toFixed(1)} mm</div>
                    <div class="meteo-mini-range">${(_ct('clima_days_rain','{n} día(s) con lluvia')).replace('{n}', diasLluvia)}</div>
                    ${badge(lluviaDesc)}
                </div>
            </div>
        </div>

        <!-- COL 3: Viento + Nieve -->
        <div class="meteo-stat-group">
            <div class="meteo-stat-mini">
                <span class="meteo-mini-icon">💨</span>
                <div>
                    <div class="meteo-mini-label">${_ct('clima_stat_wind','VIENTO MÁXIMO')}</div>
                    <div class="meteo-mini-value">${maxViento.toFixed(0)} km/h</div>
                    <div class="meteo-mini-range">${(_ct('clima_days_wind','{n} día(s) viento fuerte')).replace('{n}', diasVientoFuerte)}</div>
                    ${badge(vientoDesc)}
                </div>
            </div>
            <div class="meteo-stat-mini">
                <span class="meteo-mini-icon">❄</span>
                <div>
                    <div class="meteo-mini-label">${_ct('clima_stat_snow','NIEVE ACUMULADA')}</div>
                    <div class="meteo-mini-value">${totalNieve > 0 ? totalNieve.toFixed(1)+' cm' : '0 cm'}</div>
                    <div class="meteo-mini-range">${(_ct('clima_days_snow','{n} día(s) con nieve')).replace('{n}', diasNieve)}</div>
                    ${badge(nieveDesc)}
                </div>
            </div>
            <div style="font-size:0.68rem; color:rgba(255,255,255,0.4); margin-top:auto; padding-top:8px; border-top:1px solid rgba(255,255,255,0.1);">
                📅 ${(_ct('clima_footer','{n} días analizados · Open-Meteo API')).replace('{n}', periodDays.length)}
            </div>
        </div>
    `;

    card.style.display = 'flex';
    card.style.flexDirection = 'column';
}
