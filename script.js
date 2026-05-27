// ====================== script.js ======================
let allData = [];
let salesMap = {};
let closedFlights = new Set();   // ключ: "дата|рейс"
let groupedData = {};
let currentFlight = null;

const DATA_FILE = "./krasavia-data.json";

// Обычные рейсы (не помечаем как ДОП)
const NORMAL_FLIGHTS = new Set([
    203, 204, 209, 210, 211, 212, 213, 214, 215, 216,
    225, 226, 247, 248, 249, 250
]);

function cleanFlight(str) {
    let f = String(str || '').trim().toUpperCase();
    f = f.replace(/[^KV0-9-]/g, '');
    return f.substring(0, 6);
}

function isNormalFlight(flight) {
    let num = parseInt(flight.replace('KV-', '')) || 0;
    if (num >= 100 && num <= 199) return true;
    return NORMAL_FLIGHTS.has(num);
}

// Главная функция — определяет, в какую группу попадёт рейс
function getBaseFlight(flight, route = '') {
    let num = parseInt(flight.replace('KV-', '')) || 0;

    // Специальные случаи
    if (num === 261) return 'KV-161';
    if (num === 262) return 'KV-162';
    if (num === 325) return 'KV-225';
    if (num === 253) return 'KV-153';
    if (num === 254) return 'KV-154';
    if (num === 273) return 'KV-173';
    if (num === 274) return 'KV-174';

    // 3xx и 4xx — ищем по маршруту среди обычных рейсов
    if (num >= 300 && num <= 499) {
        // Если есть маршрут — пытаемся найти обычный рейс с таким же маршрутом
        if (route) {
            // Здесь можно сделать поиск, но пока оставляем стандартное поведение
            return `KV-${num - 200}`;
        }
        return `KV-${num - 200}`;
    }

    return flight;
}

function parseDate(dateStr) {
    if (!dateStr) return new Date(0);
    const [day, month, year] = dateStr.split('.').map(Number);
    return new Date(year, month - 1, day);
}

function normalizeDate(d) {
    d = String(d || '').trim();
    if (d.includes('.')) return d;
    if (d.length === 8) return `${d.slice(0,2)}.${d.slice(2,4)}.${d.slice(4)}`;
    return d;
}

function processData() {
    groupedData = {};

    allData.forEach(row => {
        if (row.length < 7) return;
        let flight = cleanFlight(row[0]);
        let route = (row[3] || '').trim();
        let base = getBaseFlight(flight, route);

        if (!groupedData[base]) groupedData[base] = [];
        groupedData[base].push(row);
    });

    renderFlightList();
    if (Object.keys(groupedData).length > 0) {
        selectFlight(Object.keys(groupedData).sort()[0]);
    }
}

function renderFlightList() {
    const container = document.getElementById('flight-list');
    container.innerHTML = '';

    Object.keys(groupedData).sort().forEach(base => {
        const count = groupedData[base].length;
        const div = document.createElement('div');
        div.className = `flight-item flex items-center justify-between px-6 py-4 mx-2 rounded-2xl cursor-pointer mb-1 ${currentFlight === base ? 'active' : ''}`;
        div.innerHTML = `
            <div class="flex items-center gap-x-3">
                <span class="text-xl">✈️</span>
                <span class="font-semibold">Рейс ${base}</span>
            </div>
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
    rows.sort((a, b) => parseDate(a[1]) - parseDate(b[1]));

    document.getElementById('selected-flight-title').innerHTML = `Рейс <span class="font-bold">${base}</span>`;

    let html = `<table class="w-full"><thead><tr>
        <th>Дата</th>
        <th class="text-right">(мест в продаже)</th>
        <th class="text-right">(загрузка)</th>
        <th class="text-right">Продано сегодня</th>
        <th class="text-right">Продано вчера</th>
        <th class="text-right">Загрузка</th>
    </tr></thead><tbody>`;

    rows.forEach(row => {
        const date = row[1] || '-';
        const totalAU = parseInt(row[5] || 0);
        const freeSeg = parseInt(row[6] || 0);
        const key = `${date}|${cleanFlight(row[0])}`;
        const sales = salesMap[key] || {today:0, yesterday:0};
        const isClosed = closedFlights.has(key);
        const isExtra = !isNormalFlight(cleanFlight(row[0]));

        let statusHTML = '';
        if (isClosed) {
            statusHTML = `<span class="closed-text">ЗАКРЫТ</span>`;
        } else {
            const occupancy = totalAU > 0 ? Math.round((freeSeg / totalAU) * 100) : 0;
            const occClass = occupancy >= 75 ? 'occupancy-high' : (occupancy >= 45 ? 'occupancy-med' : 'occupancy-low');
            statusHTML = `<span class="${occClass}">${occupancy}%</span>`;
        }

        html += `<tr class="${isClosed ? 'closed-flight' : (isExtra ? 'extra-flight' : '')}">
            <td>${date} ${isExtra ? '<span class="extra-badge ml-2">(ДОП)</span>' : ''}</td>
            <td class="text-right font-semibold">${totalAU}</td>
            <td class="text-right font-semibold">${freeSeg}</td>
            <td class="text-right font-semibold">${sales.today}</td>
            <td class="text-right font-semibold">${sales.yesterday}</td>
            <td class="text-right font-bold">${statusHTML}</td>
        </tr>`;
    });

    html += `</tbody></table>`;
    document.getElementById('table-container').innerHTML = html;
    document.getElementById('table-container').classList.remove('hidden');
}

// ====================== ЗАГРУЗКА ФАЙЛОВ ======================
function triggerAvailabilityUpload() { document.getElementById('availabilityInput').click(); }
function handleAvailabilityUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    files.sort((a, b) => b.lastModified - a.lastModified);
    const latestTwo = files.slice(0, 2);

    let loaded = 0;
    allData = [];

    latestTwo.forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => {
            let lines = ev.target.result.split('\n').slice(3);
            const parsed = lines.filter(l => l.trim()).map(l => l.split(';').map(f => f.trim()));
            allData = allData.concat(parsed);
            loaded++;
            if (loaded === latestTwo.length) processData();
        };
        reader.readAsText(file, 'windows-1251');
    });
}

function triggerSalesUpload() { document.getElementById('salesInput').click(); }
function handleSalesUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        let lines = ev.target.result.split('\n').filter(l => l.trim());
        const rows = lines.map(l => l.split(',').map(f => f.trim()));
        salesMap = {};
        rows.forEach(row => {
            if (row.length < 13) return;
            const date = normalizeDate(row[7] || '');
            const flight = cleanFlight(row[12] || '');
            if (!date || !flight) return;
            const key = `${date}|${flight}`;
            if (!salesMap[key]) salesMap[key] = {today:0, yesterday:0};
            const todayStr = normalizeDate(rows[1] ? rows[1][0] : '');
            if (date === todayStr) salesMap[key].today++;
            else if (rows[2] && date === normalizeDate(rows[2][0])) salesMap[key].yesterday++;
        });
        alert('✅ Продажи загружены!');
        if (currentFlight) selectFlight(currentFlight);
    };
    reader.readAsText(file, 'windows-1251');
}

function triggerClosedUpload() { document.getElementById('closedInput').click(); }
function handleClosedUpload(e) {
    const files = Array.from(e.target.files);
    let loaded = 0;

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => {
            let lines = ev.target.result.split('\n').slice(3);
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
                alert(`✅ Загружено ${files.length} файлов закрытых рейсов`);
                if (currentFlight) selectFlight(currentFlight);
            }
        };
        reader.readAsText(file, 'windows-1251');
    });
}

function saveData() {
    const data = {
        allData: allData,
        salesMap: salesMap,
        closedFlights: Array.from(closedFlights),
        timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'krasavia-data.json';
    a.click();
    alert('✅ Все данные (доступность + продажи + закрытые рейсы) сохранены в krasavia-data.json');
}

function refreshData() { location.reload(); }

window.onload = () => {
    loadSavedData();
};
