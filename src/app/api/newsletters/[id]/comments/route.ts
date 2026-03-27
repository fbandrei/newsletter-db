import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";

const MAX_LIMIT = 100;
const MAX_COMMENT_LENGTH = 5000;

function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(Number.parseInt(searchParams.get("page") || "1", 10) || 1, 1);
  const limit = Math.min(
    Math.max(Number.parseInt(searchParams.get("limit") || "20", 10) || 20, 1),
    MAX_LIMIT,
  );

  return { page, limit, skip: (page - 1) * limit };
}

const replyInclude = {
  user: {
    select: {
      id: true,
      name: true,
      image: true,
    },
  },
  replies: {
    orderBy: { createdAt: "asc" as const },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      replies: {
        orderBy: { createdAt: "asc" as const },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          replies: {
            orderBy: { createdAt: "asc" as const },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
        },
      },
    },
  },
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const { page, limit, skip } = parsePagination(searchParams);

    const [comments, totalCount] = await Promise.all([
      prisma.comment.findMany({
        where: {
          newsletterId: id,
          parentId: null,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: replyInclude,
      }),
      prisma.comment.count({
        where: {
          newsletterId: id,
          parentId: null,
        },
      }),
    ]);

    return NextResponse.json({
      comments,
      totalCount,
      page,
      totalPages: Math.max(1, Math.ceil(totalCount / limit)),
    });
  } catch (error) {
    console.error("Failed to fetch comments", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const payload = await req.json();
    const body = String(payload?.body || "").trim();
    const parentId = payload?.parentId ? String(payload.parentId) : undefined;

    if (!body) {
      return NextResponse.json({ error: "Comment body is required" }, { status: 400 });
    }

    if (body.length > MAX_COMMENT_LENGTH) {
      return NextResponse.json(
        { error: `Comment body must be <= ${MAX_COMMENT_LENGTH} characters` },
        { status: 400 },
      );
    }

    const newsletter = await prisma.newsletter.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!newsletter) {
      return NextResponse.json({ error: "Newsletter not found" }, { status: 404 });
    }

    let parentComment: { id: string; userId: string; newsletterId: string } | null = null;

    if (parentId) {
      parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
        select: {
          id: true,
          userId: true,
          newsletterId: true,
        },
      });

      if (!parentComment || parentComment.newsletterId !== id) {
        return NextResponse.json(
          { error: "Parent comment does not belong to this newsletter" },
          { status: 400 },
        );
      }
    }

    const comment = await prisma.comment.create({
      data: {
        userId: session.user.id,
        newsletterId: id,
        body,
        parentId,
      },
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

    if (parentComment && parentComment.userId !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: parentComment.userId,
          type: "COMMENT_REPLY",
          message: `${session.user.name ?? "Someone"} replied to your comment`,
          newsletterId: id,
        },
      });
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error("Failed to create comment", error);
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
  }
}
