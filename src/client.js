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
const MAX_DROPPED_MESSAGES = 3;

const DROPPED_ARROWS = [];
const MAX_DROPPED_ARROWS = 6;

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

let activeArrows = 0;

function addArrow(pos, rotation) {
    if (activeArrows === MAX_DROPPED_ARROWS) {
        activeArrows--;
        for (let i = 0; i < DROPPED_ARROWS.length; i++) {
            if (!DROPPED_ARROWS[i].removing) {
                var removalIndex = i;
                break;
            }
        }
        DROPPED_ARROWS[removalIndex].remove(() => {
            DROPPED_ARROWS.splice(0, 1);
        });
    }
    activeArrows++;
    DROPPED_ARROWS.push(new GroundArrow(pos.x, pos.y, rotation));

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
    let adjustedSpeed = KEY_CHECKER[16] ? this.speed * 1.6 : this.speed;
    if (KEY_CHECKER[65]) {
        this.pos.x -= adjustedSpeed;
    }
    if (KEY_CHECKER[87]) {
        this.pos.y -= adjustedSpeed;
    }
    if (KEY_CHECKER[68]) {
        this.pos.x += adjustedSpeed;
    }
    if (KEY_CHECKER[83]) {
        this.pos.y += adjustedSpeed;
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
    };
    this.arrowDropState = {
        timeDropped: 0
    };
    this.timeToDrop = 1000;
}
inherits(MsgDropper, Player);

MsgDropper.prototype.update = function(t) {
    this.super_.prototype.update.call(this);

    this.handleMessageDropping(t);
    this.handleArrowDropping(t);
}

MsgDropper.prototype.handleArrowDropping = function(t) {
    let LEFT_PRESSED = KEY_CHECKER[37];
    let UP_PRESSED = KEY_CHECKER[38];
    let RIGHT_PRESSED = KEY_CHECKER[39];
    let DOWN_PRESSED = KEY_CHECKER[40];

    let nonePressed = ![LEFT_PRESSED, UP_PRESSED, RIGHT_PRESSED, DOWN_PRESSED].some(function(el) { return !!el; });
    if (nonePressed) {
        this.freezeArrowDrop = false;
        return;
    }

    if (this.freezeArrowDrop) {
        return;
    }

    // Early exit first cycle to allow time for simultaneous button pressing
    if (!this.awaitingDrop) {
        this.awaitingDrop = true;
        return;
    }

    this.awaitingDrop = false;

    // Down -- Default
    let rotation = 0;

    if (LEFT_PRESSED && UP_PRESSED) {
        rotation = .75 * Math.PI;
    } else if (LEFT_PRESSED && DOWN_PRESSED) {
        rotation = .25 * Math.PI;
    } else if (LEFT_PRESSED) {
        rotation = .5 * Math.PI;
    } else if (RIGHT_PRESSED && UP_PRESSED) {
        rotation = 1.25 * Math.PI;
    } else if (RIGHT_PRESSED && DOWN_PRESSED) {
        rotation = 1.75 * Math.PI;
    } else if (RIGHT_PRESSED) {
        rotation = 1.5 * Math.PI;
    } else if (UP_PRESSED) {
        rotation = 1 * Math.PI;
    }

    this.dropArrow(rotation);
}

MsgDropper.prototype.handleMessageDropping = function(t) {
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
    const canDrop =
        DROPPED_MESSAGES.length < MAX_DROPPED_MESSAGES &&
        !Array.prototype.some.call([65,87,68,83], function(i) { return KEY_CHECKER[i] }) &&
        !this.freezeMsgDrop;

    this.canDropMessage = canDrop;
}

MsgDropper.prototype.dropMessage = function() {
    addMessage(this.pos);
    this.msgDropState.timeDropped = 0;
    this.droppingMessage = false;
    this.freezeMsgDrop = true;
}

MsgDropper.prototype.dropArrow = function(rotation) {
    addArrow(this.pos, rotation);
    this.freezeArrowDrop = true;
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

function GroundArrow(x, y, rotation) {
    this.pos = {x: x, y:y};
    this.rotation = rotation;
    this.removing = false;
    this.opacity = 1;
}

GroundArrow.prototype.remove = function(cb) {
    this.removing = true;
    this.removalCB = cb;
}

GroundArrow.prototype.update = function() {
    if (this.opacity <= 0) {
        this.removalCB && this.removalCB(this);
        return;
    }
    if (this.removing) {
        this.opacity -= .1;
    }
}

GroundArrow.prototype.draw = function() {
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0,0,0,' + this.opacity + ')';
    ctx.lineWidth = 4;
    ctx.translate(this.pos.x, this.pos.y);
    ctx.translate(0, -5);
    ctx.rotate(this.rotation);
    ctx.translate(0, 5);
    ctx.moveTo(0, 2);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-2, -5);
    ctx.lineTo(-2, -25)
    ctx.lineTo(2, -25);
    ctx.lineTo(2, -5);
    ctx.lineTo(5, -5);
    ctx.closePath();

    ctx.scale(1.4,1.4);
    ctx.stroke();
    // ctx.stroke();
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
    updateBackground();

    draw();
    window.requestAnimationFrame(update);
    globalTime = time;
}

function updateBackground() {
    updateArrows();
}

function updateArrows() {
    for (let arrow = 0; arrow < DROPPED_ARROWS.length; arrow++) {
        DROPPED_ARROWS[arrow].update();
    }
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
    drawArrows();
    ctx.restore();
}
function drawMessages() {
    for (let msg = 0; msg < DROPPED_MESSAGES.length; msg++) {
        DROPPED_MESSAGES[msg].draw();
    }
}
function drawArrows() {
    for (let arrow = 0; arrow < DROPPED_ARROWS.length; arrow++) {
        DROPPED_ARROWS[arrow].draw();
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