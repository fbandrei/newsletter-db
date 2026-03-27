import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

const MAX_LIMIT = 100;

type SortOption = "newest" | "rated" | "commented";

function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(Number.parseInt(searchParams.get("page") || "1", 10) || 1, 1);
  const limit = Math.min(
    Math.max(Number.parseInt(searchParams.get("limit") || "20", 10) || 20, 1),
    MAX_LIMIT,
  );

  return { page, limit, skip: (page - 1) * limit };
}

function avgRating(scores: Array<{ score: number }>) {
  if (!scores.length) return 0;
  return scores.reduce((acc, item) => acc + item.score, 0) / scores.length;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const sort = (searchParams.get("sort") || "newest") as SortOption;
    const tags = searchParams
      .get("tags")
      ?.split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const sourceId = searchParams.get("sourceId");
    const search = searchParams.get("q")?.trim();

    const where = {
      isProcessed: true,
      ...(tags?.length
        ? {
            tags: {
              some: {
                tag: {
                  slug: { in: tags },
                },
              },
            },
          }
        : {}),
      ...(sourceId ? { sourceId } : {}),
      ...(search
        ? {
            OR: [
              { subject: { contains: search, mode: "insensitive" as const } },
              { summary: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    if (sort === "rated") {
      const ratedNewsletters = await prisma.newsletter.findMany({
        where,
        select: {
          id: true,
          sourceId: true,
          subject: true,
          summary: true,
          publishedAt: true,
          importedAt: true,
          source: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
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
          ratings: {
            select: {
              score: true,
            },
          },
        },
      });

      const sorted = ratedNewsletters
        .map((newsletter) => {
          const averageRating = avgRating(newsletter.ratings);
          return {
            ...newsletter,
            averageRating,
            tags: newsletter.tags.map((item) => item.tag),
            ratings: undefined,
          };
        })
        .sort((a, b) => {
          if (b.averageRating !== a.averageRating) {
            return b.averageRating - a.averageRating;
          }

          return (b.publishedAt?.getTime() || 0) - (a.publishedAt?.getTime() || 0);
        });

      const totalCount = sorted.length;
      const newsletters = sorted.slice(skip, skip + limit);

      return NextResponse.json({
        newsletters,
        totalCount,
        page,
        totalPages: Math.max(1, Math.ceil(totalCount / limit)),
      });
    }

    const orderBy =
      sort === "commented"
        ? [{ comments: { _count: "desc" as const } }, { publishedAt: "desc" as const }]
        : [{ publishedAt: "desc" as const }];

    const [newsletters, totalCount] = await Promise.all([
      prisma.newsletter.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          source: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
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
      }),
      prisma.newsletter.count({ where }),
    ]);

    const averages = await prisma.rating.groupBy({
      by: ["newsletterId"],
      where: {
        newsletterId: {
          in: newsletters.map((newsletter) => newsletter.id),
        },
      },
      _avg: {
        score: true,
      },
    });

    const averageMap = new Map(
      averages.map((item) => [item.newsletterId, Number(item._avg.score ?? 0)]),
    );

    return NextResponse.json({
      newsletters: newsletters.map((newsletter) => ({
        ...newsletter,
        averageRating: averageMap.get(newsletter.id) ?? 0,
        tags: newsletter.tags.map((item) => item.tag),
      })),
      totalCount,
      page,
      totalPages: Math.max(1, Math.ceil(totalCount / limit)),
    });
  } catch (error) {
    console.error("Failed to fetch newsletters", error);
    return NextResponse.json({ error: "Failed to fetch newsletters" }, { status: 500 });
  }
}
