"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImportStatus } from "@/generated/prisma/enums";

type Status = (typeof ImportStatus)[keyof typeof ImportStatus];

interface ImportLog {
  id: string;
  senderEmail: string;
  subject: string | null;
  status: Status;
  receivedAt: string;
  errorMessage: string | null;
}

interface LogsResponse {
  items: ImportLog[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

function statusBadgeVariant(status: Status): "default" | "success" | "warning" | "primary" {
  if (status === ImportStatus.PROCESSED) return "success";
  if (status === ImportStatus.FAILED) return "warning";
  if (status === ImportStatus.PENDING) return "primary";
  return "default";
}

export default function AdminImportLogsPage() {
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (filter !== "all") {
        params.set("status", filter);
      }

      const response = await fetch(`/api/admin/import-logs?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as LogsResponse & { error?: string };

      if (!response.ok) {
        setError(data.error || "Failed to load import logs.");
        return;
      }

      setLogs(data.items);
      setTotalPages(data.pagination.totalPages);
    } catch {
      setError("Failed to load import logs.");
    } finally {
      setLoading(false);
    }
  }, [filter, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [autoRefresh, load]);

  async function retry(id: string) {
    await fetch("/api/admin/import-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Import Logs</h1>

      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Filter status:</label>
            <select
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
              value={filter}
              onChange={(e) => {
                setPage(1);
                setFilter(e.target.value as "all" | Status);
              }}
            >
              <option value="all">All</option>
              {Object.values(ImportStatus).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (15s)
          </label>
        </div>
      </Card>

      <Card>
        {loading ? (
          <p className="text-sm text-[var(--color-text-secondary)]">Loading logs...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-text-secondary)]">
                  <th className="px-2 py-3">Date</th>
                  <th className="px-2 py-3">Sender</th>
                  <th className="px-2 py-3">Subject</th>
                  <th className="px-2 py-3">Status</th>
                  <th className="px-2 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-[var(--color-border)]">
                    <td className="px-2 py-3">{new Date(log.receivedAt).toLocaleString()}</td>
                    <td className="px-2 py-3">{log.senderEmail}</td>
                    <td className="px-2 py-3">
                      <p>{log.subject || "(No subject)"}</p>
                      {log.errorMessage && (
                        <p className="text-xs text-red-600 dark:text-red-300">{log.errorMessage}</p>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <Badge variant={statusBadgeVariant(log.status)}>{log.status}</Badge>
                    </td>
                    <td className="px-2 py-3">
                      {log.status === ImportStatus.FAILED ? (
                        <Button size="sm" onClick={() => retry(log.id)}>
                          Retry
                        </Button>
                      ) : (
                        <span className="text-[var(--color-text-secondary)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && (
              <p className="py-6 text-center text-sm text-[var(--color-text-secondary)]">
                No logs found.
              </p>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <Button
            variant="secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Page {page} of {totalPages}
          </p>
          <Button
            variant="secondary"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      </Card>

      {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
    </div>
  );
}
