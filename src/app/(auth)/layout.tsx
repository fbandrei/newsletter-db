import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[calc(100vh-8rem)] bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center justify-center px-4 py-10">
        <div className="w-full">
          <div className="mb-6 text-center">
            <Link
              href="/"
              className="text-2xl font-bold text-[var(--color-primary)] transition-opacity hover:opacity-90"
            >
              NewsletterDB
            </Link>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Welcome back to your newsletter intelligence platform.
            </p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
