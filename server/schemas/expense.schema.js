import joi from 'joi';
import { currencies, splitTypes, categories } from './common.schema.js';

const objectIdOrEmail = joi.alternatives().try(
  joi.string().trim().regex(/^[0-9a-fA-F]{24}$/),
  joi.string().trim().email()
);

const participantSchema = joi.alternatives().try(
  objectIdOrEmail,
  joi.object({
    userId: objectIdOrEmail.required(),
    amount: joi.number().positive().optional(),
    percentage: joi.number().min(0).max(100).optional(),
    shares: joi.number().positive().optional(),
  })
);

export const addExpenseSchema = joi.object({
  amount: joi.number().required().positive().max(999999.99),
  description: joi.string().required().min(1).max(200).trim(),
  currency: joi.string().valid(...currencies).default('INR'),
  splitType: joi.string().valid(...splitTypes).required(),
  group: joi.string().regex(/^[0-9a-fA-F]{24}$/).optional().allow(null),
  groupId: joi.string().regex(/^[0-9a-fA-F]{24}$/).optional().allow(null),
  category: joi.string().valid(...categories).optional(),
  date: joi.date().max('now').optional(),
  participants: joi.array().items(participantSchema).max(50),
  paidBy: objectIdOrEmail.optional(),
  notes: joi.string().max(500).trim().optional(),
  location: joi.string().max(100).optional(),
  splitDetails: joi.object().optional(),
});

export const updateExpenseSchema = joi.object({
  amount: joi.number().optional().positive().max(999999.99),
  description: joi.string().optional().min(1).max(200).trim(),
  currency: joi.string().valid(...currencies).optional(),
  group: joi.string().regex(/^[0-9a-fA-F]{24}$/).optional().allow(null),
  groupId: joi.string().regex(/^[0-9a-fA-F]{24}$/).optional().allow(null),
  category: joi.string().valid(...categories).optional(),
  date: joi.date().max('now').optional(),
  participants: joi.array().items(participantSchema).max(50).optional(),
  paidBy: objectIdOrEmail.optional(),
  notes: joi.string().max(500).trim().optional(),
  location: joi.string().max(100).optional(),
});

export default {
  addExpenseSchema,
  updateExpenseSchema,
};
