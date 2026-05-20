import logger from '../utils/logger.js';
import { socketAuthMiddleware, requireSocketAuth } from '../middleware/socket-auth.middleware.js';

export const setupMessageSocket = (io) => {
  const messageNamespace = io.of('/messages');

  messageNamespace.use(socketAuthMiddleware);

  messageNamespace.on('connection', (socket) => {
    logger.info('Socket connected', { socketId: socket.id, userId: socket.userId });

    socket.on('join-expense', (expenseId, callback) => {
      try {
        if (!expenseId) {
          return callback?.({ error: 'expenseId is required' });
        }
        socket.join(`expense:${expenseId}`);
        logger.info('User joined expense room', { userId: socket.userId, expenseId, socketId: socket.id });
        callback?.({ success: true });
      } catch (err) {
        logger.error('Error joining expense room', { error: err.message });
        callback?.({ error: err.message });
      }
    });

    socket.on('leave-expense', (expenseId, callback) => {
      try {
        if (!expenseId) {
          return callback?.({ error: 'expenseId is required' });
        }
        socket.leave(`expense:${expenseId}`);
        logger.info('User left expense room', { userId: socket.userId, expenseId, socketId: socket.id });
        callback?.({ success: true });
      } catch (err) {
        logger.error('Error leaving expense room', { error: err.message });
        callback?.({ error: err.message });
      }
    });

    socket.on('new-message', (data, callback) => {
      try {
        const { expenseId, message } = data;

        if (!expenseId || !message) {
          return callback?.({ error: 'expenseId and message are required' });
        }

        const messageObj = {
          userId: socket.userId,
          expenseId,
          message,
          timestamp: new Date().toISOString(),
        };

        messageNamespace.to(`expense:${expenseId}`).emit('message-received', messageObj);
        logger.info('Message broadcast', { userId: socket.userId, expenseId, socketId: socket.id });
        callback?.({ success: true });
      } catch (err) {
        logger.error('Error broadcasting message', { error: err.message });
        callback?.({ error: err.message });
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info('Socket disconnected', { socketId: socket.id, userId: socket.userId, reason });
    });

    socket.on('error', (error) => {
      logger.error('Socket error', { socketId: socket.id, userId: socket.userId, error: error.message });
    });
  });

  logger.info('Message socket handler initialized');
};


