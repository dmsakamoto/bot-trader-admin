import { Nav } from '@/components/nav';

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="max-w-[1600px] mx-auto px-6 py-6">{children}</main>
    </>
  );
}
