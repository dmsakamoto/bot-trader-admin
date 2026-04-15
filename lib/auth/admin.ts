// Admin user IDs can be provided two ways:
//   (a) ADMIN_USER_IDS — comma-separated list (works in .env.local)
//   (b) ADMIN_USER_ID_1, ADMIN_USER_ID_2, … — one UUID per var (for Vercel)
// Both sources are merged; either alone is sufficient.
function loadAllowed(): string[] {
  const out = new Set<string>();
  const csv = process.env.ADMIN_USER_IDS ?? '';
  for (const s of csv.split(',')) {
    const v = s.trim();
    if (v) out.add(v);
  }
  for (let i = 1; i < 100; i++) {
    const v = (process.env[`ADMIN_USER_ID_${i}`] ?? '').trim();
    if (!v) break;
    out.add(v);
  }
  return [...out];
}

export function isAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return loadAllowed().includes(userId);
}
