import Expense from '../models/expense.model.js';
import User from '../models/user.model.js';
import mongoose from 'mongoose';
import { splitEqual } from './split.service.js';

const resolveParticipantUsers = async (participants) => {
    const cleaned = [...new Set(participants.map((item) => String(item).trim()).filter(Boolean))];
    const users = [];
    const missing = [];

    for (const identifier of cleaned) {
        let user = null;
        if (mongoose.Types.ObjectId.isValid(identifier)) {
            user = await User.findById(identifier);
        }

        if (!user) {
            user = await User.findOne({ email: identifier.toLowerCase() });
        }

        if (user) {
            users.push(user);
        } else {
            missing.push(identifier);
        }
    }

    if (missing.length > 0) {
        const error = new Error(`Users not found for: ${missing.join(', ')}`);
        error.statusCode = 400;
        throw error;
    }

    return users;
};

export const addExpense=async(data)=>{
    const { userId, groupId, amount, description, participants } = data;

    if (!userId || !groupId || !amount || !description || !Array.isArray(participants) || participants.length === 0) {
        const error = new Error('userId, groupId, amount, description and participants are required');
        error.statusCode = 400;
        throw error;
    }

    const participantUsers = await resolveParticipantUsers(participants);
    const participantIds = participantUsers
        .map((user) => user._id.toString())
        .filter((id) => id !== String(userId));

    if (participantIds.length === 0) {
        const error = new Error('Add at least one participant other than the payer');
        error.statusCode = 400;
        throw error;
    }

    const splits=splitEqual(Number(amount), participantIds).map((split) => ({
        ...split,
        status: 'pending'
    }));

    const createdExpense=await Expense.create({
        group: groupId,
        amount: Number(amount),
        description,
        paidBy:userId,
        participants:splits,
    });
    return createdExpense;
};

export const getVisibleExpenses = async (userId) => {
    return Expense.find({
        $or: [
            { paidBy: userId },
            { 'participants.userId': userId }
        ]
    })
        .populate('group', 'name')
        .populate('paidBy', 'name email')
        .sort({ createdAt: -1 });
};

export const updateExpense = async (userId, expenseId, updates) => {
    const expense = await Expense.findById(expenseId);
    if (!expense) {
        const error = new Error('Expense not found');
        error.statusCode = 404;
        throw error;
    }

    if (String(expense.paidBy) !== String(userId)) {
        const error = new Error('Only the payer can edit this expense');
        error.statusCode = 403;
        throw error;
    }

    const nextDescription = (updates.description ?? expense.description)?.trim();
    const nextAmount = updates.amount != null ? Number(updates.amount) : Number(expense.amount);

    if (!nextDescription || !Number.isFinite(nextAmount) || nextAmount <= 0) {
        const error = new Error('Valid description and amount are required');
        error.statusCode = 400;
        throw error;
    }

    let nextParticipants = expense.participants.map((entry) => String(entry.userId));

    if (Array.isArray(updates.participants) && updates.participants.length > 0) {
        const participantUsers = await resolveParticipantUsers(updates.participants);
        nextParticipants = participantUsers
            .map((user) => user._id.toString())
            .filter((id) => id !== String(userId));
    }

    if (nextParticipants.length === 0) {
        const error = new Error('Add at least one participant other than the payer');
        error.statusCode = 400;
        throw error;
    }

    expense.description = nextDescription;
    expense.amount = nextAmount;
    expense.participants = splitEqual(nextAmount, nextParticipants).map((split) => ({
        ...split,
        status: 'pending'
    }));

    await expense.save();

    return Expense.findById(expense._id)
        .populate('group', 'name')
        .populate('paidBy', 'name email');
};

export const deleteExpense = async (userId, expenseId) => {
    const expense = await Expense.findById(expenseId);
    if (!expense) {
        const error = new Error('Expense not found');
        error.statusCode = 404;
        throw error;
    }

    if (String(expense.paidBy) !== String(userId)) {
        const error = new Error('Only the payer can delete this expense');
        error.statusCode = 403;
        throw error;
    }

    await Expense.deleteOne({ _id: expenseId });
    return { deleted: true };
};

export const getMyDues = async (userId) => {
    const expenses = await Expense.find({ 'participants.userId': userId })
        .populate('paidBy', 'name email')
        .populate('group', 'name')
        .sort({ createdAt: -1 });

    const dues = expenses
        .map((expense) => {
            const participant = expense.participants.find(
                (entry) => String(entry.userId) === String(userId)
            );

            if (!participant || String(expense.paidBy?._id) === String(userId)) {
                return null;
            }

            return {
                expenseId: expense._id,
                description: expense.description,
                amount: participant.amount,
                status: participant.status,
                group: {
                    id: expense.group?._id,
                    name: expense.group?.name || 'Unknown Group'
                },
                paidTo: {
                    id: expense.paidBy?._id,
                    name: expense.paidBy?.name || 'Unknown User',
                    email: expense.paidBy?.email || ''
                },
                createdAt: expense.createdAt
            };
        })
        .filter(Boolean);

    const totalOwed = dues.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return { totalOwed, dues };
};