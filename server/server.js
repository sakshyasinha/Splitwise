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

const app =express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use('/api/auth',authRoutes);

app.use("/api/groups", groupRoutes);

app.use("/api/expenses", expenseRoutes);

app.use("/api/settlements",settlementsRoutes);


const startServer = async () => {
    try {
        await connectDB();

        app.listen(5000, () => {
            console.log('Server is running on port 5000');
        });
    } catch (error) {
        console.error('DB connection failed:', error);
        process.exit(1);
    }
};

startServer();
