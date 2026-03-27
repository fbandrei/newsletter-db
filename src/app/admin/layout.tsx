import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

const adminLinks = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/ai-settings", label: "AI Settings" },
  { href: "/admin/sources", label: "Sources" },
  { href: "/admin/import-logs", label: "Import Logs" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 p-4 lg:grid-cols-[240px_1fr] lg:p-6">
      <aside className="h-fit rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
        <h2 className="px-2 pb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          Admin
        </h2>
        <nav className="space-y-1">
          {adminLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main>{children}</main>
    </div>
  );
}
