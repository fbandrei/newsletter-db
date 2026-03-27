"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default function ProfileSettingsPage() {
  const { data: session, status, update } = useSession();

  const currentName = session?.user?.name ?? "";
  const [name, setName] = useState(currentName);
  const [nameSaving, setNameSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const role = session?.user?.role || "FREE";
  const isPremium = role === "PREMIUM";

  const passwordError = useMemo(() => {
    if (!newPassword && !confirmPassword && !currentPassword) return null;
    if (!currentPassword) return "Current password is required.";
    if (newPassword.length < 8) return "New password must be at least 8 characters.";
    if (newPassword !== confirmPassword) return "Passwords do not match.";
    return null;
  }, [currentPassword, newPassword, confirmPassword]);

  async function handleNameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!name.trim()) {
      setError("Name cannot be empty.");
      return;
    }

    setNameSaving(true);
    try {
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Failed to update profile.");
        return;
      }

      await update({ name: name.trim() });
      setMessage("Profile updated.");
    } catch {
      setError("Failed to update profile.");
    } finally {
      setNameSaving(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (passwordError) {
      setError(passwordError);
      return;
    }

    setPasswordSaving(true);
    try {
      const response = await fetch("/api/user/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Failed to update password.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password updated successfully.");
    } catch {
      setError("Failed to update password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  if (status === "loading") {
    return <p className="text-sm text-[var(--color-text-secondary)]">Loading profile...</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-4">
          <Avatar
            src={session?.user?.image}
            name={session?.user?.name || session?.user?.email || "User"}
            size="lg"
          />
          <div>
            <h2 className="text-xl font-semibold">Profile</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">{session?.user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleNameSubmit} className="mt-6 space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Button type="submit" loading={nameSaving}>
            Save name
          </Button>
        </form>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Subscription</h2>
          <Badge variant={isPremium ? "success" : "default"}>{role}</Badge>
        </div>

        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          {isPremium
            ? "You are currently on a premium plan."
            : "You are currently on a free plan."}
        </p>

        {isPremium ? (
          <a
            href={process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL || "/billing/portal"}
            className="mt-4 inline-flex rounded-lg bg-[var(--color-bg-secondary)] px-4 py-2 text-sm font-medium"
          >
            Open Stripe Customer Portal
          </a>
        ) : (
          <Button className="mt-4">Upgrade to Premium</Button>
        )}
      </Card>

      <Card>
        <h2 className="text-xl font-semibold">Change password</h2>
        <form className="mt-4 space-y-4" onSubmit={handlePasswordSubmit}>
          <Input
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Input
            label="New password"
            type="password"
            helperText="Minimum 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <Input
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          <Button type="submit" loading={passwordSaving}>
            Update password
          </Button>
        </form>
      </Card>

      {message && <p className="text-sm text-green-600 dark:text-green-300">{message}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
    </div>
  );
}
