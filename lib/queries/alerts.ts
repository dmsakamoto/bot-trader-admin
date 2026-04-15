import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import type { AccountRow, AlertLogRow, AlertType } from '@/lib/types/db';

export interface AlertRow extends AlertLogRow {
  customer_name: string;
}

export interface AlertFilters {
  accountId?: string;
  types?: AlertType[];
  fromIso?: string;
  toIso?: string;
  page?: number;
  pageSize?: number;
}

export async function getAlerts(filters: AlertFilters): Promise<{ rows: AlertRow[]; total: number; accounts: AccountRow[] }> {
  const db = createServiceClient();
  const pageSize = filters.pageSize ?? 50;
  const page = filters.page ?? 0;

  const accountsQ = await db.from('accounts').select('*').returns<AccountRow[]>();
  if (accountsQ.error) throw accountsQ.error;
  const nameById = new Map((accountsQ.data ?? []).map((a) => [a.id, a.customer_name]));

  let q = db.from('alert_log').select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  if (filters.accountId) q = q.eq('account_id', filters.accountId);
  if (filters.types && filters.types.length > 0) q = q.in('alert_type', filters.types);
  if (filters.fromIso) q = q.gte('created_at', filters.fromIso);
  if (filters.toIso) q = q.lte('created_at', filters.toIso);

  const { data, error, count } = await q.returns<AlertLogRow[]>();
  if (error) throw error;

  return {
    rows: (data ?? []).map((r) => ({ ...r, customer_name: nameById.get(r.account_id) ?? 'unknown' })),
    total: count ?? 0,
    accounts: accountsQ.data ?? [],
  };
}
