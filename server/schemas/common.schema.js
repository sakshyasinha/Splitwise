import joi from 'joi';

const objectId = joi.string().regex(/^[0-9a-fA-F]{24}$/).message('Invalid ID format');

export const commonSchemas = {
  email: joi.string().email().lowercase().trim().required(),
  password: joi.string().min(8).max(128).required(),
  name: joi.string().min(2).max(100).trim().required(),
  amount: joi.number().positive().max(999999.99).required(),
  description: joi.string().max(500).trim(),
  objectId,
  mongoId: objectId,
};

export const currencies = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'SGD', 'AED', 'CNY'];
export const splitTypes = ['equal', 'exact', 'percentage', 'shares', 'itemized', 'adjustment', 'payment'];
export const categories = [
  'Food',
  'Travel',
  'Events',
  'Utilities',
  'Shopping',
  'General',
  'Rent',
  'Transport',
  'Entertainment',
  'Healthcare',
  'Education',
  'Other',
];
export const groupTypes = ['Trip', 'Roommates', 'Friends', 'Family', 'Project', 'Other'];

export default commonSchemas;
