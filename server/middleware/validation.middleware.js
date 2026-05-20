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
        const errors = err.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context.value,
        }));

        return res.status(400).json({
          statusCode: 400,
          message: 'Validation failed',
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
