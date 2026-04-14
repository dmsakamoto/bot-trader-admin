'use client';
import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Table, THead, Tr, Th, Td } from '@/components/ui/table';
import type { MarketScanRow } from '@/lib/types/db';

export function ScansTable({ rows }: { rows: MarketScanRow[] }) {
  const [gateFilter, setGateFilter] = useState<'all' | 'passed' | 'rejected'>('all');
  const [gateName, setGateName] = useState<string>('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const gateNames = useMemo(
    () => Array.from(new Set(rows.map((r) => r.closest_failing_gate).filter(Boolean) as string[])).sort(),
    [rows],
  );
  const filtered = rows.filter((r) => {
    if (gateFilter !== 'all' && r.gate_result !== gateFilter) return false;
    if (gateName && r.closest_failing_gate !== gateName) return false;
    return true;
  });

  function toggle(id: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <h3 className="text-sm font-semibold">Recent scans</h3>
        <select className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs"
          value={gateFilter} onChange={(e) => setGateFilter(e.target.value as 'all' | 'passed' | 'rejected')}>
          <option value="all">All</option>
          <option value="passed">Passed</option>
          <option value="rejected">Rejected</option>
        </select>
        <select className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs"
          value={gateName} onChange={(e) => setGateName(e.target.value)}>
          <option value="">Any gate</option>
          {gateNames.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <span className="text-xs text-neutral-500">{filtered.length} of {rows.length}</span>
      </div>
      <Table>
        <THead>
          <Tr>
            <Th>Time</Th><Th>Ticker</Th><Th>Side</Th>
            <Th className="text-right">Edge</Th>
            <Th className="text-right">Fair</Th>
            <Th className="text-right">Base FV</Th>
            <Th className="text-right">µ-edge</Th>
            <Th className="text-right">Floor</Th>
            <Th>Gate</Th><Th>Closest fail</Th><Th>{' '}</Th>
          </Tr>
        </THead>
        <tbody>
          {filtered.map((r) => (
            <React.Fragment key={r.id}>
              <Tr>
                <Td className="mono text-xs">{format(new Date(r.created_at), 'MMM d HH:mm:ss')}</Td>
                <Td className="mono text-xs">{r.ticker}</Td>
                <Td>{r.signal_side ?? '—'}</Td>
                <Td className="text-right mono">{r.edge?.toFixed(3) ?? '—'}</Td>
                <Td className="text-right mono">{r.fair_value?.toFixed(3) ?? '—'}</Td>
                <Td className="text-right mono">{r.base_fair_value?.toFixed(3) ?? '—'}</Td>
                <Td className="text-right mono">{r.micro_edge_score?.toFixed(3) ?? '—'}</Td>
                <Td className="text-right mono">{r.dynamic_edge_floor?.toFixed(3) ?? '—'}</Td>
                <Td>{r.gate_result ?? '—'}</Td>
                <Td className="text-xs">{r.closest_failing_gate ?? '—'}</Td>
                <Td>
                  <button className="text-xs text-blue-400 hover:underline" onClick={() => toggle(r.id)}>
                    {expanded.has(r.id) ? 'hide' : 'gates'}
                  </button>
                </Td>
              </Tr>
              {expanded.has(r.id) && (
                <Tr>
                  <Td className="mono text-xs whitespace-pre" {...{ colSpan: 11 }}>
                    {JSON.stringify(r.gate_values ?? {}, null, 2)}
                  </Td>
                </Tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
