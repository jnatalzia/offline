"use strict";

const MAP_WIDTH = 2000;
const MAP_HEIGHT = 2000;

const DIR_N=0,DIR_S=1,DIR_E=2,DIR_W=3,DIR_NE=4,DIR_NW=5,DIR_SW=6,DIR_SE=7;

const CIVILIANS_PER_ROOM = 8;
const RESET_TIMEOUT = 3000;
const GAME_STATES = {
    LOADING: 0,
    PLAYING: 1,
    CHOOSING_ROOM: 2,
    STARTING: 3,
    PRE_CONNECT: 4,
    GAME_OVER: 5,
    RESET: 6
};

const LOWER_PLAYING_STATES = {
    PHASE_ONE: 0,
    PHASE_TWO: 1
};

const GAME_CONDITIONS = {
    CIVILIANS_SHOT: 0
};

const CIV_VELOCITIES = [1.5, .5, 0, 1, 1.75, 1.25, .75, .25].map(r => {
    let rot = r * Math.PI;
    return {x: Math.cos(rot), y: Math.sin(rot)};
});

const CIV_NOT_NEIGH = [
    [DIR_S, DIR_SE, DIR_SW, DIR_W, DIR_E],
    [DIR_N, DIR_NW, DIR_NE, DIR_W, DIR_E],
    [DIR_NW, DIR_W, DIR_SW, DIR_N, DIR_S],
    [DIR_E, DIR_NE, DIR_SE, DIR_N, DIR_S],
    [DIR_S, DIR_SW, DIR_W, DIR_SE, DIR_NW],
    [DIR_S, DIR_SE, DIR_E, DIR_SW, DIR_NE],
    [DIR_N, DIR_NE, DIR_E, DIR_NW, DIR_SE],
    [DIR_N, DIR_NW, DIR_W, DIR_SW, DIR_NE]
];

/** Types/Enums */
const PLAYER_COURIER = 'COURIER';
const PLAYER_DICTATOR = 'DICTATOR';
const PLAYER_MESSAGE_DROPPER = 'MSGDROPPER';

const PLAYER_ROLE_IDX = {
    'MSGDROPPER': 0,
    'COURIER': 1,
    'DICTATOR': 2
};

const TICK_TIME = 10;//1000/60;
const SERVER_UPDATE_TICK = TICK_TIME * 1.75;
const MAX_DROPPED_ARROWS = 6;
const MAX_DROPPED_MESSAGES = 3;
const CIVILIAN_KILL_CAP = 1;
const PLAYER_WIDTH = 15;
const PLAYER_HEIGHT = 15;

const PIXELS_PER_UNIT = 50;
const GRID_INTERVAL = 5;

const abs = Math.abs;
const max = Math.max;
const min = Math.min;
const pow = Math.pow;
const sqrt = Math.sqrt;

/** Utils */
function genId() {
	return Math.random().toString(36).substring(7);
}

function getRandomEntryInArr(arr) {
    if (!arr.length) {
        throw new Error('Tried to get random entry in empty array');
    }
    return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomEntryInArrWithIdx(arr) {
    let idx = Math.floor(Math.random() * arr.length);
    return [arr[idx], idx];
}

function generateHitbox(pos, size) {
    return {
        x: pos.x - size.w/2,
        y: pos.y - size.h/2,
        w: size.w,
        h: size.h
    };
}

function hasOverlap(hb1, hb2) {
    return !(hb1.x + hb1.w < hb2.x ||
        hb1.x > hb2.x + hb2.w ||
        hb1.y + hb1.h < hb2.y ||
        hb1.y > hb2.y + hb2.h)
}

function isInBounds(pos, size) {
    let hb = getHitbox(pos, size);
    return hb.x > 0 && hb.x + hb.w < MAP_WIDTH && hb,y > 0 && hb.y + hb.h < MAP_HEIGHT;
}

function getPlayerHitbox(u) {
    return {x: u.pos.x - PLAYER_WIDTH / 2, y: u.pos.y - PLAYER_HEIGHT / 2, w: PLAYER_WIDTH, h: PLAYER_HEIGHT};
}

function getDist(pos1, pos2) {
    return Math.sqrt(Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2));
}

function genRemovalFromArray(arr) {
    return function() {
        let idx = arr.indexOf(this);
        arr.splice(idx, 1);
    }
}

function getAdjustedVel(vel, t) {
    return {
        x: vel.x  * (t/TICK_TIME),
        y: vel.y  * (t/TICK_TIME)
    };
}

/** Shared draw classes */
function GroundArrow(x, y, rotation) {
    this.id = genId();
    this.pos = {x: x, y:y};
    this.size = {w: 30, h: 30};
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

GroundArrow.draw = function(pos, rotation, opacity) {
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0,0,0,' + opacity + ')';
    ctx.lineWidth = 4;
    ctx.translate(pos.x, pos.y);
    ctx.translate(0, -5);
    ctx.rotate(rotation);
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

function Bullet(x, y, rotation, removeCB) {
    this.id = genId();
    this.speed = 6;
    this.pos = {x: x, y: y};
    this.origPos = {x: x, y: y};
    this.rotation = rotation;
    this.vel = {};
    this.vel.x = Math.cos(this.rotation) * this.speed;
    this.vel.y = Math.sin(this.rotation) * this.speed;
    this.rad = 5;
    this.remove = removeCB;
    this.size = {w: this.rad * 2, h: this.rad * 2};
}

Bullet.prototype.update = function(t) {
    this.pos.x += this.vel.x * (t/TICK_TIME);
    this.pos.y += this.vel.y * (t/TICK_TIME);

    let distFromStart = getDist(this.pos, this.origPos);
    if (distFromStart > 500) {
        this.remove();
    }
}

Bullet.draw = function (pos, rad) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, rad, 0, 2 * Math.PI);
    ctx.fillStyle = 'red';
    ctx.fill();
    ctx.restore();
}

Bullet.prototype.getHitbox = function() {
    let r2 = this.rad * 2;
    return {
        x: this.pos.x - this.rad + 2,
        y: this.pos.y - this.rad + 2,
        w: (r2) - 4,
        h: (r2) - 4
    }
}

function Message(x, y, destroy) {
    this.id = genId();
    this.pos = {x: x, y: y};
    this.size = {
        w: 20,
        h: 10
    };
    this.coords = [112, 45];
    this.destroy = destroy;
}

Message.draw = function(pos, size) {
    ctx.save();
    ctx.fillStyle = '#eee';
    ctx.strokeStyle = '#00348F';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(pos.x - size.w/2, pos.y - size.h/2, size.w, size.h);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}


Message.prototype.getHitbox = function() {
    return generateHitbox(this.pos, this.size);
}

/** Map Object Classes */

function Building(x, y, w, h) {
    this.pos = {x: x, y: y};
    this.size = {w: w, h: h};
    this.id = genId();
}

Building.draw = function(pos, size) {
    ctx.fillStyle = '#000';
    ctx.lineWidth = 0;
    ctx.fillRect(pos.x - size.w / 2, pos.y - size.h / 2, size.w, size.h);
}

Building.prototype.getHitbox = function () {
    return generateHitbox(this.pos, this.size);
}

/** AI */

const CIV_STATES = {
    WALKING: 1,
    STATIC: 2
};

function Civilian(x, y, buildings, removeCB) {
    this.id = genId();
    this.pos = { x: x, y: y };
    this.size = { w: PLAYER_WIDTH, h: PLAYER_HEIGHT };
    this.vel = {x: 0, y: 0};
    this.speed = 1.25;
    this.remove = removeCB;
    this.timeWaited = 0;
    this.buildings = buildings;
}

let civProto = Civilian.prototype;

civProto.begin = function() {
    this.chooseState();
}

civProto.update = function(t) {
    switch (this.state) {
        case CIV_STATES.WALKING:
            this.updateWalk(t);
            break;
        case CIV_STATES.STATIC:
            this.incrementWaitTime(t);
            break;
        default:
            break;
    }
}

civProto.incrementWaitTime = function(t) {
    this.timeWaited += t;
    if (this.timeWaited > this.maxWaitTime) {
        this.chooseState();
    }
}

civProto.updateWalk = function(t) {
    this.timeWaited += t;
    this.walkTimeWaited += t;
    if (this.walkTimeWaited > this.maxWalkDirTime) {
        this.determineNewVelocity();
    } else if (this.timeWaited > this.maxWaitTime) {
        this.chooseState();
        return;
    }

    let adjustedVel = {
        x: (this.vel.x * (t/TICK_TIME)),
        y: (this.vel.y * (t/TICK_TIME))
    }

    let adjustedPos = {
        x: this.pos.x + adjustedVel.x,
        y: this.pos.y + adjustedVel.y
    };

    if (!this.canWalkHere(adjustedPos.x, adjustedPos.y)) {
        this.determineNewVelocity();
        return;
    }

    this.pos.x += adjustedVel.x;
    this.pos.y += adjustedVel.y;
}

civProto.chooseState = function() {
    let randState = Math.random();

    if (randState < .25) {
        this.maxWaitTime = 7000 + Math.floor(Math.random() * 6000);
        this.timeWaited = 0;
        this.state = CIV_STATES.STATIC;
    } else if (randState >= .25) {
        this.maxWaitTime = 10000 + Math.floor(Math.random() * 8000);
        this.dir = undefined;
        this.velocity = this.determineNewVelocity();
        this.timeWaited = 0;
        this.state = CIV_STATES.WALKING;
    }
}

civProto.determineNewVelocity = function() {
    this.walkTimeWaited = 0;
    this.maxWalkDirTime = 2000 + Math.floor(Math.random() * 500);

    let impossibleDirections = CIV_NOT_NEIGH[this.dir] || [];
    const allNeigh = this.findNeighbours(this.pos.x, this.pos.y);
    let possibleDirections = allNeigh.filter(d => {
        return impossibleDirections.indexOf(d) === -1;
    });

    if (possibleDirections.length === 0) {
        possibleDirections = allNeigh;
    }

    this.dir = getRandomEntryInArr(possibleDirections);
    let baseVel = CIV_VELOCITIES[this.dir];
    this.vel = {x: baseVel.x * this.speed, y: baseVel.y * this.speed};
}

civProto.findNeighbours = function(x, y)
{
    var	N = y - this.size.w,
    S = y + this.size.w,
    E = x + this.size.w,
    W = x - this.size.w,
    myN = this.canWalkHere(x, N),
    myS = this.canWalkHere(x, S),
    myE = this.canWalkHere(E, y),
    myW = this.canWalkHere(W, y),
    result = [];

    if(myN)
    result.push(DIR_N);
    if(myE)
    result.push(DIR_E);
    if(myS)
    result.push(DIR_S);
    if(myW)
    result.push(DIR_W);

    this.DiagonalNeighbours(myN, myS, myE, myW, N, S, E, W, result);

    return result;
}

// South West or North West cell - no squeezing through
// "cracks" between two diagonals
civProto.DiagonalNeighbours = function(myN, myS, myE, myW, N, S, E, W, result)
{
    if(myN)
    {
        if(myE && this.canWalkHere(E, N))
        result.push(DIR_NE);
        if(myW && this.canWalkHere(W, N))
        result.push(DIR_NW);
    }
    if(myS)
    {
        if(myE && this.canWalkHere(E, S))
        result.push(DIR_SE);
        if(myW && this.canWalkHere(W, S))
        result.push(DIR_SW);
    }
}

civProto.canWalkHere = function(x, y) {
    return !(x > MAP_WIDTH - this.size.w ||
        x - this.size.w < 0 || y - this.size.h < 0 ||
        y > MAP_HEIGHT - this.size.h ||
        this.buildings.some(b => hasOverlap(
            generateHitbox({x:x, y:y}, {w:this.size.w, h: this.size.h}),
            b.getHitbox())
        )
    );
}

Civilian.draw = function(pos, size) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(pos.x-size.w/2, pos.y-size.h/2, size.w, size.h);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#111';
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

civProto.getHitbox = function() {
    return generateHitbox(this.pos, this.size);
}
