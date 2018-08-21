"use strict";

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 1000;

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

/** Utils */
function genId() {
	return Math.random().toString(36).substring(7);
}

function getRandomEntryInArr(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
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

function Civilian(x, y, destX, destY, removeCB) {
    this.pos = { x: x, y: y };
    this.size = { w: PLAYER_WIDTH, h: PLAYER_HEIGHT };
    this.dest = { x: destX, y: destY };
    this.currentDest = { x: x, y: y };
    this.vel = {x: 0, y: 0};
    this.speed = 2;
    this.remove = removeCB;
}

Civilian.prototype.update = function(obstacles) {
    if (this.shouldUpdatePath()) {
        this.determineDestination(obstacles);
    }
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
}

Civilian.prototype.shouldUpdatePath = function() {
    return getDist(this.pos, this.currentDest) < 2;
}

Civilian.prototype.isAtDest = function() {
    return getDist(this.pos, this.dest) < this.size.w;
}

Civilian.prototype.determineDestination = function(obstacles) {
    // check if main dest is met
    if (this.isAtDest()) {
        this.dest = {x: Math.floor(Math.random() * MAP_WIDTH), y: Math.floor(Math.random() * MAP_HEIGHT)};
        return;
    }

    let options = [
        {x: this.pos.x - GRID_INTERVAL, y: this.pos.y - GRID_INTERVAL }, //top left
        {x: this.pos.x - GRID_INTERVAL, y: this.pos.y }, // left
        {x: this.pos.x - GRID_INTERVAL, y: this.pos.y + GRID_INTERVAL }, //bottom left
        {x: this.pos.x, y: this.pos.y - GRID_INTERVAL }, //top
        {x: this.pos.x + GRID_INTERVAL, y: this.pos.y - GRID_INTERVAL }, //top right
        {x: this.pos.x + GRID_INTERVAL, y: this.pos.y }, // right
        {x: this.pos.x + GRID_INTERVAL, y: this.pos.y + GRID_INTERVAL }, //bottom right
        {x: this.pos.x, y: this.pos.y + GRID_INTERVAL } //bottom
    ];

    let sortedOptions = [];

    options.forEach(opt => {
        let d = getDist(opt, this.dest);
        opt.dist = d;
    });
    sortedOptions = options.sort((a, b) => {
        return a.dist - b.dist;
    });


    for (let i = 0; i < sortedOptions.length; i++) {
        let hasAnyOverlap = obstacles.some(o => {
            return hasOverlap(generateHitbox(sortedOptions[i], this.size), o.getHitbox())
        });

        if (!hasAnyOverlap) {
            this.currentDest = {x: sortedOptions[i].x, y: sortedOptions[i].y};
            this.rotation = Math.atan2((this.currentDest.y - this.pos.y), (this.currentDest.x - this.pos.x));
            this.vel.x = Math.cos(this.rotation) * this.speed;
            this.vel.y = Math.sin(this.rotation) * this.speed;
            return;
        }
    }
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

Civilian.prototype.getHitbox = function() {
    return generateHitbox(this.pos, this.size);
}