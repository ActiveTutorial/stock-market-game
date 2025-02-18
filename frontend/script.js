document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/version')
        .then(response => response.json())
        .then(data => {
            document.getElementById('version').textContent = `Stock Market Game v${data.version}`;
        });
});
