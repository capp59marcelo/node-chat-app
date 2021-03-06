const path = require('path');
const http = require('http');
const express = require('express');
const socketIO = require('socket.io');
const session = require('express-session');
var routes = require('./routes.js');
var bodyParser = require('body-parser');
var redis = require("redis");
client = redis.createClient(16986, 'redis-16986.c17.us-east-1-4.ec2.cloud.redislabs.com', {no_ready_check: true});
//16986, 'redis-16986.c17.us-east-1-4.ec2.cloud.redislabs.com', {no_ready_check: true}
client.auth('abJprwykKTWGBDrtZHTMaeLCmsouFvnP', function (err) {
  if (err) throw err;
});
var exphbs  = require('express-handlebars');

client.flushall( function (err, succeeded) {
});

// abJprwykKTWGBDrtZHTMaeLCmsouFvnP

const {generateMessage} = require('./utils/message');
const {isRealString} = require('./utils/validation');
const {Users} = require('./utils/users');

const publicPath = path.join(__dirname, '../public');
const port = process.env.PORT || 3000;
var app = express();
app.use(express.static(publicPath));
app.use(session({ secret: 'keyboard cat', cookie: { maxAge: 6000000 }}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
var server = http.createServer(app);
var io = socketIO(server);

app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, './../public/'));

app.use(routes.router);

var users = [];
client.set("users", JSON.stringify(users));

io.on('connection', (socket) => {
  var user = {id: socket.handshake.query.userId, socketId: socket.id, nome: socket.handshake.query.nome};
  if (socket.handshake.query.idTo !== undefined) {
    routes.pegaMensagens(socket.handshake.query.userId, socket.handshake.query.idTo).then((mensagens) => {
      mensagens.forEach(mensagem => {
        getIdToSocketId(mensagem.idTo).then((socketId) => {
          socket.emit(socketId).emit('newMessage', mensagem.dataValues);
        });
      });
      
    });
  }

  updateUserList(user).then((users) => {
    io.emit('userList', users);
  })
  
  socket.on('join', () => {
    socket.broadcast.emit('newMessage', generateMessage('Admin', 'New User joined the chat'));
  });

  socket.on('createMessage', (message, callback) => {
    getIdToSocketId(message.idTo).then((socketId) => {
      routes.salvaMensagem(message);
      io.emit(socketId).emit('newMessage', message);
    });
    callback();
  });

  socket.on('disconnect', () => {
      removeUser(socket.id).then((users) => {
        io.emit('newMessage', generateMessage('Admin', 'Usuario deslogou'));
        io.emit('userList', users);
      });
  });
});

server.listen(port, () => {
  console.log(`Server is up on ${port}`);
});

function updateUserList(usuario) {
  return new Promise((resolve, reject) => {
    client.get('users', (err, reply) => {
      let users = JSON.parse(reply);
      users = users.filter(user => {return user.id != usuario.id}); 
      users.push(usuario);
      client.set('users', JSON.stringify(users));
      resolve(users);
    });
  });
}

function getIdToSocketId(idTo) {
  return new Promise((resolve, reject) => {
    client.get('users', (err, reply) => {
      let users = JSON.parse(reply);
      user = users.filter(user => {return user.id === idTo}); 
      resolve(user.socketId);
    });
  });
}

function removeUser(id) {
  return new Promise((resolve, reject) => {
    client.get('users', (err, reply) => {
      let users = JSON.parse(reply);
      users = users.filter(user => {return user.socketId != id}); 
      client.set('users', JSON.stringify(users));
      resolve(users);
    });
  });
}
  
client.on("error", function (err) {
  console.log("Error " + err);
});