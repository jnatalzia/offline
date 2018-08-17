/** Global constants */
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const SCANNER_RADIUS = CANVAS_WIDTH / 10;
const ZOOM_AMT = 1.4;

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

/** Base event listeners */
canvas.onmousemove = handleMouseMove;

/** Game State */
let mousePos = { x: 0, y: 0 };
let enemyPos = { x: 0, y: 0 };
let showMouse = false;

/** Main Update Loop */
function update(time) {
    draw();
    window.requestAnimationFrame(update);
}

/** Main Draw Loop */
function draw() {
    clearBoard();
    drawBackground();
    drawScanner();
    drawEnhancedBackground();
    drawEnemy();
}

function clearBoard() {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function drawBackground() {
    for (let i = 100; i < CANVAS_WIDTH - 100; i += 50) {
        let colors = ['#aaa', '#bbb', '#ccc'];
        ctx.fillStyle = colors[i % colors.length];
        for (let k = 100; k < CANVAS_HEIGHT - 100; k += 50) {
            ctx.fillRect(i, k, 40, 40);
        }
    }
}

function drawEnhancedBackground() {
    ctx.save();
    ctx.beginPath();
    ctx.arc(mousePos.x, mousePos.y, SCANNER_RADIUS, 0, 2*Math.PI);
    ctx.clip();
    const adjustedPos = {x: mousePos.x * ZOOM_AMT, y: mousePos.y * ZOOM_AMT};
    // ctx.translate(mousePos.x - adjustedPos.x - (ZOOM_AMT * SCANNER_RADIUS), mousePos.y - adjustedPos.y - (ZOOM_AMT * SCANNER_RADIUS));
    ctx.translate(CANVAS_WIDTH/2, CANVAS_HEIGHT/2)
    ctx.scale(ZOOM_AMT, ZOOM_AMT);
    drawBackground();
    ctx.restore();
}

function drawScanner() {
    if (!showMouse) {
        return;
    }
    drawScannerCircle(mousePos.x, mousePos.y, SCANNER_RADIUS);
}

function drawEnemy() {
    /** Temp function for testing overlap */
    enemyPos = { x: 400, y: 300 };
    ctx.save();
    ctx.beginPath();
    ctx.arc(mousePos.x, mousePos.y, SCANNER_RADIUS, 0, 2*Math.PI);
    ctx.clip();
    drawScannerCircle(enemyPos.x, enemyPos.y, SCANNER_RADIUS, '#333333');
    ctx.restore();
}

function drawScannerCircle(x, y, rad, fill) {
    ctx.fillStyle = fill || '#fff';
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, 2 * Math.PI);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#333333';
    ctx.stroke();
    ctx.fill();
}

/* User Interaction */
function handleMouseMove(e) {
    showMouse = true;
    mousePos = {x: e.offsetX, y: e.offsetY};
}

/** Start game */
update();