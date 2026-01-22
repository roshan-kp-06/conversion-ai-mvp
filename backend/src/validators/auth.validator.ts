/**
 * Auth Validators
 *
 * Input validation for authentication endpoints.
 * Uses simple validation without external libraries for MVP.
 */

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// Email regex (RFC 5322 simplified)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Password requirements
const MIN_PASSWORD_LENGTH = 8;

/**
 * Validate registration input
 */
export function validateRegisterInput(data: {
  email?: string;
  password?: string;
  name?: string;
}): ValidationResult {
  const errors: ValidationError[] = [];

  // Email validation
  if (!data.email) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (!EMAIL_REGEX.test(data.email)) {
    errors.push({ field: 'email', message: 'Invalid email format' });
  }

  // Password validation
  if (!data.password) {
    errors.push({ field: 'password', message: 'Password is required' });
  } else if (data.password.length < MIN_PASSWORD_LENGTH) {
    errors.push({
      field: 'password',
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    });
  }

  // Name validation (optional but if provided must be non-empty)
  if (data.name !== undefined && data.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Name cannot be empty if provided' });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate login input
 */
export function validateLoginInput(data: {
  email?: string;
  password?: string;
}): ValidationResult {
  const errors: ValidationError[] = [];

  // Email validation
  if (!data.email) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (!EMAIL_REGEX.test(data.email)) {
    errors.push({ field: 'email', message: 'Invalid email format' });
  }

  // Password validation
  if (!data.password) {
    errors.push({ field: 'password', message: 'Password is required' });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format validation errors for API response
 */
export function formatValidationErrors(errors: ValidationError[]): {
  message: string;
  code: string;
  details: ValidationError[];
} {
  return {
    message: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details: errors,
  };
}
