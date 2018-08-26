/** Global constants */
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const CURSOR_RADIUS = 10;

const KEY_CHECKER = {};

/** To be swapped with server logic */
let DROPPED_MESSAGES = [];
let DROPPED_ARROWS = [];
let FIRED_BULLETS = [];
let ACTIVE_CIVILIANS = [];

const EXTERNAL_PLAYERS = [];

let map = [];

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
    this.speed = 2;
    this.isPlayer = !isNotPlayer;
    if (this.isPlayer) {
        this.addEventHandlers();
    }
}

let pp = Player.prototype;

pp.addEventHandlers = function() {
    socket.on('shot', function(data) {
        this.die();
    }.bind(this));
}

pp.die = function() {
    console.log('You died betch');
}

pp.getAdjustedSpeed = function(t) {
    return (KEY_CHECKER[16] ? this.speed * 1.6 : this.speed) * (16/t);
}

pp.update = function(t) {
    // A or <-
    let adjustedSpeed = this.getAdjustedSpeed(t);
    let n, s, e, w;
    if (KEY_CHECKER[65] && this.checkMoveLeft(adjustedSpeed)) {
        w = true;
    }
    if (KEY_CHECKER[87] && this.checkMoveUp(adjustedSpeed)) {
        n = true;
    }
    if (KEY_CHECKER[68] && this.checkMoveRight(adjustedSpeed)) {
        e = true;
    }
    if (KEY_CHECKER[83] && this.checkMoveDown(adjustedSpeed)) {
        s = true;
    }

    let vel = {x: 0, y: 0};
    if (n || s || e || w) {
        let rotation = 1.5; // n
        if (n && w) rotation = 1.25
        else if (n && e) rotation = 1.75
        else if (s && w) rotation = .75
        else if (s && e) rotation = .25
        else if (s) rotation = .5
        else if (w) rotation = 1
        else if (e) rotation = 0;

        rotation *= Math.PI;
        vel.x = Math.cos(rotation) * adjustedSpeed;
        vel.y = Math.sin(rotation) * adjustedSpeed;
    }

    this.pos.x += vel.x;
    this.pos.y += vel.y;
}

pp.getRectCorner = function() {
    return {
        x: this.pos.x - this.size.w/2,
        y: this.pos.y - this.size.h/2
    }
}

pp.checkMove = function (hitbox) {
    for (let i = 0; i < map.length; i++) {
        let b = map[i];
        if (hasOverlap(hitbox, generateHitbox(b.pos, b.size))) {
            return false;
        }
    }

    return true;
}

pp.checkMoveLeft = function(adjSpeed) {
    let topCorner = this.getRectCorner();
    let adjustedHitbox = { x: topCorner.x - adjSpeed, y: topCorner.y, w: this.size.w, h: this.size.h };
    return this.checkMove(adjustedHitbox);
}

pp.checkMoveDown = function(adjSpeed) {
    let topCorner = this.getRectCorner();
    let adjustedHitbox = { x: topCorner.x, y: topCorner.y + adjSpeed, w: this.size.w, h: this.size.h };
    return this.checkMove(adjustedHitbox);
}

pp.checkMoveUp = function(adjSpeed) {
    let topCorner = this.getRectCorner();
    let adjustedHitbox = { x: topCorner.x, y: topCorner.y - adjSpeed, w: this.size.w, h: this.size.h };
    return this.checkMove(adjustedHitbox);
}

pp.checkMoveRight = function(adjSpeed) {
    let topCorner = this.getRectCorner();
    let adjustedHitbox = { x: topCorner.x + adjSpeed, y: topCorner.y, w: this.size.w, h: this.size.h };
    return this.checkMove(adjustedHitbox);
}

pp.draw = function() {
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

pp.absoluteDraw = function() {
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

pp.drawUI = function() {
    if (this.type) {
        ctx.fillStyle = 'white';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'right';
        ctx.fillText("PLAYER TYPE: " + this.type, CANVAS_WIDTH - 10, CANVAS_HEIGHT - 20);
        ctx.strokeText("PLAYER TYPE: " + this.type, CANVAS_WIDTH - 10, CANVAS_HEIGHT - 20);
        ctx.textAlign = 'left';
        let px = this.pos.x.toFixed(2);
        let py = this.pos.y.toFixed(2);
        ctx.fillText("PLAYER POS: " + px + "," + py, 10, CANVAS_HEIGHT - 20);
        ctx.strokeText("PLAYER POS: " + px + "," + py, 10, CANVAS_HEIGHT - 20);
    }
}

pp.getHitbox = function() {
    return {
        x: this.pos.x - this.size.w/2,
        y: this.pos.y - this.size.h/2,
        w: this.size.w,
        h: this.size.h
    }
}

function MsgDropper(x, y) {
    this.super_.apply(this, arguments);

    this.type = PLAYER_MESSAGE_DROPPER;
    this.canDropMessage = true;
    this.droppingMessage = false;
    this.msgDropState = {
        timeDropped: 0
    };
    this.timeToDrop = 1000;
}
inherits(MsgDropper, Player);
let mp = MsgDropper.prototype;
mp.update = function(t) {
    this.super_.prototype.update.call(this, t);

    this.handleMessageDropping(t);
    this.handleArrowDropping(t);
}

mp.addEventHandlers = function () {
    this.super_.prototype.addEventHandlers.apply(this, arguments);
}

mp.handleArrowDropping = function(t) {
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

mp.handleMessageDropping = function(t) {
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

mp.updateCanDrop = function() {
    const canDrop =
        DROPPED_MESSAGES.length < MAX_DROPPED_MESSAGES &&
        !Array.prototype.some.call([65,87,68,83], function(i) { return KEY_CHECKER[i] }) &&
        !this.freezeMsgDrop;

    this.canDropMessage = canDrop;
}

mp.dropMessage = function() {
    addMessage(this.pos);
    this.msgDropState.timeDropped = 0;
    this.droppingMessage = false;
    this.freezeMsgDrop = true;
}

mp.dropArrow = function(rotation) {
    addArrow(this.pos, rotation);
    this.freezeArrowDrop = true;
}

mp.drawUI = function() {
    this.super_.prototype.drawUI.apply(this, arguments);

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

let cp = Courier.prototype;

cp.addEventHandlers = function() {
    this.super_.prototype.addEventHandlers.apply(this, arguments);

    socket.on('message-collision', (msg) => {
        this.canPickUp(msg);
    });
}

cp.update = function(t) {
    this.super_.prototype.update.apply(this, arguments);
    if (!KEY_CHECKER[32]) {
        this.justPickedUp = false;
    }
}

cp.canPickUp = function(msg) {
    if (!this.justPickedUp && KEY_CHECKER[32]) {
        console.log("The encoded message tells you: " + msg.coords);
        socket.emit('destroy-message', { id: msg.id });
        this.justPickedUp = true;
    }
}

cp.getAdjustedSpeed = function(t) {
    return this.speed * (16/t);
}

function Dictator(x, y, isNotPlayer) {
    this.super_.apply(this, arguments);
    this.type = PLAYER_DICTATOR;
}

inherits(Dictator, Player);

let dp = Dictator.prototype;

dp.update = function(t) {
    this.super_.prototype.update.apply(this, arguments);
    if (!KEY_CHECKER[32]) {
        this.justPickedUp = false;
    }
}

dp.canPickUp = function(msg) {
    if (!this.justPickedUp && KEY_CHECKER[32]) {
        socket.emit('destroy-message', { id: msg.id });
        this.justPickedUp = true;
    }
}

dp.addEventHandlers = function() {
    this.super_.prototype.addEventHandlers.apply(this, arguments);

    canvas.addEventListener('click', this.fireBullet.bind(this));

    socket.on('message-collision', (msg) => {
        this.canPickUp(msg);
    });
}

dp.fireBullet = function() {
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
    /** Update Civilians */
    ACTIVE_CIVILIANS = data.civilians;
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

function getNearObjects(arr) {
    let viewHB = generateHitbox({x: player.pos.x, y: player.pos.y}, {w: MAP_WIDTH, h: MAP_HEIGHT});
    return arr.filter(obj => {
        let obhb = generateHitbox(obj.pos, obj.size);
        return hasOverlap(viewHB, obhb);
    });
}

function drawBackground() {
    ctx.save();
    ctx.translate(-player.pos.x + CANVAS_WIDTH/2,-player.pos.y + CANVAS_HEIGHT/2)
    ctx.fillStyle = '#ccc';
    ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    let allObjects = [
        [FIRED_BULLETS, drawBullets],
        [map, drawBuildings],
        [DROPPED_MESSAGES, drawMessages],
        [DROPPED_ARROWS, drawArrows],
        [EXTERNAL_PLAYERS, drawOtherPlayers],
        [ACTIVE_CIVILIANS, drawCivilians]
    ];

    allObjects.forEach(function(arr) {
        let drawFunc = arr[1];
        let filteredArr = getNearObjects(arr[0]);
        drawFunc(filteredArr);
    });
    ctx.restore();
}

function genericObjectDraw(arr, cls) {
    arr.forEach(o => {
        cls.draw(o.pos, o.size);
    });
}

function drawBuildings(buildings) {
    genericObjectDraw(buildings, Building);
}
function drawMessages(msgs) {
    genericObjectDraw(msgs, Message);
}
function drawArrows(arrs) {
    for (let arrow = 0; arrow < arrs.length; arrow++) {
        let drawData = arrs[arrow];
        GroundArrow.draw(drawData.pos, drawData.rotation, drawData.opacity);
    }
}
function drawBullets(bulls) {
    for (let bullet = 0; bullet < bulls.length; bullet++) {
            let drawData = bulls[bullet];
            Bullet.draw(drawData.pos, drawData.rad);
    }
}
function drawCursor() {
    ctx.beginPath();
    ctx.arc(mousePos.x, mousePos.y, CURSOR_RADIUS, 0, 2 * Math.PI);
    ctx.strokeStyle = 'red';
    ctx.stroke();
}

function drawOtherPlayers(plyrs) {
    Object.keys(plyrs).forEach(p => {
        plyrs[p].absoluteDraw();
    });
}

function drawCivilians(civs) {
    genericObjectDraw(civs, Civilian);
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
    map = data.buildings;
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
