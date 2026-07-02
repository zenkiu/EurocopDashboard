/**
 * EUROCOP ANALYTICS - GENERADOR DE INFOGRAFÍA
 * v3-10-19: Síntesis respeta lastFilteredData (todos los filtros ya aplicados)
 *           + bloque contexto de filtros activos
 *           + clima integrado en cualquier vista temporal
 */

// ============================================================
// HELPER: recoger descripción de filtros activos
// ============================================================
function _buildFiltrosContexto() {
    const t = (typeof translations !== 'undefined' && translations[currentLang]) || translations['es'] || {};

    const partes = [];

    // ── AÑOS ──
    const yearCbs  = Array.from(document.querySelectorAll('#items-year input'));
    const yearSel  = yearCbs.filter(c => c.checked).map(c => c.value);
    if (yearSel.length > 0 && yearSel.length < yearCbs.length) {
        partes.push({ icon: '📅', label: (t.filtro_anios || 'Años'), value: yearSel.join(', ') });
    } else if (yearCbs.length > 0) {
        partes.push({ icon: '📅', label: (t.filtro_anios || 'Años'), value: t.sel_all || 'TODOS' });
    }

    // ── PERÍODO / MESES ──
    if (typeof dateFilterMode !== 'undefined' && dateFilterMode === 'daymonth') {
        const fromVal = document.getElementById('daymonth-from-input')?.value || '01/01';
        const toVal   = document.getElementById('daymonth-to-input')?.value   || '31/12';
        partes.push({ icon: '📆', label: (t.filtro_periodo || 'Período'), value: `${fromVal} → ${toVal}` });
    } else {
        const mCbs  = Array.from(document.querySelectorAll('#items-month input'));
        const mSel  = mCbs.filter(c => c.checked);
        if (mSel.length > 0 && mSel.length < mCbs.length) {
            const abbr = (t.months_abbr) || [];
            const nombres = mSel.map(c => abbr[parseInt(c.value) - 1] || c.value);
            partes.push({ icon: '📆', label: (t.filtro_meses || 'Meses'), value: nombres.join(', ') });
        } else {
            partes.push({ icon: '📆', label: (t.filtro_meses || 'Meses'), value: t.sel_all || 'TODOS' });
        }
    }

    // ── CATEGORÍAS ──
    const catCbs = Array.from(document.querySelectorAll('#items-category input'));
    const catSel = catCbs.filter(c => c.checked);
    if (catSel.length > 0 && catSel.length < catCbs.length) {
        const nombres = catSel.map(c => c.value);
        const txt = nombres.length <= 3
            ? nombres.join(', ')
            : `${nombres.slice(0,3).join(', ')} +${nombres.length - 3}`;
        partes.push({ icon: '🏷', label: (t.filtro_cats || 'Categorías'), value: txt });
    } else {
        partes.push({ icon: '🏷', label: (t.filtro_cats || 'Categorías'), value: t.sel_all || 'TODOS' });
    }

    // ── TABLA HECHOS ──
    if (typeof FncTablaHechos !== 'undefined' && FncTablaHechos.isActive()) {
        partes.push({ icon: '🌳', label: (t.filtro_th || 'Árbol hechos'), value: t.filtro_activo || 'Activo' });
    }

    // ── MULTISELECT dinámico (Talde, Siglas...) ──
    if (typeof FncMultiselect !== 'undefined' && FncMultiselect.activeFilters) {
        Object.entries(FncMultiselect.activeFilters).forEach(([col, vals]) => {
            if (vals && vals.length > 0) {
                const txt = vals.length <= 3 ? vals.join(', ') : `${vals.slice(0,3).join(', ')} +${vals.length - 3}`;
                partes.push({ icon: '🔍', label: col, value: txt });
            }
        });
    }

    // ── FILTRO ESPACIAL ──
    const chkSpatial = document.getElementById('chk-spatial-filter');
    if (chkSpatial && chkSpatial.checked) {
        partes.push({ icon: '🗺', label: (t.filtro_espacial || 'Zona'), value: t.filtro_activo || 'Activo' });
    }

    // ── CLIMA ──
    if (typeof meteoEnabled !== 'undefined' && meteoEnabled && meteoData && Object.keys(meteoData).length > 0) {
        const varSel = document.getElementById('meteo-var-select');
        const varLabel = varSel ? varSel.options[varSel.selectedIndex]?.text : '—';
        partes.push({ icon: '🌤', label: (t.filtro_clima || 'Clima'), value: varLabel });
    }

    return partes;
}

// ============================================================
// HELPER: texto de vista temporal actual
// ============================================================
function _labelVistaTemporal() {
    const t = (typeof translations !== 'undefined' && translations[currentLang]) || translations['es'] || {};
    const map = {
        'year':    t.view_year    || 'Anual',
        'month':   t.view_month   || 'Mensual',
        'quarter': t.view_quarter || 'Trimestral',
        'day':     t.view_day     || 'Diario',
        'daily':   t.view_daily   || 'Diario',
    };
    const v = (typeof temporalView !== 'undefined') ? temporalView : 'year';
    return map[v] || v;
}

// ============================================================
// GENERADOR PRINCIPAL
// ============================================================
function generateSmartInfographic() {
    const t = translations[currentLang] || translations['es'];

    // 1. USAR lastFilteredData — ya tiene TODOS los filtros aplicados
    //    (año, mes, categoría, TablaHechos, Multiselect, filtro espacial)
    const data = (typeof lastFilteredData !== 'undefined' && lastFilteredData.length > 0)
        ? lastFilteredData
        : [];

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
    data.forEach(d => { if (d.calle && d.calle !== "SIN CALLE / GPS") streetCounts[d.calle] = (streetCounts[d.calle] || 0) + 1; });
    const sortedStreets = Object.entries(streetCounts).sort((a, b) => b[1] - a[1]);

    const hourCounts = Array(24).fill(0);
    data.forEach(d => { hourCounts[d.hour]++; });
    const maxHour = hourCounts.indexOf(Math.max(...hourCounts));
    const peakTime = `${maxHour}:00 - ${maxHour + 1}:00`;

    // 3. CONTENEDOR
    const container = document.getElementById('ai-infographic-container');
    if (!container) {
        alert("Error: No se encuentra la plantilla de infografía.");
        document.getElementById('loading-overlay').classList.remove('active');
        return;
    }

    // 4. CABECERA
    document.getElementById('info-title').innerText = `${t.info_report_title || 'Informe'} - ${total} REG.`;
    document.getElementById('info-date').innerText = new Date().toLocaleDateString();

    const insightText = (t.info_insight_text || "Categoría líder: {cat}")
        .replace('{archivo}', nombreArchivoSubido)
        .replace('{cat}', `<span style="color:#5e72e4">${topCat[0]}</span>`)
        .replace('{percent}', percent);
    document.getElementById('info-insight-main').innerHTML = insightText;

    // 5. BLOQUE FILTROS ACTIVOS
    const filtrosEl = document.getElementById('info-filtros-activos');
    if (filtrosEl) {
        const ctx = _buildFiltrosContexto();
        const vista = _labelVistaTemporal();
        filtrosEl.innerHTML = `
            <span class="filtro-badge filtro-vista">
                📊 ${t.filtro_vista || 'Vista'}: ${vista}
            </span>
            ${ctx.map(f => `
                <span class="filtro-badge">
                    ${f.icon} <strong>${f.label}:</strong> ${f.value}
                </span>
            `).join('')}
        `;
    }

    // 6. KPIs
    document.getElementById('info-stat-total').innerText = total.toLocaleString();
    document.getElementById('info-stat-peak').innerText = peakTime;

    // Día de la semana más frecuente (no el primero del array)
    const dowCounts = Array(7).fill(0);
    data.forEach(d => { dowCounts[d.date.getDay()]++; });
    const maxDow = dowCounts.indexOf(Math.max(...dowCounts));
    document.getElementById('info-stat-day').innerText = t.days_full ? t.days_full[maxDow] : "---";

    // 7. LISTADOS
    const listCat = document.getElementById('info-top-list');
    listCat.innerHTML = sortedCats.slice(0, 3).map(c =>
        `<li><span>${c[0]}</span><span>${c[1]}</span></li>`
    ).join('');

    const listStreet = document.getElementById('info-street-list');
    listStreet.innerHTML = sortedStreets.slice(0, 3).map(s =>
        `<li><span>${s[0]}</span><span>${s[1]}</span></li>`
    ).join('');

    // 8. GRÁFICO DOMINANCIA
    document.getElementById('info-pie-percent').innerText = `${percent}%`;
    document.getElementById('info-lbl-leader').innerText = topCat[0];
    document.getElementById('info-pie-subtext').innerText = `${topCat[1]} vs ${total - topCat[1]}`;

    const circle = document.getElementById('svg-pie-progress');
    if (circle) {
        const circum = 2 * Math.PI * 54;
        circle.style.strokeDashoffset = circum - (percent / 100) * circum;
    }

    // 9. METEOROLOGÍA
    if (typeof buildMeteoSintesis === 'function') buildMeteoSintesis(data);

    // 10. EXPORTAR A IMAGEN
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
// Funciona en cualquier temporalView si hay meteoData activo
// ============================================================

function _ct(key, fallback) {
    const t = (typeof translations !== 'undefined' && translations[currentLang]) || {};
    return t[key] || fallback;
}

function descLluvia(mm) {
    if (mm === null || mm === undefined || mm < 0.1) return null;
    if (mm < 2)   return { texto: _ct('d_lluvia_ligera',  'Lluvia ligera'),    badge: 'badge-lluvia-ligera',  icono: '🌦' };
    if (mm < 10)  return { texto: _ct('d_lluvia_mod',     'Lluvia moderada'),  badge: 'badge-lluvia-mod',     icono: '🌧' };
    if (mm < 30)  return { texto: _ct('d_lluvia_fuerte',  'Lluvia fuerte'),    badge: 'badge-lluvia-fuerte',  icono: '⛈' };
    return             { texto: _ct('d_lluvia_mfuerte', 'Lluvia muy fuerte'), badge: 'badge-lluvia-fuerte',  icono: '🌊' };
}

function descViento(kmh) {
    if (kmh === null || kmh === undefined || kmh < 0) return null;
    if (kmh < 20)  return { texto: _ct('d_viento_calma',   'Calma'),            badge: 'badge-normal',        icono: '🌬' };
    if (kmh < 40)  return { texto: _ct('d_viento_brisa',   'Brisa moderada'),   badge: 'badge-viento-mod',    icono: '💨' };
    if (kmh < 60)  return { texto: _ct('d_viento_fuerte',  'Viento fuerte'),    badge: 'badge-viento-fuerte', icono: '💨' };
    return              { texto: _ct('d_viento_mfuerte', 'Viento muy fuerte'), badge: 'badge-viento-fuerte', icono: '🌀' };
}

function descTemperatura(c) {
    if (c === null || c === undefined) return null;
    if (c < 0)   return { texto: _ct('d_temp_helada',    'Helada'),        badge: 'badge-frio',   icono: '🥶' };
    if (c < 8)   return { texto: _ct('d_temp_frio',      'Frío'),          badge: 'badge-frio',   icono: '❄' };
    if (c < 18)  return { texto: _ct('d_temp_fresco',    'Fresco'),        badge: 'badge-normal', icono: '🌤' };
    if (c < 28)  return { texto: _ct('d_temp_agradable', 'Agradable'),     badge: 'badge-normal', icono: '☀' };
    if (c < 35)  return { texto: _ct('d_temp_calor',     'Calor'),         badge: 'badge-calor',  icono: '🌡' };
    return            { texto: _ct('d_temp_extremo',   'Calor extremo'),  badge: 'badge-calor',  icono: '🔥' };
}

function descNieve(cm) {
    if (cm === null || cm === undefined || cm < 0.1) return null;
    if (cm < 2)  return { texto: _ct('d_nieve_ligera', 'Nevada ligera'),   badge: 'badge-nieve', icono: '🌨' };
    if (cm < 10) return { texto: _ct('d_nieve_mod',    'Nevada moderada'), badge: 'badge-nieve', icono: '❄' };
    return            { texto: _ct('d_nieve_intensa', 'Nevada intensa'),   badge: 'badge-nieve', icono: '🌨' };
}

function buildMeteoSintesis(data) {
    const t    = (typeof translations !== 'undefined' && translations[currentLang]) || {};
    const card = document.getElementById('info-meteo-card');
    const body = document.getElementById('info-meteo-body');
    if (!card || !body) return;

    // Mostrar si clima está activo con datos, independientemente de temporalView
    if (!meteoEnabled || !meteoData || Object.keys(meteoData).length === 0) {
        card.style.display = 'none';
        return;
    }

    // Variable de clima seleccionada en el gráfico
    const varSel  = document.getElementById('meteo-var-select');
    const varKey  = varSel ? varSel.value : 'all';
    const varLabel = varSel ? varSel.options[varSel.selectedIndex]?.text : '—';

    // ── DÍAS DEL PERÍODO ──
    const periodDays = [...new Set(data.map(d => {
        const dd = String(d.date.getDate()).padStart(2, '0');
        const mm = String(d.date.getMonth() + 1).padStart(2, '0');
        const yy = String(d.date.getFullYear()).slice(-2);
        return `${dd}/${mm}/${yy}`;
    }))];

    let totalPrecip = 0, maxViento = 0, sumTemp = 0, totalNieve = 0;
    let diasLluvia = 0, diasVientoFuerte = 0, diasNieve = 0, countTemp = 0;
    let tempMin = Infinity, tempMax = -Infinity;

    const incByDay = {};
    data.forEach(d => {
        const dd = String(d.date.getDate()).padStart(2, '0');
        const mm = String(d.date.getMonth() + 1).padStart(2, '0');
        const yy = String(d.date.getFullYear()).slice(-2);
        incByDay[`${dd}/${mm}/${yy}`] = (incByDay[`${dd}/${mm}/${yy}`] || 0) + 1;
    });

    periodDays.forEach(key => {
        const m = meteoData[key];
        if (!m) return;
        if (m.precip > 0.1) { totalPrecip += m.precip; diasLluvia++; }
        if (m.wind > maxViento) maxViento = m.wind;
        if (m.wind > 40) diasVientoFuerte++;
        if (m.snow > 0.1) { totalNieve += m.snow; diasNieve++; }
        if (m.tempMax !== null && m.tempMax !== undefined) {
            sumTemp += m.tempMax; countTemp++;
            if (m.tempMax > tempMax) tempMax = m.tempMax;
        }
        if (m.tempMin !== null && m.tempMin !== undefined && m.tempMin < tempMin) tempMin = m.tempMin;
    });

    const tempMedia = countTemp > 0 ? (sumTemp / countTemp) : null;

    // ── CORRELACIÓN: días con más incidencias ──
    const topDays = Object.entries(incByDay).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const correlaciones = topDays.map(([day, count]) => {
        const m = meteoData[day];
        if (!m) return null;
        const factores = [];
        if (m.precip > 0.1) factores.push(descLluvia(m.precip)?.texto);
        if (m.wind > 40)    factores.push(descViento(m.wind)?.texto);
        if (m.snow > 0.1)   factores.push(descNieve(m.snow)?.texto);
        if (m.tempMax > 30) factores.push(`${_ct('d_temp_extremo', 'Calor extremo')} (${m.tempMax.toFixed(1)}°C)`);
        if (m.tempMax < 5)  factores.push(`${_ct('d_temp_frio', 'Frío intenso')} (${m.tempMax.toFixed(1)}°C)`);
        return { day, count, factores, m };
    }).filter(Boolean);

    // ── TEXTO NARRATIVO ──
    const partes = [];
    if (diasLluvia > 0)
        partes.push((_ct('clima_period_days', '{n} día(s) con precipitación ({mm} mm)'))
            .replace('{n}', diasLluvia).replace('{mm}', totalPrecip.toFixed(1)));
    if (diasVientoFuerte > 0)
        partes.push((_ct('clima_period_wind', 'viento fuerte en {n} día(s) (máx. {kmh} km/h)'))
            .replace('{n}', diasVientoFuerte).replace('{kmh}', maxViento.toFixed(0)));
    if (diasNieve > 0)
        partes.push((_ct('clima_period_snow', 'nevada en {n} día(s) ({cm} cm)'))
            .replace('{n}', diasNieve).replace('{cm}', totalNieve.toFixed(1)));
    if (tempMedia !== null)
        partes.push((_ct('clima_period_temp', 'temperatura media {c}°C'))
            .replace('{c}', tempMedia.toFixed(1)));

    const prefix = _ct('clima_period_prefix', 'El período analizado registró');
    const narrativa = partes.length > 0
        ? `${prefix} ${partes.join(', ')}.`
        : _ct('clima_period_stable', 'El período analizado presentó condiciones meteorológicas estables.');

    // ── CORRELACIÓN texto ──
    let correlText = '';
    if (correlaciones.length > 0) {
        const top = correlaciones[0];
        const factStr = top.factores.length > 0
            ? ` ${_ct('clima_corr_with', 'coincidiendo con')} <strong>${top.factores.join(' y ')}</strong>`
            : ` ${_ct('clima_corr_none', 'sin condición meteorológica adversa destacable')}`;
        correlText = `${(_ct('clima_corr_top', 'El día de mayor actividad fue {day} con {n} incidencias'))
            .replace('{day}', `<strong>${top.day}</strong>`)
            .replace('{n}', `<strong>${top.count}</strong>`)}${factStr}. `;
        if (correlaciones[1]) {
            const t2 = correlaciones[1];
            const f2str = t2.factores.length > 0
                ? ` ${_ct('clima_corr_with', 'coincidiendo con')} <strong>${t2.factores.join(' y ')}</strong>`
                : '';
            correlText += (_ct('clima_corr_second', 'Le siguió {day} con {n} incidencias'))
                .replace('{day}', `<strong>${t2.day}</strong>`)
                .replace('{n}', t2.count) + f2str + '.';
        }
    }

    // ── NOTA DE VISTA TEMPORAL (aviso si no es Diario) ──
    const esVistaDiaria = (typeof temporalView !== 'undefined' && (temporalView === 'daily' || temporalView === 'day'));
    const avisoVista = !esVistaDiaria
        ? `<p style="font-size:0.7rem; color:rgba(255,255,255,0.45); margin:6px 0 0 0; font-style:italic;">
            ⚠ ${_ct('clima_aviso_vista', 'Correlación calculada sobre días individuales del período. El gráfico de clima se muestra en vista')} <strong>${_labelVistaTemporal()}</strong>.
           </p>`
        : '';

    // ── BUILD HTML ──
    const tempDesc   = descTemperatura(tempMedia);
    const lluviaDesc = diasLluvia > 0 ? descLluvia(totalPrecip / diasLluvia) : null;
    const vientoDesc = descViento(maxViento);
    const nieveDesc  = diasNieve > 0 ? descNieve(totalNieve / diasNieve) : null;
    const badge = (d) => d
        ? `<span class="meteo-badge ${d.badge}">${d.icono} ${d.texto}</span>`
        : `<span class="meteo-badge badge-normal">—</span>`;

    const topDaysTable = correlaciones.slice(0, 3).map(c => {
        const iconos = [];
        if (c.m.precip > 0.1) iconos.push(descLluvia(c.m.precip)?.icono || '🌧');
        if (c.m.wind > 40)    iconos.push('💨');
        if (c.m.snow > 0.1)   iconos.push('❄');
        if (c.m.tempMax > 30) iconos.push(`🌡${c.m.tempMax.toFixed(1)}°C`);
        if (c.m.tempMax < 5)  iconos.push(`🥶${c.m.tempMax.toFixed(1)}°C`);
        const condStr = c.factores.length > 0
            ? c.factores.join(' · ')
            : _ct('clima_no_adverse', 'Sin condición adversa');
        return `<div class="meteo-day-row">
            <span class="meteo-day-date">${c.day}</span>
            <span class="meteo-day-icons">${iconos.join(' ') || '☀'}</span>
            <span class="meteo-day-cond">${condStr}</span>
            <span class="meteo-day-count">${c.count} ${_ct('clima_inc', 'inc.')}</span>
        </div>`;
    }).join('');

    const minTxt = tempMin !== Infinity  ? tempMin.toFixed(1) + '°C' : '--';
    const maxTxt = tempMax !== -Infinity ? tempMax.toFixed(1) + '°C' : '--';

    body.innerHTML = `
        <!-- COL 1: Narrativa + variable activa + Top días -->
        <div>
            <div style="margin-bottom:6px;">
                <span class="meteo-badge badge-normal" style="font-size:0.68rem;">
                    📊 ${_ct('clima_var_activa', 'Variable en gráfico')}: <strong>${varLabel}</strong>
                </span>
            </div>
            <p class="meteo-summary-text">${narrativa}</p>
            ${correlText ? `<p style="font-size:0.78rem; color:rgba(255,255,255,0.75); line-height:1.5; margin:0 0 8px 0;">${correlText}</p>` : ''}
            ${topDaysTable ? `<div class="meteo-days-table">${topDaysTable}</div>` : ''}
            ${avisoVista}
        </div>

        <!-- COL 2: Temperatura + Precipitación -->
        <div class="meteo-stat-group">
            <div class="meteo-stat-mini">
                <span class="meteo-mini-icon">🌡</span>
                <div>
                    <div class="meteo-mini-label">${_ct('clima_stat_temp', 'TEMPERATURA MEDIA')}</div>
                    <div class="meteo-mini-value">${tempMedia !== null ? tempMedia.toFixed(1) + '°C' : '--'}</div>
                    <div class="meteo-mini-range">Min ${minTxt} / Max ${maxTxt}</div>
                    ${badge(tempDesc)}
                </div>
            </div>
            <div class="meteo-stat-mini">
                <span class="meteo-mini-icon">🌧</span>
                <div>
                    <div class="meteo-mini-label">${_ct('clima_stat_precip', 'PRECIPITACIÓN TOTAL')}</div>
                    <div class="meteo-mini-value">${totalPrecip.toFixed(1)} mm</div>
                    <div class="meteo-mini-range">${(_ct('clima_days_rain', '{n} día(s) con lluvia')).replace('{n}', diasLluvia)}</div>
                    ${badge(lluviaDesc)}
                </div>
            </div>
        </div>

        <!-- COL 3: Viento + Nieve -->
        <div class="meteo-stat-group">
            <div class="meteo-stat-mini">
                <span class="meteo-mini-icon">💨</span>
                <div>
                    <div class="meteo-mini-label">${_ct('clima_stat_wind', 'VIENTO MÁXIMO')}</div>
                    <div class="meteo-mini-value">${maxViento.toFixed(0)} km/h</div>
                    <div class="meteo-mini-range">${(_ct('clima_days_wind', '{n} día(s) viento fuerte')).replace('{n}', diasVientoFuerte)}</div>
                    ${badge(vientoDesc)}
                </div>
            </div>
            <div class="meteo-stat-mini">
                <span class="meteo-mini-icon">❄</span>
                <div>
                    <div class="meteo-mini-label">${_ct('clima_stat_snow', 'NIEVE ACUMULADA')}</div>
                    <div class="meteo-mini-value">${totalNieve > 0 ? totalNieve.toFixed(1) + ' cm' : '0 cm'}</div>
                    <div class="meteo-mini-range">${(_ct('clima_days_snow', '{n} día(s) con nieve')).replace('{n}', diasNieve)}</div>
                    ${badge(nieveDesc)}
                </div>
            </div>
            <div style="font-size:0.68rem; color:rgba(255,255,255,0.4); margin-top:auto; padding-top:8px; border-top:1px solid rgba(255,255,255,0.1);">
                📅 ${(_ct('clima_footer', '{n} días analizados · Open-Meteo API')).replace('{n}', periodDays.length)}
            </div>
        </div>
    `;

    card.style.display = 'flex';
    card.style.flexDirection = 'column';
}
