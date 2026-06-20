export type ValidationResult = {
  valid: boolean;
  checks: Record<string, boolean>;
  errors: string[];
};

export function buildValidation(checks: Record<string, boolean>): ValidationResult {
  const errors = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `Validation failed: ${name}`);
  return { valid: errors.length === 0, checks, errors };
}

export function isSafeGeneralAudienceText(value: string) {
  return value.trim().length > 0 && value.length <= 240;
}
