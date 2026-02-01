/**
 * EUROCOP ANALYTICS - GENERADOR DE INFOGRAFÍA (Smart Brief)
 * Calcula estadísticas sobre los datos filtrados actuales,
 * rellena el contenedor #ai-infographic-container y lo exporta como PNG.
 */

function generateSmartInfographic() {
    const t = translations[currentLang];
    if (!t) return;

    // 1. RECOPILAR DATOS FILTRADOS ACTUALES (replica la lógica de updateUI)
    const selYears = Array.from(document.querySelectorAll('#items-year input:checked')).map(i => Number(i.value));
    const selCats  = Array.from(document.querySelectorAll('#items-category input:checked')).map(i => i.value);
    let data;

    if (dateFilterMode === 'daymonth') {
        const dayMonthFromInput = document.getElementById('daymonth-from-input');
        const dayMonthToInput   = document.getElementById('daymonth-to-input');
        const dayMonthFrom = dayMonthFromInput && dayMonthFromInput.value ? dayMonthFromInput.value : '01/01';
        const dayMonthTo   = dayMonthToInput   && dayMonthToInput.value   ? dayMonthToInput.value   : '31/12';

        const parsesDayMonth = (dmString) => {
            const parts = dmString.split('/');
            return { day: parseInt(parts[0]), month: parseInt(parts[1]) };
        };
        const from = parsesDayMonth(dayMonthFrom);
        const to   = parsesDayMonth(dayMonthTo);

        data = finalData.filter(d => {
            if (!selYears.includes(d.year) || !selCats.includes(d.cat)) return false;
            const recordDM = (d.date.getMonth() + 1) * 100 + d.date.getDate();
            const fromDM   = from.month * 100 + from.day;
            const toDM     = to.month * 100 + to.day;
            if (fromDM <= toDM) return recordDM >= fromDM && recordDM <= toDM;
            else                return recordDM >= fromDM || recordDM <= toDM;
        });
    } else {
        const selMonths = Array.from(document.querySelectorAll('#items-month input:checked')).map(i => Number(i.value));
        data = finalData.filter(d =>
            selYears.includes(d.year) &&
            selMonths.includes(d.month) &&
            selCats.includes(d.cat)
        );
    }

    // Aplicar filtro espacial si está activo
    if (typeof applySpatialFilter === 'function') data = applySpatialFilter(data);

    if (data.length === 0) {
        alert(currentLang === 'eu' ? "Ez dago daturik" : "No hay datos para la síntesis");
        return;
    }

    document.getElementById('loading-overlay').classList.add('active');

    // 2. CÁLCULOS ESTADÍSTICOS
    const total = data.length;

    // 2.1 Categorías
    const catCounts = {};
    data.forEach(d => {
        const cleanCat = cleanCategoryName(d.cat);
        catCounts[cleanCat] = (catCounts[cleanCat] || 0) + 1;
    });
    const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
    const topCatName = sortedCats.length > 0 ? sortedCats[0][0] : "N/A";
    const topCatVal  = sortedCats.length > 0 ? sortedCats[0][1] : 0;
    const percent    = total > 0 ? Math.round((topCatVal / total) * 100) : 0;

    // 2.2 Ubicaciones (calles, excluyendo "SIN CALLE / GPS")
    const streetCounts = {};
    data.forEach(d => {
        if (d.calle && d.calle !== "SIN CALLE / GPS") {
            streetCounts[d.calle] = (streetCounts[d.calle] || 0) + 1;
        }
    });
    const sortedStreets = Object.entries(streetCounts).sort((a, b) => b[1] - a[1]);

    // 2.3 Tiempos (horas y días)
    const hourCounts = Array(24).fill(0);
    data.forEach(d => { hourCounts[d.hour]++; });
    const maxHourIdx = hourCounts.indexOf(Math.max(...hourCounts));
    const peakTime   = `${String(maxHourIdx).padStart(2, '0')}:00 - ${String(maxHourIdx + 1).padStart(2, '0')}:00`;

    const dayCounts = Array(7).fill(0);
    data.forEach(d => { dayCounts[d.date.getDay()]++; });
    const maxDayIdx  = dayCounts.indexOf(Math.max(...dayCounts));
    const busiestDay = t.days_full ? t.days_full[maxDayIdx] : "---";

    // 3. FUNCIÓN AUXILIAR PARA INYECTAR DATOS EN EL DOM
    const setSafeInner = (id, value, isHTML = false) => {
        const el = document.getElementById(id);
        if (el) { if (isHTML) el.innerHTML = value; else el.innerText = value; }
    };

    // 4. RELLENAR TEXTOS CABECERA Y KPIs
    let titlePeriod;
    if (dateFilterMode === 'daymonth') {
        const dayMonthFrom = document.getElementById('daymonth-from-input')?.value || '01/01';
        const dayMonthTo   = document.getElementById('daymonth-to-input')?.value   || '31/12';
        const yearsText = selYears.length > 2
            ? (currentLang === 'eu' ? "Anitzak" : "Multi-año")
            : selYears.join(', ');
        titlePeriod = `${yearsText} (${dayMonthFrom} - ${dayMonthTo})`;
    } else {
        titlePeriod = selYears.length > 2
            ? (currentLang === 'eu' ? "Anitzak" : "Multi-Periodo")
            : selYears.join(', ');
    }

    setSafeInner('info-title', `${t.info_report_title || 'Informe'} ${titlePeriod}`);
    setSafeInner('info-date', new Date().toLocaleDateString());

    const insightHTML = (t.info_insight_text || "Categoría: {cat} ({percent}%)")
        .replace('{archivo}',  `${truncateText(nombreArchivoSubido, 40)}`)
        .replace('{cat}',      `<span style="color:#ffd600">${truncateText(topCatName, 60)}</span>`)
        .replace('{percent}',  percent);
    setSafeInner('info-insight-main', insightHTML, true);

    setSafeInner('info-stat-total', total.toLocaleString());
    setSafeInner('info-stat-peak',  peakTime);
    setSafeInner('info-stat-day',   busiestDay);

    // 5. TENDENCIA Y CALLES
    let trendText = t.info_trend_night;
    if (maxHourIdx >= 6  && maxHourIdx < 14) trendText = t.info_trend_morning;
    else if (maxHourIdx >= 14 && maxHourIdx < 22) trendText = t.info_trend_afternoon;

    if (sortedStreets.length > 0) {
        trendText += " " + t.info_street_insight.replace('{street}', sortedStreets[0][0]);
    }
    setSafeInner('info-text-trend', trendText);

    // 6. RELLENAR LISTADOS (TOP 3)

    // 6.1 Categorías
    const listCatContainer = document.getElementById('info-top-list');
    if (listCatContainer) {
        listCatContainer.innerHTML = '';
        sortedCats.slice(0, 3).forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${truncateText(item[0], 45)}</span> <span>${item[1].toLocaleString()}</span>`;
            listCatContainer.appendChild(li);
        });
    }

    // 6.2 Ubicaciones críticas
    const streetListContainer = document.getElementById('info-street-list');
    if (streetListContainer) {
        streetListContainer.innerHTML = '';
        const topStreets = sortedStreets.slice(0, 3);

        if (topStreets.length > 0) {
            topStreets.forEach(item => {
                const li = document.createElement('li');
                li.style.cssText = "display:flex; justify-content:space-between; border-bottom:1px solid #f3f4f6; padding-bottom:5px; margin-bottom:8px; color:#374151;";
                li.innerHTML = `<span style="text-align:left; flex:1;">${truncateText(item[0], 45)}</span> <span style="font-weight:800; margin-left:10px;">${item[1]}</span>`;
                streetListContainer.appendChild(li);
            });
        } else {
            const noDataMessages = { es: "Sin datos de vía", eu: "Ez dago kale daturik", gl: "Sen datos de vía", ca: "Sense dades de via" };
            const li = document.createElement('li');
            li.style.cssText = "display:block; text-align:center; color:#9ca3af; font-style:italic; padding:10px 0;";
            li.innerText = noDataMessages[currentLang] || "Sin datos de vía";
            streetListContainer.appendChild(li);
        }
    }

    // 7. GRÁFICO CIRCULAR (DOMINANCIA)
    setSafeInner('info-pie-percent', `${percent}%`);
    const circle = document.getElementById('svg-pie-progress');
    if (circle) {
        const radius        = circle.r.baseVal.value;
        const circumference = 2 * Math.PI * radius;
        const offset        = circumference - (percent / 100) * circumference;
        circle.style.strokeDasharray  = circumference;
        circle.style.strokeDashoffset = offset;
    }
    setSafeInner('info-lbl-leader', truncateText(topCatName, 40));

    const restLabels = { es: 'Resto', eu: 'Gainerakoak', ca: 'Resta', gl: 'Resto' };
    setSafeInner('info-lbl-resto',    restLabels[currentLang] || 'Resto');
    setSafeInner('info-pie-subtext',  `${topCatVal.toLocaleString()} vs ${(total - topCatVal).toLocaleString()}`);

    // Aplicar i18n a etiquetas estáticas dentro del contenedor
    document.querySelectorAll('#ai-infographic-container [data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.textContent = t[key];
    });

    // 8. EXPORTACIÓN A IMAGEN (html2canvas)
    const container = document.getElementById('ai-infographic-container');
    setTimeout(() => {
        const contentHeight = container.scrollHeight;
        html2canvas(container, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#f3f4f6',
            width: 800,
            height: contentHeight,
            windowWidth: 800,
            windowHeight: contentHeight,
            onclone: (clonedDoc) => {
                const clonedEl = clonedDoc.getElementById('ai-infographic-container');
                clonedEl.style.display  = 'flex';
                clonedEl.style.position = 'relative';
                clonedEl.style.left     = '0';
                clonedEl.style.height   = 'auto';
            }
        }).then(canvas => {
            const link = document.createElement('a');
            const fileNamePrefix = { es: 'Sintesis', eu: 'Sintesia', ca: 'Sintesi', gl: 'Sintese' }[currentLang];
            link.download = `Eurocop_${fileNamePrefix}_${new Date().getTime()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(err => {
            console.error("Error capturando sintesis:", err);
        }).finally(() => {
            document.getElementById('loading-overlay').classList.remove('active');
        });
    }, 800);
}
