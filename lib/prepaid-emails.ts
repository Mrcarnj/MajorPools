// Entries submitted from these emails are created with has_paid already true.
// The payments page checkbox stays the source of truth after creation — this is
// only the default applied at submit time.
export const PREPAID_EMAILS = [
  'mike.f.dietrich@gmail.com',
  'alexanoelmcgrath@gmail.com',
  'garrettrank87@gmail.com',
];

export function isPrepaidEmail(email: string): boolean {
  return PREPAID_EMAILS.includes(email.trim().toLowerCase());
}
