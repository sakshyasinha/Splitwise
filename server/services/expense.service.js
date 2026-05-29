import Expense from '../models/expense.model.js';
import User from '../models/user.model.js';
import Group from '../models/group.model.js';
import mongoose from 'mongoose';
import { splitEqual, splitPercentage, splitShares, splitItemized, splitCustom, splitPayment, splitAdjustment } from './split.service.js';
import * as emailService from './email.service.js';
import { createExpenseActivity } from './activity.service.js';
import { getFilePath, deleteFile } from '../middleware/upload.middleware.js';

const toStringArray = (value) => {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => String(item || '').trim())
        .filter(Boolean);
};

const getParticipantIdentifier = (item) => {
    if (typeof item === 'string' || typeof item === 'number') {
        return String(item).trim();
    }

    if (!item || typeof item !== 'object') {
        return '';
    }

    if (item.email) return String(item.email).trim();
    if (item.userId && typeof item.userId === 'object') {
        return String(item.userId.email || item.userId._id || item.userId.id || '').trim();
    }
    if (item.userId) return String(item.userId).trim();
    if (item._id) return String(item._id).trim();
    if (item.id) return String(item.id).trim();

    return '';
};

const resolveParticipantUsers = async (participants, options = {}) => {
    const { allowCreateMissing = true } = options;
    console.log('resolveParticipantUsers called with:', participants);
    const cleaned = [...new Set((participants || []).map(getParticipantIdentifier).filter(Boolean))];
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
            if (!allowCreateMissing) {
                const error = new Error(`Participant not found: ${identifier}`);
                error.statusCode = 400;
                throw error;
            }

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

const getLedgerTransactionId = (expense) => String(
    expense?._id ||
    expense?.transactionId ||
    expense?.sourceExpenseId ||
    expense?.expenseId ||
    ''
);

const isSettlementTransaction = (expense) => String(expense?.splitType || '').toLowerCase() === 'payment';

const resolveLedgerIdentity = (value, fallbackId = '', fallbackLabel = 'Unknown User') => {
    const resolvedValue = value?.toObject ? value.toObject() : value || {};
    const id = String(resolvedValue._id || resolvedValue.id || fallbackId || '');
    const name = String(resolvedValue.name || '').trim();
    const email = String(resolvedValue.email || '').trim();
    const displayName = name || email || id || fallbackLabel;

    return {
        id,
        name,
        email,
        displayName,
        label: displayName
    };
};

const buildCanonicalLedgerNode = (expense) => {
    const normalizedExpense = expense?.toObject ? expense.toObject() : { ...expense };
    const transactionId = getLedgerTransactionId(expense);
    const transactionType = isSettlementTransaction(normalizedExpense) ? 'settlement' : 'expense';
    const payerRecord = normalizedExpense.paidBy || normalizedExpense.createdBy || normalizedExpense.payers?.[0]?.userId || null;
    const payerIdentity = resolveLedgerIdentity(payerRecord, transactionId, normalizedExpense.description || 'Unknown User');
    const payerId = String(payerIdentity.id || payerRecord?._id || payerRecord || '');
    const expenseKind = normalizedExpense.splitType === 'payment'
        ? 'payment'
        : ((normalizedExpense.participants || []).length === 1 ? 'personal' : 'shared');

    const participants = (normalizedExpense.participants || []).map((participant) => {
        const participantRecord = participant?.userId || null;
        const participantId = String(participantRecord?._id || participantRecord || '');
        const identity = resolveLedgerIdentity(participantRecord, participantId, 'Unknown User');
        const shareAmount = Number(participant?.shareAmount || participant?.amount || 0);
        const paidAmount = Number(participant?.paidAmount || 0);
        const balance = Number(participant?.balance || calculateParticipantBalance(normalizedExpense, participant));

        return {
            userId: participantId,
            user: participantRecord || identity,
            identity,
            shareAmount,
            paidAmount,
            balance,
            status: String(participant?.status || 'pending').toLowerCase(),
            settled: isParticipantSettled(participant),
            settledAt: participant?.settledAt || null
        };
    });

    const payer = payerIdentity.id || payerIdentity.name || payerIdentity.email ? payerIdentity : null;

    const settlementState = isExpenseFullySettled(expense) ? 'settled' : 'pending';
    const pendingParticipantCount = getExpensePendingCount(expense);
    const settledParticipantCount = participants.filter((participant) => participant.settled).length;

    return {
        id: transactionId,
        transactionId,
        sourceExpenseId: expense?._id,
        expenseKind,
        settlementState,
        pendingParticipantCount,
        settledParticipantCount,
        participantCount: participants.length,
        transactionType,
        payer,
        participants,
        amount: Number(normalizedExpense.amount || 0),
        splitType: normalizedExpense.splitType,
        isSettled: settlementState === 'settled',
        canonicalLedgerId: transactionId,
        payerId,
        primaryKey: transactionId
    };
};

const getExpenseParticipant = (expense, userId) => {
    return (expense?.participants || []).find((entry) => {
        const entryUserId = entry?.userId?._id?.toString?.() || entry?.userId?.toString?.() || entry?.userId;
        return String(entryUserId) === String(userId);
    }) || null;
};

const isParticipantSettled = (participant) => {
    const status = String(participant?.status || 'pending').toLowerCase();
    return status === 'settled' || status === 'paid';
};

const calculateParticipantBalance = (expense, participant, userId = null) => {
    if (!expense || !participant) return 0;

    const amount = Number(expense.amount || 0);
    const paidAmount = Number(participant.paidAmount || 0);
    const shareAmount = Number(participant.shareAmount || participant.amount || 0);

    if (expense.splitType === 'payment') {
        const payerId = String(expense.paidBy?._id || expense.paidBy || expense.createdBy?._id || expense.createdBy || '');
        const participantId = String(participant.userId?._id || participant.userId || '');

        if (userId != null) {
            return String(userId) === payerId ? amount : -amount;
        }

        return participantId === payerId ? amount : -amount;
    }

    return paidAmount - shareAmount;
};

const getExpenseNetBalance = (expense, participant, userId) => {
    if (!expense || !participant) return 0;

    return calculateParticipantBalance(expense, participant, userId);
};

const getExpensePendingCount = (expense) => {
    return (expense?.participants || []).filter((participant) => !isParticipantSettled(participant)).length;
};

const isExpenseFullySettled = (expense) => {
    if (!expense) return true;
    if (expense.isSettled) return true;

    const participants = Array.isArray(expense.participants) ? expense.participants : [];
    if (participants.length === 0) return false;

    return participants.every(isParticipantSettled);
};

const buildSharedExpenseGraph = (expense) => {
    const ledgerNode = buildCanonicalLedgerNode(expense);
    const transactionId = ledgerNode.transactionId;
    const expenseKind = ledgerNode.expenseKind;
    const participants = ledgerNode.participants || [];
    const payerId = String(ledgerNode.payerId || '');
    const payer = ledgerNode.payer;

    const edges = expenseKind === 'payment'
        ? participants
            .filter((participant) => participant.userId && participant.userId !== payerId)
            .map((participant) => ({
                from: payerId,
                to: participant.userId,
                amount: Number(ledgerNode.amount || 0),
                settled: participant.settled
            }))
        : participants
            .filter((participant) => participant.userId && participant.userId !== payerId)
            .map((participant) => ({
                from: payerId,
                to: participant.userId,
                amount: Number(participant.shareAmount || 0),
                balance: Number(participant.balance || 0),
                settled: participant.settled
            }));

    const involvedNames = Array.from(new Set([
        payer?.name || payer?.email || '',
        ...participants.map((participant) => participant.user?.name || participant.user?.email || '').filter(Boolean)
    ])).filter(Boolean);

    return {
        ...ledgerNode,
        edges,
        involvedNames,
        ledgerNode
    };
};

const decorateLedgerExpense = (expense) => {
    const normalizedExpense = expense?.toObject ? expense.toObject() : { ...expense };
    const sharedGraph = buildSharedExpenseGraph(expense);

    return {
        ...normalizedExpense,
        transactionId: getLedgerTransactionId(expense),
        canonicalLedgerId: sharedGraph.ledgerNode?.canonicalLedgerId || sharedGraph.transactionId,
        sourceExpenseId: expense?._id,
        pendingParticipantCount: getExpensePendingCount(expense),
        ledgerState: isExpenseFullySettled(expense) ? 'settled' : 'pending',
        isSettled: isExpenseFullySettled(expense),
        expenseKind: sharedGraph.expenseKind,
        sharedGraph,
        ledgerNode: sharedGraph.ledgerNode || sharedGraph
    };
};

const buildLedgerRow = (expense, userId, role) => {
    const entry = buildUserLedgerEntry(expense, userId);
    if (!entry) return null;

    if (role === 'borrowed') {
        return entry.direction === 'liability' ? entry : null;
    }

    if (role === 'lent') {
        return entry.direction === 'asset' ? entry : null;
    }

    return null;
};

const getUserLedgerExpenses = async (userId) => {
    return Expense.find({
        $or: [
            { paidBy: userId },
            { createdBy: userId },
            { 'payers.userId': userId },
            { 'participants.userId': userId }
        ],
        isDeleted: false
    })
        .populate('paidBy', 'name email')
        .populate('createdBy', 'name email')
        .populate('group', 'name')
        .populate('participants.userId', 'name email')
        .populate('payers.userId', 'name email avatar')
        .sort({ createdAt: -1 });
};

const buildUserLedgerEntry = (expense, userId) => {
    const sharedGraph = buildSharedExpenseGraph(expense);
    const ledgerNode = sharedGraph.ledgerNode || sharedGraph;
    const transactionId = sharedGraph.transactionId;
    const payer = sharedGraph.payer || null;
    const participant = (sharedGraph.participants || []).find((entry) => String(entry.userId) === String(userId)) || null;
    const isPayment = sharedGraph.expenseKind === 'payment';

    if (isSettlementTransaction(expense)) {
        return null;
    }

    if (!participant || ledgerNode.settlementState === 'settled') {
        return null;
    }

    const balance = Number(participant.balance || 0);
    const direction = balance >= 0 ? 'asset' : 'liability';
    const roleDirection = direction === 'asset' ? 'is-owed' : 'owes';
    const financialRole = direction === 'asset' ? 'lent' : 'borrowed';
    const payerName = payer?.displayName || payer?.name || payer?.email || 'Unknown User';
    const payerEmail = payer?.email || '';

    const counterparty = direction === 'liability'
        ? (isPayment
            ? (payer ? { id: payer.id, name: payer.displayName || payer.name || payerEmail || 'Unknown User', email: payerEmail, displayName: payer.displayName || payer.name || payerEmail || 'Unknown User' } : null)
            : {
                id: payer?.id || null,
                name: payerName,
                email: payerEmail,
                displayName: payerName,
            })
        : null;

    const owedBy = direction === 'asset'
        ? ((sharedGraph.participants || [])
            .filter((entry) => entry.userId && entry.userId !== String(userId))
            .filter((entry) => !isPayment || String(entry.userId) !== String(payer?.id || ''))
            .filter((entry) => Number(entry.balance || 0) < 0)
            .map((entry) => ({
                id: entry.userId,
                name: entry.identity?.displayName || entry.user?.name || entry.user?.email || 'Unknown',
                displayName: entry.identity?.displayName || entry.user?.name || entry.user?.email || 'Unknown',
                amount: isPayment
                    ? Number(sharedGraph.amount || expense.amount || 0)
                    : Math.abs(Number(entry.balance || 0))
            })))
        : [];

    return {
        expenseId: transactionId,
        transactionId,
        canonicalLedgerId: ledgerNode.canonicalLedgerId || transactionId,
        ledgerNodeId: ledgerNode.id || transactionId,
        sourceExpenseId: expense?._id,
        ledgerState: ledgerNode.settlementState,
        financialRole,
        roleDirection,
        direction,
        description: expense.description || 'Unknown expense',
        amount: Math.abs(Number(participant.balance || balance || 0)),
        status: 'pending',
        transactionType: isPayment ? 'settlement' : 'expense',
        group: {
            id: expense.group?._id,
            name: expense.group?.name || ''
        },
        paidTo: counterparty,
        owedBy,
        sharedGraph,
        ledgerNode,
        createdAt: expense.createdAt
    };
};

export const buildNormalizedUserLedger = (expenses, userId) => {
    const rows = [];

    (expenses || []).forEach((expense) => {
        const entry = buildUserLedgerEntry(expense, userId);
        if (entry) {
            rows.push(entry);
        }
    });

    return rows;
};

export const summarizeUserLedgerRows = (rows = []) => {
    const groupBalances = new Map();

    rows.forEach((row) => {
        const groupId = String(row.group?.id || row.group?.name || row.transactionId || row.sourceExpenseId || '');
        if (!groupBalances.has(groupId)) {
            groupBalances.set(groupId, {
                groupId,
                groupName: String(row.group?.name || ''),
                balance: 0,
            });
        }

        const groupBalance = groupBalances.get(groupId);
        const signedAmount = row.direction === 'asset'
            ? Number(row.amount || 0)
            : -Number(row.amount || 0);

        groupBalance.balance += signedAmount;

        if (!groupBalance.groupName && row.group?.name) {
            groupBalance.groupName = row.group.name;
        }
    });

    const owesTo = [];
    const owedBy = [];
    let totalBalance = 0;

    groupBalances.forEach((groupBalance) => {
        totalBalance += groupBalance.balance;
        const roundedBalance = Math.round(groupBalance.balance * 100) / 100;

        if (roundedBalance < -0.01) {
            owesTo.push({
                ...groupBalance,
                balance: roundedBalance,
                amount: Math.abs(roundedBalance)
            });
        } else if (roundedBalance > 0.01) {
            owedBy.push({
                ...groupBalance,
                balance: roundedBalance,
                amount: roundedBalance
            });
        }
    });

    const totalOwed = rows
        .filter((row) => row.direction === 'liability')
        .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    const totalToReceive = rows
        .filter((row) => row.direction === 'asset')
        .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    return {
        totalBalance: Math.round(totalBalance * 100) / 100,
        totalOwed: Math.round(totalOwed * 100) / 100,
        totalToReceive: Math.round(totalToReceive * 100) / 100,
        owesTo,
        owedBy,
        groupBreakdown: Array.from(groupBalances.values()).map((groupBalance) => ({
            ...groupBalance,
            balance: Math.round(groupBalance.balance * 100) / 100,
        }))
    };
};

export const addExpense = async (data) => {
    try {
        console.log('addExpense called with data:', data);
        const {
            userId,
            groupId,
            amount,
            description,
            participants,
            paidBy,
            splitType = 'equal',
            splitDetails = {},
            currency = 'INR',
            category = 'General',
            notes = '',
            receiptUrl = '',
            images = [],
            tags = []
        } = data;

        console.log('Extracted values:', { userId, groupId, amount, description, participants, splitType, currency, category });

        if (!userId || !amount || !description || !Array.isArray(participants) || participants.length === 0) {
            console.error('Validation failed:', { userId, amount, description, participants });
            const error = new Error('userId, amount, description and participants are required');
            error.statusCode = 400;
            throw error;
        }

        const isGroupExpense = Boolean(groupId);
        const payerIdentifier = paidBy || userId;
        const [payerUser] = await resolveParticipantUsers([payerIdentifier], { allowCreateMissing: !isGroupExpense });
        if (!payerUser) {
            const error = new Error('Payer not found');
            error.statusCode = 400;
            throw error;
        }
        const payerId = String(payerUser._id);

        const participantUsers = await resolveParticipantUsers(participants, { allowCreateMissing: !isGroupExpense });
        const participantIds = participantUsers
            .map((user) => user._id.toString())
            .filter((id) => id !== payerId);

        if (isGroupExpense) {
            const group = await Group.findById(groupId).select('members createdBy');
            if (!group) {
                const error = new Error('Group not found');
                error.statusCode = 404;
                throw error;
            }

            const allowedMemberIds = new Set([
                ...(group.members || []).map((memberId) => String(memberId)),
                ...(group.createdBy || []).map((creatorId) => String(creatorId)),
            ]);

            if (!allowedMemberIds.has(String(userId))) {
                const error = new Error('Only group members can add expenses to this group');
                error.statusCode = 403;
                throw error;
            }

            if (!allowedMemberIds.has(payerId)) {
                const error = new Error('Selected payer is not a member of this group');
                error.statusCode = 400;
                throw error;
            }

            const invalidParticipants = participantUsers
                .filter((user) => !allowedMemberIds.has(String(user._id)))
                .map((user) => user.email || String(user._id));

            if (invalidParticipants.length > 0) {
                const error = new Error(`These participants are not in the group: ${invalidParticipants.join(', ')}`);
                error.statusCode = 400;
                throw error;
            }
        }

        // Check if this is a personal expense (only the current user)
        const isPersonalExpense = participantIds.length === 0;

        if (!isPersonalExpense && participantIds.length === 0) {
            const error = new Error('Add at least one participant other than the payer');
            error.statusCode = 400;
            throw error;
        }

        const payerAwareParticipants = isPersonalExpense ? [payerId] : [payerId, ...participantIds];
        const numericAmount = Number(amount);

        // Create email-to-userId mapping for custom split lookup
        const userEmailMap = {};
        participantUsers.forEach(user => {
            userEmailMap[user._id.toString()] = user.email;
        });
        userEmailMap[payerId] = payerUser.email;

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
                splits = splitCustom(numericAmount, payerAwareParticipants, splitDetails.customAmounts, userEmailMap);
                break;
            case 'adjustment':
                splits = splitAdjustment(numericAmount, payerAwareParticipants, splitDetails.adjustments);
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
            const isPayer = String(split.userId) === payerId;
            const balance = calculateParticipantBalance(
                { amount: numericAmount, splitType, paidBy: payerId, createdBy: userId },
                { userId: split.userId, paidAmount: isPayer ? numericAmount : 0, shareAmount: split.amount }
            );

            return {
                userId: split.userId,
                amount: split.amount, // Legacy field for backward compatibility
                shareAmount: split.amount, // New production field
                paidAmount: isPayer ? numericAmount : 0, // Payer paid full amount, others paid 0
                balance, // Payer: positive (lent), Recipient: negative (owes)
                status: isPayer ? 'settled' : 'pending' // Payer is already settled, others need to pay
            };
        });

        // Create multi-payer entry (single payer for now, but structure supports multiple)
        const payers = [{
            userId: payerId,
            amount: numericAmount,
            paidAt: new Date(),
            paymentMethod: 'cash'
        }];

        const createdExpense = await Expense.create({
            group: groupId || null, // Allow null for quick expenses without groups
            amount: numericAmount,
            description,
            category,
            notes: String(notes || '').trim() || undefined,
            receiptUrl: String(receiptUrl || '').trim() || undefined,
            images: toStringArray(images),
            tags: toStringArray(tags),
            paidBy: payerId, // Legacy field
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
                changes: { amount, description, category, splitType, participants: participantIds },
                previousValues: {},
                reason: 'Initial expense creation'
            }]
        });

        setImmediate(async () => {
            try {
                await createExpenseActivity('expense_created', createdExpense, userId, participantIds);
            } catch (error) {
                console.error('Failed to create expense activity:', error);
            }
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
    const expenses = await Expense.find({
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

    return expenses.map((expense) => decorateLedgerExpense(expense));
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
    const nextCategory = updates.category ?? expense.category;
    const nextCurrency = updates.currency ?? expense.currency;
    const nextNotes = updates.notes != null ? String(updates.notes).trim() : expense.notes;
    const nextReceiptUrl = updates.receiptUrl != null ? String(updates.receiptUrl).trim() : expense.receiptUrl;
    const nextImages = updates.images != null ? toStringArray(updates.images) : expense.images;
    const nextTags = updates.tags != null ? toStringArray(updates.tags) : expense.tags;

    if (!nextDescription || !Number.isFinite(nextAmount) || nextAmount <= 0) {
        const error = new Error('Valid description and amount are required');
        error.statusCode = 400;
        throw error;
    }

    let nextParticipants = expense.participants
        .map((entry) => String(entry.userId))
        .filter((id) => id !== String(userId)); // Exclude payer from existing participants

    if (Array.isArray(updates.participants) && updates.participants.length > 0) {
        const participantUsers = await resolveParticipantUsers(updates.participants, { allowCreateMissing: !expense.group });
        nextParticipants = participantUsers
            .map((user) => user._id.toString())
            .filter((id) => id !== String(userId));

        if (expense.group) {
            const group = await Group.findById(expense.group).select('members createdBy');
            if (!group) {
                const error = new Error('Group not found');
                error.statusCode = 404;
                throw error;
            }

            const allowedMemberIds = new Set([
                ...(group.members || []).map((memberId) => String(memberId)),
                ...(group.createdBy || []).map((creatorId) => String(creatorId)),
            ]);

            const invalidParticipants = participantUsers
                .filter((user) => !allowedMemberIds.has(String(user._id)))
                .map((user) => user.email || String(user._id));

            if (invalidParticipants.length > 0) {
                const error = new Error(`These participants are not in the group: ${invalidParticipants.join(', ')}`);
                error.statusCode = 400;
                throw error;
            }
        }
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
        participants: expense.participants.map(p => String(p.userId)),
        currency: expense.currency,
        notes: expense.notes,
        receiptUrl: expense.receiptUrl,
        images: expense.images,
        tags: expense.tags
    };

    // Update basic fields
    expense.description = nextDescription;
    expense.amount = nextAmount;
    expense.category = nextCategory;
    expense.currency = nextCurrency;
    expense.splitType = nextSplitType;
    expense.splitDetails = nextSplitDetails;
    expense.notes = nextNotes || undefined;
    expense.receiptUrl = nextReceiptUrl || undefined;
    expense.images = nextImages;
    expense.tags = nextTags;

    // Recalculate splits
    const payerAwareParticipants = [String(userId), ...nextParticipants];

    // Create email-to-userId mapping for custom split lookup
    const userEmailMap = {};
    for (const id of nextParticipants) {
        const user = await User.findById(id);
        if (user) userEmailMap[id] = user.email;
    }
    const payerUser = await User.findById(userId);
    if (payerUser) userEmailMap[userId] = payerUser.email;

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
            splits = splitCustom(nextAmount, payerAwareParticipants, nextSplitDetails.customAmounts, userEmailMap);
            break;
        default:
            splits = splitEqual(nextAmount, payerAwareParticipants);
    }

    expense.participants = splits
        .map((split) => {
            const isPayer = String(split.userId) === String(userId);
            const balance = calculateParticipantBalance(
                { amount: nextAmount, splitType: nextSplitType, paidBy: userId, createdBy: userId },
                { userId: split.userId, paidAmount: isPayer ? nextAmount : 0, shareAmount: split.amount }
            );
            return {
                userId: split.userId,
                amount: split.amount,
                shareAmount: split.amount,
                paidAmount: isPayer ? nextAmount : 0,
                balance,
                status: isPayer ? 'settled' : 'pending'
            };
        });

    // Add audit log
    if (expense.addAuditLog) {
        await expense.addAuditLog('updated', userId, {
            description: nextDescription,
            amount: nextAmount,
            currency: nextCurrency,
            splitType: nextSplitType,
            notes: nextNotes,
            receiptUrl: nextReceiptUrl,
            images: nextImages,
            tags: nextTags
        }, previousValues, 'Expense updated');
    }

    await expense.save();

    setImmediate(async () => {
        try {
            await createExpenseActivity('expense_updated', expense, userId, nextParticipants);
        } catch (error) {
            console.error('Failed to create expense update activity:', error);
        }
    });

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

    setImmediate(async () => {
        try {
            await createExpenseActivity('expense_deleted', expense, userId);
        } catch (error) {
            console.error('Failed to create expense delete activity:', error);
        }
    });

    // Cleanup related activities and uploaded files asynchronously
    setImmediate(async () => {
        try {
            // Remove activity records tied to this expense
            try {
                const ActivityModel = mongoose.model('Activity');
                await ActivityModel.deleteMany({ expenseId: expenseId });
            } catch (err) {
                console.error('Failed to delete related activities for expense:', err);
            }

            // Remove local receipt file if present
            try {
                if (expense.receiptUrl) {
                    const receiptFilename = expense.receiptUrl.split('/').pop();
                    const receiptPath = getFilePath(receiptFilename);
                    await deleteFile(receiptPath);
                }
            } catch (err) {
                console.error('Failed to delete receipt file for expense:', err);
            }

            // Remove image files if present
            try {
                if (Array.isArray(expense.images)) {
                    for (const img of expense.images) {
                        if (!img) continue;
                        const imgFilename = img.split('/').pop();
                        const imgPath = getFilePath(imgFilename);
                        await deleteFile(imgPath);
                    }
                }
            } catch (err) {
                console.error('Failed to delete expense image files:', err);
            }
        } catch (err) {
            console.error('Error during expense cleanup:', err);
        }
    });

    return { deleted: true };
};

export const settleDue = async (userId, expenseId) => {
    const expense = await Expense.findById(expenseId);

    if (!expense) {
        const error = new Error('Expense not found');
        error.statusCode = 404;
        throw error;
    }

    // If the payer ends up clicking settle, treat it as a no-op instead of a hard failure.
    // The expense is already considered paid from the payer's side.
    if (String(expense.paidBy) === String(userId) || 
        (expense.payers && expense.payers.some(p => String(p.userId) === String(userId)))) {
        return { settled: true, alreadyPaid: true, expense };
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
        return { settled: true, alreadyPaid: true, expense };
    }

    // Update participant status
    participant.status = 'settled';
    participant.settledAt = new Date();

    // For the common two-person case, settle both sides together so the expense
    // disappears from both debtor and creditor views without relying on mutable balance state.
    if ((expense.participants || []).length === 2) {
        const otherParticipant = (expense.participants || []).find((entry) => {
            const id = entry.userId?._id?.toString?.() || entry.userId?.toString?.() || entry.userId;
            return String(id) !== String(userId);
        });

        if (otherParticipant && otherParticipant.status !== 'settled') {
            otherParticipant.status = 'settled';
            otherParticipant.settledAt = new Date();
        }
    }

    // Mark participants array as modified so Mongoose saves the changes
    expense.markModified('participants');

    // Add audit log
    if (expense.addAuditLog) {
        await expense.addAuditLog('settled', userId, {
            participantId: userId,
            amount: participant.amount
        }, {}, 'Payment settled');
    }

    await expense.save();

    // If all participants are marked settled/paid, mark the expense as settled
    try {
        const allSettled = (expense.participants || []).every(p => {
            return p.status === 'settled' || p.status === 'paid';
        });

        if (allSettled && !expense.isSettled) {
            const previousValues = { isSettled: expense.isSettled };
            expense.isSettled = true;
            expense.settledAt = new Date();

            if (expense.addAuditLog) {
                await expense.addAuditLog('settled', userId, { settledBy: userId }, previousValues, 'All participants settled');
            } else {
                await expense.save();
            }
        }
    } catch (err) {
        // Don't block the settle flow if this additional step fails; log and continue
        console.error('Error while marking expense as fully settled:', err);
    }

    setImmediate(async () => {
        try {
            await createExpenseActivity('expense_settled', expense, userId, [userId]);
        } catch (error) {
            console.error('Failed to create expense settled activity:', error);
        }
    });

    return { settled: true, expense };
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
    const expenses = await getUserLedgerExpenses(userId);

    const ledgerRows = buildNormalizedUserLedger(expenses, userId);
    const dues = ledgerRows.filter((entry) => entry.direction === 'liability');

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

        const expenses = await getUserLedgerExpenses(userId);

        const ledgerRows = buildNormalizedUserLedger(expenses, userId);
        const lents = ledgerRows.filter((entry) => entry.direction === 'asset');

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
            if (isSettlementTransaction(expense) || isExpenseFullySettled(expense)) {
                return;
            }

            const expenseAmount = Number(expense.amount) || 0;
            const participants = expense.participants || [];
            const isPersonalExpense = participants.length === 1 &&
                String(participants[0].userId?._id || participants[0].userId) === String(userId);

            if (isPersonalExpense) {
                personalTotal += expenseAmount;
                personalExpenses.push({
                    expenseId: getLedgerTransactionId(expense),
                    transactionId: getLedgerTransactionId(expense),
                    sourceExpenseId: expense._id,
                    ledgerState: 'pending',
                    description: expense.description,
                    amount: expenseAmount,
                    category: expense.category,
                    date: expense.date,
                    createdAt: expense.createdAt
                });
            } else {
                sharedTotal += expenseAmount;
                sharedExpenses.push({
                    expenseId: getLedgerTransactionId(expense),
                    transactionId: getLedgerTransactionId(expense),
                    sourceExpenseId: expense._id,
                    ledgerState: 'pending',
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
            if (isSettlementTransaction(expense) || isExpenseFullySettled(expense)) {
                return;
            }

            const participants = expense.participants || [];
            const payerId = String(expense.paidBy?._id || expense.paidBy || expense.createdBy?._id || expense.createdBy || '');
            const totalAmount = Number(expense.amount || 0);

            if (expense.splitType === 'payment') {
                const otherParticipant = participants.find(
                    (entry) => String(entry.userId?._id || entry.userId) !== String(userId)
                );

                if (!otherParticipant) return;

                const friend = otherParticipant.userId;
                if (!friend) return;

                const friendId = friend._id || friend.id;
                const friendName = friend.name || friend.email || 'Unknown';
                const friendEmail = friend.email || '';

                if (!friendsMap.has(friendId)) {
                    friendsMap.set(friendId, {
                        id: friendId,
                        name: friendName,
                        email: friendEmail,
                        totalOwed: 0,
                        totalOwe: 0,
                        expenses: []
                    });
                }

                const friendData = friendsMap.get(friendId);

                if (String(userId) === payerId) {
                    friendData.totalOwed += totalAmount;
                } else {
                    friendData.totalOwe += totalAmount;
                }

                friendData.expenses.push({
                    expenseId: getLedgerTransactionId(expense),
                    transactionId: getLedgerTransactionId(expense),
                    sourceExpenseId: expense._id,
                    ledgerState: 'pending',
                    description: expense.description,
                    amount: totalAmount,
                    date: expense.date,
                    createdAt: expense.createdAt
                });

                return;
            }

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
                const friendBalance = Number(participant.paidAmount || 0) - Number(participant.shareAmount || participant.amount || 0);

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
                    expenseId: getLedgerTransactionId(expense),
                    transactionId: getLedgerTransactionId(expense),
                    sourceExpenseId: expense._id,
                    ledgerState: 'pending',
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
