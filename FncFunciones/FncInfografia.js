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

    // 4. EXPORTAR A IMAGEN
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