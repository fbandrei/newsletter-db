"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { formatDistanceToNow } from "date-fns";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/loading";
import { cn } from "@/lib/utils/cn";

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  parentId: string | null;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
  replies?: Comment[];
}

interface CommentSectionProps {
  newsletterId: string;
}

export function CommentSection({ newsletterId }: CommentSectionProps) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/newsletters/${newsletterId}/comments`);
      if (!res.ok) throw new Error("Failed to load comments");
      const data: Comment[] = await res.json();
      setComments(buildTree(data));
    } catch {
      setError("Could not load comments.");
    } finally {
      setLoading(false);
    }
  }, [newsletterId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (parentId?: string, text?: string) => {
    const content = text ?? body;
    if (!content.trim() || !session) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/newsletters/${newsletterId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: content.trim(), parentId: parentId ?? null }),
      });
      if (!res.ok) throw new Error("Failed to post comment");
      if (!parentId) setBody("");
      await fetchComments();
    } catch {
      setError("Failed to post comment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const res = await fetch(
        `/api/newsletters/${newsletterId}/comments?commentId=${commentId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete");
      await fetchComments();
    } catch {
      setError("Failed to delete comment.");
    }
  };

  const handleEdit = async (commentId: string, newBody: string) => {
    try {
      const res = await fetch(`/api/newsletters/${newsletterId}/comments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, body: newBody }),
      });
      if (!res.ok) throw new Error("Failed to update");
      await fetchComments();
    } catch {
      setError("Failed to update comment.");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-semibold text-[var(--color-text)]">
        Comments ({flatCount(comments)})
      </h2>

      {/* Comment form */}
      {session ? (
        <div className="flex gap-3">
          <Avatar
            src={session.user.image}
            name={session.user.name ?? "User"}
            size="sm"
          />
          <div className="flex-1 space-y-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share your thoughts…"
              rows={3}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent resize-none"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => handleSubmit()}
                disabled={!body.trim() || submitting}
                loading={submitting}
              >
                Post Comment
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-text-secondary)] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3">
          <a href="/sign-in" className="text-[var(--color-primary)] font-medium hover:underline">
            Sign in
          </a>{" "}
          to join the conversation.
        </p>
      )}

      {error && (
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
      )}

      {/* Comments list */}
      {comments.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)] py-4 text-center">
          No comments yet. Be the first to share your thoughts!
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={session?.user?.id}
              onReply={(parentId, text) => handleSubmit(parentId, text)}
              onDelete={handleDelete}
              onEdit={handleEdit}
              submitting={submitting}
              depth={0}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── CommentItem ───────────────────────────────────────────────────────────

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  onReply: (parentId: string, text: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, body: string) => void;
  submitting: boolean;
  depth: number;
}

function CommentItem({
  comment,
  currentUserId,
  onReply,
  onDelete,
  onEdit,
  submitting,
  depth,
}: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.body);
  const isOwner = currentUserId === comment.user.id;

  const handleReplySubmit = () => {
    if (!replyText.trim()) return;
    onReply(comment.id, replyText);
    setReplyText("");
    setShowReplyForm(false);
  };

  const handleEditSubmit = () => {
    if (!editText.trim()) return;
    onEdit(comment.id, editText.trim());
    setEditing(false);
  };

  return (
    <div className={cn("flex gap-3", depth > 0 && "ml-8 pt-3")}>
      <Avatar
        src={comment.user.image}
        name={comment.user.name ?? "User"}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--color-text)]">
            {comment.user.name ?? "Anonymous"}
          </span>
          <time className="text-xs text-[var(--color-text-secondary)]">
            {formatDistanceToNow(new Date(comment.createdAt), {
              addSuffix: true,
            })}
          </time>
          {comment.createdAt !== comment.updatedAt && (
            <span className="text-xs text-[var(--color-text-secondary)]">
              (edited)
            </span>
          )}
        </div>

        {editing ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleEditSubmit}>
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setEditText(comment.body);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-sm text-[var(--color-text)] whitespace-pre-wrap">
            {comment.body}
          </p>
        )}

        {/* Actions */}
        {!editing && (
          <div className="mt-1.5 flex items-center gap-3">
            {currentUserId && depth < 3 && (
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
              >
                Reply
              </button>
            )}
            {isOwner && (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(comment.id)}
                  className="text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] transition-colors"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}

        {/* Reply form */}
        {showReplyForm && (
          <div className="mt-3 space-y-2">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply…"
              rows={2}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleReplySubmit}
                disabled={!replyText.trim() || submitting}
                loading={submitting}
              >
                Reply
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowReplyForm(false);
                  setReplyText("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Nested replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="space-y-0 border-l border-[var(--color-border)]">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                onReply={onReply}
                onDelete={onDelete}
                onEdit={onEdit}
                submitting={submitting}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildTree(comments: Comment[]): Comment[] {
  const map = new Map<string, Comment>();
  const roots: Comment[] = [];

  for (const c of comments) {
    map.set(c.id, { ...c, replies: [] });
  }

  for (const c of comments) {
    const node = map.get(c.id)!;
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.replies!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function flatCount(comments: Comment[]): number {
  let count = 0;
  for (const c of comments) {
    count += 1;
    if (c.replies) count += flatCount(c.replies);
  }
  return count;
}
