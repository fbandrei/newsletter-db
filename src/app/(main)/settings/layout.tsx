import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

const settingsLinks = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/notifications", label: "Notifications" },
];

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  return (
    <div className="mx-auto w-full max-w-6xl p-4 lg:p-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="mt-6 grid gap-6 md:grid-cols-[220px_1fr]">
        <aside className="h-fit rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2">
          <nav className="space-y-1">
            {settingsLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-md px-3 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>
        <section>{children}</section>
      </div>
    </div>
  );
}
