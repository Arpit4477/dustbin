const map = L.map('map').setView([0, 0], 2); // Set a default view that will be updated

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Define DivIcons for different fill levels
const createIcon = (iconUrl, labelText) => {
    return L.divIcon({
        html: `
            <div style="position: relative; text-align: center; color: black;">
                <div style="font-size: 12px; font-weight: bold;">${labelText}</div>
                <img src="${iconUrl}" style="width: 20px; height: 20px;">
            </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        className: '' // To remove the default className
    });
};

const icons = {
    '100%': createIcon('dustbinFull.png', '100%'),
    '75%': createIcon('dustbinFull.png', '75%'),
    '50%': createIcon('dustbinEmpty.png', '50%'),
    '25%': createIcon('dustbinEmpty.png', '25%')
};

const dustbins = [];

const fetchDustbins = () => {
    fetch('/api/dustbin-status')
        .then(response => response.json())
        .then(data => {
            dustbins.length = 0;
            data.forEach(dustbin => dustbins.push(dustbin));
            applyFilters();
        })
        .catch(error => console.error('Error:', error));
};

const applyFilters = () => {
    const locationFilter = document.getElementById('locationFilter').value;
    const fillLevelFilter = document.getElementById('fillLevelFilter').value;

    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });

    const bounds = [];

    dustbins.forEach(dustbin => {
        const fillLevel = getFillLevel(dustbin);
        if ((locationFilter === '' || dustbin.locationId === locationFilter) &&
            (fillLevelFilter === '' || fillLevel === fillLevelFilter)) {
            const icon = icons[fillLevel] || icons['25%']; // Default to 25% if unknown
            const marker = L.marker([dustbin.lat, dustbin.lng], { icon })
                .addTo(map)
                .bindPopup(`Dustbin at Location ID: ${dustbin.locationId}, Device ID: ${dustbin.deviceId}, Status: ${fillLevel}`);
            bounds.push(marker.getLatLng());
        }
    });

    if (bounds.length > 0) {
        map.fitBounds(bounds);
    } else {
        map.setView([51.505, -0.09], 13);
    }
};

const getFillLevel = (dustbin) => {
    const sensorValues = [dustbin.sensor1, dustbin.sensor2, dustbin.sensor3, dustbin.sensor4, dustbin.sensor5];
    const maxSensorValue = Math.max(...sensorValues);
    if (maxSensorValue > 20) {
        return '100%';
    } else if (maxSensorValue > 15) {
        return '75%';
    } else if (maxSensorValue > 10) {
        return '50%';
    } else {
        return '25%';
    }
};

document.getElementById('applyFilters').addEventListener('click', applyFilters);

fetchDustbins();

// Handle form submission
const form = document.getElementById('dustbinForm');
form.addEventListener('submit', function (e) {
    e.preventDefault();

    const lat = parseFloat(document.getElementById('lat').value);
    const lng = parseFloat(document.getElementById('lng').value);
    const locationId = document.getElementById('locationId').value;
    const deviceId = document.getElementById('deviceId').value;

    const dustbin = { lat, lng, locationId, deviceId };

    fetch('/api/dustbins', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dustbin)
    })
    .then(response => response.json())
    .then(data => {
        // Add the new dustbin to the map
        const marker = L.marker([data.lat, data.lng], { icon: icons['25%'] }).addTo(map)
            .bindPopup(`Dustbin at Location ID: ${data.locationId}, Device ID: ${data.deviceId}`);

        // Clear the form
        form.reset();
    })
    .catch(error => console.error('Error:', error));
});

// Function to handle map click event
function onMapClick(e) {
    alert("You clicked the map at " + e.latlng);
}

// Add event listener for map clicks
map.on('click', onMapClick);
