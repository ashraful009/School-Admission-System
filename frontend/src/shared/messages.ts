import { LANG_STORAGE_KEY, type Language } from './i18n';

/**
 * User-facing messages in plain English (Q8).
 * Centralized here to allow internationalization (Bangla / English).
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

export const ERROR_MESSAGES_BN: Record<string, string> = {
  INVALID_STUDENT_ID: 'অনুগ্রহ করে একটি সঠিক ১৭-সংখ্যার জন্ম নিবন্ধন নম্বর লিখুন।',
  NO_SEATS_AVAILABLE: 'বর্তমানে এই ক্লাসে কোনো আসন ফাঁকা নেই।',
  ALREADY_APPLIED_IN_CLASS: 'আপনার ইতিমধ্যে এই ক্লাসে একটি সক্রিয় বা নিশ্চিত আবেদন রয়েছে।',
  HOLD_EXPIRED: 'আপনার আসন সংরক্ষণের মেয়াদ শেষ হয়েছে। আসনটি পুলে ফেরত গেছে।',
  HOLD_NOT_ACTIVE: 'এই আসন সংরক্ষণটি আর সক্রিয় নেই বা বাতিল করা হয়েছে।',
  HOLD_ALREADY_CONFIRMED: 'এই আসন সংরক্ষণটি ইতিমধ্যে নিশ্চিত করা হয়েছে।',
  TOTAL_SEATS_BELOW_OCCUPIED: 'মোট আসন সংখ্যা বর্তমানে সংরক্ষিত ও নিশ্চিত আসনের চেয়ে কম হতে পারে না।',
  VALIDATION_ERROR: 'প্রদত্ত তথ্য সঠিক নয়। অনুগ্রহ করে মানগুলো পুনরায় পরীক্ষা করুন।',
  NOT_FOUND: 'অনুরোধকৃত ক্লাস বা আসন সংরক্ষণ খুঁজে পাওয়া যায়নি।',
  METHOD_NOT_ALLOWED: 'এই পদক্ষেপটি অনুমোদিত নয়।',
  UNSUPPORTED_MEDIA_TYPE: 'অনুরোধের ফরম্যাটটি সমর্থিত নয়।',
  INTERNAL_ERROR: 'সার্ভারে একটি অপ্রত্যাশিত ত্রুটি ঘটেছে। পুনরায় চেষ্টা করুন।',
  NETWORK_ERROR: 'সার্ভারের সাথে সংযোগ স্থাপন করা যাচ্ছে না। পুনরায় চেষ্টা করা হচ্ছে...',
  UNKNOWN_ERROR: 'কিছু ভুল হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।',
};

export function getCurrentLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'bn') return 'bn';
  } catch {
    // localStorage unavailable
  }
  return 'en';
}

export function getErrorMessage(
  code?: string,
  fallback?: string,
  lang?: Language,
): string {
  const currentLang = lang || getCurrentLanguage();
  const dict = currentLang === 'bn' ? ERROR_MESSAGES_BN : ERROR_MESSAGES;
  const defaultFallback = dict.UNKNOWN_ERROR;

  if (!code) return fallback || defaultFallback;
  return dict[code] || fallback || defaultFallback;
}
