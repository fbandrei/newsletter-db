import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";

async function ensureAdmin() {
  const session = await auth();
  return !!(session?.user && session.user.role === "ADMIN");
}

export async function GET(req: NextRequest) {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isApprovedParam = req.nextUrl.searchParams.get("isApproved");
  const isApproved =
    isApprovedParam === null ? undefined : isApprovedParam === "true" ? true : false;

  const sources = await prisma.newsletterSource.findMany({
    where: isApproved === undefined ? undefined : { isApproved },
    include: {
      newsletters: {
        select: { importedAt: true },
        orderBy: { importedAt: "desc" },
        take: 1,
      },
      _count: {
        select: { newsletters: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    sources: sources.map((source) => ({
      id: source.id,
      name: source.name,
      senderEmail: source.senderEmail,
      isApproved: source.isApproved,
      newsletterCount: source._count.newsletters,
      lastReceived: source.newsletters[0]?.importedAt ?? null,
      description: source.description,
      category: source.category,
      websiteUrl: source.websiteUrl,
      logoUrl: source.logoUrl,
    })),
  });
}

export async function PUT(req: NextRequest) {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      id?: string;
      action?: "approve" | "edit";
      name?: string;
      senderEmail?: string;
      description?: string | null;
      category?: string | null;
      websiteUrl?: string | null;
      logoUrl?: string | null;
      isApproved?: boolean;
    };

    if (!body.id) {
      return NextResponse.json({ error: "Source id is required." }, { status: 400 });
    }

    const data =
      body.action === "approve"
        ? { isApproved: true }
        : {
            name: body.name,
            senderEmail: body.senderEmail,
            description: body.description,
            category: body.category,
            websiteUrl: body.websiteUrl,
            logoUrl: body.logoUrl,
            isApproved: body.isApproved,
          };

    const updated = await prisma.newsletterSource.update({
      where: { id: body.id },
      data,
    });

    return NextResponse.json({ source: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update source." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as { id?: string; deleteNewsletters?: boolean };
    if (!body.id) {
      return NextResponse.json({ error: "Source id is required." }, { status: 400 });
    }

    if (body.deleteNewsletters) {
      await prisma.newsletter.deleteMany({ where: { sourceId: body.id } });
    }

    await prisma.newsletterSource.delete({ where: { id: body.id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete source." }, { status: 500 });
  }
}
