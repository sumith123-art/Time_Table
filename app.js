document.addEventListener('DOMContentLoaded', () => {

    const departureBoardElement = document.getElementById('departure-board');
    const currentTimeElement = document.getElementById('current-time');
    const boardTitleElement = document.getElementById('board-title');
    const terminalSelect = document.getElementById('terminal-select');
    const filterBtn = document.getElementById('filter-btn');
    const resetBtn = document.getElementById('reset-btn');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    
    const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTWMKzsRjojZPbDkTxgQUtovW0ZMkiOguqS-zEsjekDkhPU2Qa1wy5LGd3dVIuLnD6nc65rBOaZXxU0/pub?output=csv';
    const DEPARTURE_TIME_HEADER = "ISO Departure";

    let allBusData = [];
    let currentFilter = null;
    let isInitialLoad = true; // Track the first load

    function populateTerminalDropdown(data) {
        const terminals = [...new Set(data.map(bus => bus['Terminal']).filter(Boolean))];
        terminals.sort();
        terminals.forEach(terminal => {
            const option = document.createElement('option');
            option.value = terminal;
            option.textContent = terminal;
            terminalSelect.appendChild(option);
        });
    }

    async function initialDataFetch() {
        try {
            const response = await fetch(GOOGLE_SHEET_URL);
            if (!response.ok) throw new Error(`Network response was not ok`);
            const csvText = await response.text();
            const lines = csvText.trim().split(/\r?\n/);
            const headers = lines[0].split(',').map(h => h.trim());
            if (!headers.includes(DEPARTURE_TIME_HEADER)) {
                 throw new Error(`Required column "${DEPARTURE_TIME_HEADER}" not found.`);
            }
            allBusData = [];
            for (let i = 1; i < lines.length; i++) {
                if (lines[i].trim() === '') continue;
                const values = lines[i].split(',').map(v => v.trim());
                const entry = {};
                headers.forEach((header, index) => { entry[header] = values[index]; });
                allBusData.push(entry);
            }
            populateTerminalDropdown(allBusData);
            updateDisplay();
        } catch (error) {
            console.error('Error fetching data:', error);
            departureBoardElement.innerHTML = `<p class="loading-message">Could not load schedule.</p>`;
        }
    }

    function updateDisplay() {
        const now = new Date();
        const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);
        const upcomingDepartures = allBusData.map(bus => {
            const sheetTimeStr = bus[DEPARTURE_TIME_HEADER];
            if (!sheetTimeStr) return null;
            const sheetDateTime = new Date(sheetTimeStr);
            if (isNaN(sheetDateTime.getTime())) return null;
            const departureTime = new Date();
            departureTime.setHours(sheetDateTime.getHours(), sheetDateTime.getMinutes(), sheetDateTime.getSeconds(), 0);
            if (now.getHours() === 23 && departureTime.getHours() === 0) {
                departureTime.setDate(departureTime.getDate() + 1);
            }
            return { ...bus, calculatedDepartureTime: departureTime };
        }).filter(bus => {
            if (!bus) return false;
            const isTerminalMatch = currentFilter ? bus['Terminal'] === currentFilter : true;
            const isTimeMatch = bus.calculatedDepartureTime >= now && bus.calculatedDepartureTime <= thirtyMinutesFromNow;
            return isTerminalMatch && isTimeMatch;
        }).sort((a, b) => a.calculatedDepartureTime - b.calculatedDepartureTime);

        if (isInitialLoad) {
            renderTable(upcomingDepartures);
            isInitialLoad = false;
            return;
        }

        departureBoardElement.classList.add('fading-out');
        setTimeout(() => {
            renderTable(upcomingDepartures);
            departureBoardElement.classList.remove('fading-out');
        }, 400);
    }
    
    function renderTable(departures) {
        const now = new Date();
        let headerMessage = currentFilter ? ` - ${currentFilter}` : '';
        boardTitleElement.textContent = `Live Departure Board${headerMessage}`;

        if (departures.length === 0) {
            departureBoardElement.innerHTML = `<p class="no-departures-message">No departures scheduled in the next 30 minutes${currentFilter ? ` from ${currentFilter}` : ''}.</p>`;
            return;
        }

        let tableHTML = `<table><thead><tr><th>Route</th><th>Terminal</th><th>Start Location</th><th>End Location</th><th>Arrival Time</th><th>Departure Time</th><th>Operator</th></tr></thead><tbody>`;
        
        departures.forEach(bus => {
            const minutesUntilDeparture = (bus.calculatedDepartureTime - now) / 1000 / 60;
            let departureCellClass = ''; 
            if (minutesUntilDeparture <= 5 && minutesUntilDeparture >= 0) {
                departureCellClass = 'departing-soon';
            }
            const arrivalDateTime = new Date(bus['ISO Arrival']);
            let formattedArrivalTime = !isNaN(arrivalDateTime.getTime()) ? arrivalDateTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', hour12: true}) : bus['Arrival Time'];
            let formattedDepartureTime = bus.calculatedDepartureTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', hour12: true});
            
            tableHTML += `<tr>
                            <td>${bus['Route'] || ''}</td>
                            <td>${bus['Terminal'] || ''}</td>
                            <td>${bus['Start Location'] || ''}</td>
                            <td>${bus['End Location'] || ''}</td>
                            <td>${formattedArrivalTime}</td>
                            <td class="${departureCellClass}">${formattedDepartureTime}</td> 
                            <td>${bus['Operator'] || ''}</td>
                          </tr>`;
        });

        tableHTML += `</tbody></table>`;
        departureBoardElement.innerHTML = tableHTML;
    }

    function updateCurrentTime() {
        if (!currentTimeElement) return;
        const now = new Date();
        let hours = now.getHours();
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const hoursStr = hours.toString().padStart(2, '0');
        const timeHTML = `
            <span class="digit">${hoursStr[0]}</span><span class="digit">${hoursStr[1]}</span>
            <span class="separator">:</span>
            <span class="digit">${minutes[0]}</span><span class="digit">${minutes[1]}</span>
            <span class="separator">:</span>
            <span class="digit">${seconds[0]}</span><span class="digit">${seconds[1]}</span>
            <span class="ampm">${ampm}</span>`;
        currentTimeElement.innerHTML = timeHTML;
    }

    // --- Event Listeners for Buttons ---

    // ***** THIS IS THE CORRECTED PART *****
    filterBtn.addEventListener('click', () => {
        const selectedTerminal = terminalSelect.value;
        if (selectedTerminal) {
            currentFilter = selectedTerminal;
            updateDisplay();
        }
    });
    // *************************************

    resetBtn.addEventListener('click', () => {
        currentFilter = null;
        terminalSelect.value = "";
        updateDisplay();
    });

    fullscreenBtn.addEventListener('click', () => {
        const body = document.body;
        const icon = fullscreenBtn.querySelector('i');
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
            body.classList.add('fullscreen-active');
            icon.classList.remove('fa-expand'); icon.classList.add('fa-compress');
        } else {
            if (document.exitFullscreen) { document.exitFullscreen(); }
            body.classList.remove('fullscreen-active');
            icon.classList.remove('fa-compress'); icon.classList.add('fa-expand');
        }
    });

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            const body = document.body;
            const icon = fullscreenBtn.querySelector('i');
            body.classList.remove('fullscreen-active');
            icon.classList.remove('fa-compress'); icon.classList.add('fa-expand');
        }
    });

    // --- Script Initialization ---
    initialDataFetch();
    setInterval(updateDisplay, 15000);
    setInterval(updateCurrentTime, 1000);
    updateCurrentTime();
});