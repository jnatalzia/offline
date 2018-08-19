"use strict";

/**
 * User sessions
 * @param {Array} users
 */
const users = [];
const ROOMS = {

};

/** Server constants */
let BUILDING_WIDTHS = [100, 110, 120, 130, 140, 150];
let MAX_BUILDING_WIDTH = 150;

let BUILD_X_OPTS = [];
let adjustedWidth = MAP_WIDTH - MAX_BUILDING_WIDTH / 2;
for (let i = MAX_BUILDING_WIDTH / 2; i < adjustedWidth; i+= GRID_INTERVAL) {
    BUILD_X_OPTS.push(i + GRID_INTERVAL);
}
let adjustedHeight = MAP_HEIGHT - MAX_BUILDING_WIDTH / 2;
let BUILD_Y_OPTS = [];
for (let i = MAX_BUILDING_WIDTH / 2; i < adjustedHeight; i+= GRID_INTERVAL) {
    BUILD_Y_OPTS.push(i + GRID_INTERVAL);
}

const X_CHUNKS = 3;
const Y_CHUNKS = 3;

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
	console.log('Created a new room with id: ' + roomId);
	ROOMS[roomId] = new GameRoom(roomId);
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

		this.setupUpdate();

		this.bullets = [];
		this.arrows = [];
		this.activeArrows = 0;
		this.messages = [];
		// TEST DATA
		this.addMessage({x: 500, y: 400});
		this.addMessage({x: 600, y: 400});
		this.map = this.generateMap();
	}

	generateMap() {
        let map = [];
        console.log('Generating ' + NUM_BUILDINGS + ' buildings');
		for (let i = 0; i < NUM_BUILDINGS; i++) {
            let b = this.generateBuilding(i);

            while (this.buildingOverlapsCurrent(b, map)) {
                b = this.generateBuilding(i);
            }

            map.push(b);
        }
        return map;
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
        let yChunk = BUILD_X_OPTS.slice((yAdjustedIndex * Y_INTERVALS_PER_CHUNK), (yAdjustedIndex * Y_INTERVALS_PER_CHUNK) + Y_INTERVALS_PER_CHUNK);

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
		this.bullets.push(new Bullet(pos.x, pos.y, rotation, function() {
			let idx = that.bullets.indexOf(this);
			that.bullets.splice(idx, 1);
		}));
	}

	setupUpdate() {
		setInterval(this.update.bind(this), TICK_TIME)
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
				messages: this.messages
			});
		});
	}

	update() {
        this.checkCollisions();

		this.bullets.forEach(b => {
			b.update();
		});
		this.arrows.forEach(a => {
			a.update();
		})

		this.updateClients();
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
            for (let bu = 0; bu < this.map.length; bu++) {
                let build = this.map[bu];
                if (hasOverlap(build.getHitbox(), bul.getHitbox())) {
                    bul.remove();
                }
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
		for (let b = 0; b < this.bullets.length; b++) {
			let bul = this.bullets[b];
			if (hasOverlap(getPlayerHitbox(u), bul.getHitbox())) {
				u.socket.emit('shot', bul);
				bul.remove();
				break;
			}
		}
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
            map: this.room.map
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