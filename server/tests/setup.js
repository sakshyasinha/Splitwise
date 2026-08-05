import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import connectDB, { closeDB } from '../config/db.js';

let mongoMemoryServer;

// Ensure app import path treats tests as test environment.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

before(async function () {
    this.timeout(30000);

    if (!process.env.MONGO_URI && !process.env.MONGOOSE_URI) {
        mongoMemoryServer = await MongoMemoryServer.create();
        process.env.MONGO_URI = mongoMemoryServer.getUri();
    }

    await connectDB();
});

after(async function () {
    this.timeout(30000);

    await closeDB();

    if (mongoMemoryServer) {
        await mongoMemoryServer.stop();
    }
});

afterEach(async function () {
    const { collections } = mongoose.connection;
    const cleanupTasks = Object.values(collections).map((collection) => collection.deleteMany({}));
    await Promise.all(cleanupTasks);
});
