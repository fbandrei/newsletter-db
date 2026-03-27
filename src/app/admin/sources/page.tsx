"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type FilterType = "all" | "approved" | "pending";

interface SourceRow {
  id: string;
  name: string;
  senderEmail: string;
  isApproved: boolean;
  newsletterCount: number;
  lastReceived: string | null;
  description: string | null;
  category: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
}

export default function AdminSourcesPage() {
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSources(filter);
  }, [filter]);

  async function loadSources(currentFilter: FilterType) {
    setLoading(true);
    setError(null);

    try {
      const query =
        currentFilter === "all"
          ? ""
          : `?isApproved=${currentFilter === "approved" ? "true" : "false"}`;
      const response = await fetch(`/api/admin/sources${query}`, { cache: "no-store" });
      const data = (await response.json()) as { sources?: SourceRow[]; error?: string };

      if (!response.ok) {
        setError(data.error || "Failed to load sources.");
        return;
      }

      setSources(data.sources || []);
      setSelected({});
    } catch {
      setError("Failed to load sources.");
    } finally {
      setLoading(false);
    }
  }

  function toggleSelection(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const selectedIds = useMemo(
    () =>
      Object.entries(selected)
        .filter(([, isSelected]) => isSelected)
        .map(([id]) => id),
    [selected],
  );

  async function bulkApprove() {
    setError(null);
    setMessage(null);

    try {
      await Promise.all(
        selectedIds.map((id) =>
          fetch("/api/admin/sources", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, action: "approve" }),
          }),
        ),
      );

      setMessage(`Approved ${selectedIds.length} source(s).`);
      loadSources(filter);
    } catch {
      setError("Failed to bulk approve selected sources.");
    }
  }

  async function approveSource(id: string) {
    await fetch("/api/admin/sources", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "approve" }),
    });
    loadSources(filter);
  }

  async function deleteSource(id: string) {
    await fetch("/api/admin/sources", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadSources(filter);
  }

  async function editSource(id: string, currentName: string, currentEmail: string) {
    const name = window.prompt("Source name", currentName);
    if (!name) return;
    const senderEmail = window.prompt("Source email", currentEmail);
    if (!senderEmail) return;

    await fetch("/api/admin/sources", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "edit", name, senderEmail }),
    });

    loadSources(filter);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Sources Management</h1>

      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Filter:</label>
            <select
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterType)}
            >
              <option value="all">All</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <Button onClick={bulkApprove} disabled={selectedIds.length === 0}>
            Bulk approve ({selectedIds.length})
          </Button>
        </div>
      </Card>

      <Card>
        {loading ? (
          <p className="text-sm text-[var(--color-text-secondary)]">Loading sources...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-text-secondary)]">
                  <th className="px-2 py-3">
                    <input
                      type="checkbox"
                      checked={sources.length > 0 && selectedIds.length === sources.length}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const updated: Record<string, boolean> = {};
                        sources.forEach((source) => {
                          updated[source.id] = checked;
                        });
                        setSelected(updated);
                      }}
                    />
                  </th>
                  <th className="px-2 py-3">Name</th>
                  <th className="px-2 py-3">Email</th>
                  <th className="px-2 py-3">Status</th>
                  <th className="px-2 py-3">Newsletter count</th>
                  <th className="px-2 py-3">Last received</th>
                  <th className="px-2 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr key={source.id} className="border-b border-[var(--color-border)]">
                    <td className="px-2 py-3">
                      <input
                        type="checkbox"
                        checked={!!selected[source.id]}
                        onChange={() => toggleSelection(source.id)}
                      />
                    </td>
                    <td className="px-2 py-3 font-medium">{source.name}</td>
                    <td className="px-2 py-3">{source.senderEmail}</td>
                    <td className="px-2 py-3">
                      {source.isApproved ? (
                        <Badge variant="success">approved</Badge>
                      ) : (
                        <Badge variant="warning">pending</Badge>
                      )}
                    </td>
                    <td className="px-2 py-3">{source.newsletterCount}</td>
                    <td className="px-2 py-3">
                      {source.lastReceived ? new Date(source.lastReceived).toLocaleString() : "—"}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-2">
                        {!source.isApproved && (
                          <Button size="sm" onClick={() => approveSource(source.id)}>
                            Approve
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => editSource(source.id, source.name, source.senderEmail)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => deleteSource(source.id)}
                        >
                          Reject/Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sources.length === 0 && (
              <p className="py-6 text-center text-sm text-[var(--color-text-secondary)]">
                No sources found.
              </p>
            )}
          </div>
        )}
      </Card>

      {message && <p className="text-sm text-green-600 dark:text-green-300">{message}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
    </div>
  );
}
