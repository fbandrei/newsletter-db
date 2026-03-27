import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { ImportStatus } from "@/generated/prisma/enums";

type ImportStatusValue = (typeof ImportStatus)[keyof typeof ImportStatus];

async function ensureAdmin() {
  const session = await auth();
  return !!(session?.user && session.user.role === "ADMIN");
}

export async function GET(req: NextRequest) {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("pageSize") || 20)));

  const statusParam = req.nextUrl.searchParams.get("status") as ImportStatusValue | null;
  const where =
    statusParam && Object.values(ImportStatus).includes(statusParam)
      ? { status: statusParam }
      : undefined;

  const [total, items] = await Promise.all([
    prisma.emailImportLog.count({ where }),
    prisma.emailImportLog.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

export async function POST(req: NextRequest) {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ error: "Log id is required." }, { status: 400 });
    }

    const log = await prisma.emailImportLog.findUnique({ where: { id: body.id } });
    if (!log) {
      return NextResponse.json({ error: "Import log not found." }, { status: 404 });
    }

    const updated = await prisma.emailImportLog.update({
      where: { id: body.id },
      data: {
        status: ImportStatus.PENDING,
        errorMessage: null,
      },
    });

    return NextResponse.json({ success: true, item: updated });
  } catch {
    return NextResponse.json({ error: "Failed to retry import." }, { status: 500 });
  }
}
