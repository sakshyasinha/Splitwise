import joi from 'joi';

export const createSettlementSchema = joi.object({
  expenseId: joi.string().regex(/^[0-9a-fA-F]{24}$/).optional().allow(null),
  to: joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
  amount: joi.number().required().positive().max(999999.99),
  description: joi.string().max(200).trim().optional(),
  settlementProof: joi.string().optional(),
});

export const createPaymentSchema = joi.object({
  description: joi.string().required().min(1).max(200).trim(),
  amount: joi.number().required().positive().max(999999.99),
  groupId: joi.string().regex(/^[0-9a-fA-F]{24}$/).optional().allow(null),
  toEmail: joi.string().email().lowercase().trim().optional(),
  fromEmail: joi.string().email().lowercase().trim().optional(),
}).xor('groupId', 'toEmail').messages({
  'object.xor': 'Either groupId or toEmail is required, not both',
});

export const sendPaymentReminderSchema = joi.object({
  toUserId: joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
  amount: joi.number().required().positive().max(999999.99),
  groupId: joi.string().regex(/^[0-9a-fA-F]{24}$/).optional().allow(null),
  message: joi.string().max(500).trim().optional(),
});

export default {
  createSettlementSchema,
  createPaymentSchema,
  sendPaymentReminderSchema,
};
