import { redirect } from 'next/navigation';
import { createAuthClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/auth/admin';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    if (isAdmin(user.id)) {
      redirect('/');
    }
    redirect('/forbidden');
  }

  return <LoginForm />;
}
