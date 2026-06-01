import joi from 'joi';
import { commonSchemas, currencies, groupTypes } from './common.schema.js';

export const createGroupSchema = joi.object({
  name: joi.string().required().min(2).max(100).trim(),
  type: joi.string().valid(...groupTypes).required(),
  description: joi.string().max(500).trim().optional(),
  currency: joi.string().valid(...currencies).default('INR'),
  members: joi.array().items(
    joi.alternatives().try(
      commonSchemas.objectId,
      joi.string().email().lowercase().trim()
    )
  ).default([]),
});

export const updateGroupSchema = joi.object({
  name: joi.string().optional().min(2).max(100).trim(),
  type: joi.string().valid(...groupTypes).optional(),
  description: joi.string().max(500).trim().optional(),
  currency: joi.string().valid(...currencies).optional(),
});

export const addGroupMemberSchema = joi.object({
  memberId: joi.alternatives().try(
    commonSchemas.objectId,
    joi.string().email().lowercase().trim()
  ).required(),
});

export const removeGroupMemberSchema = joi.object({
  memberId: joi.alternatives().try(
    commonSchemas.objectId,
    joi.string().email().lowercase().trim()
  ).required(),
});

export default {
  createGroupSchema,
  updateGroupSchema,
  addGroupMemberSchema,
  removeGroupMemberSchema,
};
