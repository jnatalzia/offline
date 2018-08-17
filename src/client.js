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

/** To be swapped with server logic */
const DROPPED_MESSAGES = [];

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

function addMessage(pos) {
    console.log('ADDING MESSAGE');
    DROPPED_MESSAGES.push(new Message(pos.x, pos.y));
}

/** Game Classes */

/** Helpers */
function inherits (ctor, superCtor) {
  ctor.prototype = Object.create(superCtor.prototype, {
    constructor: {
      value: ctor,
      enumerable: false
    },
    super_: {
        value: superCtor,
        enumerable: false
    }
  });
};

function Extendable() {}

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

function MsgDropper(x, y) {
    this.super_.apply(this, arguments);
    this.canDropMessage = true;
    this.droppingMessage = false;
    this.msgDropState = {
        timeDropped: 0
    }
    this.timeToDrop = 2000;
}
inherits(MsgDropper, Player);

MsgDropper.prototype.update = function(t) {
    this.super_.prototype.update.call(this);

    if (this.freezeMsgDrop && !KEY_CHECKER[32]) {
        this.freezeMsgDrop = false;
    }

    this.updateCanDrop();

    if (KEY_CHECKER[32] && !this.droppingMessage && this.canDropMessage) {
        this.droppingMessage = true;
    }

    if (this.droppingMessage) {
        if (!KEY_CHECKER[32] || !this.canDropMessage) {
            this.msgDropState.timeDropped = 0;
            this.droppingMessage = false;
            return;
        }

        this.msgDropState.timeDropped += t;
        if (this.msgDropState.timeDropped >= this.timeToDrop) {
            this.dropMessage();
        }
    }
}

MsgDropper.prototype.updateCanDrop = function() {
    const canDrop = !Array.prototype.some.call([65,37,38,87,68,39,40,83], function(i) { return KEY_CHECKER[i] }) && !this.freezeMsgDrop;
    this.canDropMessage = canDrop;
}

MsgDropper.prototype.dropMessage = function() {
    addMessage(this.pos);
    this.msgDropState.timeDropped = 0;
    this.droppingMessage = false;
    this.freezeMsgDrop = true;
}

MsgDropper.prototype.drawUI = function() {
    ctx.save();
    ctx.strokeStyle = '#00348F';
    ctx.fillStyle = '#00348F';
    ctx.lineWidth = 2;
    ctx.fillRect(10, 10, 100 * (this.msgDropState.timeDropped / this.timeToDrop), 20);
    ctx.strokeRect(10, 10, 100, 20);
    ctx.restore();
}

function Message(x, y) {
    this.pos = {x: x, y: y};
    console.log("My message pos is");
    console.log(this.pos)
}

Message.prototype.draw = function() {
    ctx.save();
    ctx.fillStyle = '#eee';
    ctx.strokeStyle = '#00348F';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(this.pos.x - 10, this.pos.y - 5, 20, 10);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

/** Game State */
let player = new MsgDropper(500, 500);
let globalTime = 0;

/** Bootup */
function loadMap() {
    let map = [];
    update();
}
/** Main Update Loop */
function update(time) {
    let deltaTime = time - globalTime;
    player.update(deltaTime);

    draw();
    window.requestAnimationFrame(update);
    globalTime = time;
}

/** Main Draw Loop */
function draw() {
    clearBoard();
    drawBackground();
    player.draw();
    drawUI();
}
function drawUI() {
    drawCursor();
    player.drawUI();
}
function clearBoard() {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}
function drawBackground() {
    ctx.save();
    ctx.translate(-player.pos.x + CANVAS_WIDTH/2,-player.pos.y + CANVAS_HEIGHT/2)
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
    drawMessages();
    ctx.restore();
}
function drawMessages() {
    for (let msg = 0; msg < DROPPED_MESSAGES.length; msg++) {
        DROPPED_MESSAGES[msg].draw();
    }
}
function drawCursor() {
    ctx.beginPath();
    ctx.arc(mousePos.x, mousePos.y, CURSOR_RADIUS, 0, 2 * Math.PI);
    ctx.strokeStyle = 'red';
    ctx.stroke();
}
/** Start game */
loadMap();