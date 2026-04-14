import { ReactNode } from 'react';

type Tone = 'neutral' | 'green' | 'yellow' | 'red' | 'blue';

const toneClass: Record<Tone, string> = {
  neutral: 'bg-neutral-800 text-neutral-200',
  green: 'bg-green-900/50 text-green-300',
  yellow: 'bg-yellow-900/50 text-yellow-300',
  red: 'bg-red-900/50 text-red-300',
  blue: 'bg-blue-900/50 text-blue-300',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono ${toneClass[tone]}`}>
      {children}
    </span>
  );
}
