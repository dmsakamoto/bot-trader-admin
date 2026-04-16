import { format } from 'date-fns';
import { Table, THead, Tr, Th, Td } from '@/components/ui/table';
import type { BotHeartbeatRow } from '@/lib/types/db';

export function HeartbeatTable({ rows }: { rows: BotHeartbeatRow[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">Heartbeat history (last {rows.length})</h3>
      <Table>
        <THead>
          <Tr>
            <Th>Time</Th><Th>Status</Th><Th>Regime</Th>
            <Th className="text-right">Signals</Th>
            <Th className="text-right">Open Exp</Th>
            <Th className="text-right">Daily P&L</Th>
            <Th>Fail-safe</Th><Th>Cfg v</Th>
          </Tr>
        </THead>
        <tbody>
          {rows.map((r) => (
            <Tr key={r.id}>
              <Td className="mono text-xs">{format(new Date(r.timestamp), 'MMM d HH:mm:ss')}</Td>
              <Td>{r.status}</Td>
              <Td>{r.volume_regime ?? '—'}</Td>
              <Td className="text-right mono">{r.signals_detected}</Td>
              <Td className="text-right mono">${(r.open_exposure_cents / 100).toFixed(2)}</Td>
              <Td className="text-right mono">
                {r.daily_pnl_cents == null ? '—' : `$${(r.daily_pnl_cents / 100).toFixed(2)}`}
              </Td>
              <Td className="text-xs">
                {r.fail_safe_status ?? '—'}
                {r.fail_safe_reason ? ` · ${r.fail_safe_reason}` : ''}
              </Td>
              <Td className="mono">{r.config_snapshot?.version ?? '—'}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
