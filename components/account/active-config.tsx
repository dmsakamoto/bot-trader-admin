import { fmtTime, fmtCents } from '@/lib/utils/format';
import { TRADING_CONFIG_SCHEMA, getVarDef } from '@/lib/config/schema';
import type { TradingConfigRow } from '@/lib/types/tradingConfig';

function renderValue(key: string, v: unknown): string {
  if (v === null || v === undefined) return '—';
  const def = getVarDef(key);
  if (def?.type === 'boolean') return v ? 'true' : 'false';
  if (def?.unit === 'cents' && typeof v === 'number') return fmtCents(v);
  if (def?.unit === '%' && typeof v === 'number') return `${(v * 100).toFixed(2)}%`;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function ActiveConfig({ cfg }: { cfg: TradingConfigRow | null }) {
  if (!cfg) return <div className="text-neutral-500">No active config.</div>;
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 space-y-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">Active config</h3>
        <div className="text-xs text-neutral-400 mono">
          v{cfg.version} · deployed {cfg.deployed_at ? fmtTime(cfg.deployed_at) : 'never'}
        </div>
      </div>
      {TRADING_CONFIG_SCHEMA.map((g) => (
        <details key={g.id} open className="border-t border-neutral-800 pt-2">
          <summary className="cursor-pointer text-xs uppercase text-neutral-400">{g.label}</summary>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-sm">
            {g.vars.map((v) => {
              const raw = (cfg as unknown as Record<string, unknown>)[v.key];
              return (
                <div key={v.key} className="flex justify-between border-b border-neutral-900 py-1">
                  <dt className="text-neutral-400 text-xs" title={v.description ?? ''}>{v.label}</dt>
                  <dd className="mono text-xs">{renderValue(v.key, raw)}</dd>
                </div>
              );
            })}
          </dl>
        </details>
      ))}
    </div>
  );
}
