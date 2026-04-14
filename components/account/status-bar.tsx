import { formatDistanceToNowStrict } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import type { AccountDetail } from '@/lib/queries/account';

export function StatusBar({ d }: { d: AccountDetail }) {
  const hb = d.latestHeartbeat;
  const hbAge = hb ? formatDistanceToNowStrict(new Date(hb.created_at)) + ' ago' : 'never';
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 grid grid-cols-6 gap-4 text-sm">
      <div>
        <div className="text-xs uppercase text-neutral-500">Customer</div>
        <div className="font-semibold">{d.account.customer_name}</div>
      </div>
      <div>
        <div className="text-xs uppercase text-neutral-500">VPS</div>
        <div className="mono text-xs">{d.instance?.vps_ip ?? '—'}</div>
      </div>
      <div>
        <div className="text-xs uppercase text-neutral-500">Instance</div>
        <Badge tone={d.instance?.status === 'running' ? 'green' : d.instance?.status === 'error' ? 'red' : 'neutral'}>
          {d.instance?.status ?? '—'}
        </Badge>
      </div>
      <div>
        <div className="text-xs uppercase text-neutral-500">Heartbeat</div>
        <div>{hbAge}</div>
      </div>
      <div>
        <div className="text-xs uppercase text-neutral-500">Kill Switch</div>
        {d.control?.kill_switch ? <Badge tone="red">ON</Badge> : <Badge tone="green">off</Badge>}
      </div>
      <div>
        <div className="text-xs uppercase text-neutral-500">Regime</div>
        <div>{hb?.volume_regime ?? '—'}</div>
      </div>
    </div>
  );
}
