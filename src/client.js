/** Global constants */
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const CURSOR_RADIUS = 10;

const PIXELS_PER_UNIT = 50;
const MAP_WIDTH = 5000;
const MAP_HEIGHT = 5000;

const KEY_CHECKER = {};

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

/** Base event listeners */
window.addEventListener('keydown', function(e) {
    KEY_CHECKER[e.keyCode] = true;
});
window.addEventListener('keyup', function(e) {
    KEY_CHECKER[e.keyCode] = false;
});

canvas.onmousemove = handleMouseMove;

//* User Interaction */
function handleMouseMove(e) {
    showMouse = true;
    mousePos = {x: e.offsetX, y: e.offsetY};
}

/** Game State */
let mousePos = { x: 0, y: 0 };

/** Game Classes */

/** Player Class */
function Player(x, y) {
    this.pos = { x: x, y: y };
    this.size = { w: 20, h: 15 };
    this.speed = 2;
}

Player.prototype.update = function() {
    // A or <-
    if (KEY_CHECKER[65] || KEY_CHECKER[37]) {
        this.pos.x -= this.speed;
    }
    if (KEY_CHECKER[38] || KEY_CHECKER[87]) {
        this.pos.y -= this.speed;
    }
    if (KEY_CHECKER[68] || KEY_CHECKER[39]) {
        this.pos.x += this.speed;
    }
    if (KEY_CHECKER[40] || KEY_CHECKER[83]) {
        this.pos.y += this.speed;
    }
}

Player.prototype.draw = function() {
    ctx.save();
    ctx.translate(CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
    ctx.beginPath();
    ctx.rect(-this.size.w/2, -this.size.h/2, this.size.w, this.size.h);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#111';
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

/** Game State */
let player = new Player(25, 25);

/** Bootup */
function loadMap() {
    let map = [];
    console.log('map loaded!')
    update();
}
/** Main Update Loop */
function update(time) {
    player.update();

    draw();
    window.requestAnimationFrame(update);
}

/** Main Draw Loop */
function draw() {
    clearBoard();
    drawBackground();
    player.draw();
    drawCursor();
}

function clearBoard() {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}
function drawBackground() {
    ctx.save();
    ctx.translate(-player.pos.x,-player.pos.y)
    for (let w = 0; w < MAP_WIDTH; w += PIXELS_PER_UNIT) {
        for (let h = 0; h < MAP_HEIGHT; h += PIXELS_PER_UNIT) {
            ctx.beginPath();
            ctx.rect(
                w,
                h,
                PIXELS_PER_UNIT,
                PIXELS_PER_UNIT
            );
            ctx.strokeStyle = '#111';
            ctx.fillStyle = '#555';
            ctx.fill();
            ctx.stroke();
        }
    }
    ctx.restore();
}
function drawCursor() {
    ctx.beginPath();
    ctx.arc(mousePos.x, mousePos.y, CURSOR_RADIUS, 0, 2 * Math.PI);
    ctx.strokeStyle = 'red';
    ctx.stroke();
}
/** Start game */
loadMap();