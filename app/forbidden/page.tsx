export default function ForbiddenPage() {
  return (
    <main className="min-h-screen grid place-items-center bg-neutral-950 text-neutral-100">
      <div className="w-96 space-y-4 p-6 rounded-lg border border-neutral-800 text-center">
        <h1 className="text-xl font-semibold">Access denied</h1>
        <p className="text-sm text-neutral-400">
          Your account is signed in, but not on the admin allow-list for this app.
          If you think this is a mistake, contact the app owner.
        </p>
        <form action="/api/auth/signout" method="post">
          <button className="w-full bg-neutral-800 hover:bg-neutral-700 rounded py-2 text-sm">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
