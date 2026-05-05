import { CalculateBalance } from "../services/balance.service.js";
import { simplifyDebts } from "../services/settlement.services.js";
import Settlement from "../models/settlement.model.js";
import User from "../models/user.model.js";
import Expense from "../models/expense.model.js";
import * as emailService from '../services/email.service.js';

// Helper function to normalize expense (same as in expense.controller)
const normalizeExpense = (expense) => {
  if (!expense) return expense;

  const normalized = expense.toObject ? expense.toObject() : { ...expense };

  // Convert Decimal128 fields to numbers
  if (normalized.amount) {
    normalized.amount = Number(normalized.amount);
  }

  // Ensure paidBy field exists (use first payer if available)
  if (!normalized.paidBy && normalized.payers && normalized.payers.length > 0) {
    normalized.paidBy = normalized.payers[0].userId;
  }

  // Normalize participant amounts
  if (normalized.participants) {
    normalized.participants = normalized.participants.map(participant => ({
      ...participant,
      amount: Number(participant.shareAmount || participant.amount || 0),
      shareAmount: Number(participant.shareAmount || participant.amount || 0),
      paidAmount: Number(participant.paidAmount || 0),
      balance: Number(participant.balance || 0)
    }));
  }

  // Normalize payer amounts
  if (normalized.payers) {
    normalized.payers = normalized.payers.map(payer => ({
      ...payer,
      amount: Number(payer.amount || 0)
    }));
  }

  return normalized;
};

export const getSettlement=async(req,res)=>{
    const{groupId}=req.params;
    const balances=await CalculateBalance(groupId);
    const settlements=simplifyDebts(balances);

    res.json(settlements);
};

export const recordSettlement = async (req, res) => {
  try {
    const { expenseId, to, amount, description } = req.body;
    const from = req.user?.id || req.body.userId;

    if (!expenseId || !to || !amount) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const settlement = await Settlement.create({
      expenseId,
      from,
      to,
      amount,
      description,
    });

    await settlement.populate('from', 'name email');
    await settlement.populate('to', 'name email');

    // Send settlement alert email to the receiver asynchronously
    setImmediate(async () => {
      try {
        await emailService.sendSettlementAlertEmail(settlement._id);
      } catch (error) {
        console.error('Failed to send settlement alert email:', error);
      }
    });

    res.status(201).json(settlement);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

export const createPayment = async (req, res) => {
  try {
    console.log('createPayment called with:', {
      body: req.body,
      user: req.user
    });

    const { description, amount, groupId, toEmail, fromEmail } = req.body;
    let from = req.user?.id || req.user?._id;

    console.log('Parsed values:', { description, amount, groupId, toEmail, from });

    if (!description || !amount || !from) {
      console.log('Missing required fields');
      return res.status(400).json({
        message: 'Missing required fields',
        details: { description: !!description, amount: !!amount, from: !!from }
      });
    }

    if (fromEmail) {
      const fromUser = await User.findOne({ email: String(fromEmail).toLowerCase() });
      if (!fromUser) {
        return res.status(404).json({ message: 'Payer not found with that email' });
      }
      from = fromUser._id;
    }

    if (!groupId && !toEmail) {
      console.log('Missing recipient');
      return res.status(400).json({
        message: 'Either groupId or toEmail is required',
        details: { groupId: !!groupId, toEmail: !!toEmail }
      });
    }

    let toUser;

    // Find the recipient
    if (toEmail) {
      console.log('Looking up user by email:', toEmail);
      // Payment to a specific friend
      toUser = await User.findOne({ email: toEmail.toLowerCase() });
      if (!toUser) {
        console.log('User not found with email:', toEmail);
        return res.status(404).json({ message: 'Recipient not found with that email' });
      }
      console.log('Found user:', toUser._id);
    } else if (groupId) {
      console.log('Processing group payment for group:', groupId);
      // Payment within a group - find who owes the most
      try {
        const groupExpenses = await Expense.find({ group: groupId })
          .populate('participants.userId', 'name email')
          .populate('paidBy', 'name email');

        console.log('Found group expenses:', groupExpenses.length);

        if (groupExpenses.length === 0) {
          console.log('No expenses found in this group');
          return res.status(400).json({
            message: 'No expenses found in this group. Cannot process payment.',
            suggestion: 'Add some expenses to the group first, or use the "Friend" option to pay someone directly.'
          });
        }

        // Calculate balances to find who owes the most to the payer
        const balances = new Map();

        for (const expense of groupExpenses) {
          const payerId = String(expense.paidBy?._id || expense.paidBy);
          const totalAmount = Number(expense.amount) || 0;
          const participantCount = expense.participants?.length || 0;
          const sharePerPerson = participantCount > 0 ? totalAmount / participantCount : 0;

          // Initialize payer balance
          if (!balances.has(payerId)) {
            balances.set(payerId, 0);
          }

          // Payer paid the full amount
          balances.set(payerId, balances.get(payerId) + totalAmount);

          // Each participant owes their share
          for (const participant of expense.participants || []) {
            const participantId = String(participant.userId?._id || participant.userId);
            if (!balances.has(participantId)) {
              balances.set(participantId, 0);
            }
            balances.set(participantId, balances.get(participantId) - sharePerPerson);
          }
        }

        console.log('Calculated balances:', Object.fromEntries(balances));

        // Find someone who owes money (negative balance) to the payer
        const payerBalance = balances.get(String(from)) || 0;
        let maxDebtor = null;
        let maxDebt = 0;

        for (const [userId, balance] of balances.entries()) {
          if (String(userId) !== String(from) && balance < 0) {
            const debt = Math.abs(balance);
            if (debt > maxDebt) {
              maxDebt = debt;
              maxDebtor = userId;
            }
          }
        }

        if (!maxDebtor) {
          console.log('No debtors found');
          return res.status(400).json({
            message: 'No outstanding debts found in this group',
            details: {
              payerBalance,
              suggestion: 'Everyone is settled up! Use the "Friend" option to pay someone directly.'
            }
          });
        }

        console.log('Found debtor:', maxDebtor, 'with debt:', maxDebt);
        toUser = await User.findById(maxDebtor);
        if (!toUser) {
          console.log('Debtor user not found');
          return res.status(404).json({ message: 'Debtor not found' });
        }
      } catch (error) {
        console.error('Error processing group payment:', error);
        return res.status(500).json({ message: 'Error processing group payment: ' + error.message });
      }
    }

    // Create the settlement record
    console.log('Creating settlement:', { from, to: toUser._id, amount, description });
    const settlement = await Settlement.create({
      from,
      to: toUser._id,
      amount: Number(amount),
      description: description || `Payment of ₹${amount}`,
      settledAt: new Date(),
    });

    console.log('Settlement created:', settlement._id);

    // Also create an expense record so the payment shows up in expenses list
    try {
      const paymentExpense = await Expense.create({
        group: groupId || null,
        amount: Number(amount),
        description: description || `Payment to ${toUser.name || toUser.email}`,
        paidBy: from,
        createdBy: from,
        participants: [
          {
            userId: from,
            amount: 0,
            shareAmount: 0,
            paidAmount: Number(amount),
            balance: Number(amount),
            status: 'settled'
          },
          {
            userId: toUser._id,
            amount: Number(amount),
            shareAmount: Number(amount),
            paidAmount: 0,
            balance: -Number(amount),
            status: 'pending'
          }
        ],
        currency: 'INR',
        splitType: 'payment',
        splitDetails: {},
        payers: [{
          userId: from,
          amount: Number(amount),
          paidAt: new Date(),
          paymentMethod: 'cash'
        }],
        auditLog: [{
          action: 'created',
          changedBy: from,
          changedAt: new Date(),
          changes: { amount, description, splitType: 'payment' },
          previousValues: {},
          reason: 'Payment recorded via settlement'
        }]
      });

      console.log('Payment expense created:', paymentExpense._id);

      // Link the settlement to the expense
      settlement.expenseId = paymentExpense._id;
      await settlement.save();

      // Populate the expense for the response
      await paymentExpense.populate('group', 'name');
      await paymentExpense.populate('paidBy', 'name email');
      await paymentExpense.populate('createdBy', 'name email');
      await paymentExpense.populate('payers.userId', 'name email avatar');
      await paymentExpense.populate('participants.userId', 'name email');

      // Return both settlement and expense
      const response = settlement.toObject();
      response.expense = normalizeExpense(paymentExpense);

      await settlement.populate('from', 'name email');
      await settlement.populate('to', 'name email');

      console.log('Settlement populated with expense:', response);

      // Send settlement alert email to the receiver asynchronously
      setImmediate(async () => {
        try {
          await emailService.sendSettlementAlertEmail(settlement._id);
        } catch (error) {
          console.error('Failed to send settlement alert email:', error);
        }
      });

      res.status(201).json(response);
    } catch (expenseError) {
      console.error('Error creating payment expense:', expenseError);
      // Keep settlement/expense data consistent: rollback settlement if expense entry fails.
      await Settlement.findByIdAndDelete(settlement._id);
      return res.status(500).json({
        message: 'Failed to create payment expense entry',
      });
    }
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(error.statusCode || 500).json({
      message: error.message || 'Failed to create payment',
      error: error.toString()
    });
  }
};

export const getSettlementHistory = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;

    const settlements = await Settlement.find({
      $or: [{ from: userId }, { to: userId }],
    })
      .sort({ settledAt: -1 })
      .populate('from', 'name email')
      .populate('to', 'name email')
      .populate('expenseId', 'description amount date');

    res.status(200).json(settlements);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};