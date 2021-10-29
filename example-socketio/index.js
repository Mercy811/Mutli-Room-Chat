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

// 1. listen on the connection event for incoming sockets 
//    and log it to the console
// 2. each socket also fires a special disconnect event
io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('chat message',(msg)=>{
    console.log('message: '+msg);
    io.emit('chat message',msg);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

// make the http server listen on port 3000
server.listen(3000, () => {
  console.log('listening on *:3000');
});