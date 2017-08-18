var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var port = process.env.PORT || 3000;

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/public'));

// Chatroom
var lastPlayderID = 0;
var GameState = {
  WAIT_ENOUGHT_PLAYERS: 1,
  PREPARE_GAME: 2,
  PLAYING: 3
};
var gameData = {
  gameState: GameState.WAIT_ENOUGHT_PLAYERS,
  numUsers: 0
};

io.on('connection', function (socket) {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    // we tell the client to execute 'new message'
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username, movedata) {
    if (addedUser) return;
    //add id
    socket.player = {
        id: lastPlayderID++,
        x: 0,
        y: 0
    };
    if(movedata) {
      socket.player.x = movedata.x;
      socket.player.y = movedata.y; 
    }
    // we store the username in the socket session for this client
    socket.username = username;
    ++gameData.numUsers;
    addedUser = true;
    socket.emit('login', {
	  numUsers: gameData.numUsers,
      yourid: socket.player.id,
      players: getAllPlayers()
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: gameData.numUsers,
      player: socket.player
    });
    console.log('add user: %s, numUsers: %d, pos: %f, %f', socket.username, gameData.numUsers, socket.player.x, socket.player.y);
    // check enought player
    if( gameData.numUsers > 1 && gameData.gameState == GameState.WAIT_ENOUGHT_PLAYERS)
    {
      var delay = 2000;
    	setTimeout(function() {
        		checkEnoughPlayer();
    		}, delay);
    }
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    if (addedUser) {
      --gameData.numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: gameData.numUsers
      });
      console.log('user left: %s, numUsers: %d', socket.username, gameData.numUsers);
      if(gameData.numUsers == 0){
        gameData.gameState = GameState.WAIT_ENOUGHT_PLAYERS;
        console.log('Room wait for more player');
      }
    }
  });

  socket.on('request move',function(data){
    console.log('request move '+data.x+', '+data.y);
    socket.player.x = data.x;
    socket.player.y = data.y;
    io.emit('move to',socket.player);
  });
});

function getAllPlayers(){
  var players = [];
  Object.keys(io.sockets.connected).forEach(function(socketID){
      var player = io.sockets.connected[socketID].player;
      if(player) players.push(player);
  });
  return players;
}

function randomInt (low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}

function checkEnoughPlayer(){
  if( gameData.numUsers > 1 && gameData.gameState == GameState.WAIT_ENOUGHT_PLAYERS)
    prepareGame();
}

function prepareGame(){
	console.log('game prepare: %s', Date.now());
  var delay = 5000;
  gameData.gameState = GameState.PREPARE_GAME;
	io.emit('game prepare', {
      time: (Date.now() + delay)
    });
  setTimeout(function() {
      if(gameData.gameState == GameState.PREPARE_GAME)
        startGame();
    }, delay);
}

function startGame(){
  console.log('start game');
  var game_time = 12000;
  gameData.gameState = GameState.PLAYING;
  io.emit('game ready', {
      timeend: (Date.now() + game_time),
      questionid: randomInt(0, 100)
    });
  setTimeout(function() {
      if(gameData.gameState == GameState.PLAYING)
        endGame();
    }, game_time);
}

function endGame(){
  console.log('end game');
  gameData.gameState = GameState.WAIT_ENOUGHT_PLAYERS;
  io.emit('game end', {
      result: "ABC"
    });
  var delay = 2000;
  setTimeout(function() {
      checkEnoughPlayer();
    }, delay);
}