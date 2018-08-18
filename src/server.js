"use strict";

/**
 * User sessions
 * @param {Array} users
 */
const users = [];
const ROOMS = {

};

/** Utils */
function genId() {
	return Math.random().toString(36).substring(7);
}

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
		this.addMessage({x: 300, y: 400});
	}

	addMessage(pos) {
		const that = this;
		this.messages.push(new Message(pos.x, pos.y, function() {
			let idx = that.messages.indexOf(this);
			that.messages.splice(idx, 1);
		}));
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
			this.users[uid].socket.emit('game-update', {
				players: formattedUserData,
				arrows: this.arrows,
				bullets: this.bullets,
				messages: this.messages
			});
		});
	}

	update() {
		this.bullets.forEach(b => {
			b.update();
		});
		this.arrows.forEach(a => {
			a.update();
		})

		this.updateClients();
	}

	getUserInfo() {
		const userKeys = Object.keys(this.users);
		return userKeys.reduce((acc, currVal) => {
			acc[currVal] = {
				pos: this.users[currVal].pos,
				type: this.users[currVal].type,
				id: this.users[currVal].id
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

		Object.keys(this.users).forEach(uid => {
			this.users[uid].socket.emit('player-added', { id: u.id, type: u.type, pos: u.pos });
		});

		this.users[u.id] = u;
	}

	roomHasSpace() {
		return Object.keys(this.users).length < 3;
	}

	isEmpty() {
		return Object.keys(this.users).length === 0;
	}

	removeUser(u) {
		delete this.users[u.id];
		console.log('Removing user with id: ' + u.id)
		Object.keys(this.users).forEach(uid => {
			console.log('Sending player removed to id: ' + uid);
			this.users[uid].socket.emit('player-removed', { id: u.id });
		});
		console.log('Deleted user from room: ' + this.id + ', key count: ' + Object.keys(this.users).length);

		if (this.isEmpty()) {
			this.remove();
			console.log('Removing room w/ id: ' + this.id);
			return;
		}
	}

	remove() {
		delete ROOMS[this.id];
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
		this.setupSocketHandlers();
		this.socket.emit('set-id', {id: this.id});
	}

	emitOtherPlayers() {
		let formattedPlayers = this.room.getUserInfo();
		console.log("emitting " + Object.keys(this.room.users).length + " users to client");
		this.socket.emit('set-game-info', {
			players: formattedPlayers,
			test: 'test'
		});
	}

	setupSocketHandlers() {
		this.socket.on('client-update', (data) => {
			this.pos = data.playerPos;
		});
		this.socket.on('ready', (data) => {
			this.type = data.type;
			this.pos = data.pos;
			findRoom(this);
			this.emitOtherPlayers();
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