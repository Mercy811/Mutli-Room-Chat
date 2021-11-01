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

// users
// socketid : 
//      username
//      roomId
let users = {};
// rooms
// roomId : 
//      owner
//      isPrivate
//      password
let rooms = {};

function isRoomExist(roomId){
  if(Object.keys(rooms).length === 0){
    return false;
  }else{
    return Object.keys(rooms).includes(roomId);
  }
}

async function userJoin(socket,userInfo){
  console.log('========== connection ==========');
  console.log(userInfo);
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
}

// 1. listen on the connection event for incoming sockets 
//    and log it to the console
// 2. each socket also fires a special disconnect event
io.on('connection', async (socket) => {
  console.log('========== connection ==========');
  console.log(socket.id);

  socket.on('createRoom',(roomInfo)=>{
    console.log('========== createRoom ==========');
    rooms[roomInfo.roomId] = {
      "owner":roomInfo.username,
      "isPrivate":roomInfo.isPrivate,
      "password":roomInfo.password
    }
    console.log(rooms);
    io.to(socket.id).emit('joinSuccess');
    let userInfo = {username:roomInfo.username, roomId: roomInfo.roomId};

    userJoin(socket, userInfo);
  });

  socket.on('join',async (userInfo)=>{
    console.log('========== join ==========');
    console.log(rooms);
    if(!isRoomExist(userInfo.roomId)){
      console.log("roomNotExist");
      io.to(socket.id).emit('roomNotExist');
      return;
    }
    
    console.log("roomExist");
    console.log(userInfo);
    if(rooms[userInfo.roomId].isPrivate){
      if(!userInfo.password){
        console.log("passwordNeeded");
      io.to(socket.id).emit('passwordNeeded');
      return;
      }else{
        if(userInfo.password != rooms[userInfo.roomId].password){
          console.log("wrongPassword");
          io.to(socket.id).emit('wrongPassword');
          return;
        }
      }
    }    

    io.to(socket.id).emit('joinSuccess');
    userJoin(socket, userInfo);
  });

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