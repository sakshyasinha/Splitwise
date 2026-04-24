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

export const getExpenses = async (req, res) => {
    try {
        const data = await expenseService.getVisibleExpenses(req.user?.id);
        res.json(data);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const updateExpense = async (req, res) => {
    try {
        const expense = await expenseService.updateExpense(req.user?.id, req.params.id, req.body);
        res.json(expense);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const deleteExpense = async (req, res) => {
    try {
        const data = await expenseService.deleteExpense(req.user?.id, req.params.id);
        res.json(data);
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