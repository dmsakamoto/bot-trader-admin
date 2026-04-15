export function isAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const raw = process.env.ADMIN_USER_IDS ?? '';
  const allowed = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return allowed.includes(userId);
}
