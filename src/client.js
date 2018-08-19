/** Global constants */
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const CURSOR_RADIUS = 10;

const PIXELS_PER_UNIT = 50;
const MAP_WIDTH = 1000;
const MAP_HEIGHT = 1000;

const KEY_CHECKER = {};

/** To be swapped with server logic */
let DROPPED_MESSAGES = [];
let DROPPED_ARROWS = [];
let FIRED_BULLETS = [];

const EXTERNAL_PLAYERS = [];


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

/** Utils */

function getClassFromType(type) {
    switch(type) {
        case PLAYER_COURIER:
            return Courier;
        case PLAYER_DICTATOR:
            return Dictator;
        case PLAYER_MESSAGE_DROPPER:
            return MsgDropper;
    }
}

/** Game State */
let mousePos = { x: 0, y: 0 };
let player;

function addMessage(pos) {
    // DROPPED_MESSAGES.push(new Message(pos.x, pos.y));
    socket.emit('drop-message', {pos: pos});
}

let activeArrows = 0;

function addArrow(pos, rotation) {
    socket.emit('drop-arrow', {
        pos: pos,
        rotation: rotation
    });
}

function addBullet(pos, rotation) {
    socket.emit('fire-bullet', {
        pos: pos,
        rotation: rotation
    });
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
function Player(x, y, isNotPlayer) {
    this.pos = { x: x, y: y };
    this.size = { w: PLAYER_WIDTH, h: PLAYER_HEIGHT };
    this.speed = 12;
    this.isPlayer = !isNotPlayer;
    if (this.isPlayer) {
        this.addEventHandlers();
    }
}

Player.prototype.addEventHandlers = function() {
    socket.on('shot', function(data) {
        this.die();
    }.bind(this));
}

Player.prototype.die = function() {
    console.log('You died betch');
}

Player.prototype.getAdjustedSpeed = function(t) {
    return (KEY_CHECKER[16] ? this.speed * 1.6 : this.speed) * (t/100);
}

Player.prototype.update = function(t) {
    // A or <-
    let adjustedSpeed = this.getAdjustedSpeed(t);
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

Player.prototype.absoluteDraw = function() {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.beginPath();
    ctx.rect(-this.size.w/2, -this.size.h/2, this.size.w, this.size.h);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#111';
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

Player.prototype.drawUI = function() {

}

Player.prototype.getHitbox = function() {
    return {
        x: this.pos.x - this.size.w/2,
        y: this.pos.y - this.size.h/2,
        w: this.size.w,
        h: this.size.h
    }
}

function MsgDropper(x, y) {
    this.super_.apply(this, arguments);

    this.type = PLAYER_MESSAGE_DROPPER
    this.canDropMessage = true;
    this.droppingMessage = false;
    this.msgDropState = {
        timeDropped: 0
    };
    this.timeToDrop = 1000;
}
inherits(MsgDropper, Player);

MsgDropper.prototype.update = function(t) {
    this.super_.prototype.update.call(this, t);

    this.handleMessageDropping(t);
    this.handleArrowDropping(t);
}

MsgDropper.prototype.addEventHandlers = function () {
    this.super_.prototype.addEventHandlers.apply(this, arguments);
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

function Courier(x, y) {
    this.super_.apply(this, arguments);

    this.type = PLAYER_COURIER;
    this.nearbyMessages = [];
}

inherits(Courier, Player);

Courier.prototype.addEventHandlers = function() {
    this.super_.prototype.addEventHandlers.apply(this, arguments);

    socket.on('message-collision', (msg) => {
        this.canPickUp(msg);
    });
}

Courier.prototype.update = function(t) {
    this.super_.prototype.update.apply(this, arguments);
}

Courier.prototype.canPickUp = function(msg) {
    if (KEY_CHECKER[32]) {
        console.log("The encoded message tells you: " + msg.coords);
        socket.emit('destroy-message', { id: msg.id });
    }
}

Courier.prototype.getAdjustedSpeed = function(t) {
    return this.speed * (t/100);
}

function Dictator(x, y, isNotPlayer) {
    this.super_.apply(this, arguments);
    this.type = PLAYER_DICTATOR;
}

inherits(Dictator, Player);

Dictator.prototype.canPickUp = function(msg) {
    if (KEY_CHECKER[32]) {
        socket.emit('destroy-message', { id: msg.id });
    }
}

Dictator.prototype.addEventHandlers = function() {
    this.super_.prototype.addEventHandlers.apply(this, arguments);

    canvas.addEventListener('click', this.fireBullet.bind(this));

    socket.on('message-collision', (msg) => {
        this.canPickUp(msg);
    });
}

Dictator.prototype.fireBullet = function() {
    let derivedRadianRotation = Math.atan2((mousePos.y - CANVAS_HEIGHT / 2), (mousePos.x - CANVAS_WIDTH / 2));
    addBullet(this.pos, derivedRadianRotation, this);
}

/** Game State */
let globalTime = 0;
let userID;

function updateGameStateFromServer(data) {
    let players = data.players;
    delete players[userID];
    let playerKeys = Object.keys(players);
    playerKeys.forEach(pKey => {
        let p = players[pKey];
        let internalP = EXTERNAL_PLAYERS[pKey];
        internalP.pos = p.pos;
    });

    /** Update arrows */
    DROPPED_ARROWS = data.arrows;
    /** Update Bullets */
    FIRED_BULLETS = data.bullets;
    /** Update Messages */
    DROPPED_MESSAGES = data.messages;
}

/** Bootup */
function loadMap() {
    let map = [];
}
/** Main Update Loop */
function update(time) {
    let deltaTime = time - globalTime;

    player.update(deltaTime);

    // Check collisions
    // checkCollisions();

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
    drawArrows();
    drawBullets();
    drawOtherPlayers();
    ctx.restore();
}
function drawMessages() {
    for (let msg = 0; msg < DROPPED_MESSAGES.length; msg++) {
        let drawData = DROPPED_MESSAGES[msg];
        Message.draw(drawData.pos, drawData.size);
    }
}
function drawArrows() {
    for (let arrow = 0; arrow < DROPPED_ARROWS.length; arrow++) {
        let drawData = DROPPED_ARROWS[arrow];
        GroundArrow.draw(drawData.pos, drawData.rotation, drawData.opacity);
    }
}
function drawBullets() {
    for (let bullet = 0; bullet < FIRED_BULLETS.length; bullet++) {
        let drawData = FIRED_BULLETS[bullet];
        Bullet.draw(drawData.pos, drawData.rad);
    }
}
function drawCursor() {
    ctx.beginPath();
    ctx.arc(mousePos.x, mousePos.y, CURSOR_RADIUS, 0, 2 * Math.PI);
    ctx.strokeStyle = 'red';
    ctx.stroke();
}

function drawOtherPlayers() {
    Object.keys(EXTERNAL_PLAYERS).forEach(p => {
        EXTERNAL_PLAYERS[p].absoluteDraw();
    });
}

/** Socket listeners */
socket.on('set-id', function(data) {
    console.log("SET ID");
    userID = data.id;
});

socket.on('set-game-info', function(data) {
    delete data.players[userID];

    const playerKeys = Object.keys(data.players);
    playerKeys.forEach(i => {
        let p = data.players[i];
        console.log('adding player with id: ' + p.id);
        const type = getClassFromType(p.type);
        EXTERNAL_PLAYERS[p.id] = new type(p.pos.x, p.pos.y, true);
    });
});

socket.on('game-update', function(data) {
    updateGameStateFromServer(data);
});

socket.on('player-added', function(data) {
    const type = getClassFromType(data.type);
    EXTERNAL_PLAYERS[data.id] = new type(data.pos.x, data.pos.y, true);
});

socket.on('player-removed', function(data) {
    delete EXTERNAL_PLAYERS[data.id];
});

/** Send client updates to server */
function updateServer() {
    socket.emit('client-update', {
        playerPos: player.pos
    });
}

/** Start game */
loadMap();

socket.emit('ready', {
    pos: {x: 500, y: 500}
});

socket.on('set-type', function(d) {
    console.log('SETTING TYPE', d);
    const type = getClassFromType(d.type);
    player = new type(500, 500);

    update();
    setInterval(updateServer, TICK_TIME);
});
