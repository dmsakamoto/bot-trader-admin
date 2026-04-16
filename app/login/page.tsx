import { redirect } from 'next/navigation';
import { createAuthClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/auth/admin';
import { LoginForm } from './login-form';

function safeNextServer(raw: string | undefined): string {
  if (!raw) return '/';
  // Must start with / and not //, must not contain \
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/';
  return raw;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { next } = await searchParams;

  if (user) {
    if (isAdmin(user.id)) {
      redirect(safeNextServer(next));
    }
    redirect('/forbidden');
  }

  return <LoginForm />;
}
