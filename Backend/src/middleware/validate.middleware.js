const { validationResult } = require('express-validator');

/**
 * Validates request using express-validator results.
 * If errors exist, returns 400 Bad Request with formatted error details.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: formattedErrors,
    });
  }
  next();
};

module.exports = validate;
