const map = L.map('map').setView([0, 0], 2); // Set a default view that will be updated

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Define a custom red dot icon
const redIcon = L.icon({
    iconUrl: 'red-dot.png',  // Use the relative path to the image in the public folder
    iconSize: [10, 10],  // Adjust size as needed
    iconAnchor: [5, 5],  // Adjust anchor point as needed
});

// Fetch dustbin locations from the server and add to the map
fetch('/api/dustbins')
    .then(response => response.json())
    .then(data => {
        if (data.length > 0) {
            const bounds = [];
            data.forEach(dustbin => {
                const marker = L.marker([dustbin.lat, dustbin.lng], { icon: redIcon }).addTo(map)
                    .bindPopup('Dustbin at Location ID: ' + dustbin.locationId);
                bounds.push(marker.getLatLng());
            });
            map.fitBounds(bounds);  // Adjust the map view to fit all markers
        } else {
            // Default view if no dustbins are available
            map.setView([51.505, -0.09], 13); // Adjust to the desired default location
        }
    });

// Handle form submission
const form = document.getElementById('dustbinForm');
form.addEventListener('submit', function (e) {
    e.preventDefault();

    const lat = parseFloat(document.getElementById('lat').value);
    const lng = parseFloat(document.getElementById('lng').value);
    const locationId = document.getElementById('locationId').value;

    const dustbin = { lat, lng, locationId };

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
        const marker = L.marker([data.lat, data.lng], { icon: redIcon }).addTo(map)
            .bindPopup('Dustbin at Location ID: ' + data.locationId);

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
