import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

export const setupMessageSocket = (io) => {
  const messageNamespace = io.of('/messages');

  messageNamespace.use((socket, next) => {
    // Simple auth check: verify JWT from query string or auth
    const token = socket.handshake.auth?.token;
    console.log('Socket auth attempt, token:', token ? 'present' : 'missing');
    
    if (!token) {
      console.log('Socket auth failed: no token');
      return next(new Error('Authentication failed - no token'));
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      console.log('Socket auth successful, user:', decoded.id);
      next();
    } catch (err) {
      console.log('Socket auth failed: invalid token', err.message);
      next(new Error('Invalid token'));
    }
  });

  messageNamespace.on('connection', (socket) => {
    console.log('✓ Socket connected:', socket.id, 'user:', socket.user?.id);

    // Join an expense room (e.g., "expense:123")
    socket.on('join-expense', (expenseId) => {
      socket.join(`expense:${expenseId}`);
      console.log('✓ User joined expense room:', `expense:${expenseId}`);
    });

    // Leave an expense room
    socket.on('leave-expense', (expenseId) => {
      socket.leave(`expense:${expenseId}`);
      console.log('✓ User left expense room:', `expense:${expenseId}`);
    });

    // Handle new message from client
    socket.on('new-message', (data) => {
      const { expenseId, message } = data;
      console.log('Broadcasting message for expense:', expenseId);
      messageNamespace.to(`expense:${expenseId}`).emit('message-received', message);
    });

    socket.on('disconnect', () => {
      console.log('✗ Socket disconnected:', socket.id);
    });

    socket.on('error', (err) => {
      console.log('Socket error:', err);
    });
  });

  console.log('✓ Message socket handler initialized');
};

