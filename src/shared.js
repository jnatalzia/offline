"use strict";

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
const PLAYER_WIDTH = 20;
const PLAYER_HEIGHT = 15;

/** Utils */
function genId() {
	return Math.random().toString(36).substring(7);
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

    let distFromStart = Math.sqrt(Math.pow(this.pos.x - this.origPos.x, 2) + Math.pow(this.pos.y - this.origPos.y, 2));
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
    return {
        x: this.pos.x - this.size.w/2,
        y: this.pos.y - this.size.h/2,
        w: this.size.w,
        h: this.size.h
    }
}
