# Caspian Methane Watch - Frontend Dashboard

## Overview
The **Caspian Methane Watch** dashboard is a specialized real-time monitoring tool designed for satellite operations. It visualizes methane leak data detected via satellite imagery over the Caspian Sea region, specifically focusing on key infrastructure zones.

The application provides a "Command Center" interface for operators to:
- Monitor incoming leak alerts in real-time.
- Visualize affected areas on an interactive map.
- Dispatch inspection teams to verify leaks.
- Provide feedback (verify or mark as false positive) to improve the system.
- Analyze trends and risk severity.

## Tech Stack
- **Frontend Core**: HTML5, CSS3, Vanilla JavaScript (ES6+).
- **Mapping**: [Leaflet.js](https://leafletjs.com/) with Esri World Imagery (Satellite) tiles.
- **Data Visualization**: [Chart.js](https://www.chartjs.org/) for analytics.
- **Real-time Communication**: [SockJS](https://github.com/sockjs/sockjs-client) & [StompJS](https://github.com/stomp-js/stompjs) for WebSocket connectivity.
- **Fonts**: Google Fonts (Roboto).

## Setup & Installation
1.  **Clone/Download** the repository to your local machine.
2.  Ensure you have an internet connection (required for CDN libraries: Leaflet, Chart.js, StompJS).
3.  Open `index.html` in any modern web browser (Chrome, Firefox, Edge).

No build step (npm/webpack) is required for this vanilla implementation.

## Configuration
The backend API endpoint is configured in `script.js`.
```javascript
const API_URL = 'https://azercosmos-back-production.up.railway.app';
```
If the backend URL changes, update this constant at the top of the file.

## Features

### 1. Interactive Map
- **Satellite View**: High-resolution satellite imagery (Esri) implies a live operational context.
- **Leak Visualization**: Detected leaks are rendered as semi-transparent polygons.
  - **Red**: New detection.
  - **Yellow**: Dispatched for inspection.
  - **Blue**: Verified leak.
  - **Green**: False positive.
- **Tooltips**: Hover over polygons to see ID and status. Click to open the Action Panel.

### 2. Alert Feed & Sidebar
- **Real-time Feed**: The sidebar lists active leaks, sorted by date.
- **Filters**: capabilities to filter by Severity (High/Medium/Low) and search by ID/Location.
- **Date Selector**: Browse historical data by selecting available dates from the dropdown.

### 3. Action Panel (Popup)
Clicking a leak or a list item opens the Action Panel overlay:
- **Details**: Shows precise location, date, severity, and detection source.
- **Dispatch**: "Dispatch Inspection Team" button updates status to `DISPATCHED`.
- **Feedback**: "Field Feedback" section allows marking a leak as `VERIFIED` or `FALSE_POSITIVE`.

### 4. Analytics
- **Trends**: Line chart showing detection counts over time.
- **Status Distribution**: Bar chart of current leak statuses.
- **Severity Risk**: Doughnut chart splitting leaks by High/Medium/Low severity.

### 5. Export
- **CSV Export**: Downloads the currently filtered view of leaks as a `.csv` file for external reporting.

## Folder Structure
```
Frontend/
├── index.html      # Main application structure
├── styles.css      # Custom styling and theming
├── script.js       # Application logic, API calls, and Map rendering
└── README.md       # Project documentation
```
