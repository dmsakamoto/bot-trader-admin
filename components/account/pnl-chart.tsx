'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import type { DailyPnl } from '@/lib/metrics/types';

export function PnlChart({ data }: { data: DailyPnl[] }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <h3 className="text-sm font-semibold mb-2">Daily P&L (last 30 days)</h3>
      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer>
          <BarChart data={data}>
            <XAxis dataKey="date" stroke="#737373" fontSize={11} />
            <YAxis stroke="#737373" fontSize={11}
              tickFormatter={(v) => `$${(v / 100).toFixed(0)}`} />
            <Tooltip
              contentStyle={{ background: '#171717', border: '1px solid #404040' }}
              formatter={(v: number) => `$${(v / 100).toFixed(2)}`}
            />
            <Bar dataKey="pnlCents">
              {data.map((d, i) => (
                <Cell key={i} fill={d.pnlCents >= 0 ? '#4ade80' : '#f87171'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
