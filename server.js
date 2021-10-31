const express = require('express');
// Express initialize app to be a function handler 
// that you can supply to an HTTP server
const app = express();
const http = require('http');
const server = http.createServer(app);

// initialize a new instance of socket.io
// by passing the server (the http server) object
const {Server} = require("socket.io");
const io = new Server(server);

// define a route handler 
// that gets called when we hit our website home
app.get('/', (req, res) => {
  // res.send('<h1>Hello world</h1>');
  res.sendFile(__dirname + '/index.html');
});

let users = {};

// 1. listen on the connection event for incoming sockets 
//    and log it to the console
// 2. each socket also fires a special disconnect event
io.on('connection', (socket) => {
  console.log('========== connection ==========');
  console.log(socket.id);

  socket.on('join',async (userInfo)=>{
    console.log('========== join ==========');
    // console.log(userInfo.username);
    // console.log(userInfo.roomId);
    socket.join(userInfo.roomId);
    
    users[socket.id] = {
      "roomId":userInfo.roomId,
      "username":userInfo.username
    };

    // get an array of usernames in room roomId
    let usernamesInRoom = [];
    await io.in(userInfo.roomId).allSockets()
    .then(socketsInRoomSet => Array.from(socketsInRoomSet))
    .then(socketsInRoomArray => {
      socketsInRoomArray.forEach(element => {
        usernamesInRoom.push(users[element].username);
      });
    })
    .catch(error => console.error('Error:', error));

    io.to(userInfo.roomId).emit('newUser',userInfo.username);
    io.to(userInfo.roomId).emit('updateUserList',usernamesInRoom);
  })

  socket.on('chat message',(msg)=>{
    io.to(users[socket.id].roomId).emit('chat message',Array(users[socket.id].username, msg));
  });

  socket.on('disconnect', () => {
    console.log('========== disconnect ==========');
  });
});

// make the http server listen on port 3000
server.listen(3000, () => {
  console.log('listening on *:3000');
});