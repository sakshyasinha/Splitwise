import mongoose from 'mongoose';
import logger from '../utils/logger.js';

const connectDB = async () => {
    const mongoUri = (process.env.MONGO_URI || process.env.MONGOOSE_URI || '').trim();
    if (!mongoUri) {
        throw new Error('Missing Mongo URI. Set MONGO_URI (or MONGOOSE_URI) in your .env file.');
    }

    const options = {
        maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE) || 10,
        minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE) || 5,
        serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT) || 5000,
        socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT) || 45000,
        retryWrites: true,
        retryReads: true,
    };

    try {
        await mongoose.connect(mongoUri, options);
        logger.info(`MongoDB connected (pool: ${options.minPoolSize}-${options.maxPoolSize})`);
    } catch (error) {
        logger.error('MongoDB connection failed:', error.message);
        throw error;
    }

    mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected, attempting to reconnect...');
    });

    mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error:', error.message);
    });

    mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
    });
};

export const closeDB = async () => {
    try {
        await mongoose.disconnect();
        logger.info('MongoDB disconnected gracefully');
    } catch (error) {
        logger.error('Error closing MongoDB connection:', error.message);
    }
};

export default connectDB;