/**
 * BUG-016: Robust Input Validation
 * Protects against script injection (<script>), spreadsheet formula injection (=, +, -, @),
 * and malformed entries across employee/customer forms.
 */

// Name regex:
// Starts with any Unicode letter (\p{L}).
// Followed by 1 to 59 Unicode letters, combining marks (\p{M}), spaces, dots, single quotes/apostrophes, or hyphens.
const NAME_REGEX = /^[\p{L}][\p{L}\p{M}\s.'’-]{1,59}$/u;

// Forbidden formula-leading characters
const FORMULA_TRIGGERS = new Set(['=', '+', '-', '@']);

export function validatePersonName(rawName: string | null | undefined): { valid: boolean; error?: string } {
  if (!rawName) {
    return { valid: false, error: 'Name is required' };
  }

  const name = rawName.trim();
  if (name.length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters' };
  }
  if (name.length > 60) {
    return { valid: false, error: 'Name cannot exceed 60 characters' };
  }

  const firstChar = name[0];
  if (FORMULA_TRIGGERS.has(firstChar)) {
    return { valid: false, error: 'Name cannot begin with =, +, -, or @' };
  }

  if (/[<>{};\\\/$*%^&]/.test(name)) {
    return { valid: false, error: 'Name contains invalid special characters or HTML tags' };
  }

  if (!NAME_REGEX.test(name)) {
    return {
      valid: false,
      error: 'Name must start with a letter and contain only letters, spaces, hyphens, and apostrophes',
    };
  }

  return { valid: true };
}

export function validatePassword(password: string | null | undefined): { valid: boolean; error?: string } {
  if (!password) {
    return { valid: false, error: 'Password is required' };
  }
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must include at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must include at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must include at least one number' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, error: 'Password must include at least one special character' };
  }
  return { valid: true };
}
