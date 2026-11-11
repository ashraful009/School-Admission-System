/**
 * User-facing messages in plain English (Q8).
 * Centralized here to allow internationalization (e.g. Bangla) later.
 */
export const ERROR_MESSAGES: Record<string, string> = {
  INVALID_STUDENT_ID: 'Please enter a valid 17-digit birth registration number.',
  NO_SEATS_AVAILABLE: 'No seats are currently available in this class.',
  ALREADY_APPLIED_IN_CLASS: 'You already have an active hold or confirmed admission in this class.',
  HOLD_EXPIRED: 'Your seat hold has expired. The seat has been returned to the pool.',
  HOLD_NOT_ACTIVE: 'This seat hold is no longer active or was cancelled.',
  HOLD_ALREADY_CONFIRMED: 'This seat hold has already been confirmed.',
  TOTAL_SEATS_BELOW_OCCUPIED: 'Total seats cannot be lower than the currently held and confirmed seats.',
  VALIDATION_ERROR: 'Invalid input. Please check the values provided and try again.',
  NOT_FOUND: 'The requested class or hold was not found.',
  METHOD_NOT_ALLOWED: 'Action not allowed.',
  UNSUPPORTED_MEDIA_TYPE: 'Unsupported request format.',
  INTERNAL_ERROR: 'An unexpected server error occurred. Please try again.',
  NETWORK_ERROR: 'Server is currently unreachable. Retrying automatically...',
  UNKNOWN_ERROR: 'Something went wrong. Please try again.',
};

export function getErrorMessage(code?: string, fallback = ERROR_MESSAGES.UNKNOWN_ERROR): string {
  if (!code) return fallback;
  return ERROR_MESSAGES[code] || fallback;
}

