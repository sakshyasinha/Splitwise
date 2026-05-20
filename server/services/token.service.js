import jwt from 'jsonwebtoken';
import { getRedisClient } from './cache.service.js';
import logger from '../utils/logger.js';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60;

const getRefreshTokenKey = (userId) => `refresh_token:${userId}`;

export const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { id: userId, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { id: userId, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { accessToken, refreshToken };
};

export const storeRefreshToken = async (userId, refreshToken) => {
  try {
    const redis = getRedisClient();
    const key = getRefreshTokenKey(userId);
    await redis.setex(key, REFRESH_TOKEN_TTL, refreshToken);
  } catch (error) {
    logger.error('Failed to store refresh token in Redis:', error.message);
    throw new Error('Token storage failed');
  }
};

export const verifyRefreshToken = async (userId, refreshToken) => {
  try {
    const redis = getRedisClient();
    const key = getRefreshTokenKey(userId);
    const storedToken = await redis.get(key);
    return storedToken === refreshToken;
  } catch (error) {
    logger.error('Failed to verify refresh token:', error.message);
    return false;
  }
};

export const revokeRefreshToken = async (userId) => {
  try {
    const redis = getRedisClient();
    const key = getRefreshTokenKey(userId);
    await redis.del(key);
  } catch (error) {
    logger.error('Failed to revoke refresh token:', error.message);
  }
};

export const refreshAccessToken = async (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    const isValid = await verifyRefreshToken(decoded.id, refreshToken);
    if (!isValid) {
      throw new Error('Refresh token has been revoked');
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.id);
    await storeRefreshToken(decoded.id, newRefreshToken);

    return { accessToken, refreshToken: newRefreshToken };
  } catch (error) {
    logger.error('Token refresh failed:', error.message);
    throw new Error('Token refresh failed');
  }
};
