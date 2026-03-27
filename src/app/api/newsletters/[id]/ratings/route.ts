import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";

function toAggregateResponse(aggregate: {
  _avg: { score: number | null };
  _count: { _all: number };
}) {
  return {
    average: Number(aggregate._avg.score ?? 0),
    count: aggregate._count._all,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await auth();

    const [aggregate, userRating] = await Promise.all([
      prisma.rating.aggregate({
        where: { newsletterId: id },
        _avg: { score: true },
        _count: { _all: true },
      }),
      session?.user?.id
        ? prisma.rating.findUnique({
            where: {
              userId_newsletterId: {
                userId: session.user.id,
                newsletterId: id,
              },
            },
            select: { score: true },
          })
        : Promise.resolve(null),
    ]);

    return NextResponse.json({
      ...toAggregateResponse(aggregate),
      userRating: userRating?.score ?? null,
    });
  } catch (error) {
    console.error("Failed to fetch ratings", error);
    return NextResponse.json({ error: "Failed to fetch ratings" }, { status: 500 });
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
    const score = Number(payload?.score);

    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return NextResponse.json(
        { error: "score must be an integer between 1 and 5" },
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

    await prisma.rating.upsert({
      where: {
        userId_newsletterId: {
          userId: session.user.id,
          newsletterId: id,
        },
      },
      create: {
        userId: session.user.id,
        newsletterId: id,
        score,
      },
      update: {
        score,
      },
    });

    const aggregate = await prisma.rating.aggregate({
      where: { newsletterId: id },
      _avg: { score: true },
      _count: { _all: true },
    });

    return NextResponse.json({
      ...toAggregateResponse(aggregate),
      userRating: score,
    });
  } catch (error) {
    console.error("Failed to submit rating", error);
    return NextResponse.json({ error: "Failed to submit rating" }, { status: 500 });
  }
}
