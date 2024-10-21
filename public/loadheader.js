// loadHeader.js

document.addEventListener("DOMContentLoaded", function () {
    fetch('header.ejs')
        .then(response => response.text())
        .then(data => {
            document.getElementById('header-placeholder').innerHTML = data;
        })
        .catch(error => console.error('Error loading header:', error));
});
