document.addEventListener('DOMContentLoaded', () => {

    // Fetch and set version number
    fetch('/api/version')
        .then(response => response.json())
        .then(data => {
            document.getElementById('version').textContent = `Stock Market Game v${data.version}`;
        });

    
    // Create canvas
    const canvas = document.getElementById('stockCanvas');
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
        const mainDiv = document.querySelector('.main');
        // Adjust size to fit inside the main div
        canvas.width = mainDiv.clientWidth - 40; 
        canvas.height = mainDiv.clientHeight - 40;
    }

    function drawCoordinateSystem() {
        // Height and width of the canvas
        const width = canvas.width;
        const height = canvas.height;
        // Step size for thick and thin grid lines
        const step = (width - 40) / 10; // Adjust step to align with axes
        const subStep = step / 5; // Sub-step for denser grid lines

        ctx.clearRect(0, 0, width, height); // Clear the canvas before drawing

        // Create elements to get computed styles
        const styleElements = {};
        ['main-grid-line', 'dense-grid-line', 'axis-label', 'axis-line', 'axis-arrow'].forEach(className => {
            styleElements[className] = document.createElement('div');
            styleElements[className].className = className;
            styleElements[className].style.display = 'none';
            document.querySelector("#style-element-container").appendChild(styleElements[className]);
        });

        // Draw main grid lines
        // Set line style
        ctx.strokeStyle = getComputedStyle(styleElements['main-grid-line']).stroke;
        ctx.lineWidth = parseFloat(getComputedStyle(styleElements['main-grid-line']).strokeWidth);

        // Draw vertical main grid lines
        for (let x = 20; x <= width - 20; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height - 20);
            ctx.stroke();
        }

        // Draw horizontal main grid lines
        for (let y = height - 20; y >= 0; y -= step) {
            ctx.beginPath();
            ctx.moveTo(20, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Draw denser grid lines
        // Set line style
        ctx.strokeStyle = getComputedStyle(styleElements['dense-grid-line']).stroke;
        ctx.lineWidth = parseFloat(getComputedStyle(styleElements['dense-grid-line']).strokeWidth);

        // Draw vertical denser grid lines
        for (let x = 20 + subStep; x <= width - 20; x += subStep) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height - 20);
            ctx.stroke();
        }

        // Draw horizontal denser grid lines
        for (let y = height - 20 - subStep; y >= 0; y -= subStep) {
            ctx.beginPath();
            ctx.moveTo(20, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Draw coordinate markings
        ctx.fillStyle = getComputedStyle(styleElements['axis-label']).fill;
        ctx.font = `${getComputedStyle(styleElements['axis-label']).fontSize} Arial`;
        for (let i = 1; i <= 9; i++) {
            ctx.fillText(`x${i}`, 5, height - (i * step) - 25);
        }

        // Draw axes
        ctx.strokeStyle = getComputedStyle(styleElements['axis-line']).stroke;
        ctx.lineWidth = parseFloat(getComputedStyle(styleElements['axis-line']).strokeWidth);

        // X-axis
        ctx.beginPath();
        ctx.moveTo(20, height - 20);
        ctx.lineTo(width, height - 20);
        ctx.stroke();

        // X-axis arrow
        ctx.strokeStyle = getComputedStyle(styleElements['axis-arrow']).stroke;
        ctx.lineWidth = parseFloat(getComputedStyle(styleElements['axis-arrow']).strokeWidth);
        ctx.beginPath();
        ctx.moveTo(width - 10, height - 25);
        ctx.lineTo(width, height - 20);
        ctx.lineTo(width - 10, height - 15);
        ctx.stroke();

        // Y-axis
        ctx.strokeStyle = getComputedStyle(styleElements['axis-line']).stroke;
        ctx.lineWidth = parseFloat(getComputedStyle(styleElements['axis-line']).strokeWidth);
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(20, height);
        ctx.stroke();

        // Y-axis arrow
        ctx.strokeStyle = getComputedStyle(styleElements['axis-arrow']).stroke;
        ctx.lineWidth = parseFloat(getComputedStyle(styleElements['axis-arrow']).strokeWidth);
        ctx.beginPath();
        ctx.moveTo(15, 10);
        ctx.lineTo(20, 0);
        ctx.lineTo(25, 10);
        ctx.stroke();

        // Remove temporary elements
        Object.values(styleElements).forEach(element => document.body.removeChild(element));
    }

    function drawCanvas() {
        resizeCanvas();
        drawCoordinateSystem();
    }

    drawCanvas();

    window.addEventListener('resize', () => {
        drawCanvas();
    });
});
