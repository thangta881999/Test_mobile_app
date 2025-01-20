const { Server } = require('socket.io');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');

const guests = new Map();
const onlineUsers = new Set();

const generateId = () => uuidv4();

const setupSignaling = (server) => {
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    const callerId = socket.handshake.query.callerId;
    if (!callerId) {
      console.error('Caller ID is missing');
      return next(new Error('Caller ID is required'));
    }
    socket.callerId = callerId;
    next();
  });

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.callerId}`);
    onlineUsers.add(socket.callerId);
    io.emit('online-users', Array.from(onlineUsers));

    socket.on('offer', (data) => {
      console.log('Received offer:', data);
      socket.to(data.calleeId).emit('offer', data);
    });

    socket.on('answer', (data) => {
      console.log('Received answer:', data);
      socket.to(data.callerId).emit('answer', data);
    });

    socket.on('ice-candidate', (data) => {
      console.log('Received ICE candidate:', data);
      socket.to(data.target).emit('ice-candidate', data);
    });

    socket.on('call', (data) => {
      console.log('Received call:', data);
      io.to(data.calleeId).emit('incoming-call', data);

      // Set a timeout to automatically cancel the call if not answered within 2 minutes
      const callTimeout = setTimeout(() => {
        console.log('Call timeout:', data);
        socket.to(data.calleeId).emit('call-canceled', data);
        socket.emit('call-canceled', data);
      }, 2 * 60 * 1000); // 2 minutes

      socket.on('call-accepted', (data) => {
        console.log('Call accepted:', data);
        clearTimeout(callTimeout);
        socket.to(data.callerId).emit('call-accepted', data);
      });

      socket.on('call-rejected', (data) => {
        console.log('Call rejected:', data);
        clearTimeout(callTimeout);
        socket.to(data.callerId).emit('call-rejected', data);
      });

      socket.on('call-canceled', (data) => {
        console.log('Call canceled:', data);
        clearTimeout(callTimeout);
        socket.to(data.calleeId).emit('call-canceled', data);
      });
    });

    socket.on('disconnect', async (reason) => {
      console.log(`Client disconnected: ${socket.callerId}, reason: ${reason}`);
      onlineUsers.delete(socket.callerId);
      io.emit('online-users', Array.from(onlineUsers));
      if (guests.has(socket.callerId)) {
        guests.delete(socket.callerId);
        console.log(`Guest account with ID ${socket.callerId} removed.`);
      } else {
        const user = await User.findOne({ id: socket.callerId });
        if (user) {
          user.isOnline = false;
          await user.save();
        }
      }
    });
  });
};

module.exports = setupSignaling;