import { sendEmail, sendBulkEmails } from '../utils/mailer.js';
import Group from '../models/group.model.js';
import User from '../models/user.model.js';
import Expense from '../models/expense.model.js';
import Settlement from '../models/settlement.model.js';
import logger from '../utils/logger.js';

/**
 * Email Service
 * Handles all email notifications for the Splitwise application
 */

// Utility functions for formatting
const formatCurrency = (amount, currency = 'INR') => {
  const numAmount = Number(amount) || 0;
  const symbols = {
    'INR': '₹',
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'CAD': 'C$',
    'AUD': 'A$',
    'SGD': 'S$',
    'AED': 'د.إ',
    'CNY': '¥'
  };
  const symbol = symbols[currency] || currency;
  return `${symbol}${numAmount.toFixed(2)}`;
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const formatDateTime = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Template generation functions
const generateGroupInviteTemplate = (data) => {
  const {
    userName,
    inviterName,
    groupName,
    groupType,
    groupDescription,
    memberCount,
    appUrl
  } = data;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>You're Invited to Join a Group</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
            .content { padding: 30px; }
            .invite-box { background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px; }
            .invite-box h2 { margin-top: 0; color: #667eea; font-size: 22px; }
            .detail-row { display: flex; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
            .detail-label { font-weight: 600; color: #555; width: 120px; flex-shrink: 0; }
            .detail-value { color: #333; flex-grow: 1; }
            .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: 600; margin: 20px 0; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #eee; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎉 You're Invited!</h1>
            </div>
            <div class="content">
                <p>Hello ${userName},</p>
                <p><strong>${inviterName}</strong> has invited you to join their group on Splitwise!</p>
                <div class="invite-box">
                    <h2>${groupName}</h2>
                    <div class="detail-row">
                        <div class="detail-label">Group Type:</div>
                        <div class="detail-value">${groupType}</div>
                    </div>
                    ${groupDescription ? `
                    <div class="detail-row">
                        <div class="detail-label">Description:</div>
                        <div class="detail-value">${groupDescription}</div>
                    </div>` : ''}
                    <div class="detail-row">
                        <div class="detail-label">Members:</div>
                        <div class="detail-value">${memberCount} members</div>
                    </div>
                </div>
                <div style="text-align: center;">
                    <a href="${appUrl}" class="button">Accept Invitation</a>
                </div>
            </div>
            <div class="footer">
                <p>This invitation was sent by <strong>${inviterName}</strong> via Splitwise.</p>
            </div>
        </div>
    </body>
    </html>
  `;
};

const generateExpenseAlertTemplate = (data) => {
  const {
    userName,
    payerName,
    groupName,
    expenseDescription,
    amount,
    currency,
    expenseDate,
    category,
    notes,
    yourShare,
    splitType,
    participants,
    expenseUrl
  } = data;

  const participantsList = participants.map(p =>
    `<li><strong>${p.name}</strong>: ${formatCurrency(p.share, currency)}</li>`
  ).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Expense Added</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
            .content { padding: 30px; }
            .expense-box { background-color: #fff5f5; border-left: 4px solid #f5576c; padding: 20px; margin: 20px 0; border-radius: 4px; }
            .expense-box h2 { margin-top: 0; color: #f5576c; font-size: 22px; }
            .amount-display { font-size: 32px; font-weight: bold; color: #f5576c; text-align: center; margin: 20px 0; }
            .detail-row { display: flex; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
            .detail-label { font-weight: 600; color: #555; width: 140px; flex-shrink: 0; }
            .detail-value { color: #333; flex-grow: 1; }
            .your-share { background-color: #e8f5e9; padding: 15px; border-radius: 4px; margin: 20px 0; text-align: center; }
            .your-share-amount { font-size: 28px; font-weight: bold; color: #2e7d32; }
            .split-info { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0; }
            .participant-list { list-style: none; padding: 0; margin: 0; }
            .participant-item { padding: 8px 0; border-bottom: 1px solid #eee; }
            .button { display: inline-block; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: 600; margin: 20px 0; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #eee; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>💰 New Expense Added</h1>
            </div>
            <div class="content">
                <p>Hello ${userName},</p>
                <p><strong>${payerName}</strong> just added a new expense to <strong>${groupName}</strong>:</p>
                <div class="expense-box">
                    <h2>${expenseDescription}</h2>
                    <div class="amount-display">${formatCurrency(amount, currency)}</div>
                    <div class="detail-row">
                        <div class="detail-label">Paid by:</div>
                        <div class="detail-value">${payerName}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Date:</div>
                        <div class="detail-value">${expenseDate}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Category:</div>
                        <div class="detail-value">${category}</div>
                    </div>
                    ${notes ? `
                    <div class="detail-row">
                        <div class="detail-label">Notes:</div>
                        <div class="detail-value">${notes}</div>
                    </div>` : ''}
                </div>
                <div class="your-share">
                    <h3>Your Share</h3>
                    <div class="your-share-amount">${formatCurrency(yourShare, currency)}</div>
                </div>
                <div class="split-info">
                    <h4>Split Details (${splitType})</h4>
                    <ul class="participant-list">${participantsList}</ul>
                </div>
                <div style="text-align: center;">
                    <a href="${expenseUrl}" class="button">View Expense Details</a>
                </div>
            </div>
            <div class="footer">
                <p>This expense was added by <strong>${payerName}</strong> in <strong>${groupName}</strong>.</p>
            </div>
        </div>
    </body>
    </html>
  `;
};

const generateSettlementAlertTemplate = (data) => {
  const {
    receiverName,
    payerName,
    description,
    amount,
    currency,
    settlementDate,
    groupName,
    transactionId,
    notes,
    settlementUrl
  } = data;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Received</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
            .content { padding: 30px; }
            .payment-box { background-color: #e8f5e9; border-left: 4px solid #38ef7d; padding: 20px; margin: 20px 0; border-radius: 4px; }
            .payment-box h2 { margin-top: 0; color: #2e7d32; font-size: 22px; }
            .amount-display { font-size: 36px; font-weight: bold; color: #2e7d32; text-align: center; margin: 20px 0; }
            .detail-row { display: flex; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
            .detail-label { font-weight: 600; color: #555; width: 140px; flex-shrink: 0; }
            .detail-value { color: #333; flex-grow: 1; }
            .success-message { background-color: #d4edda; color: #155724; padding: 15px; border-radius: 4px; margin: 20px 0; text-align: center; border: 1px solid #c3e6cb; }
            .transaction-info { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0; }
            .button { display: inline-block; background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: 600; margin: 20px 0; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #eee; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>✅ Payment Received!</h1>
            </div>
            <div class="content">
                <p>Hello ${receiverName},</p>
                <p>Great news! <strong>${payerName}</strong> has sent you a payment.</p>
                <div class="success-message">
                    <strong>🎉 Payment Successfully Received</strong>
                </div>
                <div class="payment-box">
                    <h2>${description}</h2>
                    <div class="amount-display">${formatCurrency(amount, currency)}</div>
                    <div class="detail-row">
                        <div class="detail-label">From:</div>
                        <div class="detail-value">${payerName}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">To:</div>
                        <div class="detail-value">${receiverName}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Date:</div>
                        <div class="detail-value">${settlementDate}</div>
                    </div>
                    ${groupName ? `
                    <div class="detail-row">
                        <div class="detail-label">Group:</div>
                        <div class="detail-value">${groupName}</div>
                    </div>` : ''}
                </div>
                <div class="transaction-info">
                    <h4>Transaction Details</h4>
                    <p><strong>Transaction ID:</strong> ${transactionId}</p>
                    <p><strong>Status:</strong> Completed</p>
                    ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
                </div>
                <div style="text-align: center;">
                    <a href="${settlementUrl}" class="button">View Settlement Details</a>
                </div>
            </div>
            <div class="footer">
                <p>Payment received from <strong>${payerName}</strong>.</p>
            </div>
        </div>
    </body>
    </html>
  `;
};

const generateDebtNudgeTemplate = (data) => {
  const {
    receiverName,
    senderName,
    amount,
    currency,
    groupName,
    dueDate,
    customMessage,
    paymentUrl,
    groupUrl
  } = data;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Reminder</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
            .content { padding: 30px; }
            .reminder-box { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 4px; }
            .reminder-box h2 { margin-top: 0; color: #856404; font-size: 22px; }
            .amount-display { font-size: 36px; font-weight: bold; color: #dc3545; text-align: center; margin: 20px 0; }
            .detail-row { display: flex; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
            .detail-label { font-weight: 600; color: #555; width: 140px; flex-shrink: 0; }
            .detail-value { color: #333; flex-grow: 1; }
            .message-box { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0; border-left: 3px solid #6c757d; }
            .action-buttons { display: flex; gap: 10px; justify-content: center; margin: 20px 0; flex-wrap: wrap; }
            .button { display: inline-block; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: 600; }
            .button-primary { background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%); color: white; }
            .button-secondary { background-color: #6c757d; color: white; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #eee; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>💳 Payment Reminder</h1>
            </div>
            <div class="content">
                <p>Hello ${receiverName},</p>
                <p>This is a friendly reminder that you have an outstanding payment to <strong>${senderName}</strong>.</p>
                <div class="reminder-box">
                    <h2>Outstanding Balance</h2>
                    <div class="amount-display">${formatCurrency(amount, currency)}</div>
                    <div class="detail-row">
                        <div class="detail-label">You owe:</div>
                        <div class="detail-value">${senderName}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Group:</div>
                        <div class="detail-value">${groupName}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Due Date:</div>
                        <div class="detail-value">${dueDate}</div>
                    </div>
                </div>
                ${customMessage ? `
                <div class="message-box">
                    <h4>Message from ${senderName}:</h4>
                    <p style="font-style: italic;">"${customMessage}"</p>
                </div>` : ''}
                <div class="action-buttons">
                    <a href="${paymentUrl}" class="button button-primary">Pay Now</a>
                    <a href="${groupUrl}" class="button button-secondary">View Group Details</a>
                </div>
            </div>
            <div class="footer">
                <p>This reminder was sent by <strong>${senderName}</strong> regarding <strong>${groupName}</strong>.</p>
            </div>
        </div>
    </body>
    </html>
  `;
};

/**
 * Send group invite email
 */
export const sendGroupInviteEmail = async (groupId, newMemberId, inviterId) => {
  try {
    // Fetch group details
    const group = await Group.findById(groupId).populate('members', 'name email');
    if (!group) {
      throw new Error('Group not found');
    }

    // Fetch inviter details
    const inviter = await User.findById(inviterId);
    if (!inviter) {
      throw new Error('Inviter not found');
    }

    // Fetch new member details
    const newMember = await User.findById(newMemberId);
    if (!newMember) {
      throw new Error('New member not found');
    }

    // Generate email content
    const appUrl = `${process.env.CORS_ORIGIN || 'http://localhost:5173'}/groups/${groupId}`;
    const html = generateGroupInviteTemplate({
      userName: newMember.name,
      inviterName: inviter.name,
      groupName: group.name,
      groupType: group.type,
      groupDescription: group.description,
      memberCount: group.members.length,
      appUrl
    });

    // Send email
    const result = await sendEmail({
      to: newMember.email,
      subject: `You're invited to join "${group.name}"`,
      html: html
    });

    logger.info(`Group invite email sent to ${newMember.email} for group ${group.name}`);
    return result;

  } catch (error) {
    logger.error('Failed to send group invite email:', error);
    throw error;
  }
};

/**
 * Send expense alert email to all participants
 */
export const sendExpenseAlertEmail = async (expenseId) => {
  try {
    // Fetch expense details with populated data
    const expense = await Expense.findById(expenseId)
      .populate('participants.userId', 'name email')
      .populate('createdBy', 'name email')
      .populate('group', 'name');

    if (!expense) {
      throw new Error('Expense not found');
    }

    // Get recipients (all participants except creator)
    const recipients = expense.participants
      .filter(p => String(p.userId._id) !== String(expense.createdBy._id))
      .map(p => ({
        userId: p.userId._id,
        name: p.userId.name,
        email: p.userId.email,
        share: Number(p.shareAmount) || 0
      }));

    if (recipients.length === 0) {
      logger.info('No recipients for expense alert email');
      return { success: true, recipientsCount: 0, message: 'No recipients to notify' };
    }

    // Prepare participant list for template
    const participantsList = expense.participants.map(p => ({
      name: p.userId.name,
      share: Number(p.shareAmount) || 0
    }));

    // Generate emails for each recipient
    const emails = recipients.map(recipient => {
      const expenseUrl = `${process.env.CORS_ORIGIN || 'http://localhost:5173'}/expenses/${expenseId}`;
      const html = generateExpenseAlertTemplate({
        userName: recipient.name,
        payerName: expense.createdBy.name,
        groupName: expense.group?.name || 'Personal',
        expenseDescription: expense.description,
        amount: Number(expense.amount),
        currency: expense.currency,
        expenseDate: formatDate(expense.date),
        category: expense.category,
        notes: expense.notes,
        yourShare: recipient.share,
        splitType: expense.splitType,
        participants: participantsList,
        expenseUrl
      });

      return {
        to: recipient.email,
        subject: `New Expense: ${expense.description}`,
        html: html
      };
    });

    // Send all emails
    const result = await sendBulkEmails(emails);
    logger.info(`Expense alert emails sent to ${recipients.length} recipients`);
    return result;

  } catch (error) {
    logger.error('Failed to send expense alert email:', error);
    throw error;
  }
};

/**
 * Send settlement alert email
 */
export const sendSettlementAlertEmail = async (settlementId) => {
  try {
    // Fetch settlement details
    const settlement = await Settlement.findById(settlementId)
      .populate('from', 'name email')
      .populate('to', 'name email')
      .populate('expenseId', 'description amount currency group');

    if (!settlement) {
      throw new Error('Settlement not found');
    }

    // Fetch group details if available
    let groupName = 'Personal';
    if (settlement.expenseId?.group) {
      const group = await Group.findById(settlement.expenseId.group);
      groupName = group?.name || 'Personal';
    }

    // Generate email content
    const settlementUrl = `${process.env.CORS_ORIGIN || 'http://localhost:5173'}/settlements/${settlementId}`;
    const html = generateSettlementAlertTemplate({
      receiverName: settlement.to.name,
      payerName: settlement.from.name,
      description: settlement.description || 'Payment',
      amount: Number(settlement.amount),
      currency: settlement.expenseId?.currency || 'INR',
      settlementDate: formatDateTime(settlement.settledAt),
      groupName: groupName,
      transactionId: settlement._id.toString(),
      notes: settlement.notes,
      settlementUrl
    });

    // Send email to receiver
    const result = await sendEmail({
      to: settlement.to.email,
      subject: `Payment Received: ${settlement.description || 'Payment'}`,
      html: html
    });

    logger.info(`Settlement alert email sent to ${settlement.to.email}`);
    return result;

  } catch (error) {
    logger.error('Failed to send settlement alert email:', error);
    throw error;
  }
};

/**
 * Send debt nudge email
 */
export const sendDebtNudgeEmail = async (fromUserId, toUserId, groupId, amount, customMessage = '') => {
  try {
    // Fetch user details
    const fromUser = await User.findById(fromUserId);
    const toUser = await User.findById(toUserId);
    const group = await Group.findById(groupId);

    if (!fromUser || !toUser || !group) {
      throw new Error('User or group not found');
    }

    // Generate email content
    const paymentUrl = `${process.env.CORS_ORIGIN || 'http://localhost:5173'}/groups/${groupId}/pay`;
    const groupUrl = `${process.env.CORS_ORIGIN || 'http://localhost:5173'}/groups/${groupId}`;
    const dueDate = formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // 7 days from now

    const html = generateDebtNudgeTemplate({
      receiverName: toUser.name,
      senderName: fromUser.name,
      amount: Number(amount),
      currency: 'INR',
      groupName: group.name,
      dueDate: dueDate,
      customMessage: customMessage,
      paymentUrl: paymentUrl,
      groupUrl: groupUrl
    });

    // Send email
    const result = await sendEmail({
      to: toUser.email,
      subject: `Payment Reminder from ${fromUser.name}`,
      html: html
    });

    logger.info(`Debt nudge email sent from ${fromUser.email} to ${toUser.email}`);
    return result;

  } catch (error) {
    logger.error('Failed to send debt nudge email:', error);
    throw error;
  }
};

/**
 * Test email configuration
 */
export const testEmailConfiguration = async () => {
  try {
    const { testEmailConfig } = await import('../utils/mailer.js');
    return await testEmailConfig();
  } catch (error) {
    logger.error('Failed to test email configuration:', error);
    throw error;
  }
};

export default {
  sendGroupInviteEmail,
  sendExpenseAlertEmail,
  sendSettlementAlertEmail,
  sendDebtNudgeEmail,
  testEmailConfiguration
};