import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { isAdmin } from '@/lib/auth/admin';

const PUBLIC_PATHS = ['/login', '/forbidden', '/api/auth/callback', '/api/auth/signout'];

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const path = request.nextUrl.pathname;

  if (PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + '/'))) {
    return response;
  }

  if (!user) {
    const url = request.nextUrl.clone();
    const next = request.nextUrl.pathname + request.nextUrl.search;
    url.pathname = '/login';
    url.search = ''; // clear any inherited query first
    // Only encode meaningful paths (skip root to avoid /?next=/ noise)
    if (next && next !== '/') {
      url.searchParams.set('next', next);
    }
    return NextResponse.redirect(url);
  }

  if (!isAdmin(user.id)) {
    const url = request.nextUrl.clone();
    url.pathname = '/forbidden';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
