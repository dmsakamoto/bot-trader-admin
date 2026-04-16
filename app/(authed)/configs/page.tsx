import { getConfigSummary } from '@/lib/queries/configs';
import { SummaryTable } from '@/components/configs/summary-table';
import { ComparisonTable } from '@/components/configs/comparison-table';

export const dynamic = 'force-dynamic';

export default async function ConfigsPage() {
  const rows = await getConfigSummary();
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Config Comparison</h1>
      <section className="space-y-2">
        <h2 className="text-sm uppercase text-neutral-400">Summary (all accounts)</h2>
        <SummaryTable rows={rows} />
      </section>
      <section className="space-y-2">
        <h2 className="text-sm uppercase text-neutral-400">Side-by-side comparison</h2>
        <ComparisonTable rows={rows} />
      </section>
    </div>
  );
}
