/* eslint-disable no-console */
const { createServer } = require('https');
const { Server } = require('socket.io');
const fs = require('fs');

const PORT = 8080;

const key = fs.readFileSync('/ssl/cert.key');
const cert = fs.readFileSync('/ssl/cert.pem');

const options = {
  key,
  cert,
};

const httpServer = createServer(
  options,
  (request, response) => {
    const baseURL =  request.protocol + '://' + request.headers.host + '/';
    const { pathname } = new URL(request.url, baseURL);
    if (pathname === '/hello') {
      response.writeHead(200);
      response.write('hello');
      response.end();
    }
  }
);

httpServer.listen(PORT);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const peers = [];

console.log(`Server: http://localhost:${PORT}`);

io.sockets.on('connection', (socket) => {
  socket.on('disconnect', (reason) => {
    const idx = peers.findIndex(d => d.clientId === socket.id);
    if (idx > -1) {
      const peer = peers[idx];
      console.log(`${peer.nickname}断开连接：${reason}`);
      peers.splice(idx, 1);
      io.sockets.emit('peer-leave-room', socket.id);
    }
  });

  socket.on('message', (message) => {
    console.log('Receive message:', message.type, message.id);
    socket.broadcast.emit('message', message);
  });

  socket.on('joinRoom', async(room, userInfo) => {
    console.log(`房间“${room}”已有${peers.length}人加入`);

    const peer = {
      ...userInfo,
      clientId: socket.id,
    };

    // 通知房间内的其他用户有人加入房间
    io.sockets.to(room).emit('peer-join-room', {
      roomId: room,
      peer: peer,
    });

    console.log(`${peer.nickname}加入房间“${room}”`);
    socket.join(room);

    // 通知用户已加入房间
    socket.emit('joined-room', {
      roomId: room,
      peer: peer,
      peers: peers,
    }); 

    peers.push(peer);
  });
});
