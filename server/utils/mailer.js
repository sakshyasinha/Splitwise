import nodemailer from 'nodemailer';
import logger from './logger.js';

/**
 * Get email configuration (lazy-loaded to ensure env vars are available)
 */
const getEmailConfig = () => {
  const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const configuredFrom = process.env.SMTP_FROM?.trim();
  const isDefaultPlaceholderFrom = !configuredFrom || configuredFrom.includes('noreply@splitwise.com');
  const from = isDefaultPlaceholderFrom && user && host.includes('gmail.com')
    ? `Splitwise <${user}>`
    : configuredFrom || 'Splitwise <noreply@splitwise.com>';

  return {
    host,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user,
      pass
    },
    from,
    enabled: String(process.env.EMAIL_ENABLED || 'true').trim() !== 'false'
  };
};

/**
 * Create nodemailer transporter
 */
let transporter = null;

const createTransporter = () => {
  try {
    // Emergency override: if this env var is set we refuse to create a transporter
    if (String(process.env.EMERGENCY_DISABLE_EMAILS || 'false').trim() === 'true') {
      logger.warn('EMERGENCY_DISABLE_EMAILS is set. Email transporter will NOT be created.');
      return null;
    }
    const emailConfig = getEmailConfig();

    // Debug: Log current environment variable values
    logger.info('Current environment variables:', {
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: process.env.SMTP_PORT,
      SMTP_SECURE: process.env.SMTP_SECURE,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS ? '***' : 'MISSING',
      SMTP_FROM: process.env.SMTP_FROM,
      EMAIL_ENABLED: process.env.EMAIL_ENABLED
    });

    if (!emailConfig.auth.user || !emailConfig.auth.pass) {
      logger.warn('SMTP credentials not configured. Email sending will be disabled.', {
        hasUser: !!emailConfig.auth.user,
        hasPass: !!emailConfig.auth.pass,
        userLength: emailConfig.auth.user?.length || 0,
        passLength: emailConfig.auth.pass?.length || 0
      });
      return null;
    }

    logger.info('Creating email transporter with credentials:', {
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      user: emailConfig.auth.user
    });

    transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: emailConfig.auth,
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates
      }
    });

    logger.info('Email transporter created successfully');
    return transporter;
  } catch (error) {
    logger.error('Failed to create email transporter:', error);
    return null;
  }
};

/**
 * Initialize email transporter
 */
const initializeTransporter = () => {
  if (!transporter) {
    const emailConfig = getEmailConfig();
    if (emailConfig.enabled) {
      transporter = createTransporter();
    }
  }
  return transporter;
};

/**
 * Validate email address
 */
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Send email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Plain text content (fallback)
 * @param {Object} options.attachments - Email attachments
 * @returns {Promise<Object>} Email info or error
 */
export const sendEmail = async (options) => {
  try {
    const emailConfig = getEmailConfig();

    // Emergency short-circuit: skip sending even if configured
    if (String(process.env.EMERGENCY_DISABLE_EMAILS || 'false').trim() === 'true') {
      logger.warn('EMERGENCY_DISABLE_EMAILS is set. Skipping sendEmail to:', { to: options.to, subject: options.subject });
      return { success: true, skipped: true, message: 'Email sending disabled by emergency flag' };
    }

    // Check if email is enabled
    if (!emailConfig.enabled) {
      logger.info('Email sending is disabled. Skipping email to:', options.to);
      return { success: true, skipped: true, message: 'Email sending is disabled' };
    }

    // Initialize transporter if needed
    const currentTransporter = initializeTransporter();
    if (!currentTransporter) {
      throw new Error('Email transporter not available');
    }

    // Validate recipient email
    if (!options.to || !validateEmail(options.to)) {
      throw new Error('Invalid recipient email address');
    }

    // Validate required fields
    if (!options.subject) {
      throw new Error('Email subject is required');
    }

    if (!options.html && !options.text) {
      throw new Error('Email content (html or text) is required');
    }

    // Prepare email options
    const mailOptions = {
      from: emailConfig.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || stripHtml(options.html),
      attachments: options.attachments || []
    };

    // Send email
    const info = await currentTransporter.sendMail(mailOptions);

    logger.info(`Email sent successfully to ${options.to}:`, {
      messageId: info.messageId,
      subject: options.subject
    });

    return {
      success: true,
      messageId: info.messageId,
      response: info.response
    };

  } catch (error) {
    logger.error(`Failed to send email to ${options.to}:`, error);

    // Return error information without throwing
    return {
      success: false,
      error: error.message,
      details: {
        to: options.to,
        subject: options.subject
      }
    };
  }
};

/**
 * Send multiple emails in parallel
 * @param {Array} emailOptions - Array of email options
 * @returns {Promise<Array>} Array of results
 */
export const sendBulkEmails = async (emailOptions) => {
  try {
    // Emergency short-circuit: skip all sends
    if (String(process.env.EMERGENCY_DISABLE_EMAILS || 'false').trim() === 'true') {
      logger.warn('EMERGENCY_DISABLE_EMAILS is set. Skipping sendBulkEmails for', { total: Array.isArray(emailOptions) ? emailOptions.length : 0 });
      return {
        total: Array.isArray(emailOptions) ? emailOptions.length : 0,
        successful: 0,
        failed: 0,
        skipped: true,
        message: 'Bulk email sending disabled by emergency flag',
        results: []
      };
    }

    if (!Array.isArray(emailOptions) || emailOptions.length === 0) {
      throw new Error('Email options array is required');
    }

    logger.info(`Sending ${emailOptions.length} emails in parallel`);

    const results = await Promise.all(
      emailOptions.map(options => sendEmail(options))
    );

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    logger.info(`Bulk email sending completed: ${successful} successful, ${failed} failed`);

    return {
      total: emailOptions.length,
      successful,
      failed,
      results
    };

  } catch (error) {
    logger.error('Failed to send bulk emails:', error);
    throw error;
  }
};

/**
 * Test email configuration
 * @returns {Promise<Object>} Test result
 */
export const testEmailConfig = async () => {
  try {
    const currentTransporter = initializeTransporter();
    const emailConfig = getEmailConfig();

    if (!currentTransporter) {
      return {
        success: false,
        message: 'Email transporter not available',
        configured: false
      };
    }

    // Verify connection configuration
    await currentTransporter.verify();

    return {
      success: true,
      message: 'Email configuration is valid',
      configured: true,
      config: {
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure,
        from: emailConfig.from,
        enabled: emailConfig.enabled
      }
    };

  } catch (error) {
    logger.error('Email configuration test failed:', error);
    return {
      success: false,
      message: error.message,
      configured: false,
      error: error.message
    };
  }
};

/**
 * Strip HTML tags (for plain text fallback)
 * @param {string} html - HTML content
 * @returns {string} Plain text content
 */
const stripHtml = (html) => {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/&/g, '&') // Replace HTML entities
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
};

/**
 * Get email configuration status
 * @returns {Object} Configuration status
 */
export const getEmailConfigStatus = () => {
  const emailConfig = getEmailConfig();
  return {
    enabled: emailConfig.enabled,
    configured: !!(emailConfig.auth.user && emailConfig.auth.pass),
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    from: emailConfig.from,
    hasCredentials: !!(emailConfig.auth.user && emailConfig.auth.pass)
  };
};

export default {
  sendEmail,
  sendBulkEmails,
  testEmailConfig,
  getEmailConfigStatus
};
