import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";

function getWeekStart(now: Date) {
  const date = new Date(now);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await auth();

    const newsletter = await prisma.newsletter.findFirst({
      where: {
        id,
        isProcessed: true,
      },
      include: {
        source: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            websiteUrl: true,
          },
        },
        tags: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        _count: {
          select: {
            comments: true,
            ratings: true,
          },
        },
      },
    });

    if (!newsletter) {
      return NextResponse.json({ error: "Newsletter not found" }, { status: 404 });
    }

    const ratingAggregate = await prisma.rating.aggregate({
      where: { newsletterId: id },
      _avg: { score: true },
      _count: { _all: true },
    });

    let userRating: number | null = null;

    if (session?.user?.id) {
      const existingRead = await prisma.readHistory.findUnique({
        where: {
          userId_newsletterId: {
            userId: session.user.id,
            newsletterId: id,
          },
        },
      });

      if (!existingRead) {
        if (session.user.role === "FREE") {
          const freeLimit = Number.parseInt(
            process.env.FREE_NEWSLETTERS_PER_WEEK || "3",
            10,
          );

          const readsThisWeek = await prisma.readHistory.count({
            where: {
              userId: session.user.id,
              readAt: {
                gte: getWeekStart(new Date()),
              },
            },
          });

          if (readsThisWeek >= freeLimit) {
            return NextResponse.json(
              {
                paywall: true,
                message: "Free weekly newsletter limit reached",
                freeLimit,
                readsThisWeek,
              },
              { status: 402 },
            );
          }
        }

        await prisma.readHistory.create({
          data: {
            userId: session.user.id,
            newsletterId: id,
          },
        });
      }

      const ownRating = await prisma.rating.findUnique({
        where: {
          userId_newsletterId: {
            userId: session.user.id,
            newsletterId: id,
          },
        },
        select: {
          score: true,
        },
      });

      userRating = ownRating?.score ?? null;
    }

    return NextResponse.json({
      newsletter: {
        ...newsletter,
        tags: newsletter.tags.map((item) => item.tag),
      },
      averageRating: Number(ratingAggregate._avg.score ?? 0),
      ratingCount: ratingAggregate._count._all,
      userRating,
    });
  } catch (error) {
    console.error("Failed to fetch newsletter", error);
    return NextResponse.json({ error: "Failed to fetch newsletter" }, { status: 500 });
  }
}
