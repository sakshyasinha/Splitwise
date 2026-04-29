import express from 'express';
import dotenv from "dotenv"
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import connectDB from "./config/db.js"
import logger from './utils/logger.js';
import expressWinston from 'express-winston';
import * as Sentry from '@sentry/node';

import authRoutes from './routes/auth.routes.js'
import groupRoutes from './routes/group.routes.js';
import expenseRoutes from './routes/expense.routes.js';
import settlementsRoutes from './routes/settlements.routes.js';
import aiRoutes from './routes/ai.routes.js';
import debtRoutes from './routes/debt.routes.js';
import activityRoutes from './routes/activity.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.JWT_SECRET) {
    throw new Error('Missing JWT secret. Set JWT_SECRET in server/.env or the workspace root .env file.');
}

const PORT = Number(process.env.PORT) || 5000;
const CORS_ORIGIN = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : true;

const app =express();

if (process.env.SENTRY_DSN) {
    Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || 'development' });
    app.use(Sentry.Handlers.requestHandler());
}

app.use(expressWinston.logger({
    winstonInstance: logger,
    meta: true,
    msg: 'HTTP {{req.method}} {{req.url}}',
    expressFormat: true,
    colorize: false,
}));

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});

app.use('/api/auth',authRoutes);
app.use('/api/ai', aiRoutes);

app.use("/api/groups", groupRoutes);

app.use("/api/expenses", expenseRoutes);

app.use("/api/settlements",settlementsRoutes);

app.use("/api/debt", debtRoutes);

app.use("/api/activity", activityRoutes);


export const startServer = async () => {
    try {
        await connectDB();

        const server = app.listen(PORT, () => {
            logger.info(`Server is running on port ${PORT} (env: ${process.env.NODE_ENV || 'development'})`);
        });

        server.on('error', (err) => {
            if (err && err.code === 'EADDRINUSE') {
                logger.error(`Port ${PORT} is already in use. Stop the other process or set a different PORT environment variable.`);
            } else {
                logger.error('Server error:', err);
            }
            process.exit(1);
        });

        // Error handler middleware should be last
        if (process.env.SENTRY_DSN) {
            app.use(Sentry.Handlers.errorHandler());
        }

        const { errorHandler } = await import('./middleware/error.middleware.js');
        app.use(errorHandler);
    } catch (error) {
        logger.error('DB connection failed:', error);
        process.exit(1);
    }
};

// Export app for testing
export default app;

// Only start server when not running tests
if (process.env.NODE_ENV !== 'test') {
    startServer();
}
