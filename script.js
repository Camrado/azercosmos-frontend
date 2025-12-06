// --- CONFIG ---
const API_URL = "https://azercosmos-back-production.up.railway.app";
const API_ENDPOINTS = {
    leaks: `${API_URL}/api/leaks`,
    ws: `${API_URL}/ws`,
    leakStatus: (id) => `${API_URL}/api/leaks/${id}/status`
};

// --- MOCK DATA (Fallback) ---
const MOCK_LEAKS = [
    {
        id: "LK-2023-001",
        date: "2023-10-25",
        locationName: "Shah Deniz Field (Offshore)",
        coordinates: [
            [40.012, 50.200], [40.012, 50.250], [39.980, 50.250], [39.980, 50.200]
        ],
        severity: "High", status: "New", detectedBy: "Sentinel-5P"
    },
    {
        id: "LK-2023-002",
        date: "2023-10-25",
        locationName: "Sangachal Terminal (Onshore)",
        coordinates: [
            [40.185, 49.460], [40.190, 49.490], [40.170, 49.490], [40.165, 49.460]
        ],
        severity: "Medium", status: "New", detectedBy: "GHGSat-C1"
    },
    {
        id: "LK-2023-10-24-01",
        date: "2023-10-24",
        locationName: "Neft Daşları (Oil Rocks)",
        coordinates: [
            [40.250, 50.840], [40.260, 50.870], [40.230, 50.870], [40.220, 50.840]
        ],
        severity: "High", status: "Verified", detectedBy: "Sentinel-2"
    },
    {
        id: "LK-2023-10-26-01",
        date: "2023-10-26",
        locationName: "Baku Absheron Coast",
        coordinates: [
            [40.350, 49.880], [40.360, 49.920], [40.340, 49.920], [40.330, 49.880]
        ],
        severity: "Medium", status: "False Positive", detectedBy: "Drone-X"
    }
];

// --- STATE MANAGEMENT ---
const state = {
    selectedDate: null, // Will be set to latest date from API
    currentLeaks: [],
    allLeaks: [], // Store all fetched leaks
    // Filter State
    searchQuery: "",
    severityFilters: ["High", "Medium", "Low"],
    // Map Stuff
    map: null,
    leakLayer: null,
    availableDates: [],
    // Runtime
    stompClient: null
};

// --- DOM ELEMENTS ---
const getElements = () => ({
    dateList: document.getElementById('date-list'),
    dateTrigger: document.getElementById('date-dropdown-trigger'),
    customSelect: document.getElementById('custom-select'),
    searchInput: document.getElementById('search-input'),
    filterCheckboxes: document.querySelectorAll('.filter-severity'),
    totalLeaks: document.getElementById('total-leaks-count'),
    pending: document.getElementById('pending-count'),
    alertList: document.getElementById('alert-list'),
    overlay: document.getElementById('action-panel-overlay'),
    closePanel: document.getElementById('close-panel'),
    panelTitle: document.getElementById('panel-title'),
    detailId: document.getElementById('detail-id'),
    detailDate: document.getElementById('detail-date'),
    detailSeverity: document.getElementById('detail-severity'),
    detailSource: document.getElementById('detail-source'),
    detailStatus: document.getElementById('detail-status'),
    btnDispatch: document.getElementById('btn-dispatch'),
    btnFeedback: document.getElementById('btn-feedback'),
    feedbackSelect: document.getElementById('feedback-select'),
    btnAnalytics: document.getElementById('btn-analytics'),
    btnExport: document.getElementById('btn-export'),
    analyticsModal: document.getElementById('analytics-modal'),
    closeAnalytics: document.getElementById('close-analytics'),
    chartSeverity: document.getElementById('severityChart'),
    chartStatus: document.getElementById('statusChart'),
    chartTrend: document.getElementById('trendChart')
});

let activeLeakId = null;

// --- INITIALIZATION ---
function init() {
    initMap();
    initListeners();
    initWebSocket();
    fetchLeakData();
}

// 0. WebSocket Integration
function initWebSocket() {
    if (typeof StompJs === 'undefined' || typeof SockJS === 'undefined') {
        console.warn("WebSocket libraries (SockJS/StompJS) missing. Skipping real-time updates.");
        return;
    }

    try {
        const client = new StompJs.Client({
            webSocketFactory: () => new SockJS(API_ENDPOINTS.ws),
            reconnectDelay: 5000,
            onConnect: () => {
                console.log('Connected to WebSocket');
                client.subscribe('/topic/leaks', (message) => {
                    const leak = JSON.parse(message.body);
                    console.log('New leak detected:', leak);
                    handleNewLeak(leak);
                });
            },
            onDisconnect: () => {
                console.log('Disconnected from WebSocket');
            }
        });

        client.activate();
        state.stompClient = client;
    } catch (e) {
        console.error("WebSocket setup failed:", e);
    }
}

// Helper to normalize status text (e.g. FALSE_POSITIVE -> False Positive)
function normalizeStatus(status) {
    if (!status) return 'New';
    let s = status.toString().toUpperCase();
    if (s === 'FALSE_POSITIVE' || s === 'FALSE POSITIVE') return 'False Positive';
    if (s === 'VERIFIED') return 'Verified';
    if (s === 'DISPATCHED' || s === 'DISPATCH') return 'Dispatched';
    if (s === 'NEW') return 'New';
    // Fallback: Title Case
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace('_', ' ');
}

function handleNewLeak(leak) {
    // Normalize new leak
    const leakDate = (leak.date || new Date().toISOString()).split('T')[0];
    const leakSev = (leak.severity || "Medium").charAt(0).toUpperCase() + (leak.severity || "Medium").slice(1).toLowerCase();
    const leakStat = normalizeStatus(leak.status);

    const normalizedLeak = { ...leak, date: leakDate, severity: leakSev, status: leakStat };
    state.allLeaks.push(normalizedLeak);

    // Update Available Dates logic
    if (!state.availableDates.includes(normalizedLeak.date)) {
        state.availableDates.unshift(normalizedLeak.date);
        state.availableDates.sort().reverse();
        renderDateList();
    }

    // Refresh if viewing current date or all
    if (normalizedLeak.date === state.selectedDate) {
        filterByDate(state.selectedDate);
        // Visual Alert
        alert(`New Leak Detected at ${normalizedLeak.locationName}!`);
    }
}

// 1. Map Setup
// 1. Map Setup
// 1. Map Setup
function initMap() {
    state.map = L.map('map').setView([40.37, 49.84], 9);

    const voyager = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    });

    const lightLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '©OpenStreetMap, ©CARTO',
        subdomains: 'abcd',
        maxZoom: 19
    });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri'
    });

    // Default to Voyager
    voyager.addTo(state.map);

    const baseMaps = {
        "Voyager": voyager,
        "Satellite View": satelliteLayer,
        "Terrain Map": lightLayer
    };

    state.leakLayer = L.layerGroup().addTo(state.map);
    L.control.layers(baseMaps, { "Leaks": state.leakLayer }).addTo(state.map);
}

// 2. Interaction Listeners
function initListeners() {
    const el = getElements();

    el.dateTrigger.addEventListener('click', (e) => {
        el.dateList.classList.toggle('show');
        e.stopPropagation();
    });
    document.addEventListener('click', (e) => {
        if (!el.customSelect.contains(e.target)) {
            el.dateList.classList.remove('show');
        }
    });

    el.closePanel.addEventListener('click', closePanel);
    el.overlay.addEventListener('click', (e) => { if (e.target === el.overlay) closePanel(); });

    el.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase();
        applyFilters();
    });

    el.filterCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            const checked = Array.from(el.filterCheckboxes)
                .filter(c => c.checked)
                .map(c => c.value);
            state.severityFilters = checked;
            applyFilters();
        });
    });

    el.btnDispatch.addEventListener('click', handleDispatch);
    el.btnFeedback.addEventListener('click', handleFeedback);

    if (el.btnAnalytics) {
        el.btnAnalytics.addEventListener('click', openAnalytics);
        el.closeAnalytics.addEventListener('click', () => {
            el.analyticsModal.classList.add('hidden');
        });
        el.analyticsModal.addEventListener('click', (e) => {
            if (e.target === el.analyticsModal) el.analyticsModal.classList.add('hidden');
        });
    }

    if (el.btnExport) {
        el.btnExport.addEventListener('click', exportCSV);
    }
}

// 3. Data & Filtering
async function fetchLeakData() {
    try {
        console.log("Fetching from:", API_ENDPOINTS.leaks);
        const response = await fetch(API_ENDPOINTS.leaks);
        if (!response.ok) throw new Error('API Network Error');

        const data = await response.json();
        console.log("API Data received:", data);

        // Normalize Data
        state.allLeaks = data.map(l => {
            let sev = l.severity || "Medium";
            sev = sev.charAt(0).toUpperCase() + sev.slice(1).toLowerCase(); // ensuring "High", "Medium", etc

            return {
                ...l,
                date: (l.date || new Date().toISOString()).split('T')[0], // Ensure YYYY-MM-DD
                severity: sev,
                status: normalizeStatus(l.status)
            };
        });

    } catch (error) {
        console.warn('Backend API failed (likely CORS or offline). Using MOCK data.', error);
        state.allLeaks = [...MOCK_LEAKS];
    }

    // Post-Fetch setup
    const dates = [...new Set(state.allLeaks.map(l => l.date))].sort().reverse();
    state.availableDates = dates;

    // Auto-select most recent date available
    if (dates.length > 0) {
        state.selectedDate = dates[0];
    } else {
        state.selectedDate = new Date().toISOString().split('T')[0];
    }

    renderDateList();
    const el = getElements();
    if (el.dateTrigger.querySelector('span')) el.dateTrigger.querySelector('span').textContent = state.selectedDate;

    filterByDate(state.selectedDate);
}

function filterByDate(date) {
    state.rawLeaksForDate = state.allLeaks.filter(leak => leak.date === date);
    applyFilters();
}

function applyFilters() {
    state.currentLeaks = state.rawLeaksForDate.filter(leak => {
        const matchesSearch =
            (leak.id || '').toLowerCase().includes(state.searchQuery) ||
            (leak.locationName || '').toLowerCase().includes(state.searchQuery);

        const leakSev = (leak.severity || 'Low'); // Already normalized in fetch
        const matchesSeverity = state.severityFilters.includes(leakSev);

        return matchesSearch && matchesSeverity;
    });
    updateUI();
}

function updateUI() {
    const el = getElements();
    el.totalLeaks.textContent = state.currentLeaks.length;
    // Count pending
    const pending = state.currentLeaks.filter(l => {
        const s = (l.status || 'New').toLowerCase();
        return s === 'new' || s.startsWith('dispatch');
    }).length;
    el.pending.textContent = pending;

    renderAlertFeed();
    renderMap();
}

function renderDateList() {
    const el = getElements();
    el.dateList.innerHTML = '';
    state.availableDates.forEach(date => {
        const li = document.createElement('li');
        li.className = 'date-item';
        li.textContent = date;
        if (date === state.selectedDate) li.classList.add('selected');
        li.onclick = () => handleDateSelection(date);
        el.dateList.appendChild(li);
    });
}

function handleDateSelection(date) {
    state.selectedDate = date;
    const el = getElements();
    el.dateTrigger.querySelector('span').textContent = date;
    el.dateList.classList.remove('show');
    renderDateList();
    filterByDate(date);
}

function renderAlertFeed() {
    const el = getElements();
    el.alertList.innerHTML = '';
    if (state.currentLeaks.length === 0) {
        el.alertList.innerHTML = '<li style="padding:15px; color:#777; text-align:center;">No match found.</li>';
        return;
    }

    state.currentLeaks.forEach(leak => {
        const li = document.createElement('li');
        li.className = 'alert-item';
        li.setAttribute('data-severity', leak.severity);
        li.innerHTML = `
            <div class="top-row">
                <span class="id">${leak.id}</span>
                <span class="date">${leak.severity}</span>
            </div>
            <div class="info">${leak.locationName}</div>
            <div class="info">Status: ${leak.status}</div>
        `;
        li.onclick = () => { zoomToLeak(leak); openPanel(leak); };
        el.alertList.appendChild(li);
    });
}

function renderMap() {
    state.leakLayer.clearLayers();

    state.currentLeaks.forEach(leak => {
        const color = getStatusColor(leak.status);

        // Create a distinct look for Satellite (brighter)
        const polygon = L.polygon(leak.coordinates, {
            color: color,
            weight: 3,
            opacity: 1,
            fillColor: color,
            fillOpacity: 0.35, // Slightly more opaque for visibility over satellite
            className: 'leak-polygon'
        }).addTo(state.leakLayer);

        polygon.bindTooltip(`
            <div style="text-align:center;">
                <b style="color:${color}; font-size:1.1em;">${normalizeStatus(leak.status)}</b><br>
                ${leak.locationName}
            </div>
        `, {
            permanent: false,
            direction: 'top',
            className: 'custom-tooltip'
        });

        polygon.on('click', () => openPanel(leak));
    });
}

// 5. Actions / Helpers
function getStatusColor(status) {
    const s = (status || '').toLowerCase();
    if (s === 'new') return '#d32f2f'; // Red
    if (s.startsWith('dispatch')) return '#fbc02d'; // Yellow
    if (s === 'verified') return '#1976d2'; // Blue
    if (s === 'false positive' || s.includes('false_positive')) return '#388e3c'; // Green
    return '#7f8c8d';
}

function zoomToLeak(leak) {
    const bounds = L.latLngBounds(leak.coordinates);
    state.map.fitBounds(bounds, { padding: [50, 50] });
}

function openPanel(leak) {
    activeLeakId = leak.id;
    const el = getElements();
    el.overlay.classList.remove('hidden');
    el.panelTitle.textContent = leak.locationName;
    el.detailId.textContent = leak.id;
    el.detailDate.textContent = leak.date;
    el.detailSeverity.textContent = leak.severity;
    el.detailSource.textContent = leak.detectedBy;

    el.detailStatus.textContent = leak.status;
    const color = getStatusColor(leak.status);

    el.detailStatus.style.borderColor = color;
    el.detailStatus.style.color = color;

    if (color.startsWith('#')) {
        let r = parseInt(color.slice(1, 3), 16);
        let g = parseInt(color.slice(3, 5), 16);
        let b = parseInt(color.slice(5, 7), 16);
        el.detailStatus.style.backgroundColor = `rgba(${r},${g},${b},0.1)`;
    } else {
        el.detailStatus.style.backgroundColor = '#f0f0f0';
    }

    const s = (leak.status || '').toLowerCase();
    const isFinal = (s === 'verified' || s === 'false positive' || s.includes('false_positive'));
    const isDispatched = s.startsWith('dispatch');

    // Dispatch button disabled if Dispatched, Verified, or False Positive
    el.btnDispatch.disabled = isFinal || isDispatched;

    // Feedback button disabled only if Verified or False Positive
    el.btnFeedback.disabled = isFinal;
}

function closePanel() {
    const el = getElements();
    el.overlay.classList.add('hidden');
    activeLeakId = null;
}

async function updateLeakStatus(id, statusEnum) {
    try {
        const url = `${API_ENDPOINTS.leaks}/${id}/status?status=${statusEnum}`;
        const response = await fetch(url, { method: 'PATCH' });

        if (!response.ok) throw new Error('Failed to update status');

        const updatedLeak = await response.json();

        // Update local state
        const index = state.allLeaks.findIndex(l => l.id === id);
        if (index !== -1) {
            // Update status and re-normalize if necessary
            state.allLeaks[index].status = normalizeStatus(updatedLeak.status);
        }

        // Return updated leak for UI usage
        return state.allLeaks[index];

    } catch (error) {
        console.error('Status update failed:', error);
        alert('Failed to update status. Please try again.');
        return null;
    }
}

async function handleDispatch() {
    if (!activeLeakId) return;

    // Optimistic UI or wait for API? Let's wait for API to be sure.
    const btn = document.getElementById('btn-dispatch');
    const originalText = btn.innerText;
    btn.innerText = "Processing...";
    btn.disabled = true;

    const result = await updateLeakStatus(activeLeakId, 'DISPATCHED');

    btn.innerText = originalText;
    btn.disabled = false;

    if (result) {
        openPanel(result);
        filterByDate(state.selectedDate);
    }
}

async function handleFeedback() {
    if (!activeLeakId) return;
    const el = getElements();
    const val = el.feedbackSelect.value;

    const apiStatus = (val === 'verified') ? 'VERIFIED' : 'FALSE_POSITIVE';

    const btn = document.getElementById('btn-feedback');
    const originalText = btn.innerText;
    btn.innerText = "Processing...";
    btn.disabled = true;

    const result = await updateLeakStatus(activeLeakId, apiStatus);

    btn.innerText = originalText;
    btn.disabled = false;

    if (result) {
        openPanel(result);
        filterByDate(state.selectedDate);
    }
}

function exportCSV() {
    const rows = [["ID", "Date", "Location", "Severity", "Status", "DetectedBy"]];
    state.currentLeaks.forEach(l => {
        rows.push([l.id, l.date, `"${l.locationName}"`, l.severity, l.status, l.detectedBy]);
    });
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `leak_report_${state.selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- ANALYTICS ---
function openAnalytics() {
    const el = getElements();
    el.analyticsModal.classList.remove('hidden');

    const severityCounts = { High: 0, Medium: 0, Low: 0 };
    const statusCounts = { New: 0, Dispatched: 0, Verified: 0, 'False Positive': 0 };
    const trendData = {};

    state.allLeaks.forEach(l => {
        if (severityCounts[l.severity] !== undefined) severityCounts[l.severity]++;
        if (statusCounts[l.status] !== undefined) statusCounts[l.status]++;
        if (!trendData[l.date]) trendData[l.date] = 0;
        trendData[l.date]++;
    });

    const sortedDates = Object.keys(trendData).sort();
    const trendCounts = sortedDates.map(d => trendData[d]);

    renderChart(el.chartSeverity, 'doughnut', 'Severity Risk Model', {
        labels: Object.keys(severityCounts),
        data: Object.values(severityCounts),
        colors: ['#d32f2f', '#fbc02d', '#388e3c'],
        cutout: '70%'
    });

    renderChart(el.chartStatus, 'bar', 'Response Status', {
        labels: Object.keys(statusCounts),
        data: Object.values(statusCounts),
        colors: ['#ef5350', '#ffca28', '#1976d2', '#66bb6a'],
        borderRadius: 6
    });

    renderChart(el.chartTrend, 'line', 'Detection Trend (7-Day)', {
        labels: sortedDates,
        data: trendCounts,
        colors: '#0288d1',
        fill: true
    });
}

function renderChart(canvas, type, label, dataPayload) {
    if (!canvas) return;
    let chartInstance = null;
    if (canvas.id === 'severityChart') chartInstance = state.severityChart;
    if (canvas.id === 'statusChart') chartInstance = state.statusChart;
    if (canvas.id === 'trendChart') chartInstance = state.trendChart;

    if (chartInstance) chartInstance.destroy();

    const ctx = canvas.getContext('2d');
    let background = dataPayload.colors;

    if (type === 'line') {
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(2, 136, 209, 0.5)');
        gradient.addColorStop(1, 'rgba(2, 136, 209, 0.0)');
        background = gradient;
    }

    const config = {
        type: type,
        data: {
            labels: dataPayload.labels,
            datasets: [{
                label: label,
                data: dataPayload.data,
                backgroundColor: background,
                borderColor: type === 'line' ? '#01579b' : '#fff',
                borderWidth: type === 'line' ? 3 : 2,
                borderRadius: dataPayload.borderRadius || 0,
                tension: 0.4,
                fill: !!dataPayload.fill,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#01579b',
                pointRadius: 5,
                hoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } },
                title: { display: true, text: label, font: { size: 16, weight: '600' }, padding: { bottom: 20 }, color: '#37474f' }
            },
            layout: { padding: 10 }
        }
    };

    const newChart = new Chart(canvas, config);
    if (canvas.id === 'severityChart') state.severityChart = newChart;
    if (canvas.id === 'statusChart') state.statusChart = newChart;
    if (canvas.id === 'trendChart') state.trendChart = newChart;
}

// Start
init();
