import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";

const MAX_LIMIT = 100;

function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(Number.parseInt(searchParams.get("page") || "1", 10) || 1, 1);
  const limit = Math.min(
    Math.max(Number.parseInt(searchParams.get("limit") || "20", 10) || 20, 1),
    MAX_LIMIT,
  );

  return { page, limit, skip: (page - 1) * limit };
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const { page, limit, skip } = parsePagination(searchParams);

    const [notifications, totalCount, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.notification.count({
        where: { userId: session.user.id },
      }),
      prisma.notification.count({
        where: {
          userId: session.user.id,
          isRead: false,
        },
      }),
    ]);

    return NextResponse.json({
      notifications,
      unreadCount,
      totalCount,
      page,
      totalPages: Math.max(1, Math.ceil(totalCount / limit)),
    });
  } catch (error) {
    console.error("Failed to fetch notifications", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json();
    const markAllRead = Boolean(payload?.markAllRead);

    if (markAllRead) {
      const result = await prisma.notification.updateMany({
        where: {
          userId: session.user.id,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });

      return NextResponse.json({ updated: result.count });
    }

    const notificationIds = Array.isArray(payload?.notificationIds)
      ? payload.notificationIds.map((id: unknown) => String(id).trim()).filter(Boolean)
      : null;

    if (!notificationIds?.length) {
      return NextResponse.json(
        { error: "Provide notificationIds[] or markAllRead: true" },
        { status: 400 },
      );
    }

    const result = await prisma.notification.updateMany({
      where: {
        userId: session.user.id,
        id: {
          in: notificationIds,
        },
      },
      data: {
        isRead: true,
      },
    });

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    console.error("Failed to mark notifications as read", error);
    return NextResponse.json(
      { error: "Failed to mark notifications as read" },
      { status: 500 },
    );
  }
}
