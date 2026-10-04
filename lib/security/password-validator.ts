/**
 * Password Strength & Vulnerability Validator
 * 
 * Enforces production-grade password policies:
 * - Minimum 12 characters
 * - Uppercase, lowercase, number, symbol
 * - Blocks common dictionary passwords (haveibeenpwned top lists, "password123", "12345678", etc.)
 * - Calculates password entropy and strength score (0 to 4)
 */

// Top common/breached passwords and predictable variants (HIBP top lists)
export const COMMON_PASSWORDS_BLACKLIST = new Set([
  'password',
  'password123',
  'password1234',
  'password12345',
  'password123456',
  '12345678',
  '123456789',
  '1234567890',
  '00000000',
  '11111111',
  'qwerty12345',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm123',
  'admin12345',
  'admin123456',
  'administrator',
  'welcometo',
  'welcome123',
  'welcome1234',
  'letmein123',
  'climbing123',
  'kclmc12345',
  'kclmc2026',
  'kingscollege',
  'kingslondon',
  'mountaineer',
  'bouldering',
  'iloveyou123',
  'sunshine123',
  'princess123',
  'football123',
  'dragon1234',
  'monkey1234',
  'master1234',
  'charlie123',
  'shadow1234',
  'superman123',
  'trustno1',
  'hunter2',
  'starwars123',
  'p@ssword123',
  'p@ssw0rd123',
  'passw0rd123',
  'pass123456',
  'changeme123',
  'default123',
  'secret1234',
]);

export interface PasswordValidationResult {
  isValid: boolean;
  score: number; // 0 (very weak) to 4 (strong)
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  color: string;
  errors: string[];
  suggestions: string[];
  hasMinLength: boolean;
  hasUpperCase: boolean;
  hasLowerCase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  isNotCommon: boolean;
  entropyBits: number;
}

/**
 * Calculate Shannon / charset entropy in bits
 */
export function calculateEntropy(pwd: string): number {
  if (!pwd) return 0;
  let poolSize = 0;
  if (/[a-z]/.test(pwd)) poolSize += 26;
  if (/[A-Z]/.test(pwd)) poolSize += 26;
  if (/[0-9]/.test(pwd)) poolSize += 10;
  if (/[^A-Za-z0-9]/.test(pwd)) poolSize += 33;

  if (poolSize === 0) return 0;
  return Math.round(pwd.length * (Math.log2(poolSize)));
}

export function validatePasswordStrength(password: string): PasswordValidationResult {
  const pwd = password || '';
  const errors: string[] = [];
  const suggestions: string[] = [];

  const hasMinLength = pwd.length >= 12;
  const hasUpperCase = /[A-Z]/.test(pwd);
  const hasLowerCase = /[a-z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSymbol = /[^A-Za-z0-9]/.test(pwd);
  const entropyBits = calculateEntropy(pwd);

  // Normalize by stripping common leetspeak substitutions
  const normalized = pwd
    .toLowerCase()
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/[^a-z0-9]/g, '');

  const isDirectlyBlacklisted =
    COMMON_PASSWORDS_BLACKLIST.has(pwd.toLowerCase()) ||
    COMMON_PASSWORDS_BLACKLIST.has(normalized) ||
    COMMON_PASSWORDS_BLACKLIST.has(pwd.toLowerCase().replace(/[^a-z0-9]/g, ''));

  // Check for common repetitive or sequential patterns
  const isSequentialNumbers = /(?:0123|1234|2345|3456|4567|5678|6789|7890)/.test(pwd);
  const isRepeatedChars = /(.)\1{3,}/.test(pwd); // e.g. "aaaa"
  const isKeyboardWalk = /(?:qwerty|asdfgh|zxcvbn)/i.test(pwd);
  const isNotCommon = !isDirectlyBlacklisted && !isSequentialNumbers && !isRepeatedChars && !isKeyboardWalk;

  if (!hasMinLength) {
    errors.push('Password must be at least 12 characters long');
    suggestions.push('Add more characters or use a memorable multi-word passphrase');
  }
  if (!hasUpperCase) {
    errors.push('Must contain at least one uppercase letter (A-Z)');
  }
  if (!hasLowerCase) {
    errors.push('Must contain at least one lowercase letter (a-z)');
  }
  if (!hasNumber) {
    errors.push('Must contain at least one number (0-9)');
  }
  if (!hasSymbol) {
    errors.push('Must contain at least one symbol or special character (e.g. !@#$%^&*)');
  }
  if (isDirectlyBlacklisted) {
    errors.push('This password is on the common breached passwords blacklist and cannot be used');
    suggestions.push('Avoid common dictionary words, simple number sequences, or club names');
  } else if (isSequentialNumbers) {
    errors.push('Avoid sequential numbers (e.g. 1234, 5678)');
  } else if (isRepeatedChars) {
    errors.push('Avoid repeating the same character multiple times in a row');
  } else if (isKeyboardWalk) {
    errors.push('Avoid common keyboard walk patterns (e.g. qwerty, asdfgh)');
  }

  // Calculate score (0 to 4) modeled after zxcvbn entropy thresholds
  let score = 0;
  if (pwd.length >= 8) score = 1;
  if (pwd.length >= 12 && (hasUpperCase || hasLowerCase) && (hasNumber || hasSymbol)) score = 2;
  if (hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSymbol && isNotCommon) {
    score = entropyBits >= 60 ? 3 : 2;
    if (pwd.length >= 14 && entropyBits >= 75) score = 4;
  }

  if (errors.length > 0 && score > 2) {
    score = 2; // Cap score if mandatory criteria fail
  }
  if (isDirectlyBlacklisted || !isNotCommon) {
    score = Math.min(score, 1);
  }

  const scoreMap: Record<number, { label: PasswordValidationResult['label']; color: string }> = {
    0: { label: 'Very Weak', color: '#ef4444' }, // red
    1: { label: 'Weak', color: '#f97316' },      // orange
    2: { label: 'Fair', color: '#eab308' },      // yellow
    3: { label: 'Good', color: '#3b82f6' },      // blue
    4: { label: 'Strong', color: '#10b981' },    // emerald green
  };

  const isValid = errors.length === 0;

  return {
    isValid,
    score,
    label: scoreMap[score].label,
    color: scoreMap[score].color,
    errors,
    suggestions,
    hasMinLength,
    hasUpperCase,
    hasLowerCase,
    hasNumber,
    hasSymbol,
    isNotCommon,
    entropyBits,
  };
}

