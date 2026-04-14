import Link from 'next/link';

const links = [
  { href: '/', label: 'Fleet' },
  { href: '/configs', label: 'Configs' },
  { href: '/alerts', label: 'Alerts' },
];

export function Nav() {
  return (
    <nav className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-[1600px] mx-auto px-6 h-12 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold">Parachute Admin</span>
          <div className="flex gap-4 text-sm">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-neutral-400 hover:text-neutral-100">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <form action="/api/auth/signout" method="post">
          <button className="text-sm text-neutral-400 hover:text-neutral-100">Sign out</button>
        </form>
      </div>
    </nav>
  );
}
