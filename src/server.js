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

const X_CHUNKS = 5;
const Y_CHUNKS = 5;

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
function findRoom(user, cb) {
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
	cb && cb();
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
		this.takenRoles = [0, 0];
		this.id = id;
		this.waitingForPlayers = true;
		this.bullets = [];
        this.messages = [];
        let map = this.generateMap();
        this.buildings = map.buildings;
		this.civilians = [];
		this.civiliansKilled = 0;
		this.prevTime = Date.now();
		this.lowerPlayerState = LOWER_PLAYING_STATES.PHASE_ONE;
		for (let i = 0; i < CIVILIANS_PER_ROOM; i++) {
			let civ = this.genCivilian();
            this.civilians.push(civ);
        }
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

	getRandomPos(size) {
		let randX, randY, bOverlap = true;
		while (bOverlap) {
			randX = getRandomEntryInArr(BUILD_X_OPTS);
			randY = getRandomEntryInArr(BUILD_Y_OPTS);
			let hb = generateHitbox({x: randX, y: randY}, {w:size.w, h: size.h})
			bOverlap = this.buildings.some(b => {
				return hasOverlap(hb, b.getHitbox());
			});
		}
		return {x: randX, y: randY};
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

	addBullet(pos, rotation) {
		const that = this;
        this.bullets.push(new Bullet(pos.x, pos.y, rotation, genRemovalFromArray(that.bullets)));
	}

	setupUpdate() {
		const that = this;
		let numGreaterThan50 = 0;

		// Start AI loop
		this.civilians.forEach(c => c.begin());

		// Reset Prev Time
		this.prevTime = Date.now();

        this.updateInterval = setInterval(function() {
			const time = Date.now();
			that.update();
			const updateTime = Date.now() - time;
			if (updateTime > 50) {
				numGreaterThan50++;
				if (numGreaterThan50 % 10 === 0) {
					console.log('10 greater than 50ms updates');
				}
			}
        }, TICK_TIME);
        this.updateClientInterval = setInterval(function() {
            that.updateClients();
        }, SERVER_UPDATE_TICK);
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
				bullets: this.bullets,
                messages: this.messages,
				civilians: this.civilians,
				civiliansKilled: this.civiliansKilled
			});
		});
	}

	update() {
		let currTime = Date.now();
		let timeDiff = currTime - this.prevTime;
        this.checkCollisions();

		this.bullets.forEach(b => {
			b.update(timeDiff);
		});
        this.civilians.forEach(c => {
			c.update(timeDiff);
		});

		this.prevTime = currTime;
	}

	checkCollisions() {
		let endLoop;
		let uKeys = Object.keys(this.users)

		for (let i = 0; i < uKeys.length; i++) {
			let user = this.users[uKeys[i]];
			if (user.type !== PLAYER_DICTATOR) {
				if (this.checkDeathCollisions(user)) {
					return;
				}
			}
		}

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
					this.civiliansKilled++;
                    civ.remove();
                    bul.remove();
					shouldBreak = true;
					if (this.civiliansKilled > CIVILIAN_KILL_CAP) {
						this.gameOver(PLAYER_COURIER, GAME_CONDITIONS.CIVILIANS_SHOT);
					}
                    break;
                }
            }
            if (shouldBreak) {
                break;
            }
		}
	}

	gameOver(winner, reason) {
		console.log('Ending game');
		Object.keys(this.users).forEach(k => {
			let user = this.users[k];
			console.log('Sending game over to user: ' + user.id);
			user.socket.emit('game-over', {
				didWin: winner === user.type,
				reason: reason
			});
		});
		this.remove();
	}

	checkDeathCollisions(u) {
        let playerHitbox = getPlayerHitbox(u);
		for (let b = 0; b < this.bullets.length; b++) {
            let bul = this.bullets[b];
            let bHbox = bul.getHitbox();
			if (hasOverlap(playerHitbox, bHbox)) {
				if (u.type === PLAYER_COURIER) {
					this.gameOver([PLAYER_DICTATOR], GAME_CONDITIONS.SHOT_COURIER);
					return true;
				}
				bul.remove();
				break;
            }
		}
    }

	getUserInfo() {
		let plyKeys = Object.keys(this.users)
		return plyKeys.map(p => {
			let u = this.users[p];
			return {
				id: u.id,
				size: u.size,
				pos: u.pos,
                type: u.type,
                vel: u.vel
			}
		});
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
        u.pos = this.getRandomPos({w: PLAYER_WIDTH, h: PLAYER_HEIGHT});
        u.vel = {x: 0, y: 0};
		console.log('User of type: ' + type + 'added.')
		this.takenRoles[PLAYER_ROLE_IDX[type]] = 1;

		u.socket.emit('set-type', {
			type: type
		});
		Object.keys(this.users).forEach(uid => {
			this.users[uid].socket.emit('player-added', { id: u.id, type: type, pos: u.pos, vel: u.vel });
		});
		this.users[u.id] = u;

		if (!this.roomHasSpace()) {
			console.log('Room full and ready');
			this.setupUpdate();
			Object.keys(this.users).forEach(uid => {
				let usr = this.users[uid];
				usr.socket.emit('set-state', {state: GAME_STATES.STARTING});
				this.startTimeout = setTimeout(() => {
					usr.start();
				}, 3000)
			});
		}
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

		console.log('Finding new user to replace');
		this.clearAllIntervals();
		this.remove();
		Object.keys(this.users).forEach(uid => {
			let user = this.users[uid];
			user.socket.emit('set-state', { state: GAME_STATES.RESET_GAME, reset: true });
		});
	}

	remove() {
		this.clearAllIntervals();
		delete ROOMS[this.id];
		// Finding new room for players
		Object.keys(this.users).forEach(uid => {
			let user = this.users[uid];
			user.room = undefined;
		});
		this.users = [];
		console.log('Room removed');
    }

    clearAllIntervals() {
        clearInterval(this.updateClientInterval);
        clearInterval(this.updateInterval);
        clearTimeout(this.startTimeout);
    }

	selectPlayerType() {
		const availableRoles = [PLAYER_MESSAGE_DROPPER, PLAYER_DICTATOR, PLAYER_COURIER]
			.filter((f) => !this.takenRoles[PLAYER_ROLE_IDX[f]]);

		return availableRoles[Math.floor(Math.random() * availableRoles.length)];
	}
	startPhaseTwo() {
		this.lowerPlayerState = LOWER_PLAYING_STATES.PHASE_TWO;

		Object.keys(this.users).forEach(uid => {
			this.users[uid].socket.emit('start-phase-two', { state: LOWER_PLAYING_STATES.PHASE_TWO });
		});
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
		this.findRoom();
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
            this.vel = data.playerVel;
		});
		this.socket.on('ready', (data) => {
			this.ready = true;
		});
		this.socket.on('drop-arrow', function(data) {
			this.room.addArrow(data.pos, data.rotation);
		}.bind(this));
		this.socket.on('fire-bullet', function(data) {
			this.room.addBullet(data.pos, data.rotation);
		}.bind(this));
		this.socket.on('destroy-message', function(data) {
			this.room.deleteMessage(data.id);
			if (data.courier) {
				this.room.startPhaseTwo();
			}
		}.bind(this));
		this.socket.on('find-room', () => {
			this.findRoom();
		});
	}

	findRoom() {
		this.socket.emit('set-state', {
			state: GAME_STATES.CHOOSING_ROOM
		});
		findRoom(this);
		this.socket.emit('set-start', {id: this.id, pos: this.pos});
		this.emitOtherPlayers();
	}

	start() {
		console.log('Starting game in room w/ id: ' + this.room.id);
		this.socket.emit('game-start');
	}

	/**
	 * Terminate room
	 */
	end() {
		console.log('Ending game in room w/ id: ' + room.id);
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