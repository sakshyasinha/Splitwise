const FIELD_LABELS = {
  amount: 'Amount',
  category: 'Category',
  description: 'Description',
  email: 'Email',
  group: 'Group',
  groupId: 'Group',
  members: 'Members',
  name: 'Name',
  paidBy: 'Paid by',
  participants: 'Participants',
  password: 'Password',
  splitType: 'Split type',
  type: 'Type',
};

const friendlyValidationMessage = (detail) => {
  const field = detail.path.join('.') || detail.context?.key || 'field';
  const label = FIELD_LABELS[field] || FIELD_LABELS[detail.context?.key] || field;

  switch (detail.type) {
    case 'any.required':
      return `${label} is required.`;
    case 'any.only':
      return `Choose a valid ${label.toLowerCase()}.`;
    case 'string.empty':
      return `${label} cannot be empty.`;
    case 'string.email':
      return `Enter a valid email address.`;
    case 'string.min':
      return `${label} is too short.`;
    case 'string.max':
      return `${label} is too long.`;
    case 'number.base':
      return `${label} must be a number.`;
    case 'number.positive':
      return `${label} must be greater than zero.`;
    case 'number.max':
      return `${label} is too large.`;
    case 'date.max':
      return `${label} cannot be in the future.`;
    default:
      return detail.message.replace(/"/g, '');
  }
};

export const validate = (schema) => {
  return async (req, res, next) => {
    try {
      const value = await schema.validateAsync(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      req.body = value;
      next();
    } catch (err) {
      if (err?.isJoi) {
        const seen = new Set();
        const errors = err.details
          .map((detail) => ({
            field: detail.path.join('.'),
            message: friendlyValidationMessage(detail),
            value: detail.context.value,
          }))
          .filter((error) => {
            const key = `${error.field}:${error.message}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

        return res.status(400).json({
          statusCode: 400,
          message: errors[0]?.message || 'Please check the highlighted fields.',
          errors,
        });
      }

      return res.status(500).json({
        statusCode: 500,
        message: 'Validation error',
        error: err.message,
      });
    }
  };
};

export default validate;
