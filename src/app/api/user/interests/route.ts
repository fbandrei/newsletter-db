import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    void req;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const interests = await prisma.userInterest.findMany({
      where: { userId: session.user.id },
      include: {
        tag: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        tag: {
          name: "asc",
        },
      },
    });

    return NextResponse.json({ interests: interests.map((interest) => interest.tag) });
  } catch (error) {
    console.error("Failed to fetch user interests", error);
    return NextResponse.json({ error: "Failed to fetch user interests" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await req.json()) as { tagIds?: unknown };
    if (!Array.isArray(payload.tagIds)) {
      return NextResponse.json({ error: "tagIds must be an array" }, { status: 400 });
    }

    const tagIds = [
      ...new Set(
        payload.tagIds
          .map((id) => String(id).trim())
          .filter((id) => id.length > 0),
      ),
    ];

    const existingTags = tagIds.length
      ? await prisma.tag.findMany({
          where: {
            id: {
              in: tagIds,
            },
          },
          select: { id: true },
        })
      : [];

    if (existingTags.length !== tagIds.length) {
      return NextResponse.json({ error: "One or more tagIds are invalid" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.userInterest.deleteMany({
        where: { userId: session.user.id },
      }),
      ...(tagIds.length
        ? [
            prisma.userInterest.createMany({
              data: tagIds.map((tagId) => ({
                userId: session.user.id,
                tagId,
              })),
            }),
          ]
        : []),
    ]);

    const interests = await prisma.userInterest.findMany({
      where: { userId: session.user.id },
      include: {
        tag: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        tag: {
          name: "asc",
        },
      },
    });

    return NextResponse.json({ interests: interests.map((interest) => interest.tag) });
  } catch (error) {
    console.error("Failed to update user interests", error);
    return NextResponse.json({ error: "Failed to update user interests" }, { status: 500 });
  }
}
