'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

function safeNext(raw: string | null): string {
  if (!raw) return '/';
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return '/';
    return url.pathname + url.search;
  } catch {
    return '/';
  }
}

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const sp = useSearchParams();
  const supabase = createBrowserSupabaseClient();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    const target = safeNext(sp.get('next'));
    router.replace(target);
    router.refresh();
  }

  return (
    <main className="min-h-screen grid place-items-center bg-neutral-950 text-neutral-100">
      <form onSubmit={onSubmit} className="w-80 space-y-4 p-6 rounded-lg border border-neutral-800">
        <h1 className="text-xl font-semibold">Parachute Admin</h1>
        <input
          className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2"
          type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} required
        />
        <input
          className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2"
          type="password" placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)} required
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 rounded py-2 disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
