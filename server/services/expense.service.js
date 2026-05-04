import Expense from '../models/expense.model.js';
import User from '../models/user.model.js';
import mongoose from 'mongoose';
import { splitEqual, splitPercentage, splitShares, splitItemized, splitCustom, splitPayment } from './split.service.js';
import * as emailService from './email.service.js';

const resolveParticipantUsers = async (participants) => {
    console.log('resolveParticipantUsers called with:', participants);
    const cleaned = [...new Set(participants.map((item) => String(item).trim()).filter(Boolean))];
    console.log('Cleaned participants:', cleaned);
    const users = [];

    for (const identifier of cleaned) {
        console.log('Processing identifier:', identifier);
        let user = null;
        if (mongoose.Types.ObjectId.isValid(identifier)) {
            user = await User.findById(identifier);
            console.log('Found user by ID:', user);
        }

        if (!user) {
            user = await User.findOne({ email: identifier.toLowerCase() });
            console.log('Found user by email:', user);
        }

        if (!user) {
            // For quick expenses, create a new user if they don't exist
            // This allows expenses with users who haven't signed up yet
            console.log('User not found, creating new user for:', identifier);
            try {
                user = await User.create({
                    email: identifier.toLowerCase(),
                    name: identifier.split('@')[0], // Use email prefix as name
                    password: 'temp_password_' + Date.now(), // Temporary password
                    isTemporary: true // Flag to indicate this is a temporary user
                });
                console.log('Created new user:', user);
            } catch (error) {
                console.error('Error creating user:', error);
                // If user creation fails (e.g., duplicate email), try to find again
                if (error.code === 11000) {
                    user = await User.findOne({ email: identifier.toLowerCase() });
                    console.log('Found existing user after duplicate error:', user);
                } else {
                    throw error;
                }
            }
        }

        if (user) {
            users.push(user);
        }
    }

    console.log('Final users array:', users);
    return users;
};

export const addExpense = async (data) => {
    try {
        console.log('addExpense called with data:', data);
        const { userId, groupId, amount, description, participants, splitType = 'equal', splitDetails = {}, currency = 'INR' } = data;

        console.log('Extracted values:', { userId, groupId, amount, description, participants, splitType, currency });

        if (!userId || !amount || !description || !Array.isArray(participants) || participants.length === 0) {
            console.error('Validation failed:', { userId, amount, description, participants });
            const error = new Error('userId, amount, description and participants are required');
            error.statusCode = 400;
            throw error;
        }

        const participantUsers = await resolveParticipantUsers(participants);
        const participantIds = participantUsers
            .map((user) => user._id.toString())
            .filter((id) => id !== String(userId));

        // Check if this is a personal expense (only the current user)
        const isPersonalExpense = participants.length === 1 && String(participants[0]) === String(userId);

        if (!isPersonalExpense && participantIds.length === 0) {
            const error = new Error('Add at least one participant other than the payer');
            error.statusCode = 400;
            throw error;
        }

        const payerAwareParticipants = isPersonalExpense ? [String(userId)] : [String(userId), ...participantIds];
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
            case 'payment':
                splits = splitPayment(numericAmount, payerAwareParticipants);
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
            group: groupId || null, // Allow null for quick expenses without groups
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

        // Send expense alert emails to participants asynchronously
        if (!isPersonalExpense && participantIds.length > 0) {
            setImmediate(async () => {
                try {
                    await emailService.sendExpenseAlertEmail(createdExpense._id);
                } catch (error) {
                    console.error('Failed to send expense alert email:', error);
                }
            });
        }

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

    let nextParticipants = expense.participants
        .map((entry) => String(entry.userId))
        .filter((id) => id !== String(userId)); // Exclude payer from existing participants

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
                    name: expense.group?.name || '' // Default to 'Friends' if no group
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

        // Find expenses where the user is involved
        const expenses = await Expense.find({
            $or: [
                { paidBy: userId },
                { createdBy: userId },
                { 'payers.userId': userId },
                { "participants.userId": userId }
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
                // Find the user's participant entry to get their balance
                const userParticipant = (expense.participants || []).find(
                    (entry) => String(entry.userId?._id || entry.userId) === String(userId)
                );

                if (!userParticipant) {
                    return null;
                }

                // Calculate how much the user is owed (positive balance)
                // balance = paidAmount - shareAmount
                // If positive, user paid more than their share = they lent money
                const userBalance = Number(userParticipant.balance || 0);

                if (userBalance <= 0) {
                    return null; // User doesn't lent anything in this expense
                }

                // Find who owes the user (other participants with negative balance)
                const debtors = (expense.participants || [])
                    .filter((entry) => {
                        const participantId = String(entry.userId?._id || entry.userId);
                        const isNotUser = participantId !== String(userId);
                        const owesMoney = Number(entry.balance || 0) < 0;
                        return isNotUser && owesMoney;
                    })
                    .map((entry) => ({
                        id: entry.userId?._id,
                        name: entry.userId?.name || entry.userId?.email || 'Unknown',
                        amount: Math.abs(Number(entry.balance || 0)) // They owe this amount
                    }));

                if (debtors.length === 0) {
                    return null;
                }

                const totalOwedToUser = debtors.reduce(
                    (sum, debtor) => sum + debtor.amount,
                    0
                );

                return {
                    expenseId: expense._id,
                    description: expense.description || 'Unknown expense',
                    amount: totalOwedToUser,
                    status: 'pending',
                    group: {
                        id: expense.group?._id,
                        name: expense.group?.name || 'Friends' // Default to 'Friends' if no group
                    },
                    owedBy: debtors,
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

/**
 * Get expense breakdown by type (Personal vs Shared)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Object containing personal and shared expense totals
 */
export const getExpenseBreakdown = async (userId) => {
    try {
        if (!userId) {
            const error = new Error("User ID is required");
            error.statusCode = 400;
            throw error;
        }

        // Find all expenses where the user is involved
        const expenses = await Expense.find({
            $or: [
                { paidBy: userId },
                { createdBy: userId },
                { 'payers.userId': userId },
                { "participants.userId": userId }
            ],
            isDeleted: false
        })
            .populate('paidBy', 'name email')
            .populate('createdBy', 'name email')
            .populate('group', 'name')
            .populate('participants.userId', 'name email')
            .sort({ createdAt: -1 });

        let personalTotal = 0;
        let sharedTotal = 0;
        const personalExpenses = [];
        const sharedExpenses = [];

        expenses.forEach(expense => {
            const expenseAmount = Number(expense.amount) || 0;
            const participants = expense.participants || [];
            const isPersonalExpense = participants.length === 1 &&
                String(participants[0].userId?._id || participants[0].userId) === String(userId);

            if (isPersonalExpense) {
                personalTotal += expenseAmount;
                personalExpenses.push({
                    expenseId: expense._id,
                    description: expense.description,
                    amount: expenseAmount,
                    category: expense.category,
                    date: expense.date,
                    createdAt: expense.createdAt
                });
            } else {
                sharedTotal += expenseAmount;
                sharedExpenses.push({
                    expenseId: expense._id,
                    description: expense.description,
                    amount: expenseAmount,
                    category: expense.category,
                    splitType: expense.splitType,
                    group: expense.group ? {
                        id: expense.group._id,
                        name: expense.group.name
                    } : null,
                    date: expense.date,
                    createdAt: expense.createdAt
                });
            }
        });

        return {
            personal: {
                total: personalTotal,
                count: personalExpenses.length,
                expenses: personalExpenses
            },
            shared: {
                total: sharedTotal,
                count: sharedExpenses.length,
                expenses: sharedExpenses
            },
            total: personalTotal + sharedTotal
        };
    } catch (error) {
        console.error('Error in getExpenseBreakdown:', error);
        throw error;
    }
};

/**
 * Get friends list (people who owe you or you owe, outside of groups)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Object containing friends and their relationships
 */
export const getFriendsList = async (userId) => {
    try {
        if (!userId) {
            const error = new Error("User ID is required");
            error.statusCode = 400;
            throw error;
        }

        // Find expenses without groups (quick expenses) where user is involved
        const expenses = await Expense.find({
            $or: [
                { paidBy: userId },
                { createdBy: userId },
                { 'payers.userId': userId },
                { "participants.userId": userId }
            ],
            group: null, // Only expenses without groups
            isDeleted: false
        })
            .populate('paidBy', 'name email')
            .populate('createdBy', 'name email')
            .populate('participants.userId', 'name email')
            .sort({ createdAt: -1 });

        const friendsMap = new Map();

        expenses.forEach(expense => {
            const participants = expense.participants || [];

            participants.forEach(participant => {
                const participantId = String(participant.userId?._id || participant.userId);
                if (participantId === String(userId)) return; // Skip self

                const friend = participant.userId;
                if (!friend) return;

                const friendId = friend._id || friend.id;
                const friendName = friend.name || friend.email || 'Unknown';
                const friendEmail = friend.email || '';

                // Calculate balance for this friend
                // If friend has negative balance, they owe money
                // If friend has positive balance, I owe them money
                const friendBalance = Number(participant.balance || 0);

                if (!friendsMap.has(friendId)) {
                    friendsMap.set(friendId, {
                        id: friendId,
                        name: friendName,
                        email: friendEmail,
                        totalOwed: 0, // They owe me
                        totalOwe: 0,   // I owe them
                        expenses: []
                    });
                }

                const friendData = friendsMap.get(friendId);

                if (friendBalance < 0) {
                    // Friend owes money (negative balance means they haven't paid their share)
                    friendData.totalOwed += Math.abs(friendBalance);
                } else if (friendBalance > 0) {
                    // I owe friend money (positive balance means I paid more than my share)
                    friendData.totalOwe += friendBalance;
                }

                friendData.expenses.push({
                    expenseId: expense._id,
                    description: expense.description,
                    amount: Math.abs(friendBalance),
                    date: expense.date,
                    createdAt: expense.createdAt
                });
            });
        });

        // Convert map to array and sort by total amount
        const friends = Array.from(friendsMap.values())
            .map(friend => ({
                ...friend,
                netBalance: friend.totalOwed - friend.totalOwe // Positive = they owe me, Negative = I owe them
            }))
            .sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance));

        // Calculate totals
        const totalOwedToMe = friends.reduce((sum, f) => sum + f.totalOwed, 0);
        const totalIOwe = friends.reduce((sum, f) => sum + f.totalOwe, 0);

        return {
            friends,
            totalOwedToMe,
            totalIOwe,
            netBalance: totalOwedToMe - totalIOwe
        };
    } catch (error) {
        console.error('Error in getFriendsList:', error);
        throw error;
    }
};
