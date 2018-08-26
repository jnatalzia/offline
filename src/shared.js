"use strict";

const MAP_WIDTH = 2500;
const MAP_HEIGHT = 2500;

const DIR_N=0,DIR_S=1,DIR_E=2,DIR_W=3,DIR_NE=4,DIR_NW=5,DIR_SW=6,DIR_SE=7;

/** Types/Enums */
const PLAYER_COURIER = 'COURIER';
const PLAYER_DICTATOR = 'DICTATOR';
const PLAYER_MESSAGE_DROPPER = 'MSGDROPPER';

const PLAYER_ROLE_IDX = {
    'MSGDROPPER': 0,
    'COURIER': 1,
    'DICTATOR': 2
};

const TICK_TIME = 1000/60;
const MAX_DROPPED_ARROWS = 6;
const MAX_DROPPED_MESSAGES = 3;
const PLAYER_WIDTH = 15;
const PLAYER_HEIGHT = 15;

const PIXELS_PER_UNIT = 50;
const GRID_INTERVAL = 5;
const A_STAR_GRID_INTERVAL = GRID_INTERVAL * 5;

const abs = Math.abs;
const max = Math.max;
const min = Math.min;
const pow = Math.pow;
const sqrt = Math.sqrt;

/** Pathing */
let GRID = [];

for (let i = 0; i < MAP_WIDTH; i += A_STAR_GRID_INTERVAL) {
    GRID.push([]);
    let idx = GRID.length - 1;
    for (let k = 0; k < MAP_HEIGHT; k += A_STAR_GRID_INTERVAL) {
        GRID[idx].push({x: i, y: k, cost: 0});
    }
}

// just fill the array with dummy values to pad the empty space.
const worldWidth = GRID[0].length * A_STAR_GRID_INTERVAL;
const worldHeight = GRID.length * A_STAR_GRID_INTERVAL;
const worldSize =	worldWidth * worldHeight;

/** Utils */
function genId() {
	return Math.random().toString(36).substring(7);
}

function getRandomEntryInArr(arr) {
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

function getNodeKey(node) {
    return `n-${node.x}-${node.y}`
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
    this.speed = 10;
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
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;

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

function Civilian(x, y, grid, myChunk, removeCB) {
    this.id = genId();
    this.chunk = myChunk;
    this.pos = { x: x, y: y };
    this.size = { w: PLAYER_WIDTH, h: PLAYER_HEIGHT };
    this.currentPath = [];
    this.vel = {x: 0, y: 0};
    this.speed = 2;
    this.remove = removeCB;
    this.path = [];
    this.pathIdx = 0;
    this.timeWaited = 0;
    this.grid = grid;
    this.chooseState();
}

let civProto = Civilian.prototype;

civProto.update = function(t) {
    switch (this.state) {
        case CIV_STATES.WALKING:
            this.updateWalk();
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

    if (this.timeWaited > this.maxWalkDirTime) {
        this.determineNewVelocity();
    } else if (this.timeWaited > this.maxWaitTime) {
        this.chooseState();
        return;
    }


    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
}

civProto.chooseState = function() {
    console.log('Civilian choosing state');
    let randState = Math.random();

    this.maxWaitTime = 7000 + Math.floor(Math.random() * 6000);
    if (randState < .25) {
        this.timeWaited = 0;
        this.state = CIV_STATES.STATIC;
    } else if (randState >= .25) {
        this.velocity = this.determineNewVelocity();
        this.timeWaited = 0;
        this.state = CIV_STATES.WALKING;
    }
}

civProto.getGridXY = function() {
    let adjustedX = Math.floor(this.pos.x / A_STAR_GRID_INTERVAL);
    let adjustedY = Math.floor(this.pos.y / A_STAR_GRID_INTERVAL);
    return {x: adjustedX, y: adjustedY};
}

civProto.determineNewVelocity = function() {
    this.maxWalkDirTime = 500 + Math.floor(Math.random() * 500);
    let xy = this.getGridXY();
    // console.log(xy);
    let possibleDirections = this.findNeighbours(xy.adjustedX, xy.adjustedY);
    // console.log(possibleDirections);
    this.dir = getRandomEntryInArr(possibleDirections);
}

civProto.findNeighbours = function(x, y)
{
    var	N = y - A_STAR_GRID_INTERVAL,
    S = y + A_STAR_GRID_INTERVAL,
    E = x + A_STAR_GRID_INTERVAL,
    W = x - A_STAR_GRID_INTERVAL,
    myN = N > -A_STAR_GRID_INTERVAL && this.canWalkHere(x, N, this.grid),
    myS = S < worldHeight && this.canWalkHere(x, S, this.grid),
    myE = E < worldWidth && this.canWalkHere(E, y, this.grid),
    myW = W > -A_STAR_GRID_INTERVAL && this.canWalkHere(W, y, this.grid),
    result = [];

    if(myN)
    result.push(DIR_N);
    if(myE)
    result.push(DIR_E);
    if(myS)
    result.push(DIR_S);
    if(myW)
    result.push(DIR_W);

    this.DiagonalNeighbours(myN, myS, myE, myW, N, S, E, W, result, this.grid);

    return result;
}



// returns every available North East, South East,
// South West or North West cell - no squeezing through
// "cracks" between two diagonals
civProto.DiagonalNeighbours = function(myN, myS, myE, myW, N, S, E, W, result)
{
    if(myN)
    {
        if(myE && this.canWalkHere(E, N, this.grid))
        result.push(DIR_NE);
        if(myW && this.canWalkHere(W, N, this.grid))
        result.push(DIR_NW);
    }
    if(myS)
    {
        if(myE && this.canWalkHere(E, S, this.grid))
        result.push(DIR_SE);
        if(myW && this.canWalkHere(W, S, this.grid))
        result.push(DIR_SW);
    }
}

civProto.canWalkHere = function(x, y, grid) {
    return grid[x/A_STAR_GRID_INTERVAL][y/A_STAR_GRID_INTERVAL].cost === 0;
}

/** End astar methods */

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

function Node(Parent, Point)
{
    var newNode = {
        // pointer to another Node object
        Parent:Parent,
        // array index of this Node in the world linear array
        value:Point.x + (Point.y * worldWidth),
        // the location coordinates of this Node
        x:Point.x,
        y:Point.y,
        // the distanceFunction cost to get
        // TO this Node from the START
        f:0,
        // the distanceFunction cost to get
        // from this Node to the GOAL
        g:0
    };

    return newNode;
}