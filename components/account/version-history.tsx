'use client';
import React, { useState } from 'react';
import { fmtTime } from '@/lib/utils/format';
import { Table, THead, Tr, Th, Td } from '@/components/ui/table';
import { getVarDef } from '@/lib/config/schema';
import type { BotConfigVersionRow } from '@/lib/types/db';

export function VersionHistory({ versions }: { versions: BotConfigVersionRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggle(id: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const sorted = [...versions].sort(
    (a, b) => new Date(b.deployed_at).getTime() - new Date(a.deployed_at).getTime(),
  );

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">Config version history</h3>
      <Table>
        <THead>
          <Tr><Th>Version</Th><Th>Deployed</Th><Th>Changes</Th><Th>{' '}</Th></Tr>
        </THead>
        <tbody>
          {sorted.map((v) => {
            const diffEntries = v.diff ? Object.entries(v.diff) : [];
            const count = diffEntries.length;
            return (
              <React.Fragment key={v.id}>
                <Tr>
                  <Td className="mono">v{v.version}</Td>
                  <Td className="text-xs">{fmtTime(v.deployed_at)}</Td>
                  <Td className="text-xs">
                    {v.diff == null ? 'initial' : `${count} field change${count === 1 ? '' : 's'}`}
                  </Td>
                  <Td>
                    {count > 0 && (
                      <button className="text-xs text-blue-400 hover:underline" onClick={() => toggle(v.id)}>
                        {expanded.has(v.id) ? 'hide' : 'show'}
                      </button>
                    )}
                  </Td>
                </Tr>
                {expanded.has(v.id) && count > 0 && (
                  <Tr>
                    <Td colSpan={4}>
                      <ul className="mono text-xs space-y-1">
                        {diffEntries.map(([key, change]) => {
                          const label = getVarDef(key)?.label ?? key;
                          return (
                            <li key={key}>
                              <span className="text-neutral-400">{label}</span>{' '}
                              <span className="text-red-300">{JSON.stringify(change.from)}</span>{' → '}
                              <span className="text-green-300">{JSON.stringify(change.to)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </Td>
                  </Tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
