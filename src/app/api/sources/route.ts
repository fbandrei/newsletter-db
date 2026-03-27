import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

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
    const { searchParams } = new URL(req.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const search = searchParams.get("q")?.trim();

    const where = {
      isApproved: true,
      ...(search
        ? {
            name: {
              contains: search,
              mode: "insensitive" as const,
            },
          }
        : {}),
    };

    const [sources, totalCount] = await Promise.all([
      prisma.newsletterSource.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          name: "asc",
        },
        include: {
          _count: {
            select: {
              newsletters: true,
            },
          },
        },
      }),
      prisma.newsletterSource.count({ where }),
    ]);

    return NextResponse.json({
      sources,
      totalCount,
      page,
      totalPages: Math.max(1, Math.ceil(totalCount / limit)),
    });
  } catch (error) {
    console.error("Failed to fetch sources", error);
    return NextResponse.json({ error: "Failed to fetch sources" }, { status: 500 });
  }
}
