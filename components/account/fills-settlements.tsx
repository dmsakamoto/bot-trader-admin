'use client';
import { useState } from 'react';
import { format } from 'date-fns';
import { Table, THead, Tr, Th, Td } from '@/components/ui/table';
import type { KalshiFillRow, KalshiSettlementRow } from '@/lib/types/db';

export function FillsSettlements({
  fills, settlements,
}: { fills: KalshiFillRow[]; settlements: KalshiSettlementRow[] }) {
  const [tab, setTab] = useState<'fills' | 'settlements'>('fills');
  return (
    <div>
      <div className="flex gap-2 mb-2 text-sm">
        <button onClick={() => setTab('fills')}
          className={`px-3 py-1 rounded ${tab === 'fills' ? 'bg-neutral-800' : 'text-neutral-400'}`}>
          Fills ({fills.length})
        </button>
        <button onClick={() => setTab('settlements')}
          className={`px-3 py-1 rounded ${tab === 'settlements' ? 'bg-neutral-800' : 'text-neutral-400'}`}>
          Settlements ({settlements.length})
        </button>
      </div>
      {tab === 'fills' ? (
        <Table>
          <THead>
            <Tr><Th>Time</Th><Th>Ticker</Th><Th>Side</Th><Th>Action</Th>
              <Th className="text-right">Contracts</Th><Th className="text-right">Price</Th><Th>Origin</Th></Tr>
          </THead>
          <tbody>
            {fills.map((f) => (
              <Tr key={f.id}>
                <Td className="mono text-xs">{format(new Date(f.filled_time), 'MMM d HH:mm:ss')}</Td>
                <Td className="mono text-xs">{f.ticker}</Td>
                <Td>{f.side}</Td><Td>{f.action}</Td>
                <Td className="text-right mono">{f.contracts}</Td>
                <Td className="text-right mono">{(f.price_cents / 100).toFixed(2)}</Td>
                <Td className="text-xs">{f.origin ?? '—'}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Table>
          <THead>
            <Tr><Th>Time</Th><Th>Ticker</Th><Th>Result</Th>
              <Th className="text-right">P&L</Th><Th>Origin</Th></Tr>
          </THead>
          <tbody>
            {settlements.map((s) => (
              <Tr key={s.id}>
                <Td className="mono text-xs">{format(new Date(s.settled_time), 'MMM d HH:mm:ss')}</Td>
                <Td className="mono text-xs">{s.ticker}</Td>
                <Td>{s.result}</Td>
                <Td className={`text-right mono ${s.pnl_cents >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  ${(s.pnl_cents / 100).toFixed(2)}
                </Td>
                <Td className="text-xs">{s.origin ?? '—'}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
