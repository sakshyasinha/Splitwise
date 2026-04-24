import express from 'express';
import dotenv from "dotenv"
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import connectDB from "./config/db.js"

import authRoutes from './routes/auth.routes.js'
import groupRoutes from './routes/group.routes.js';
import expenseRoutes from './routes/expense.routes.js';
import settlementsRoutes from './routes/settlements.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = Number(process.env.PORT) || 5000;
const CORS_ORIGIN = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : true;

const app =express();

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});

app.use('/api/auth',authRoutes);

app.use("/api/groups", groupRoutes);

app.use("/api/expenses", expenseRoutes);

app.use("/api/settlements",settlementsRoutes);


const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error('DB connection failed:', error);
        process.exit(1);
    }
};

startServer();
