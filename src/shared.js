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
const aStarGridInterval = GRID_INTERVAL * 2;

const abs = Math.abs;
const max = Math.max;
const pow = Math.pow;
const sqrt = Math.sqrt;

/** Pathing */
let GRID = [];

for (let i = 0; i <= MAP_WIDTH; i += aStarGridInterval) {
    GRID.push([]);
    let idx = GRID.length - 1;
    for (let k = 0; k <= MAP_HEIGHT; k += aStarGridInterval) {
        GRID[idx].push({x: i, y: k});
    }
}

// just fill the array with dummy values to pad the empty space.
const worldWidth = GRID[0].length * aStarGridInterval;
const worldHeight = GRID.length * aStarGridInterval;
const worldSize =	worldWidth * worldHeight;

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

function Civilian(x, y, map, removeCB) {
    this.id = genId();
    this.distanceFunction = this.DiagonalDistance;
    this.findNeighbours = this.DiagonalNeighbours;
    this.pos = { x: x, y: y };
    this.size = { w: PLAYER_WIDTH, h: PLAYER_HEIGHT };
    this.currentPath = [];
    this.vel = {x: 0, y: 0};
    this.speed = 2;
    this.remove = removeCB;
    this.path = [];
    this.pathIdx = 0;
    this.timeWaited = 0;
    this.obstacles = map;
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

civProto.updateWalk = function() {
    if (this.isAtDest()) {
        this.pathIdx++;
        let newDest = this.path[this.pathIdx];

        if (newDest) {
            let derivedRadianRotation = Math.atan2((newDest.y - this.pos.y), (newDest.x - this.pos.x));
            this.vel.x = Math.cos(derivedRadianRotation) * this.speed;
            this.vel.y = Math.sin(derivedRadianRotation) * this.speed;
        } else {
            this.pos = this.path[this.pathIdx - 1];
            this.path = [];
            this.chooseState();
            this.vel = {x: 0, y: 0};
        }
    }

    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
}

civProto.chooseState = function() {
    let randState = Math.random();

    if (randState < .25) {
        this.timeWaited = 0;
        this.maxWaitTime = 7000 + Math.floor(Math.random() * 6000);
        this.state = CIV_STATES.STATIC;
    } else if (randState >= .25) {
        this.dest = this.determineNewDest();
        this.path = this.determinePath();
        this.pathIdx = 0;
        this.state = CIV_STATES.WALKING;
    }
}

civProto.shouldUpdatePath = function() {
    // return getDist(this.pos, this.currentDest) < 2;
    return this.path.length === 0;
}

civProto.isAtDest = function() {
    return getDist(this.pos, this.path[this.pathIdx]) < 1;
}

civProto.heuristic = function(end, node) {
    dx = abs(end.x - node.x);
    dy = abs(end.y - node.y);
    return 1 * (dx + dy) + (1 - 2 * 1) * min(dx, dy)
}

civProto.determineNewDest = function () {
    let bOverlap = true;
    let randDestX, randDestY;
    while (bOverlap) {
        randDestY = getRandomEntryInArr(BUILD_Y_OPTS);
        randDestX = getRandomEntryInArr(BUILD_X_OPTS);

        bOverlap = this.obstacles.some(b => {
            let hb = b.getHitbox();
            let destHB = generateHitbox({x: randDestX, y: randDestY}, {w: PLAYER_WIDTH, h: PLAYER_HEIGHT})
            return hasOverlap(hb, destHB);
        });

        bOverlap = bOverlap || getDist(this.pos, {x: randDestX, y: randDestY}) < 30;
    }

    return {x: randDestX, y: randDestY};
}

/** Astar methods */
civProto.DiagonalDistance = function(Point, Goal)
{	// diagonal movement - assumes diag dist is 1, same as cardinals
    return max(abs(Point.x - Goal.x), abs(Point.y - Goal.y));
}

civProto.Neighbours = function(x, y)
{
    var	N = y - aStarGridInterval,
    S = y + aStarGridInterval,
    E = x + aStarGridInterval,
    W = x - aStarGridInterval,
    myN = N > -aStarGridInterval && this.canWalkHere(x, N, this.obstacles),
    myS = S < worldHeight && this.canWalkHere(x, S, this.obstacles),
    myE = E < worldWidth && this.canWalkHere(E, y, this.obstacles),
    myW = W > -aStarGridInterval && this.canWalkHere(W, y, this.obstacles),
    result = [];

    if(myN)
    result.push({x:x, y:N});
    if(myE)
    result.push({x:E, y:y});
    if(myS)
    result.push({x:x, y:S});
    if(myW)
    result.push({x:W, y:y});

    this.findNeighbours(myN, myS, myE, myW, N, S, E, W, result, this.obstacles);

    return result;
}



// returns every available North East, South East,
// South West or North West cell - no squeezing through
// "cracks" between two diagonals
civProto.DiagonalNeighbours = function(myN, myS, myE, myW, N, S, E, W, result)
{
    if(myN)
    {
        if(myE && this.canWalkHere(E, N, this.obstacles))
        result.push({x:E, y:N});
        if(myW && this.canWalkHere(W, N, this.obstacles))
        result.push({x:W, y:N});
    }
    if(myS)
    {
        if(myE && this.canWalkHere(E, S, this.obstacles))
        result.push({x:E, y:S});
        if(myW && this.canWalkHere(W, S, this.obstacles))
        result.push({x:W, y:S});
    }
}

civProto.determinePath = function() {
    var pathStart = this.pos;
    var pathEnd = this.dest;
	// the world data are integers:
	// anything higher than this number is considered blocked
	// this is handy is you use numbered sprites, more than one
	// of which is walkable road, grass, mud, etc
	var maxWalkableTileNum = 0;
	// keep track of the world dimensions
	// Note that this A-star implementation expects the world array to be square:
	// it must have equal height and width. If your game world is rectangular,
    var	mypathStart = Node(null, {x:pathStart.x, y:pathStart.y});
    var mypathEnd = Node(null, {x:pathEnd.x, y:pathEnd.y});
    // create an array that will contain all world cells
    var AStar = new Array(worldSize);
    // list of currently open Nodes
    var Open = [mypathStart];
    // list of closed Nodes
    var Closed = [];
    // list of the final output array
    var result = [];
    // reference to a Node (that is nearby)
    var myNeighbours;
    // reference to a Node (that we are considering now)
    var myNode;
    // reference to a Node (that starts a path in question)
    var myPath;
    // temp integer variables used in the calculations
    var length, max, min, i, j;
    // iterate through the open list until none are left
    while(length = Open.length)
    {
        max = worldSize;
        min = -1;
        for(i = 0; i < length; i++)
        {
            if(Open[i].f < max)
            {
                max = Open[i].f;
                min = i;
            }
        }
        // grab the next node and remove it from Open array
        myNode = Open.splice(min, 1)[0];
        // is it the destination node?
        if(myNode.value === mypathEnd.value)
        {
            myPath = Closed[Closed.push(myNode) - 1];
            do
            {
                result.push({x: myPath.x, y: myPath.y});
            }
            while (myPath = myPath.Parent);
            // clear the working arrays
            AStar = Closed = Open = [];
            // we want to return start to finish
            result.reverse();
        }
        else // not the destination
        {
            // find which nearby nodes are walkable
            myNeighbours = this.Neighbours(myNode.x, myNode.y, this.obstacles);
            // test each one that hasn't been tried already
            for(i = 0, j = myNeighbours.length; i < j; i++)
            {
                myPath = Node(myNode, myNeighbours[i]);
                if (!AStar[myPath.value])
                {
                    // estimated cost of this particular route so far
                    myPath.g = myNode.g + this.distanceFunction(myNeighbours[i], myNode);
                    // estimated cost of entire guessed route to the destination
                    myPath.f = myPath.g + this.distanceFunction(myNeighbours[i], mypathEnd);
                    // remember this new path for testing above
                    Open.push(myPath);
                    // mark this node in the world graph as visited
                    AStar[myPath.value] = true;
                }
            }
            // remember this route as having no more untested options
            Closed.push(myNode);
        }
    } // keep iterating until until the Open list is empty
    return result;
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

civProto.canWalkHere = function(x, y) {
    return !this.obstacles.some(b => {
        let hb = generateHitbox({x: x, y: y}, {w: aStarGridInterval, h: aStarGridInterval});
        return hasOverlap(hb, b.getHitbox());
    });
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