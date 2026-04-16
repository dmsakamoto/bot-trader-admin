import { getAlerts } from '@/lib/queries/alerts';
import { AlertsTable } from '@/components/alerts/alerts-table';
import type { AlertType } from '@/lib/types/db';

export const dynamic = 'force-dynamic';

export default async function AlertsPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const page = Number(sp.page ?? 0);
  const pageSize = 50;
  const types = (sp.types ?? '').split(',').filter(Boolean) as AlertType[];
  const { rows, total, accounts } = await getAlerts({
    accountId: sp.accountId || undefined,
    types: types.length ? types : undefined,
    fromIso: sp.from ? new Date(sp.from).toISOString() : undefined,
    toIso: sp.to ? new Date(sp.to + 'T23:59:59Z').toISOString() : undefined,
    page, pageSize,
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Alerts</h1>
      <AlertsTable rows={rows} total={total} accounts={accounts} page={page} pageSize={pageSize} />
    </div>
  );
}
