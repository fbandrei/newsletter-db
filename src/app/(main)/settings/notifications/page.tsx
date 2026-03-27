"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NotificationPreference } from "@/generated/prisma/enums";

type Preference = (typeof NotificationPreference)[keyof typeof NotificationPreference];

interface FavoriteSource {
  id: string;
  sourceId: string;
  sourceName: string;
  notificationPref: Preference;
}

interface FavoritesResponse {
  favorites: FavoriteSource[];
  defaultPreference?: Preference;
}

const preferenceOptions: Preference[] = [
  NotificationPreference.INSTANT,
  NotificationPreference.DAILY_DIGEST,
  NotificationPreference.OFF,
];

export default function NotificationSettingsPage() {
  const [favorites, setFavorites] = useState<FavoriteSource[]>([]);
  const [defaultPreference, setDefaultPreference] = useState<Preference>(
    NotificationPreference.INSTANT,
  );
  const [isDigestDefault, setIsDigestDefault] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/user/favorites", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load favorites");
        const data = (await response.json()) as FavoritesResponse;
        if (!active) return;
        setFavorites(data.favorites || []);
        const pref = data.defaultPreference || NotificationPreference.INSTANT;
        setDefaultPreference(pref);
        setIsDigestDefault(pref === NotificationPreference.DAILY_DIGEST);
      } catch {
        if (!active) return;
        setError("Unable to load notification settings.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const hasFavorites = useMemo(() => favorites.length > 0, [favorites]);

  function updateFavoritePreference(id: string, value: Preference) {
    setFavorites((prev) =>
      prev.map((favorite) =>
        favorite.id === id ? { ...favorite, notificationPref: value } : favorite,
      ),
    );
  }

  async function savePreferences() {
    setSaving(true);
    setError(null);
    setMessage(null);

    const effectiveDefault = isDigestDefault
      ? NotificationPreference.DAILY_DIGEST
      : NotificationPreference.INSTANT;

    try {
      const response = await fetch("/api/user/favorites", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultPreference: effectiveDefault,
          favorites: favorites.map((favorite) => ({
            id: favorite.id,
            notificationPref: favorite.notificationPref,
          })),
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Failed to save preferences.");
        return;
      }

      setDefaultPreference(effectiveDefault);
      setMessage("Notification preferences saved.");
    } catch {
      setError("Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--color-text-secondary)]">Loading notification settings...</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-xl font-semibold">Notification preferences</h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Choose how you want to be notified for each favorited newsletter source.
        </p>

        <label className="mt-4 inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isDigestDefault}
            onChange={(e) => setIsDigestDefault(e.target.checked)}
          />
          Use Daily Digest as global default
        </label>

        {!hasFavorites ? (
          <p className="mt-5 text-sm text-[var(--color-text-secondary)]">
            You have no favorited sources yet.
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            {favorites.map((favorite) => (
              <div
                key={favorite.id}
                className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-sm font-medium">{favorite.sourceName}</p>
                <select
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
                  value={favorite.notificationPref}
                  onChange={(e) =>
                    updateFavoritePreference(favorite.id, e.target.value as Preference)
                  }
                >
                  {preferenceOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        <Button onClick={savePreferences} className="mt-5" loading={saving}>
          Save settings
        </Button>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold">About notification types</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[var(--color-text-secondary)]">
          <li>
            <strong>INSTANT</strong>: Receive a notification as soon as a new newsletter is imported.
          </li>
          <li>
            <strong>DAILY_DIGEST</strong>: One summarized notification per day.
          </li>
          <li>
            <strong>OFF</strong>: Disable notifications for that source.
          </li>
        </ul>
        <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
          Current default: <strong>{defaultPreference}</strong>
        </p>
      </Card>

      {message && <p className="text-sm text-green-600 dark:text-green-300">{message}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
    </div>
  );
}
