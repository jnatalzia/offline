"use strict";

/**
 * User sessions
 * @param {Array} users
 */
const users = [];
const ROOMS = {

};

/** Server constants */
let BUILDING_WIDTHS = [0, 1, 2, 3, 4, 5, 6].map(n => 100 + (n*GRID_INTERVAL));
let MAX_BUILDING_WIDTH = BUILDING_WIDTHS[BUILDING_WIDTHS.length - 1];

let BUILD_X_OPTS = [];
let adjustedWidth = Math.floor(MAP_WIDTH - MAX_BUILDING_WIDTH / 2);
for (let i = MAX_BUILDING_WIDTH / 2; i < adjustedWidth; i += GRID_INTERVAL) {
    BUILD_X_OPTS.push(i);
}
let adjustedHeight = Math.floor(MAP_HEIGHT - MAX_BUILDING_WIDTH / 2);
let BUILD_Y_OPTS = [];
for (let i = MAX_BUILDING_WIDTH / 2; i < adjustedHeight; i += GRID_INTERVAL) {
    BUILD_Y_OPTS.push(i);
}

const X_CHUNKS = 8;
const Y_CHUNKS = 8;

const X_INTERVALS_PER_CHUNK = Math.floor(BUILD_X_OPTS.length / X_CHUNKS);
const Y_INTERVALS_PER_CHUNK = Math.floor(BUILD_Y_OPTS.length / Y_CHUNKS);

const NUM_BUILDINGS = X_CHUNKS * Y_CHUNKS;

/**
 * Remove user session
 * @param {User} user
 */
function removeUser(user) {
	users.splice(users.indexOf(user), 1);
	if (user.room) user.room.removeUser(user);
}

/** Room Handling */
function findRoom(user) {
	console.log('Finding room for user: ' + user.id);
	let roomIds = Object.keys(ROOMS);
	for (let i = 0; i < roomIds.length; i++) {
		let room = ROOMS[roomIds[i]];
		if (room.roomHasSpace()) {
			room.addUser(user);
			return;
		}
	}

	let rid = createRoom();
    ROOMS[rid].addUser(user);
}

function createRoom() {
	let roomId = genId();
    ROOMS[roomId] = new GameRoom(roomId);
    console.log('Created a new room with id: ' + roomId);
	return roomId;
}

/**
 * GameRoom class
 */
class GameRoom {
	constructor(id) {
		this.users = {};
		this.takenRoles = [0, 0, 0];
		this.id = id;
		this.waitingForPlayers = true;
		this.bullets = [];
		this.arrows = [];
		this.activeArrows = 0;
        this.messages = [];
        let map = this.generateMap();
        this.buildings = map.buildings;
		this.civilians = [];
		this.prevTime = Date.now();
        // TEST DATA
		for (let i = 0; i < 20; i++) {
			let civ = this.genCivilian();
            this.civilians.push(civ);
        }
        this.setupUpdate();
	}

	genCivilian() {
        const time = Date.now();
		let bOverlap = true;
        let randX, randY;
        let count = 0;
		while (bOverlap) {
            count++;
            randX = getRandomEntryInArr(BUILD_X_OPTS);
			randY = getRandomEntryInArr(BUILD_Y_OPTS);
			bOverlap = this.buildings.some(b => {
				return hasOverlap(generateHitbox({x: randX, y: randY}, {w:PLAYER_WIDTH, h: PLAYER_HEIGHT}), b.getHitbox());
			});
		}
        let c = new Civilian(
            randX, randY,
            this.buildings,
            genRemovalFromArray(this.civilians)
        );
        const diff = Date.now() - time;
        return c;
	}

	generateMap() {
        let map = [];
		for (let i = 0; i < NUM_BUILDINGS; i++) {
            let b = this.generateBuilding(i);

			let count = 0;
            while (this.buildingOverlapsCurrent(b, map)) {
				b = this.generateBuilding(i);
			}


            map.push(b);
		}
        return {buildings: map};
    }

    buildingOverlapsCurrent(b, map) {
        for (let eb = 0; eb < map.length; eb++) {
            if (hasOverlap(b.getHitbox(), map[eb].getHitbox())) {
                return true;
            }
        }
    }

    generateBuilding(idx) {
        let xAdjustedIndex = idx % X_CHUNKS;
		let yAdjustedIndex = Math.floor(idx / X_CHUNKS);

        /** Could make this a static array and pull from idx /shrug */
        let xChunk = BUILD_X_OPTS.slice((xAdjustedIndex * X_INTERVALS_PER_CHUNK), (xAdjustedIndex * X_INTERVALS_PER_CHUNK) + X_INTERVALS_PER_CHUNK);
        let yChunk = BUILD_Y_OPTS.slice((yAdjustedIndex * Y_INTERVALS_PER_CHUNK), (yAdjustedIndex * Y_INTERVALS_PER_CHUNK) + Y_INTERVALS_PER_CHUNK);

        let bw = getRandomEntryInArr(BUILDING_WIDTHS);
        let bh = getRandomEntryInArr(BUILDING_WIDTHS);
        let bx = getRandomEntryInArr(xChunk);
        let by = getRandomEntryInArr(yChunk);

        const building = new Building(bx, by, bw, bh);
        return building;
    }

	addMessage(pos) {
		const that = this;
		this.messages.push(new Message(pos.x, pos.y, function() {
			let idx = that.messages.indexOf(this);
			that.messages.splice(idx, 1);
		}));
	}

	deleteMessage(id) {
		console.log('Destroying message with id: ' + id);
		let msg = this.messages.filter((m) => m.id === id)[0];
		if (msg) {
			msg.destroy();
		}
        console.log(this.messages.length + " messages left");

	}

	addArrow(pos, rotation) {
		if (this.activeArrows === MAX_DROPPED_ARROWS) {
			this.activeArrows--;
			for (let i = 0; i < this.arrows.length; i++) {
				if (!this.arrows[i].removing) {
					var removalIndex = i;
					break;
				}
			}
			this.arrows[removalIndex].remove(() => {
				this.arrows.splice(0, 1);
			});
		}
		this.activeArrows++;
		this.arrows.push(new GroundArrow(pos.x, pos.y, rotation));
	}

	addBullet(pos, rotation) {
		const that = this;
        this.bullets.push(new Bullet(pos.x, pos.y, rotation, genRemovalFromArray(that.bullets)));
	}

	setupUpdate() {
		const that = this;
        this.updateInterval = setInterval(function() {
			const time = Date.now();
			that.update();
			const updateTime = Date.now() - time;
			if (updateTime > 50) {
				console.log('greater than 50ms update');
			}
		}, TICK_TIME);
        // this.update();
	}

	updateClients() {
		const userKeys = Object.keys(this.users);
		let formattedUserData = this.getUserInfo();
		userKeys.forEach(uid => {
			if (!this.users[uid].ready) {
				return;
			}
			this.users[uid].socket.emit('game-update', {
				players: formattedUserData,
				arrows: this.arrows,
				bullets: this.bullets,
                messages: this.messages,
                civilians: this.civilians
			});
		});
	}

	update() {
		let currTime = Date.now();
		let timeDiff = currTime - this.prevTime;
        this.checkCollisions();

		this.bullets.forEach(b => {
			b.update();
		});
		this.arrows.forEach(a => {
			a.update();
        });
        this.civilians.forEach(c => {
			c.update(timeDiff);
		});

		this.updateClients();
		this.prevTime = currTime;
	}

	checkCollisions() {
		Object.keys(this.users).forEach(k => {
			let user = this.users[k];
			this.checkMessageCollisions(user);
			if (user.type !== PLAYER_DICTATOR) {
				this.checkDeathCollisions(user);
			}
        });

        for (let b = 0; b < this.bullets.length; b++) {
            let bul = this.bullets[b];
            let shouldBreak = false;
            for (let bu = 0; bu < this.buildings.length; bu++) {
                let build = this.buildings[bu];
                if (hasOverlap(build.getHitbox(), bul.getHitbox())) {
                    bul.remove();
                    shouldBreak = true;
                    break;
                }
            }

            if (shouldBreak) {
                break;
            }

            for (let c = 0; c < this.civilians.length; c++) {
                let civ = this.civilians[c];
                if (hasOverlap(bul.getHitbox(), civ.getHitbox())) {
                    civ.remove();
                    bul.remove();
                    shouldBreak = true;
                    break;
                }
            }
            if (shouldBreak) {
                break;
            }
		}
	}

	checkMessageCollisions(u) {
		/** refactor me, sends a message EVERYTIME there is an overlap (1 per tick) */
		for (let m = 0; m < this.messages.length; m++) {
			let msg = this.messages[m];
			if (hasOverlap(getPlayerHitbox(u), msg.getHitbox())) {
				u.socket.emit('message-collision', msg);
				break;
			}
		}
	}

	checkDeathCollisions(u) {
        let playerHitbox = getPlayerHitbox(u);
		for (let b = 0; b < this.bullets.length; b++) {
            let bul = this.bullets[b];
            let bHbox = bul.getHitbox();
			if (hasOverlap(playerHitbox, bHbox)) {
				u.socket.emit('shot', bul);
				bul.remove();
				break;
            }
		}
    }

    civilianShot() {

    }

	getUserInfo() {
		const userKeys = Object.keys(this.users);
		return userKeys.reduce((acc, currVal) => {
			let u = this.users[currVal];
			if (!u.ready) {
				return acc;
			}

			acc[currVal] = {
				pos: u.pos,
				type: u.type,
				id: u.id
			};
			return acc;
		}, {});
	}

	/**
	 * Start new game
	 */
	start() {
		users.forEach(u => {
			u.start();
		});
	}

	addUser(u) {
		console.log('Adding user {' + u.id + '} to room: ' + this.id);
		u.room = this;
		let type = this.selectPlayerType();
		u.type = type;
		console.log('User of type: ' + type + 'added.')
		this.takenRoles[PLAYER_ROLE_IDX[type]] = 1;

		u.socket.emit('set-type', {
			type: type
		});
		Object.keys(this.users).forEach(uid => {
			this.users[uid].socket.emit('player-added', { id: u.id, type: type, pos: u.pos });
		});
		this.users[u.id] = u;
	}

	numUsers() {
		return Object.keys(this.users).length;
	}

	roomHasSpace() {
		return this.numUsers() < 3;
	}

	isEmpty() {
		return this.numUsers() === 0;
	}

	removeUser(u) {
		delete this.users[u.id];
		console.log('Removing user with id: ' + u.id)
		this.takenRoles[PLAYER_ROLE_IDX[u.type]] = 0;
		Object.keys(this.users).forEach(uid => {
			console.log('Sending player removed to id: ' + uid);
			this.users[uid].socket.emit('player-removed', { id: u.id });
		});
		console.log('Deleted user from room: ' + this.id + ', key count: ' + this.numUsers());

		if (this.isEmpty()) {
			this.remove();
			console.log('Removing room w/ id: ' + this.id);
			return;
		}
	}

	remove() {
		delete ROOMS[this.id];
		clearInterval(this.updateInterval);
	}

	selectPlayerType() {
		const availableRoles = [PLAYER_MESSAGE_DROPPER, PLAYER_DICTATOR, PLAYER_COURIER]
			.filter((f) => !this.takenRoles[PLAYER_ROLE_IDX[f]]);

		return availableRoles[Math.floor(Math.random() * availableRoles.length)];
	}
}

/**
 * User session class
 */
class User {

	/**
	 * @param {Socket} socket
	 */
	constructor(socket, type) {
		this.id = genId();
		this.socket = socket;
		this.room = null;
		this.pos = {x: -500, y: -500};
		this.type = type;
		this.setupSocketHandlers();
		this.socket.emit('set-id', {id: this.id});
		findRoom(this);
	}

	emitOtherPlayers() {
		let formattedPlayers = this.room.getUserInfo();
		console.log("emitting " + Object.keys(this.room.users).length + " users to client");
		this.socket.emit('set-game-info', {
            players: formattedPlayers,
            buildings: this.room.buildings
		});
	}

	setupSocketHandlers() {
		this.socket.on('client-update', (data) => {
			this.pos = data.playerPos;
		});
		this.socket.on('ready', (data) => {
			this.pos = data.pos;
			this.emitOtherPlayers();
			this.ready = true;
		});
		this.socket.on('drop-arrow', function(data) {
			this.room.addArrow(data.pos, data.rotation);
		}.bind(this));
		this.socket.on('fire-bullet', function(data) {
			this.room.addBullet(data.pos, data.rotation);
		}.bind(this));
		this.socket.on('drop-message', function(data) {
			this.room.addMessage(data.pos);
		}.bind(this));
		this.socket.on('destroy-message', function(data) {
			this.room.deleteMessage(data.id);
		}.bind(this));
	}

	start() {
		console.log('Starting game in room w/ id: ' + room.id);
		this.socket.emit("start");
	}

	/**
	 * Terminate room
	 */
	end() {
		console.log('Ending game in room w/ id: ' + room.id);
		this.socket.emit("end");
	}

}
/**
 * Socket.IO on connect event
 * @param {Socket} socket
 */
module.exports = {

	io: (socket) => {
		const user = new User(socket);

		socket.on("disconnect", () => {
			console.log("Disconnected: " + socket.id);
			removeUser(user);
		});

		console.log("Connected: " + socket.id);
	},

	stat: (req, res) => {
		storage.get('games', 0).then(games => {
			res.send(`<h1>Games played: ${games}</h1>`);
		});
	}

};