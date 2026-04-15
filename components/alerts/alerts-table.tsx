'use client';
import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { Table, THead, Tr, Th, Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { AlertRow } from '@/lib/queries/alerts';
import type { AccountRow, AlertType } from '@/lib/types/db';

const ALERT_TYPES: AlertType[] = ['stale_heartbeat', 'daily_loss', 'kill_switch', 'sync_failure'];

export function AlertsTable({
  rows, total, accounts, page, pageSize,
}: { rows: AlertRow[]; total: number; accounts: AccountRow[]; page: number; pageSize: number }) {
  const router = useRouter();
  const sp = useSearchParams();

  function setParam(k: string, v: string | null) {
    const next = new URLSearchParams(sp);
    if (v == null || v === '') next.delete(k); else next.set(k, v);
    router.push(`/alerts?${next.toString()}`);
  }

  function toggleType(t: AlertType) {
    const current = (sp.get('types') ?? '').split(',').filter(Boolean) as AlertType[];
    const next = current.includes(t) ? current.filter((x) => x !== t) : [...current, t];
    setParam('types', next.join(','));
  }

  const currentTypes = (sp.get('types') ?? '').split(',').filter(Boolean);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-center">
        <select className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs"
          value={sp.get('accountId') ?? ''} onChange={(e) => setParam('accountId', e.target.value || null)}>
          <option value="">All accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.customer_name}</option>)}
        </select>
        <div className="flex gap-2 text-xs">
          {ALERT_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-1">
              <input type="checkbox" checked={currentTypes.includes(t)} onChange={() => toggleType(t)} />
              {t}
            </label>
          ))}
        </div>
        <input type="date" className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs"
          value={sp.get('from') ?? ''} onChange={(e) => setParam('from', e.target.value || null)} />
        <input type="date" className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs"
          value={sp.get('to') ?? ''} onChange={(e) => setParam('to', e.target.value || null)} />
        <span className="text-xs text-neutral-500">{total} alert{total === 1 ? '' : 's'}</span>
      </div>

      <Table>
        <THead>
          <Tr><Th>Time</Th><Th>Account</Th><Th>Type</Th><Th>Details</Th></Tr>
        </THead>
        <tbody>
          {rows.map((r) => (
            <Tr key={r.id}>
              <Td className="mono text-xs">{format(new Date(r.created_at), 'MMM d yyyy HH:mm:ss')}</Td>
              <Td>{r.customer_name}</Td>
              <Td><Badge tone={r.alert_type === 'daily_loss' || r.alert_type === 'kill_switch' ? 'red' : 'yellow'}>{r.alert_type}</Badge></Td>
              <Td className="mono text-xs whitespace-pre-wrap">{JSON.stringify(r.details, null, 2)}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>

      <div className="flex justify-between text-xs">
        <button disabled={page === 0} onClick={() => setParam('page', String(page - 1))}
          className="px-2 py-1 border border-neutral-800 rounded disabled:opacity-30">← Prev</button>
        <span className="text-neutral-500">Page {page + 1} of {totalPages}</span>
        <button disabled={page + 1 >= totalPages} onClick={() => setParam('page', String(page + 1))}
          className="px-2 py-1 border border-neutral-800 rounded disabled:opacity-30">Next →</button>
      </div>
    </div>
  );
}
