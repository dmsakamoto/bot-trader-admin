import { getFleetOverview } from '@/lib/queries/fleet';
import { FleetTable } from '@/components/fleet/fleet-table';

export const dynamic = 'force-dynamic';

export default async function FleetPage() {
  const rows = await getFleetOverview();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Fleet Overview</h1>
      <p className="text-sm text-neutral-400">{rows.length} accounts</p>
      <FleetTable rows={rows} />
    </div>
  );
}
