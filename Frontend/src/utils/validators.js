/**
 * Validate email address format
 * @param {string} email
 * @returns {{ isValid: boolean, message?: string }}
 */
export const validateEmail = (email) => {
  if (!email || !email.trim()) {
    return { isValid: false, message: 'Email is required' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { isValid: false, message: 'Please enter a valid email address' };
  }
  return { isValid: true };
};

/**
 * Validate password requirements:
 * At least 8 characters, with at least one uppercase, one lowercase, and one number.
 * @param {string} password
 * @returns {{ isValid: boolean, message?: string, score: number }}
 */
export const validatePassword = (password) => {
  if (!password) {
    return { isValid: false, message: 'Password is required', score: 0 };
  }

  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (password.length < 8) {
    return {
      isValid: false,
      message: 'Password must be at least 8 characters long',
      score,
    };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one uppercase letter',
      score,
    };
  }
  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one lowercase letter',
      score,
    };
  }
  if (!/[0-9]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one number',
      score,
    };
  }

  return { isValid: true, score };
};

/**
 * Validate username:
 * 3-30 characters, alphanumeric and underscore only.
 * @param {string} username
 * @returns {{ isValid: boolean, message?: string }}
 */
export const validateUsername = (username) => {
  if (!username || !username.trim()) {
    return { isValid: false, message: 'Username is required' };
  }
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 30) {
    return {
      isValid: false,
      message: 'Username must be between 3 and 30 characters',
    };
  }
  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  if (!usernameRegex.test(trimmed)) {
    return {
      isValid: false,
      message: 'Username can only contain letters, numbers, and underscores',
    };
  }
  return { isValid: true };
};
