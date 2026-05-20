import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

export const socketAuthMiddleware = (socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    logger.warn('Socket auth failed: no token', { socketId: socket.id });
    return next(new Error('Authentication failed - no token provided'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type === 'refresh') {
      logger.warn('Socket auth failed: refresh token used', { socketId: socket.id, userId: decoded.id });
      return next(new Error('Invalid token type - refresh tokens cannot be used for Socket.IO'));
    }

    socket.userId = decoded.id;
    socket.user = decoded;
    logger.info('Socket auth successful', { socketId: socket.id, userId: decoded.id });
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.warn('Socket auth failed: token expired', { socketId: socket.id });
      return next(new Error('Token expired'));
    }
    if (error.name === 'JsonWebTokenError') {
      logger.warn('Socket auth failed: invalid token', { socketId: socket.id, error: error.message });
      return next(new Error('Invalid token'));
    }
    logger.error('Socket auth failed: unknown error', { socketId: socket.id, error: error.message });
    next(new Error('Authentication failed'));
  }
};

export const requireSocketAuth = (socket, next) => {
  if (!socket.userId) {
    logger.warn('Socket operation denied: not authenticated', { socketId: socket.id });
    return next(new Error('Not authenticated'));
  }
  next();
};
