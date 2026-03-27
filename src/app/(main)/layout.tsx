import { Sidebar } from "@/components/layout/sidebar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex max-w-7xl mx-auto w-full">
      <aside className="hidden lg:block w-64 shrink-0 py-6 pl-4 lg:pl-6">
        <Sidebar />
      </aside>
      <main className="flex-1 min-w-0 p-4 lg:p-6">{children}</main>
    </div>
  );
}
