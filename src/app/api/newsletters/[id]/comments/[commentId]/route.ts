import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";

const MAX_COMMENT_LENGTH = 5000;

async function findDescendantCommentIds(rootId: string) {
  const ids: string[] = [];
  let queue = [rootId];

  while (queue.length) {
    const children = await prisma.comment.findMany({
      where: { parentId: { in: queue } },
      select: { id: true },
    });

    const childIds = children.map((comment) => comment.id);
    if (!childIds.length) break;

    ids.push(...childIds);
    queue = childIds;
  }

  return ids;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, commentId } = await params;
    const payload = await req.json();
    const body = String(payload?.body || "").trim();

    if (!body) {
      return NextResponse.json({ error: "Comment body is required" }, { status: 400 });
    }

    if (body.length > MAX_COMMENT_LENGTH) {
      return NextResponse.json(
        { error: `Comment body must be <= ${MAX_COMMENT_LENGTH} characters` },
        { status: 400 },
      );
    }

    const comment = await prisma.comment.findFirst({
      where: {
        id: commentId,
        newsletterId: id,
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const canEdit = comment.userId === session.user.id || session.user.role === "ADMIN";

    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updatedComment = await prisma.comment.update({
      where: { id: comment.id },
      data: { body },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json({ comment: updatedComment });
  } catch (error) {
    console.error("Failed to update comment", error);
    return NextResponse.json({ error: "Failed to update comment" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, commentId } = await params;

    const comment = await prisma.comment.findFirst({
      where: {
        id: commentId,
        newsletterId: id,
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const canDelete = comment.userId === session.user.id || session.user.role === "ADMIN";

    if (!canDelete) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const descendants = await findDescendantCommentIds(comment.id);
    const idsToDelete = [comment.id, ...descendants];

    await prisma.comment.deleteMany({
      where: {
        id: {
          in: idsToDelete,
        },
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete comment", error);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}
