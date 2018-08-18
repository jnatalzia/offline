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
	user.room.removeUser(user);
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
	}

	setupUpdate() {

	}

	updateClients() {
		const userKeys = Object.keys(this.users);
		let formattedUserData = userKeys.reduce((acc, currVal) => {
			acc[currVal] = {
				pos: u.position
			};
			return acc;
		}, {});
		userKeys.forEach(u => {
			u.socket.emit('game-update', { players: formattedUserData });
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

		Object.keys(this.users).forEach(u => {
			u.socket.emit('player-added', { id: u.id });
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
		Object.keys(this.users).forEach(u => {
			u.socket.emit('player-removed', { id: u.id });
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
	constructor(socket) {
		this.id = genId();
		this.socket = socket;
		this.socket.emit('set-id', { id: this.id });
		this.room = null;
		this.position = {};
		this.setupSocketHandlers();
	}

	setupSocketHandlers() {
		this.socket.on('client-update', (data) => {
			this.position = data.playerPos;
		});
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
		findRoom(user);

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