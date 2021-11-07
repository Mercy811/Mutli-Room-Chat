const express = require('express');
// Express initialize app to be a function handler 
// that you can supply to an HTTP server
const app = express();
const http = require('http');
const server = http.createServer(app);
const moment = require("moment");

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
let test = [];


// rooms
// roomId : 
//      owner
//      isPrivate
//      password
let rooms = {};

function findSocketidByUsername(username){
  for(var key in users){
    if(users[key].username == username){
      return key;
    }
  }
  return -1;
}

function isRoomExist(roomId){
  if(Object.keys(rooms).length === 0){
    return false;
  }else{
    return Object.keys(rooms).includes(roomId);
  }
}

async function userJoin(socket,userInfo){
  console.log('========== userJoin ==========');
  
  // get an array of usernames in room roomId
  let usernamesInRoom = [];
  await io.in(userInfo.roomId).fetchSockets()
  .then(socketInstancesInRoomSet => {
    console.log(socketInstancesInRoomSet);
    for (let socketInstance of socketInstancesInRoomSet){
      console.log("socketInstance.id");
      console.log(socketInstance.id);
      if(socketInstance.id != socket.id){
        usernamesInRoom.push(users[socketInstance.id].username);
      }
    }
    console.log("-----------------");
    console.log("usernamesInRoom: ");
    console.log(usernamesInRoom);

    console.log("userInfo.username");
    console.log(userInfo.username);

    // existing same username
    if(usernamesInRoom.includes(userInfo.username)){
      console.log('include');
      let previousSocketId = findSocketidByUsername(userInfo.username);
      io.to(previousSocketId).emit("login on another device");
      delete users[previousSocketId];

    }else{
      console.log('not include');
      usernamesInRoom.push(userInfo.username);
    }

    socket.join(userInfo.roomId);
    
    users[socket.id] = {
      "roomId":userInfo.roomId,
      "username":userInfo.username
    };


    io.to(userInfo.roomId).emit('newUser',userInfo.username);
    io.to(userInfo.roomId).emit('updateUserList',{
      usernamesInRoom:usernamesInRoom,
      owner:rooms[userInfo.roomId].owner
      });
    io.to(socket.id).emit('joinSuccess',{
      username: userInfo.username,
      roomId: userInfo.roomId
    })
    console.log(users);
  })
  .catch(error => console.error('Error:', error));

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

    userJoin(socket, {
      username:roomInfo.username, 
      roomId: roomInfo.roomId
    });
  });

  socket.on('join',async (userInfo)=>{
    console.log('========== join ==========');
    console.log(rooms);
    if(!isRoomExist(userInfo.roomId)){
      console.log("roomNotExist");
      io.to(socket.id).emit('roomNotExist',{
        username: userInfo.username,
        roomId: userInfo.roomId
      });
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

    userJoin(socket, userInfo);
  });

  socket.on('chat message',(msg)=>{
    io.to(users[socket.id].roomId).emit('chat message',{
      sender:users[socket.id].username, 
      msg:msg
    });
  });

  socket.on('remove',async (data)=>{
    console.log('========== remove ==========');
    let removeSocketId = findSocketidByUsername(data.username);
    let roomId = users[removeSocketId].roomId;
    console.log("removeSocketId: "+removeSocketId);
    console.log("roomId: "+roomId);
    if (removeSocketId){
      // METHOD 1
      // io.sockets : namespace
      // namespace.sockets : (Map<SocketId, Socket>)
      // io.sockets.sockets[removeSocketId] is the socketid of the user that the owner wants to remove
      // console.log(io.sockets.sockets[removeSocketId]);
      // io.sockets.sockets[removeSocketId].leave(users[socket.id].roomId);
      // io.sockets.sockets[removeSocketId].emit('removed');

      // METHOD 2
      io.to(roomId).emit('remove',{
        username:data.username
      });
      // I have no idea what's wrong with this!
      // It should work, but it doesn't !!!!!!
      // https://socket.io/docs/v3/server-api/#namespaceallsockets
      // io.sockets.sockets[removeSocketId].leave(roomId);
      if(removeSocketId == socket.id){
        socket.leave(roomId);
      }else{
        delete users[removeSocketId];

        // get an array of usernames in room roomId
        let usernamesInRoom = [];
        await io.in(roomId).allSockets()
        .then(socketsInRoomSet => Array.from(socketsInRoomSet))
        .then(socketsInRoomArray => {
          socketsInRoomArray.forEach(element => {
            usernamesInRoom.push(users[element].username);
          });
        })
        .catch(error => console.error('Error:', error));

        io.to(roomId).emit('updateUserList',{
          usernamesInRoom:usernamesInRoom,
          owner:rooms[roomId].owner
          });
        console.log(users);
      }
    }
  })

  socket.on('userLeave', async (data)=>{
    let roomId = users[data.socketId].roomId;
    console.log('========== exit ==========');
    console.log('roomId: '+roomId);
    if( data.socketId == socket.id){
      socket.leave(roomId);
    }else{
      delete users[data.socketId];
    }

    // get an array of usernames in room roomId
    let usernamesInRoom = [];
    await io.in(roomId).allSockets()
    .then(socketsInRoomSet => Array.from(socketsInRoomSet))
    .then(socketsInRoomArray => {
      socketsInRoomArray.forEach(element => {
        usernamesInRoom.push(users[element].username);
      });
    })
    .catch(error => console.error('Error:', error));

    io.to(roomId).emit('updateUserList',{
      usernamesInRoom:usernamesInRoom,
      owner:rooms[roomId].owner
      });
    io.to(roomId).emit('userLeave',{
      username: data.username
    })
  })

  socket.on('login on another device',async ()=>{
    console.log('========== exit ==========');
    let roomId = users[socket.id].roomId;
    socket.leave(roomId);

    console.log("users in room "+roomId);
    await io.in(roomId).allSockets()
    .then(socketsInRoomSet => Array.from(socketsInRoomSet))
    .then(socketsInRoomArray => {
      console.log(socketsInRoomArray);
    })
    .catch(error => console.error('Error:', error));
  })

  //-----------我是可爱的分割线---这里写private message接收----
  socket.on("private_message", function(data){
    let receiver = data['receiver'];
    console.log("private message receiver is "+receiver);
    // function getKeyByValue(object, value) {
    //   return Object.keys(object).find(key => object[key].username === value);
    // }
    console.log("socket id is " + findSocketidByUsername(receiver));
    let r_id = findSocketidByUsername(receiver);
    let time = moment().format('MMMM Do YYYY, h:mm:ss a');
    //socket.to(r_id).emit("private_message",socket.id, {message:data['message'], send:users[socket.id]} );
    if (r_id !== -1)
    {socket.to(r_id).emit("private_message", {message:data['message'], send:users[socket.id].username, time:time });}
    else 
    {socket.emit("private_message", {message:"wrong user name",send:"System", time:time});}

  });
  //-----------我是可爱的分割线---这里写private message接收----

  socket.on('disconnect', () => {
    console.log('========== disconnect ==========');
  });
});

// make the http server listen on port 3000
server.listen(3000, () => {
  console.log('listening on *:3000');
});
