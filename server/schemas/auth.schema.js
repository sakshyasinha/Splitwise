import joi from 'joi';
import { commonSchemas } from './common.schema.js';

export const registerSchema = joi.object({
  name: joi.string().required().min(2).max(100).trim(),
  email: joi.string().required().email().lowercase().trim(),
  password: joi.string().required().min(8).max(128),
});

export const loginSchema = joi.object({
  email: joi.string().required().email().lowercase().trim(),
  password: joi.string().required().max(128),
});

export const refreshTokenSchema = joi.object({
  refreshToken: joi.string().required(),
});

export default {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
};
