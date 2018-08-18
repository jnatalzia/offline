"use strict";

/**
 * User sessions
 * @param {Array} users
 */
const users = [];

/**
 * Find opponent for a user
 * @param {User} user
 */
function findOpponent(user) {
	for (let i = 0; i < users.length; i++) {
		if (
			user !== users[i] &&
			users[i].opponent === null
		) {
			new Game(user, users[i]).start();
		}
	}
}

/**
 * Remove user session
 * @param {User} user
 */
function removeUser(user) {
	users.splice(users.indexOf(user), 1);
}

/**
 * Game class
 */
class Game {

	/**
	 * @param {User} user1 
	 * @param {User} user2 
	 */
	constructor(user1, user2) {
		this.user1 = user1;
		this.user2 = user2;
	}

	/**
	 * Start new game
	 */
	start() {
		this.user1.start(this, this.user2);
		this.user2.start(this, this.user1);
	}

	/**
	 * Is game ended
	 * @return {boolean}
	 */
	ended() {
		return this.user1.guess !== GUESS_NO && this.user2.guess !== GUESS_NO;
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
		this.socket = socket;
		this.game = null;
		this.opponent = null;
	}
	/**
	 * Start new game
	 * @param {Game} game
	 * @param {User} opponent
	 */
	start(game, opponent) {
		this.game = game;
		this.opponent = opponent;
		this.guess = GUESS_NO;
		this.socket.emit("start");
	}

	/**
	 * Terminate game
	 */
	end() {
		this.game = null;
		this.opponent = null;
		this.guess = GUESS_NO;
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
		users.push(user);
		findOpponent(user);

		socket.on("disconnect", () => {
			console.log("Disconnected: " + socket.id);
			removeUser(user);
			if (user.opponent) {
				user.opponent.end();
				findOpponent(user.opponent);
			}
		});

		console.log("Connected: " + socket.id);
	},

	stat: (req, res) => {
		storage.get('games', 0).then(games => {
			res.send(`<h1>Games played: ${games}</h1>`);
		});
	}

};