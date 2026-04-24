import * as expenseService from '../services/expense.service.js';

export const addExpense=async(req,res)=>{
    try {
        const expense = await expenseService.addExpense({
            userId: req.user?.id || req.body.userId,
            ...req.body
        });
        res.status(201).json(expense);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const getMyDues = async (req, res) => {
    try {
        const data = await expenseService.getMyDues(req.user?.id);
        res.json(data);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};