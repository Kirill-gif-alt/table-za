let allData = [];
let salesMap = {};
let groupedData = {};
let currentFlight = null;

const DATA_FILE = "./krasavia-data.json";

// Обычные рейсы
const NORMAL_FLIGHTS = new Set([
    203,204,209,210,211,212,213,214,215,216,
    225,226,247,248,249,250
]);

function cleanFlight(str) {
    let f = String(str || '').trim().toUpperCase();
    f = f.replace(/[^KV0-9-]/g, '');
    return f.substring(0, 6);
}

function isNormalFlight(flight) {
    let num = parseInt(flight.replace('KV-', '')) || 0;
    if (num >= 100 && num <= 199) return true;   // все 1xx — обычные
    return NORMAL_FLIGHTS.has(num);
}

function processData() {
    groupedData = {};

    // Сначала собираем карту: маршрут → baseFlight (только для обычных рейсов)
    const routeToBase = new Map();

    allData.forEach(row => {
        if (row.length < 7) return;
        const flight = cleanFlight(row[0]);
        const route = (row[3] || '').trim();

        if (isNormalFlight(flight)) {
            if (!groupedData[flight]) groupedData[flight] = [];
            groupedData[flight].push(row);

            // Запоминаем маршрут → обычный рейс
            if (route) routeToBase.set(route, flight);
        }
    });

    // Теперь обрабатываем доп.рейсы
    allData.forEach(row => {
        if (row.length < 7) return;
        const flight = cleanFlight(row[0]);
        const route = (row[3] || '').trim();

        if (isNormalFlight(flight)) return; // уже обработали

        // Это доп.рейс — ищем обычный рейс с таким же маршрутом
        let baseFlight = routeToBase.get(route);

        if (!baseFlight) {
            // Если не нашли по маршруту — fallback (можно убрать позже)
            let num = parseInt(flight.replace('KV-', '')) || 0;
            if (num >= 300 && num <= 499) baseFlight = `KV-${num - 200}`;
            else baseFlight = flight;
        }

        if (!groupedData[baseFlight]) groupedData[baseFlight] = [];
        groupedData[baseFlight].push(row);
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
        const occupancy = totalAU > 0 ? Math.round((freeSeg / totalAU) * 100) : 0;
        const key = `${date}|${cleanFlight(row[0])}`;
        const sales = salesMap[key] || {today:0, yesterday:0};
        const isExtra = !isNormalFlight(cleanFlight(row[0]));
        const occClass = occupancy >= 75 ? 'occupancy-high' : (occupancy >= 45 ? 'occupancy-med' : 'occupancy-low');

        html += `<tr class="${isExtra ? 'extra-flight' : ''}">
            <td>${date} ${isExtra ? '<span class="extra-badge ml-2">(ДОП)</span>' : ''}</td>
            <td class="text-right font-semibold">${totalAU}</td>
            <td class="text-right font-semibold">${freeSeg}</td>
            <td class="text-right font-semibold">${sales.today}</td>
            <td class="text-right font-semibold">${sales.yesterday}</td>
            <td class="text-right font-bold ${occClass}">${occupancy}%</td>
        </tr>`;
    });

    html += `</tbody></table>`;
    document.getElementById('table-container').innerHTML = html;
    document.getElementById('table-container').classList.remove('hidden');
}

// Остальные функции (parseDate, normalizeDate, triggerAvailabilityUpload и т.д.) оставь как были раньше
// (я не стал их копировать сюда, чтобы не было дублирования)

function parseDate(dateStr) {
    if (!dateStr) return new Date(0);
    const [day, month, year] = dateStr.split('.').map(Number);
    return new Date(year, month - 1, day);
}

function refreshData() { location.reload(); }

window.onload = () => {
    loadSavedData();
};
