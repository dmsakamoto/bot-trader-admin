import { notFound } from 'next/navigation';
import { getAccountDetail } from '@/lib/queries/account';
import { StatusBar } from '@/components/account/status-bar';
import { PerformanceCards } from '@/components/account/performance-cards';
import { PnlChart } from '@/components/account/pnl-chart';
import { HeartbeatTable } from '@/components/account/heartbeat-table';
import { ScansTable } from '@/components/account/scans-table';
import { FillsSettlements } from '@/components/account/fills-settlements';
import { ActiveConfig } from '@/components/account/active-config';
import { VersionHistory } from '@/components/account/version-history';

export const dynamic = 'force-dynamic';

export default async function AccountPage({
  params,
}: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const d = await getAccountDetail(accountId);
  if (!d) notFound();
  return (
    <div className="space-y-6">
      <StatusBar d={d} />
      <PerformanceCards d={d} />
      <PnlChart data={d.daily30} />
      <HeartbeatTable rows={d.heartbeats} />
      <ScansTable rows={d.scans} />
      <FillsSettlements fills={d.fills} settlements={d.settlements} />
      <ActiveConfig cfg={d.activeConfig} />
      <VersionHistory versions={d.versions} />
    </div>
  );
}
