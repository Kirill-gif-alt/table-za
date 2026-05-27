let allData = [];
let salesMap = {};
let closedFlights = new Set();
let groupedData = {};
let currentFlight = null;

const DATA_FILE = "./krasavia-data.json";

const NORMAL_FLIGHTS = new Set([203,204,209,210,211,212,213,214,215,216,225,226,247,248,249,250]);

function cleanFlight(str) {
    let f = String(str || '').trim().toUpperCase().replace(/[^0-9]/g, '');
    if (f) f = 'KV-' + f;
    return f.substring(0, 6);
}

function normalizeDate(d) {
    d = String(d || '').trim().replace(/[^0-9]/g, '');
    if (d.length === 8) {
        return `${d.slice(0,2)}.${d.slice(2,4)}.${d.slice(4)}`;
    }
    if (d.includes('.')) {
        const parts = d.split('.');
        if (parts.length === 3) return `${parts[0].padStart(2,'0')}.${parts[1].padStart(2,'0')}.${parts[2]}`;
    }
    return d;
}

function getTodayYesterday() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const format = d => `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`;
    return { today: format(today), yesterday: format(yesterday) };
}

function parseCSVLine(line) {
    const result = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"' && (i === 0 || line[i-1] !== '\\')) {
            inQuotes = !inQuotes;
            continue;
        }
        if (c === ',' && !inQuotes) {
            result.push(field.trim());
            field = '';
        } else {
            field += c;
        }
    }
    result.push(field.trim());
    return result;
}

function handleSalesUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
        const text = ev.target.result;
        const lines = text.split('\n').filter(l => l.trim());
        const rows = lines.slice(1).map(line => parseCSVLine(line));

        const dates = getTodayYesterday();
        console.log('%c📅 Сегодня:', 'color:lime;font-weight:bold', dates.today);
        console.log('%c📅 Вчера:', 'color:lime;font-weight:bold', dates.yesterday);

        salesMap = {};
        let salesCount = 0;

        rows.forEach(row => {
            if (row.length < 13) return;

            const flyDateRaw = row[7] || '';
            const reisRaw = row[12] || '';
            const dealDateRaw = row[5] || '';

            const date = normalizeDate(flyDateRaw);
            const flight = cleanFlight(reisRaw);
            if (!date || !flight) return;

            const key = `${date}|${flight}`;
            if (!salesMap[key]) salesMap[key] = {today: 0, yesterday: 0};

            const dealNorm = normalizeDate(dealDateRaw);

            if (dealNorm === dates.today) {
                salesMap[key].today++;
                salesCount++;
            } else if (dealNorm === dates.yesterday) {
                salesMap[key].yesterday++;
                salesCount++;
            }
        });

        console.log(`%c✅ ЗАГРУЖЕНО ПРОДАЖ: ${salesCount}`, 'color:lime;font-size:18px');
        console.table(salesMap);

        alert(`✅ Продажи загружены!\nСегодня: ${Object.values(salesMap).reduce((a,b)=>a+b.today,0)}\nВчера: ${Object.values(salesMap).reduce((a,b)=>a+b.yesterday,0)}`);

        if (currentFlight) selectFlight(currentFlight);
        else if (Object.keys(groupedData).length) selectFlight(Object.keys(groupedData).sort()[0]);
    };
    reader.readAsText(file, 'windows-1251');
}

function getBaseFlight(flight) {
    let num = parseInt(flight.replace('KV-', '')) || 0;
    if ([151,351,355,455].includes(num)) return 'KV-155';
    if ([152,352,356,456].includes(num)) return 'KV-156';
    if (num === 261) return 'KV-161';
    if (num === 262) return 'KV-162';
    if (num === 253) return 'KV-153';
    if (num === 254) return 'KV-154';
    if (num === 273) return 'KV-173';
    if (num === 274) return 'KV-174';
    if (num === 325) return 'KV-225';
    if (num === 326) return 'KV-226';
    if (num >= 300 && num <= 399) return `KV-${num - 200}`;
    if (num >= 400 && num <= 499) return `KV-${num - 300}`;
    return flight;
}

function processData() {
    groupedData = {};
    allData.forEach(row => {
        if (row.length < 7) return;
        let flight = cleanFlight(row[0]);
        let base = getBaseFlight(flight);
        if (!groupedData[base]) groupedData[base] = [];
        groupedData[base].push(row);
    });
    renderFlightList();
    if (Object.keys(groupedData).length > 0) selectFlight(Object.keys(groupedData).sort()[0]);
}

function renderFlightList() {
    const container = document.getElementById('flight-list');
    container.innerHTML = '';
    Object.keys(groupedData).sort().forEach(base => {
        const count = groupedData[base].length;
        const div = document.createElement('div');
        div.className = `flight-item flex items-center justify-between px-6 py-4 mx-2 rounded-2xl cursor-pointer mb-1 ${currentFlight === base ? 'active' : ''}`;
        div.innerHTML = `
            <span class="font-semibold text-lg">Рейс ${base}</span>
            <span class="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-3xl">${count}</span>
        `;
        div.onclick = () => selectFlight(base);
        container.appendChild(div);
    });
}

function selectFlight(base) {
    currentFlight = base;
    renderFlightList();

    let rows = groupedData[base] || [];
    rows.sort((a, b) => new Date(a[1].split('.').reverse().join('-')) - new Date(b[1].split('.').reverse().join('-')));

    document.getElementById('selected-flight-title').innerHTML = `Рейс <span class="font-bold">${base}</span>`;

    let todaySum = 0;
    let yesterdaySum = 0;

    let html = `<table class="w-full"><thead><tr>
        <th>Дата</th>
        <th class="text-right">ПКЗ</th>
        <th class="text-right">Загрузка</th>
        <th class="text-right">Продажи сегодня</th>
        <th class="text-right">Продажи вчера</th>
        <th class="text-right">ЗПК</th>
    </tr></thead><tbody>`;

    rows.forEach(row => {
        const date = row[1] || '-';
        const totalAU = parseInt(row[5] || 0);
        const freeSeg = parseInt(row[6] || 0);
        const originalFlight = cleanFlight(row[0]);
        const key = `${date}|${originalFlight}`;
        const sales = salesMap[key] || {today:0, yesterday:0};

        todaySum += sales.today;
        yesterdaySum += sales.yesterday;

        const isClosed = closedFlights.has(key);
        const isExtra = originalFlight !== base;
        const flightDate = new Date(date.split('.').reverse().join('-'));
        const isFlew = flightDate < new Date(new Date().setHours(0,0,0,0));

        let rowClass = '';
        let statusHTML = '';

        if (isClosed || isFlew) {
            rowClass = 'closed-flight'; // теперь оба серые
            statusHTML = isClosed ? `<span class="closed-text">ЗАКРЫТ</span>` : `<span class="flew-text">УЛЕТЕЛ</span>`;
        } else {
            const occ = totalAU > 0 ? Math.round((freeSeg / totalAU) * 100) : 0;
            const cls = occ >= 75 ? 'occupancy-high' : (occ >= 45 ? 'occupancy-med' : 'occupancy-low');
            statusHTML = `<span class="${cls}">${occ}%</span>`;
            rowClass = isExtra ? 'extra-flight' : '';
        }

        html += `<tr class="${rowClass}">
            <td>${isExtra ? date + ' <span class="extra-badge">(ДОП)</span>' : date}</td>
            <td class="text-right font-semibold">${totalAU}</td>
            <td class="text-right font-semibold">${freeSeg}</td>
            <td class="text-right font-semibold">${sales.today}</td>
            <td class="text-right font-semibold">${sales.yesterday}</td>
            <td class="text-right font-bold">${statusHTML}</td>
        </tr>`;
    });

    // ИТОГОВАЯ СТРОКА С СУММАМИ
    html += `</tbody><tfoot><tr>
        <td class="font-bold">ИТОГО</td>
        <td></td>
        <td></td>
        <td class="text-right font-bold">${todaySum}</td>
        <td class="text-right font-bold">${yesterdaySum}</td>
        <td></td>
    </tr></tfoot></table>`;

    document.getElementById('table-container').innerHTML = html;
    document.getElementById('table-container').classList.remove('hidden');
}

// === ОСТАЛЬНЫЕ ФУНКЦИИ (без изменений) ===
function triggerAvailabilityUpload() { document.getElementById('availabilityInput').click(); }
function handleAvailabilityUpload(e) {
    const files = Array.from(e.target.files).sort((a,b)=>b.lastModified-a.lastModified).slice(0,2);
    allData = [];
    let loaded = 0;
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => {
            const lines = ev.target.result.split('\n').slice(3);
            allData = allData.concat(lines.filter(l=>l.trim()).map(l => l.split(';').map(f=>f.trim())));
            loaded++;
            if (loaded === files.length) processData();
        };
        reader.readAsText(file, 'windows-1251');
    });
}

function triggerClosedUpload() { document.getElementById('closedInput').click(); }
function handleClosedUpload(e) {
    const files = Array.from(e.target.files);
    let loaded = 0;
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => {
            const lines = ev.target.result.split('\n').slice(3);
            lines.forEach(line => {
                if (!line.trim()) return;
                const cols = line.split(';').map(f => f.trim());
                if (cols.length < 2) return;
                const flight = cleanFlight(cols[0]);
                const date = normalizeDate(cols[1]);
                if (date && flight) closedFlights.add(`${date}|${flight}`);
            });
            loaded++;
            if (loaded === files.length) {
                alert(`Загружено ${files.length} файлов закрытых рейсов`);
                if (currentFlight) selectFlight(currentFlight);
            }
        };
        reader.readAsText(file, 'windows-1251');
    });
}

function saveData() {
    const data = {allData, salesMap, closedFlights: Array.from(closedFlights), timestamp: new Date().toISOString()};
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'krasavia-data.json';
    a.click();
    alert('Данные сохранены!');
}

function refreshData() { location.reload(); }

function showTab(n) {
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
    document.getElementById('tab'+n).classList.add('active');
    document.getElementById('tab-content-0').classList.toggle('hidden', n!==0);
    document.getElementById('tab-content-1').classList.toggle('hidden', n!==1);
}

function showClosedReport() { alert('Функция отчёта по закрытым рейсам в разработке'); }
function resetClosedFilters() { }

function triggerSalesUpload() { document.getElementById('salesInput').click(); }

window.onload = () => {
    fetch(DATA_FILE + '?t=' + Date.now())
        .then(r => r.ok ? r.json() : {})
        .then(data => {
            allData = data.allData || [];
            salesMap = data.salesMap || {};
            if (data.closedFlights) closedFlights = new Set(data.closedFlights);
            processData();
        })
        .catch(() => console.log('Свежие данные загружены'));
};
