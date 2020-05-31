// Import all needed modules
global.fetch = require("node-fetch"); // for web requests
global.btoa = require('btoa'); // for SV authenication
var express = require('express'); // for main server
var Filter = require('bad-words'); // for filtering messages
var app = express(); // define the app var
var http = require('http').createServer(app); // init http server
var io = require('socket.io')(http); // attach socket to the server
var filter = new Filter(); // set up the filter
var svAppId = "4205845"; // register SV app id
var svAppSecret = "58402c158faf27abf7e89e723672d315c9a7bf40be0e7cb6bae2d8dcde886a0b"; // register SV app secret (token)
app.use(express.static(__dirname + '/public')); // tell express where to get public assets

app.get('/', (req, res) => { // set root location to index.html
  res.sendFile(__dirname + '/index.html');
});
io.on('connection', (socket) => { // handle a user connecting
  var currentRoom = 'main'; // set the room name
  socket.join(currentRoom); // join the main room
  socket.on('roomChange', (room) => { // handle a change in rooms
    socket.leave(currentRoom); // leave the current room
    currentRoom = room; // set the current room to the room sent by the client
    socket.join(currentRoom); // join the new current room
    console.log('Client switched rooms to ' + room); // ROP
  });
  console.log('a user connected' /* + user */ ); // ROP
  socket.on('chatMessage', (msg) => { // handle the server recieving messages
    io.to(currentRoom).emit('chatMessage', filter.clean(msg)); // clean and then send the message to all clients
  });
  socket.on('userRegister', (msg) => { // handle user registration
    fetch('https://api.scratch.mit.edu/users/' + msg) // make a request to the Scratch API
      .then(response => response.json())
      .then(data => {
        if (data.id == null) { // make sure that the user exists
          console.log("user doesn't exist"); // ROP
        } else { // if they do exist, continue with registration
          console.log("confirming user id " + data.id); // ROP
          fetch('http://scratchverifier.ddns.net:8888/verify/' + msg, { // make a request to the SV server
            method: 'PUT',
            headers: {
              'Authorization': "Basic " + btoa(svAppId + ":" + svAppSecret) // use basic token auth to connect
            }
          }).then((response) => {
            return response.json();
          }).then((data) => {
            console.log(data.code); // ROP
            socket.emit("svCodeToVerify", data.code); // send the SV verification code back to the registering user
            socket.on('finishVerification', (msgTwo) => { // handle finishing verification
              console.log("AHH VERIFYY"); // ROP
              fetch('http://scratchverifier.ddns.net:8888/verify/' + msg, { // make a request to the SV server (again)
                method: 'POST',
                headers: {
                  'Authorization': "Basic " + btoa(svAppId + ":" + svAppSecret) // use basic token auth again
                }
              }).then((response) => {
                return response.ok;
              }).then((data) => {
                console.log('Response: ' + data); // ROP
                if (data) { // if the response was okay
                  socket.emit("verificationSuccess", msg); // Send a success message to the registering user
                } else { // if verification failed
                  // generate error here...
                  console.error("Error with verification: " + data); // ROP
                }
              })
            })
          })
        }
      });
  });
  socket.on('disconnect', () => { // handle user disconnecting from the server
    console.log('user disconnected'); // ROP
  });
});
http.listen((process.env.PORT || 3001), () => { // initialize the server
  console.log('listening on a port'); // ROP
});