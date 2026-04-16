'use client';
import React, { useState } from 'react';
import { TRADING_CONFIG_SCHEMA } from '@/lib/config/schema';
import { Table, THead, Tr, Th, Td } from '@/components/ui/table';
import { fmtPct, accountDisplayName } from '@/lib/utils/format';
import type { ConfigSummaryRow } from '@/lib/queries/configs';
import type { TradingConfigRow } from '@/lib/types/tradingConfig';

function mostCommon(values: string[]): string | null {
  if (values.length === 0) return null;
  const counts = new Map<string, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  let best: string | null = null;
  let bestN = 0;
  for (const [v, n] of counts) if (n > bestN) { best = v; bestN = n; }
  return best;
}

function readCell(cfg: TradingConfigRow | null, key: string): string {
  if (!cfg) return 'null';
  const raw = (cfg as unknown as Record<string, unknown>)[key];
  return JSON.stringify(raw ?? null);
}

export function ComparisonTable({ rows }: { rows: ConfigSummaryRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const selectedRows = rows.filter((r) => selected.includes(r.account.id));

  function toggle(id: string) {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : s.length < 5 ? [...s, id] : s);
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs text-neutral-400 mb-1">Pick 2–5 accounts:</div>
        <div className="flex flex-wrap gap-2">
          {rows.map((r) => (
            <button key={r.account.id} onClick={() => toggle(r.account.id)}
              className={`text-xs px-2 py-1 rounded border ${
                selected.includes(r.account.id)
                  ? 'bg-blue-900/50 border-blue-700'
                  : 'border-neutral-800 text-neutral-400'}`}>
              {accountDisplayName(r.account)}
            </button>
          ))}
        </div>
      </div>

      {selectedRows.length < 2 ? (
        <p className="text-sm text-neutral-500">Select at least 2 accounts to compare.</p>
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>Parameter</Th>
              {selectedRows.map((r) => <Th key={r.account.id}>{accountDisplayName(r.account)}</Th>)}
            </Tr>
          </THead>
          <tbody>
            <Tr>
              <Td className="text-xs uppercase text-neutral-500">7d %</Td>
              {selectedRows.map((r) => (
                <Td key={r.account.id} className={`mono ${r.weekPct >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {fmtPct(r.weekPct)}
                </Td>
              ))}
            </Tr>
            <Tr>
              <Td className="text-xs uppercase text-neutral-500">30d %</Td>
              {selectedRows.map((r) => (
                <Td key={r.account.id} className={`mono ${r.monthPct >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {fmtPct(r.monthPct)}
                </Td>
              ))}
            </Tr>
            <Tr>
              <Td className="text-xs uppercase text-neutral-500">7d Sharpe</Td>
              {selectedRows.map((r) => (
                <Td key={r.account.id} className="mono">{r.sharpe7d?.toFixed(2) ?? '—'}</Td>
              ))}
            </Tr>
            {TRADING_CONFIG_SCHEMA.map((g) => (
              <React.Fragment key={g.id}>
                <Tr>
                  <Td colSpan={selectedRows.length + 1} className="text-xs uppercase text-neutral-500 bg-neutral-900/60">
                    {g.label}
                  </Td>
                </Tr>
                {g.vars.map((v) => {
                  const values = selectedRows.map((r) => readCell(r.config, v.key));
                  const common = mostCommon(values);
                  return (
                    <Tr key={v.key}>
                      <Td className="text-xs text-neutral-400"><span title={v.description ?? ''}>{v.label}</span></Td>
                      {selectedRows.map((r, i) => {
                        const val = values[i];
                        const outlier = common != null && val !== common;
                        return (
                          <Td key={r.account.id}
                            className={`mono text-xs ${outlier ? 'bg-yellow-900/30 text-yellow-200' : ''}`}>
                            {val === 'null' ? '—' : val}
                          </Td>
                        );
                      })}
                    </Tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
