import { Table, THead, Tr, Th, Td } from '@/components/ui/table';
import { fmtPct } from '@/lib/utils/format';
import { getVarDef } from '@/lib/config/schema';
import type { ConfigSummaryRow } from '@/lib/queries/configs';
import type { TradingConfigRow } from '@/lib/types/tradingConfig';

// Highlight fields to surface in the summary. Labels come from the schema.
const KEYS = ['daily_loss_limit', 'kelly_multiplier', 'max_position_size', 'order_type_priority'] as const;

function readKey(cfg: TradingConfigRow | null, key: string): string {
  if (!cfg) return '—';
  const raw = (cfg as unknown as Record<string, unknown>)[key];
  if (raw === null || raw === undefined) return '—';
  return String(raw);
}

export function SummaryTable({ rows }: { rows: ConfigSummaryRow[] }) {
  return (
    <Table>
      <THead>
        <Tr>
          <Th>Account</Th>
          <Th>v</Th>
          {KEYS.map((k) => (
            <Th key={k} className="text-xs">{getVarDef(k)?.label ?? k}</Th>
          ))}
          <Th className="text-right">7d %</Th>
          <Th className="text-right">30d %</Th>
          <Th className="text-right">7d Sharpe</Th>
        </Tr>
      </THead>
      <tbody>
        {rows.map((r) => (
          <Tr key={r.account.id}>
            <Td>{r.account.customer_name}</Td>
            <Td className="mono">{r.config?.version ?? '—'}</Td>
            {KEYS.map((k) => (
              <Td key={k} className="mono text-xs">{readKey(r.config, k)}</Td>
            ))}
            <Td className={`text-right mono ${r.weekPct >= 0 ? 'text-green-300' : 'text-red-300'}`}>{fmtPct(r.weekPct)}</Td>
            <Td className={`text-right mono ${r.monthPct >= 0 ? 'text-green-300' : 'text-red-300'}`}>{fmtPct(r.monthPct)}</Td>
            <Td className="text-right mono">{r.sharpe7d?.toFixed(2) ?? '—'}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
