import { HTMLAttributes, ReactNode } from 'react';

export function Table({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-lg border border-neutral-800 ${className}`}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}
export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-neutral-900 text-neutral-400 text-xs uppercase">{children}</thead>;
}
export function Th({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <th className={`text-left px-3 py-2 font-medium ${className}`}>{children}</th>;
}
export function Tr(
  { children, tone, ...rest }: HTMLAttributes<HTMLTableRowElement> & { tone?: 'red' | 'yellow' | 'green' },
) {
  const toneClass =
    tone === 'red' ? 'bg-red-950/40' :
    tone === 'yellow' ? 'bg-yellow-950/30' :
    tone === 'green' ? '' : '';
  return <tr className={`border-t border-neutral-800 ${toneClass}`} {...rest}>{children}</tr>;
}
export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
