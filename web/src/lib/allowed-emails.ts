export function parseAllowedEmails(raw: string | null | undefined) {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isEmailAllowed(
  email: string | null | undefined,
  allowedEmails: Set<string>,
) {
  if (!email) {
    return false;
  }

  return allowedEmails.has(email.trim().toLowerCase());
}
