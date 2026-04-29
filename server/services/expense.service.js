import Expense from '../models/expense.model.js';
import User from '../models/user.model.js';
import mongoose from 'mongoose';
import { splitEqual, splitPercentage, splitShares, splitItemized, splitCustom } from './split.service.js';

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

export const addExpense = async (data) => {
    try {
        const { userId, groupId, amount, description, participants, splitType = 'equal', splitDetails = {}, currency = 'INR' } = data;

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

        const payerAwareParticipants = [String(userId), ...participantIds];
        const numericAmount = Number(amount);

        // Calculate splits based on splitType
        let splits;
        switch (splitType) {
            case 'equal':
                splits = splitEqual(numericAmount, payerAwareParticipants);
                break;
            case 'percentage':
                splits = splitPercentage(numericAmount, payerAwareParticipants, splitDetails.percentages);
                break;
            case 'shares':
                splits = splitShares(numericAmount, payerAwareParticipants, splitDetails.shares);
                break;
            case 'itemized':
                splits = splitItemized(numericAmount, payerAwareParticipants, splitDetails.items);
                break;
            case 'custom':
                splits = splitCustom(numericAmount, payerAwareParticipants, splitDetails.customAmounts);
                break;
            default:
                splits = splitEqual(numericAmount, payerAwareParticipants);
        }

        // Create participant entries for ALL participants (including the payer)
        // This ensures proper balance calculation
        const participantSplits = splits.map((split) => {
            const isPayer = String(split.userId) === String(userId);
            return {
                userId: split.userId,
                amount: split.amount, // Legacy field for backward compatibility
                shareAmount: split.amount, // New production field
                paidAmount: isPayer ? numericAmount : 0, // Payer paid full amount, others paid 0
                balance: isPayer ? (numericAmount - split.amount) : -split.amount, // Payer: positive (lent), Others: negative (owe)
                status: isPayer ? 'settled' : 'pending' // Payer is already settled, others need to pay
            };
        });

        // Create multi-payer entry (single payer for now, but structure supports multiple)
        const payers = [{
            userId: userId,
            amount: numericAmount,
            paidAt: new Date(),
            paymentMethod: 'cash'
        }];

        const createdExpense = await Expense.create({
            group: groupId,
            amount: numericAmount,
            description,
            paidBy: userId, // Legacy field
            createdBy: userId, // New production field
            participants: participantSplits,
            currency,
            splitType,
            splitDetails,
            payers,
            // Initialize audit log
            auditLog: [{
                action: 'created',
                changedBy: userId,
                changedAt: new Date(),
                changes: { amount, description, splitType, participants: participantIds },
                previousValues: {},
                reason: 'Initial expense creation'
            }]
        });

        return Expense.findById(createdExpense._id)
            .populate('group', 'name')
            .populate('paidBy', 'name email')
            .populate('createdBy', 'name email')
            .populate('payers.userId', 'name email avatar')
            .populate('participants.userId', 'name email');
    } catch (error) {
        console.error('Error in addExpense:', error);
        throw error;
    }
};
export const getVisibleExpenses = async (userId) => {
    return Expense.find({
        $or: [
            { paidBy: userId },
            { createdBy: userId },
            { 'payers.userId': userId },
            { "participants.userId": userId }
        ],
        isDeleted: false
    })
        .populate("group", "name")
        .populate("paidBy", "name email")
        .populate("createdBy", "name email")
        .populate("payers.userId", "name email avatar")
        .populate("participants.userId", "name email")
        .sort({ createdAt: -1 });
};

export const updateExpense = async (userId, expenseId, updates) => {
    const expense = await Expense.findById(expenseId);
    if (!expense) {
        const error = new Error('Expense not found');
        error.statusCode = 404;
        throw error;
    }

    // Check authorization (support both legacy and new fields)
    if (String(expense.paidBy) !== String(userId) && String(expense.createdBy) !== String(userId)) {
        const error = new Error('Only the creator can edit this expense');
        error.statusCode = 403;
        throw error;
    }

    const nextDescription = (updates.description ?? expense.description)?.trim();
    const nextAmount = updates.amount != null ? Number(updates.amount) : Number(expense.amount);
    const nextSplitType = updates.splitType ?? expense.splitType;
    const nextSplitDetails = updates.splitDetails ?? expense.splitDetails;

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

    // Store previous values for audit log
    const previousValues = {
        description: expense.description,
        amount: expense.amount,
        splitType: expense.splitType,
        participants: expense.participants.map(p => String(p.userId))
    };

    // Update basic fields
    expense.description = nextDescription;
    expense.amount = nextAmount;
    expense.splitType = nextSplitType;
    expense.splitDetails = nextSplitDetails;

    // Recalculate splits
    const payerAwareParticipants = [String(userId), ...nextParticipants];
    let splits;
    switch (nextSplitType) {
        case 'equal':
            splits = splitEqual(nextAmount, payerAwareParticipants);
            break;
        case 'percentage':
            splits = splitPercentage(nextAmount, payerAwareParticipants, nextSplitDetails.percentages);
            break;
        case 'shares':
            splits = splitShares(nextAmount, payerAwareParticipants, nextSplitDetails.shares);
            break;
        case 'itemized':
            splits = splitItemized(nextAmount, payerAwareParticipants, nextSplitDetails.items);
            break;
        case 'custom':
            splits = splitCustom(nextAmount, payerAwareParticipants, nextSplitDetails.customAmounts);
            break;
        default:
            splits = splitEqual(nextAmount, payerAwareParticipants);
    }

    expense.participants = splits
        .map((split) => {
            const isPayer = String(split.userId) === String(userId);
            return {
                userId: split.userId,
                amount: split.amount,
                shareAmount: split.amount,
                paidAmount: isPayer ? nextAmount : 0,
                balance: isPayer ? (nextAmount - split.amount) : -split.amount,
                status: isPayer ? 'settled' : 'pending'
            };
        });

    // Add audit log
    if (expense.addAuditLog) {
        await expense.addAuditLog('updated', userId, {
            description: nextDescription,
            amount: nextAmount,
            splitType: nextSplitType
        }, previousValues, 'Expense updated');
    }

    await expense.save();

    return Expense.findById(expense._id)
        .populate('group', 'name')
        .populate('paidBy', 'name email')
        .populate('createdBy', 'name email')
        .populate('payers.userId', 'name email avatar')
        .populate('participants.userId', 'name email');
};

export const deleteExpense = async (userId, expenseId) => {
    const expense = await Expense.findById(expenseId);
    if (!expense) {
        const error = new Error('Expense not found');
        error.statusCode = 404;
        throw error;
    }

    // Check authorization
    if (String(expense.paidBy) !== String(userId) && String(expense.createdBy) !== String(userId)) {
        const error = new Error('Only the creator can delete this expense');
        error.statusCode = 403;
        throw error;
    }

    // Use soft delete if available, otherwise hard delete
    if (expense.softDelete) {
        await expense.softDelete(userId, 'Expense deleted by user');
    } else {
        await Expense.deleteOne({ _id: expenseId });
    }

    return { deleted: true };
};

export const settleDue = async (userId, expenseId) => {
    const expense = await Expense.findById(expenseId);

    if (!expense) {
        const error = new Error('Expense not found');
        error.statusCode = 404;
        throw error;
    }

    // Check if user is the payer (payers don't need to settle)
    if (String(expense.paidBy) === String(userId) || 
        (expense.payers && expense.payers.some(p => String(p.userId) === String(userId)))) {
        const error = new Error('Payer does not need to settle this expense');
        error.statusCode = 400;
        throw error;
    }

    const participant = expense.participants?.find((entry) => {
        const id =
            entry.userId?._id?.toString?.() ||
            entry.userId?.toString?.() ||
            entry.userId;

        return String(id) === String(userId);
    });

    if (!participant) {
        const error = new Error('You are not part of this expense split');
        error.statusCode = 403;
        throw error;
    }

    if (participant.status === 'paid' || participant.status === 'settled') {
        return { settled: true, alreadyPaid: true };
    }

    // Update participant status
    participant.status = 'settled';
    participant.settledAt = new Date();
    
    // Update balance (they've now paid their share)
    participant.paidAmount = participant.shareAmount || participant.amount;
    participant.balance = 0;

    // Add audit log
    if (expense.addAuditLog) {
        await expense.addAuditLog('settled', userId, {
            participantId: userId,
            amount: participant.amount
        }, {}, 'Payment settled');
    }

    await expense.save();

    return { settled: true };
};

export const getGroupExpenses = async (userId, groupId) => {
    if (!groupId) {
        const error = new Error("groupId is required");
        error.statusCode = 400;
        throw error;
    }

    const expenses = await Expense.find({ 
        group: groupId,
        isDeleted: false 
    })
        .populate("group", "name")
        .populate("paidBy", "name email")
        .populate("createdBy", "name email")
        .populate("payers.userId", "name email avatar")
        .populate("participants.userId", "name email")
        .sort({ createdAt: -1 });

    return expenses;
};

export const getMyDues = async (userId) => {
    const expenses = await Expense.find({
        'participants.userId': userId,
        isDeleted: false
    })
        .populate('paidBy', 'name email')
        .populate('createdBy', 'name email')
        .populate('group', 'name')
        .sort({ createdAt: -1 });

    const dues = expenses
        .map((expense) => {
            const participant = expense.participants.find(
                (entry) => String(entry.userId) === String(userId)
            );

            if (!participant ||
                participant.status === 'paid' ||
                participant.status === 'settled') {
                return null;
            }

            // Support both legacy and new amount fields - convert to number
            const amount = Number(participant.amount || participant.shareAmount || 0);

            return {
                expenseId: expense._id,
                description: expense.description,
                amount: amount,
                status: participant.status,
                group: {
                    id: expense.group?._id,
                    name: expense.group?.name || 'Unknown Group'
                },
                paidTo: {
                    id: expense.paidBy?._id || expense.createdBy?._id,
                    name: expense.paidBy?.name || expense.createdBy?.name || 'Unknown User',
                    email: expense.paidBy?.email || expense.createdBy?.email || ''
                },
                createdAt: expense.createdAt
            };
        })
        .filter(Boolean);

    const totalOwed = dues.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return { totalOwed, dues };
};

export const getMyLents = async (userId) => {
    try {
        if (!userId) {
            const error = new Error("User ID is required");
            error.statusCode = 400;
            throw error;
        }

        // Find expenses where the user is the payer
        const expenses = await Expense.find({
            $or: [
                { paidBy: userId },
                { createdBy: userId },
                { 'payers.userId': userId }
            ],
            isDeleted: false
        })
            .populate('paidBy', 'name email')
            .populate('createdBy', 'name email')
            .populate('group', 'name')
            .populate('participants.userId', 'name email')
            .sort({ createdAt: -1 });

        const lents = expenses
            .map((expense) => {
                // Check if user is the payer
                const isPayer = String(expense.paidBy?._id || expense.paidBy) === String(userId) ||
                               String(expense.createdBy?._id || expense.createdBy) === String(userId) ||
                               (expense.payers && expense.payers.some(p => String(p.userId?._id || p.userId) === String(userId)));

                if (!isPayer) {
                    return null;
                }

                // Calculate how much others owe this user
                const otherParticipants = (expense.participants || []).filter(
                    (entry) => {
                        const participantId = String(entry.userId?._id || entry.userId);
                        return participantId !== String(userId) && entry.status === 'pending';
                    }
                );

                if (otherParticipants.length === 0) {
                    return null;
                }

                const totalOwedToUser = otherParticipants.reduce(
                    (sum, entry) => sum + Number(entry.amount || entry.shareAmount || 0),
                    0
                );

                if (totalOwedToUser <= 0) {
                    return null;
                }

                return {
                    expenseId: expense._id,
                    description: expense.description || 'Unknown expense',
                    amount: totalOwedToUser,
                    status: 'pending',
                    group: {
                        id: expense.group?._id,
                        name: expense.group?.name || 'Unknown Group'
                    },
                    owedBy: otherParticipants.map(p => ({
                        id: p.userId?._id,
                        name: p.userId?.name || p.userId?.email || 'Unknown',
                        amount: Number(p.amount || p.shareAmount || 0)
                    })),
                    createdAt: expense.createdAt
                };
            })
            .filter(Boolean);

        const totalLent = lents.reduce((sum, item) => sum + Number(item.amount || 0), 0);

        return { totalLent, lents };
    } catch (error) {
        console.error('Error in getMyLents:', error);
        throw error;
    }
};
