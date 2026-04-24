import express from 'express';
import {addExpense, getExpenses, getMyDues, updateExpense, deleteExpense} from '../controllers/expense.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router=express.Router();

router.post('/add',protect,addExpense);
router.get('/',protect,getExpenses);
router.get('/my',protect,getMyDues);
router.put('/:id',protect,updateExpense);
router.delete('/:id',protect,deleteExpense);

export default router;
