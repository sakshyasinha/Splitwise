import express from 'express';
import {addExpense, getMyDues} from '../controllers/expense.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router=express.Router();

router.post('/add',protect,addExpense);
router.get('/my',protect,getMyDues);

export default router;
