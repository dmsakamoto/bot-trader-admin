import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Table, THead, Tr, Th, Td } from '@/components/ui/table';
import type { FleetRow } from '@/lib/queries/fleet';

function heartbeatTone(hbIso: string | null | undefined): 'green' | 'yellow' | 'red' {
  if (!hbIso) return 'red';
  const ageMin = (Date.now() - new Date(hbIso).getTime()) / 60_000;
  if (ageMin > 15) return 'red';
  if (ageMin > 5) return 'yellow';
  return 'green';
}
function rowTone(r: FleetRow): 'red' | 'yellow' | 'green' | undefined {
  const hbTone = heartbeatTone(r.heartbeat?.created_at);
  if (hbTone === 'red') return 'red';
  if (r.instance?.status === 'error') return 'red';
  if (r.configMismatch) return 'red';
  if (hbTone === 'yellow') return 'yellow';
  const regime = r.heartbeat?.volume_regime;
  if (regime === 'SPIKE' || regime === 'COOLDOWN') return 'yellow';
  return 'green';
}
const fmtCents = (c: number) => `$${(c / 100).toFixed(2)}`;
const fmtPct = (p: number) => `${(p * 100).toFixed(2)}%`;

export function FleetTable({ rows }: { rows: FleetRow[] }) {
  return (
    <Table>
      <THead>
        <Tr>
          <Th>Customer</Th>
          <Th>VPS</Th>
          <Th>Instance</Th>
          <Th>Heartbeat</Th>
          <Th>Bot</Th>
          <Th>Regime</Th>
          <Th className="text-right">Signals</Th>
          <Th className="text-right">Open Exp</Th>
          <Th>Kill</Th>
          <Th>Config v</Th>
          <Th className="text-right">Today P&L</Th>
          <Th className="text-right">7d Sharpe</Th>
        </Tr>
      </THead>
      <tbody>
        {rows.map((r) => {
          const hbTone = heartbeatTone(r.heartbeat?.created_at);
          const hbAge = r.heartbeat
            ? formatDistanceToNowStrict(new Date(r.heartbeat.created_at)) + ' ago'
            : 'never';
          const deployedV = r.config?.version ?? '—';
          const actualV = r.heartbeat?.config_snapshot?.version ?? '—';
          return (
            <Tr key={r.account.id} tone={rowTone(r)}>
              <Td>
                <Link href={`/accounts/${r.account.id}`} className="hover:underline">
                  {r.account.customer_name}
                </Link>
              </Td>
              <Td className="mono text-xs">
                {r.instance
                  ? `${r.instance.vps_ip ?? '—'} · ${r.instance.vps_provider ?? ''} ${r.instance.vps_region ?? ''}`
                  : '—'}
              </Td>
              <Td><Badge tone={r.instance?.status === 'running' ? 'green' : r.instance?.status === 'error' ? 'red' : 'neutral'}>{r.instance?.status ?? '—'}</Badge></Td>
              <Td><Badge tone={hbTone}>{hbAge}</Badge></Td>
              <Td>{r.heartbeat?.status ?? '—'}</Td>
              <Td>{r.heartbeat?.volume_regime ?? '—'}</Td>
              <Td className="text-right mono">{r.heartbeat?.signals_detected ?? 0}</Td>
              <Td className="text-right mono">{fmtCents(r.heartbeat?.open_exposure_cents ?? 0)}</Td>
              <Td>{r.control?.kill_switch ? <Badge tone="red">ON</Badge> : <Badge tone="green">off</Badge>}</Td>
              <Td className="mono text-xs">
                <span className={r.configMismatch ? 'text-red-300' : ''}>
                  {deployedV}{r.configMismatch ? ` → ${actualV}` : ''}
                </span>
              </Td>
              <Td className={`text-right mono ${r.todayPnlCents >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                {fmtCents(r.todayPnlCents)} ({fmtPct(r.todayPctReturn)})
              </Td>
              <Td className="text-right mono">{r.sharpe7d == null ? '—' : r.sharpe7d.toFixed(2)}</Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}
