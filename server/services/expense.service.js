import Expense from '../models/expense.model.js';
import { splitEqual } from './split.service.js';

export const addExpense=async(data)=>{
    const { userId, groupId, amount, description, participants } = data;

    if (!userId || !groupId || !amount || !description || !Array.isArray(participants) || participants.length === 0) {
        const error = new Error('userId, groupId, amount, description and participants are required');
        error.statusCode = 400;
        throw error;
    }

    const splits=splitEqual(Number(amount), participants);

    const createdExpense=await Expense.create({
        group: groupId,
        amount: Number(amount),
        description,
        paidBy:userId,
        participants:splits,
    });
    return createdExpense;
};