/** Global constants */
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 700;

const BOTTOM_UI_HEIGHT = 150;
const BOTTOM_UI_Y = CANVAS_HEIGHT - BOTTOM_UI_HEIGHT;

const CURSOR_RADIUS = 10;

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

/** Utils */

function getClassFromType(type) {
    switch(type) {
        case PLAYER_COURIER:
            return Courier;
        case PLAYER_DICTATOR:
            return Dictator;
    }
}

function getHumanReadableFromType(type) {
    switch(type) {
        case PLAYER_COURIER:
            return 'Courier';
        case PLAYER_DICTATOR:
            return 'Dictator';
    }
}

/** Game State */
let mousePos = { x: 0, y: 0 };
let player;
let globalGameGoal = 'The Courier has not yet picked up the message.';
let killedCivilians = 0;
let globalTime = 0;
let userID;
let currentGameState = GAME_STATES.PRE_CONNECT;
let socket;
let DROPPED_MESSAGES = [];
let FIRED_BULLETS = [];
let ACTIVE_CIVILIANS = [];

let EXTERNAL_PLAYERS = [];
let EXTERNAL_PLAYER_INDICES = {};

let updateInterval;
let didWin;
let gameOverReason;
let resetReason;

function resetGameState() {
    mousePos = { x: 0, y: 0 };
    player.remove();
    player = undefined;
    globalGameGoal = 'The Courier has not yet picked up the message.';
    killedCivilians = 0;
    globalTime = 0;
    userID = undefined;
    EXTERNAL_PLAYERS = [];
    EXTERNAL_PLAYER_INDICES = [];
    DROPPED_MESSAGES = [];
    FIRED_BULLETS = [];
    ACTIVE_CIVILIANS = [];

    EXTERNAL_PLAYERS = [];
    EXTERNAL_PLAYER_INDICES = {};
    didWin = undefined;
    clearInterval(updateInterval);
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

/** Player Class */
function Player(x, y, isNotPlayer) {
    this.pos = { x: x, y: y };
    this.vel = {x: 0 ,y: 0};
    this.size = { w: PLAYER_WIDTH, h: PLAYER_HEIGHT };
    this.speed = this.origSpeed = 2;
    this.isPlayer = !isNotPlayer;
    this.job = 'Do a thing.';
    this.fillStyle = 'blue';
    this.controls = [
        { key: 'WSAD', job: 'Moves the Player' }
    ]
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
    return (KEY_CHECKER[16] ? this.speed * 1.6 : this.speed);
}

pp.remove = function() {

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

    let vel = this.vel = {x: 0, y: 0};
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
        vel.x = Math.cos(rotation) * adjustedSpeed * (t/TICK_TIME);
        vel.y = Math.sin(rotation) * adjustedSpeed * (t/TICK_TIME);
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
        if (hasOverlap(hitbox, generateHitbox(b.pos, {w: b.size.w + 2, h: b.size.h + 2}))) {
            return false;
        }
    }

    return true;
}

pp.checkMoveLeft = function(adjSpeed) {
    let topCorner = this.getRectCorner();
    let adjustedHitbox = { x: topCorner.x - adjSpeed, y: topCorner.y, w: this.size.w, h: this.size.h };
    return topCorner.x > 0 && this.checkMove(adjustedHitbox);
}

pp.checkMoveDown = function(adjSpeed) {
    let topCorner = this.getRectCorner();
    let adjustedHitbox = { x: topCorner.x, y: topCorner.y + adjSpeed, w: this.size.w, h: this.size.h };
    return topCorner.y + this.size.h < MAP_HEIGHT && this.checkMove(adjustedHitbox);
}

pp.checkMoveUp = function(adjSpeed) {
    let topCorner = this.getRectCorner();
    let adjustedHitbox = { x: topCorner.x, y: topCorner.y - adjSpeed, w: this.size.w, h: this.size.h };
    return topCorner.y > 0 && this.checkMove(adjustedHitbox);
}

pp.checkMoveRight = function(adjSpeed) {
    let topCorner = this.getRectCorner();
    let adjustedHitbox = { x: topCorner.x + adjSpeed, y: topCorner.y, w: this.size.w, h: this.size.h };
    return topCorner.x + this.size.w < MAP_WIDTH && this.checkMove(adjustedHitbox);
}

pp.draw = function() {
    ctx.save();
    ctx.translate(CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
    ctx.beginPath();
    ctx.rect(-this.size.w/2, -this.size.h/2, this.size.w, this.size.h);
    ctx.fillStyle = this.fillStyle;
    ctx.strokeStyle = '#111';
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

pp.absoluteDraw = function(t) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.beginPath();
    ctx.rect(-this.size.w/2, -this.size.h/2, this.size.w, this.size.h);
    ctx.fillStyle = player.type === PLAYER_DICTATOR ? '#fff' : this.fillStyle;
    ctx.strokeStyle = '#111';
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

pp.drawUI = function() {
    this.drawBottomUI();
    this.drawTopUI();

    // Top left white box
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.fillRect(0, 0, 120, 55);
}

pp.drawTopUI = function() {
    ctx.save();
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH/6, 0);
    ctx.lineTo(CANVAS_WIDTH/6, 50);
    ctx.lineTo(CANVAS_WIDTH - CANVAS_WIDTH/6, 50);
    ctx.lineTo(CANVAS_WIDTH - CANVAS_WIDTH/6, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'black';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(globalGameGoal, CANVAS_WIDTH/2, 25);

    ctx.restore();
}

pp.drawBottomUI = function () {
    ctx.save();
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;

    ctx.fillRect(0, BOTTOM_UI_Y, CANVAS_WIDTH, BOTTOM_UI_HEIGHT);
    ctx.beginPath();
    ctx.moveTo(0, BOTTOM_UI_Y);
    ctx.lineTo(CANVAS_WIDTH, BOTTOM_UI_Y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH/6, BOTTOM_UI_Y);
    ctx.lineTo(CANVAS_WIDTH/6 - 15, BOTTOM_UI_Y + 75);
    ctx.lineTo(CANVAS_WIDTH - CANVAS_WIDTH/6 - 15, BOTTOM_UI_Y + 75);
    ctx.lineTo(CANVAS_WIDTH - CANVAS_WIDTH/6, BOTTOM_UI_Y);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'black';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(this.job, CANVAS_WIDTH/2, BOTTOM_UI_Y + 75/2);

    ctx.restore();

    this.drawControls();
}

pp.drawControls = function() {
    let controlsString = this.controls.map(c => {
        return c.key + ': ' + c.job;
    }).join(' | ');

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'black';
    ctx.font = 'bold 12px Arial';
    ctx.fillText(controlsString, CANVAS_WIDTH/2, BOTTOM_UI_Y + 75 * 1.5);
}

pp.getHitbox = function() {
    return {
        x: this.pos.x - this.size.w/2,
        y: this.pos.y - this.size.h/2,
        w: this.size.w,
        h: this.size.h
    }
}

function Courier(x, y) {
    this.super_.apply(this, arguments);

    this.type = PLAYER_COURIER;
    this.nearbyMessages = [];
    this.job = 'Find a Message and Deliver it to the Homebase. Blend in.';
    this.controls = this.controls.concat([
        {key: 'Space', job: 'Press to Pick up a Message'}
    ]);
}

inherits(Courier, Player);

let cp = Courier.prototype;

cp.addEventHandlers = function() {
    this.super_.prototype.addEventHandlers.apply(this, arguments);
}

cp.update = function(t) {
    this.super_.prototype.update.apply(this, arguments);
    if (!KEY_CHECKER[32]) {
        this.justPickedUp = false;
    } else {
        for (let m = 0; m < DROPPED_MESSAGES.length; m++) {
			let msg = DROPPED_MESSAGES[m];
			if (hasOverlap(this.getHitbox(), generateHitbox(msg.pos, msg.size))) {
				this.canPickUp(msg);
				break;
			}
		}
    }
}

cp.startPhaseTwo = function(data) {
    this.speed = this.origSpeed * 1.6;
    this.destination = data.destination;
    this.job = 'Get Back to the Base!';
}

cp.canPickUp = function(msg) {
    if (!this.justPickedUp && KEY_CHECKER[32]) {
        console.log("The encoded message tells you: " + msg.coords);
        socket.emit('destroy-message', { id: msg.id, courier: true });
        this.justPickedUp = true;
    }
}

cp.getAdjustedSpeed = function(t) {
    return this.speed;
}

cp.drawUI = function() {
    this.super_.prototype.drawUI.apply(this, arguments);

    ctx.save();

    if (this.destination) {
        let arrowRot = adjustArrowRotation(Math.atan2((this.destination.y - this.pos.y), (this.destination.x - this.pos.x)));
        GroundArrow.draw(
            {x: CANVAS_WIDTH - 40, y: 45},
            arrowRot
        );
    }

    ctx.restore();
}

function Dictator(x, y, isNotPlayer) {
    this.super_.apply(this, arguments);
    this.type = PLAYER_DICTATOR;
    this.job = 'Find and Eliminate the Courier. Do not shoot more than 1 civilian.';
    this.fillStyle = 'red';
    this.controls = this.controls.concat([
        {key: 'Space', job: 'Press to Destroy up a Message'},
        {key: 'Click', job: 'Shoot'},
        {key: 'L Shift', job: 'Sprint'}
    ]);
}

inherits(Dictator, Player);

let dp = Dictator.prototype;

dp.update = function(t) {
    this.super_.prototype.update.apply(this, arguments);
    if (!KEY_CHECKER[32]) {
        this.justPickedUp = false;
    } else {
        for (let m = 0; m < DROPPED_MESSAGES.length; m++) {
			let msg = DROPPED_MESSAGES[m];
			if (hasOverlap(this.getHitbox(), generateHitbox(msg.pos, msg.size))) {
				this.canPickUp(msg);
				break;
			}
		}
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
    this.boundClickHandler = this.fireBullet.bind(this);
    canvas.addEventListener('click', this.boundClickHandler);
}

dp.fireBullet = function() {
    let derivedRadianRotation = Math.atan2((mousePos.y - CANVAS_HEIGHT / 2), (mousePos.x - CANVAS_WIDTH / 2));
    addBullet(this.pos, derivedRadianRotation, this);
}

dp.drawUI = function() {
    this.super_.prototype.drawUI.apply(this, arguments);

    ctx.save();

    ctx.textAlign = 'center';
    ctx.fillStyle = killedCivilians > 0 ? 'red': 'black';
    ctx.font = 'bold 12px Arial';
    ctx.fillText(`${killedCivilians}/${CIVILIAN_KILL_CAP} Civilians Killed.`, 100/2 + 10, 30);

    ctx.restore();

    if (this.trackingCourier) {
        if (!getNearObjects([EXTERNAL_PLAYERS[0]]).length) {
            let cou = EXTERNAL_PLAYERS[0]; // change me when we get three back
            let arrowRot = adjustArrowRotation(Math.atan2((cou.pos.y - this.pos.y), (cou.pos.x - this.pos.x)));
            GroundArrow.draw(
                {x: CANVAS_WIDTH - 40, y: 45},
                arrowRot
            );
        }
    }
}

dp.startPhaseTwo = function() {
    this.job = 'The courier is running! Kill them before they get back to base.';
    this.trackingCourier = true;
}

dp.remove = function() {
    this.super_.prototype.drawUI.apply(this, arguments);
    canvas.removeEventListener('click', this.boundClickHandler);
}

function updateGameStateFromServer(data) {
    let players = data.players.filter(p => p.id !== userID);
    players.forEach(p => {
        let internalP = EXTERNAL_PLAYERS[EXTERNAL_PLAYER_INDICES[p.id]];
        internalP.pos = p.pos;
        internalP.vel = p.vel;
    });
    /** Update Bullets */
    FIRED_BULLETS = data.bullets;
    /** Update Messages */
    DROPPED_MESSAGES = data.messages;
    /** Update Civilians */
    ACTIVE_CIVILIANS = data.civilians;
    /** Update civies killed stats */
    killedCivilians = data.civiliansKilled;
}

/** Main Update Loop */
function update(time) {
    let deltaTime = time - globalTime;

    switch(currentGameState) {
        case GAME_STATES.LOADING:
            break;
        case GAME_STATES.PLAYING:
            player.update(deltaTime);
            drawPlaying(deltaTime);
            break;
        case GAME_STATES.CHOOSING_ROOM:
            chooseRoomUpdate();
            break;
        case GAME_STATES.STARTING:
            drawPregame();
            break;
        case GAME_STATES.PRE_CONNECT:
            updateMainMenu();
            drawMainMenu();
            break;
        case GAME_STATES.RESET:
            drawResetScreen();
            break;
        case GAME_STATES.GAME_OVER:
            updateGameOverScreen();
            drawGameOverScreen();
            break;
    }
    window.requestAnimationFrame(update);
    globalTime = time;
}

function chooseRoomUpdate() {
    drawChooseScreen();
}

/** Main Draw Loop */
function drawPlaying(t) {
    clearBoard();
    drawBackground(t);
    player.draw();
    drawUI();
}
function drawUI() {
    drawCursor();
    player.drawUI();
}
function drawChooseScreen() {
    clearBoard();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'black';
    ctx.font = 'bold 24px Arial';
    let plysLeft = 1 - EXTERNAL_PLAYERS.length;
    if (player && player.type) ctx.fillText(`You are the ${getHumanReadableFromType(player.type)}.`, CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 30);
    ctx.fillText(`Waiting for ${plysLeft} more player${plysLeft === 1 ? '' : 's'}.`, CANVAS_WIDTH/2, CANVAS_HEIGHT/2);

    ctx.restore();
}

function updateMainMenu() {
    if (KEY_CHECKER[32]) {
        currentGameState = GAME_STATES.LOADING;
        console.log('Connecting socket');
        connectSocket();
    }
}

function drawMainMenu() {
    clearBoard();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'black';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`Press Space to join an available room.`, CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
    ctx.restore();
}

function drawResetScreen() {
    clearBoard();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'black';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`${resetReason} Finding you a new room in ${RESET_TIMEOUT/1000} seconds`, CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
    ctx.restore();
}

function drawPregame() {
    clearBoard();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'black';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`You are the ${getHumanReadableFromType(player.type)}.`, CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 30);
    ctx.fillText(`All players loaded. Game starting in 3 seconds.`, CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 30);

    ctx.restore();
}

function getGameOverReasonText() {
    switch(gameOverReason) {
        case GAME_CONDITIONS.CIVILIANS_SHOT:
            return 'Too many civilians died.';
        case GAME_CONDITIONS.SHOT_COURIER:
            return 'The courier has been shot!';
        case GAME_CONDITIONS.COURIER_UNHARMED:
            return 'The courier made it to the destination unharmed.';
        default:
            return 'Unknown win reason.';
    }

}

function updateGameOverScreen() {
    if (KEY_CHECKER[32]) {
        currentGameState = GAME_STATES.RESET;
        resetReason = 'Starting a new game!';
        setTimeout(() => {
            currentGameState = GAME_STATES.CHOOSING_ROOM;
            socket.emit('find-room');
        }, RESET_TIMEOUT);
    }
}

function drawGameOverScreen() {
    clearBoard();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'black';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`You ${didWin ? 'won!' : 'lost.'} Press Space to play again.`, CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 30);
    ctx.fillText(getGameOverReasonText(), CANVAS_WIDTH/2, CANVAS_HEIGHT/2);

    ctx.restore();
}

function clearBoard() {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function getNearObjects(arr) {
    let viewHB = generateHitbox({x: player.pos.x, y: player.pos.y}, {w: CANVAS_WIDTH, h: CANVAS_HEIGHT});
    return arr.filter(obj => {
        let obhb = generateHitbox(obj.pos, obj.size);
        return hasOverlap(viewHB, obhb);
    });
}

function drawBackground(t) {
    ctx.save();
    ctx.translate(-player.pos.x + CANVAS_WIDTH/2,-player.pos.y + CANVAS_HEIGHT/2)
    ctx.fillStyle = '#ccc';
    ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    if (player.type === PLAYER_COURIER && player.destination) {
        ctx.fillStyle = 'red';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.fillRect(player.destination.x - DEST_SIZE.w/2, player.destination.y - DEST_SIZE.h/2, DEST_SIZE.w, DEST_SIZE.h);
        ctx.strokeRect(player.destination.x - DEST_SIZE.w/2, player.destination.y - DEST_SIZE.h/2, DEST_SIZE.w, DEST_SIZE.h);
    }

    let allObjects = [
        [FIRED_BULLETS, drawBullets],
        [map, drawBuildings],
        [DROPPED_MESSAGES, drawMessages],
        [EXTERNAL_PLAYERS, drawOtherPlayers],
        [ACTIVE_CIVILIANS, drawCivilians]
    ];

    allObjects.forEach(function(arr) {
        let drawFunc = arr[1];
        let filteredArr = getNearObjects(arr[0]);
        drawFunc(filteredArr, t);
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
function drawBullets(bulls, t) {
    for (let bullet = 0; bullet < bulls.length; bullet++) {
        let drawData = bulls[bullet];
        let bulletVel = getAdjustedVel(drawData.vel, t);
        drawData.pos = {x: drawData.pos.x + (bulletVel.x), y: drawData.pos.y + (bulletVel.y)}
        Bullet.draw(drawData.pos, drawData.rad);
    }
}
function drawCursor() {
    ctx.beginPath();
    ctx.arc(mousePos.x, mousePos.y, CURSOR_RADIUS, 0, 2 * Math.PI);
    ctx.strokeStyle = 'red';
    ctx.stroke();
}

function drawOtherPlayers(plyrs, t) {
    Object.keys(plyrs).forEach(p => {
        plyrs[p].absoluteDraw(t);
    });
}

function drawCivilians(civs) {
    genericObjectDraw(civs, Civilian);
}

/** Socket listeners */
function connectSocket() {
    socket = io({ upgrade: false, transports: ["websocket"] });
    socket.on('set-start', function(data) {
        userID = data.id;
        player.pos = data.pos;
        socket.emit('ready', {
            pos: {x: player.pos.x, y: player.pos.y}
        });
    });

    socket.on('game-start', function(data) {
        console.log("Game start");
        currentGameState = GAME_STATES.PLAYING;
        updateInterval = setInterval(updateServer, SERVER_UPDATE_TICK);
    });

    socket.on('set-game-info', function(data) {
        const players = data.players.filter(p => p.id !== userID);
        players.forEach(p => {
            const type = getClassFromType(p.type);
            EXTERNAL_PLAYER_INDICES[p.id] = EXTERNAL_PLAYERS.length;
            let newPlayer = new type(p.pos.x, p.pos.y, true)
            EXTERNAL_PLAYERS.push(newPlayer);
            newPlayer.vel = data.vel;
        });
        map = data.buildings;
    });

    socket.on('game-update', function(data) {
        updateGameStateFromServer(data);
    });

    socket.on('player-added', function(data) {
        const type = getClassFromType(data.type);
        EXTERNAL_PLAYER_INDICES[data.id] = EXTERNAL_PLAYERS.length;
        let p = new type(data.pos.x, data.pos.y, true)
        EXTERNAL_PLAYERS.push(p);
        p.vel = data.vel;
    });

    socket.on('player-removed', function(data) {
        let playerIdx = EXTERNAL_PLAYER_INDICES[data.id];
        EXTERNAL_PLAYERS.splice(playerIdx, 1);
        delete EXTERNAL_PLAYER_INDICES[data.id];
    });

    socket.on('set-state', function(data) {
        currentGameState = data.state;

        if (data.reset) {
            console.log('Got reset state');
            resetGameState();
            resetReason = 'A player left.'
            setTimeout(() => {
                socket.emit('find-room');
            }, RESET_TIMEOUT);
        }
    });

    socket.on('set-type', function(d) {
        const type = getClassFromType(d.type);
        player = new type(-1, -1);
    });

    socket.on('start-phase-two', function(data) {
        globalGameGoal = 'The Courier has the Message!';
        player.startPhaseTwo(data);
    });

    socket.on('game-over', data => {
        console.log('Game over achieved');
        resetGameState();
        currentGameState = GAME_STATES.GAME_OVER;
        didWin = data.didWin;
        gameOverReason = data.reason;
    });
}

/** Send client updates to server */
function updateServer() {
    socket.emit('client-update', {
        playerPos: player.pos,
        playerVel: player.vel
    });
}

/** Start game */
update();
