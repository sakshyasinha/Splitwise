import joi from 'joi';
import { currencies, groupTypes } from './common.schema.js';

export const createGroupSchema = joi.object({
  name: joi.string().required().min(2).max(100).trim(),
  type: joi.string().valid(...groupTypes).required(),
  description: joi.string().max(500).trim().optional(),
  currency: joi.string().valid(...currencies).default('INR'),
});

export const updateGroupSchema = joi.object({
  name: joi.string().optional().min(2).max(100).trim(),
  type: joi.string().valid(...groupTypes).optional(),
  description: joi.string().max(500).trim().optional(),
  currency: joi.string().valid(...currencies).optional(),
});

export const addGroupMemberSchema = joi.object({
  userId: joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
});

export const removeGroupMemberSchema = joi.object({
  userId: joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
});

export default {
  createGroupSchema,
  updateGroupSchema,
  addGroupMemberSchema,
  removeGroupMemberSchema,
};
