import * as emailService from '../services/email.service.js';
import { getUserNetBalance } from '../services/debt.service.js';
import logger from '../utils/logger.js';

/**
 * Send nudge email to remind someone about a debt
 * @route POST /api/email/nudge
 */
export const sendNudgeEmail = async (req, res) => {
  try {
    const { toUserId, groupId, amount, message } = req.body;
    const fromUserId = req.user?.id || req.user?._id;

    // Validate required fields
    if (!toUserId || !groupId || !amount) {
      return res.status(400).json({
        message: 'Missing required fields',
        details: { toUserId: !!toUserId, groupId: !!groupId, amount: !!amount }
      });
    }

    if (!fromUserId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Validate amount
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    // Verify that the sender has a legitimate debt relationship with the recipient
    // This prevents spamming random users
    try {
      const senderBalance = await getUserNetBalance(fromUserId);

      // Check if sender is owed money in this group
      const groupOwedBy = senderBalance.owedBy?.find(
        g => String(g.groupId) === String(groupId)
      );

      if (!groupOwedBy) {
        return res.status(403).json({
          message: 'You can only send nudges for debts you are owed',
          suggestion: 'Check your balance to see who owes you money'
        });
      }

      // Verify the recipient is someone who owes the sender money
      // This is a basic check - in production you might want more sophisticated validation
      const recipientOwesAmount = groupOwedBy.amount;
      if (numericAmount > recipientOwesAmount + 0.01) { // Allow small rounding differences
        return res.status(400).json({
          message: 'Amount exceeds what the recipient owes you',
          details: {
            requested: numericAmount,
            maximumOwed: recipientOwesAmount
          }
        });
      }

    } catch (balanceError) {
      logger.error('Error verifying debt relationship:', balanceError);
      // Continue anyway - let the email service handle validation
    }

    // Send the nudge email
    const result = await emailService.sendDebtNudgeEmail(
      fromUserId,
      toUserId,
      groupId,
      numericAmount,
      message || ''
    );

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Nudge email sent successfully',
        details: {
          toUserId,
          groupId,
          amount: numericAmount,
          messageId: result.messageId
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send nudge email',
        error: result.error
      });
    }

  } catch (error) {
    logger.error('Error sending nudge email:', error);
    res.status(error.statusCode || 500).json({
      message: error.message || 'Failed to send nudge email',
      error: error.toString()
    });
  }
};

/**
 * Test email configuration
 * @route GET /api/email/test
 */
export const testEmailConfiguration = async (req, res) => {
  try {
    const result = await emailService.testEmailConfiguration();

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Email configuration is valid',
        config: result.config
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
        configured: result.configured
      });
    }

  } catch (error) {
    logger.error('Error testing email configuration:', error);
    res.status(500).json({
      message: 'Failed to test email configuration',
      error: error.toString()
    });
  }
};

/**
 * Get email configuration status
 * @route GET /api/email/status
 */
export const getEmailStatus = async (req, res) => {
  try {
    const { getEmailConfigStatus } = await import('../utils/mailer.js');
    const status = getEmailConfigStatus();

    res.status(200).json({
      success: true,
      status
    });

  } catch (error) {
    logger.error('Error getting email status:', error);
    res.status(500).json({
      message: 'Failed to get email status',
      error: error.toString()
    });
  }
};

/**
 * Send test email (for development/testing)
 * @route POST /api/email/test-send
 */
export const sendTestEmail = async (req, res) => {
  try {
    const { to } = req.body;
    const fromUserId = req.user?.id || req.user?._id;

    if (!to) {
      return res.status(400).json({ message: 'Recipient email is required' });
    }

    const { sendEmail } = await import('../utils/mailer.js');

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Test Email</title>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
              .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
              .content { padding: 30px; }
              .success-box { background-color: #d4edda; color: #155724; padding: 15px; border-radius: 4px; margin: 20px 0; text-align: center; border: 1px solid #c3e6cb; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>✅ Test Email Successful</h1>
              </div>
              <div class="content">
                  <p>Hello!</p>
                  <div class="success-box">
                      <strong>Email configuration is working correctly!</strong>
                  </div>
                  <p>This is a test email from your Splitwise application. If you received this email, your email notification system is properly configured and ready to send notifications for:</p>
                  <ul>
                      <li>🎉 Group invitations</li>
                      <li>💰 New expense alerts</li>
                      <li>✅ Payment confirmations</li>
                      <li>💳 Payment reminders</li>
                  </ul>
                  <p style="color: #666; font-size: 14px; margin-top: 30px;">
                      Sent at: ${new Date().toLocaleString()}
                  </p>
              </div>
          </div>
      </body>
      </html>
    `;

    const result = await sendEmail({
      to: to,
      subject: 'Splitwise Test Email',
      html: html
    });

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Test email sent successfully',
        details: {
          to,
          messageId: result.messageId
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send test email',
        error: result.error
      });
    }

  } catch (error) {
    logger.error('Error sending test email:', error);
    res.status(500).json({
      message: 'Failed to send test email',
      error: error.toString()
    });
  }
};

export default {
  sendNudgeEmail,
  testEmailConfiguration,
  getEmailStatus,
  sendTestEmail
};