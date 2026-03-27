import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/db";
import { notifyFavoriteSubscribers } from "@/lib/email/notifications";

function verifyMailgunSignature(
  timestamp: string,
  token: string,
  signature: string
): boolean {
  const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  if (!signingKey) {
    console.error("MAILGUN_WEBHOOK_SIGNING_KEY is not configured");
    return false;
  }

  const hmac = crypto.createHmac("sha256", signingKey);
  hmac.update(timestamp + token);
  const expectedSignature = hmac.digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 }
    );
  }

  const sender = formData.get("sender") as string | null;
  const recipient = formData.get("recipient") as string | null;
  const subject = formData.get("subject") as string | null;
  const bodyHtml = formData.get("body-html") as string | null;
  const bodyPlain = formData.get("body-plain") as string | null;
  const messageId = formData.get("Message-Id") as string | null;
  const timestamp = formData.get("timestamp") as string | null;
  const token = formData.get("token") as string | null;
  const signature = formData.get("signature") as string | null;

  if (!sender || !subject || !bodyHtml || !timestamp || !token || !signature) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  if (!verifyMailgunSignature(timestamp, token, signature)) {
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 403 }
    );
  }

  // Deduplicate by Message-Id
  const normalizedMessageId = messageId || `${timestamp}-${token}`;
  const existingLog = await prisma.emailImportLog.findUnique({
    where: { mailgunMessageId: normalizedMessageId },
  });

  if (existingLog) {
    return NextResponse.json({ status: "duplicate", id: existingLog.id });
  }

  // Extract sender email address from "Name <email>" format
  const emailMatch = sender.match(/<([^>]+)>/) || [null, sender];
  const senderEmail = (emailMatch[1] || sender).toLowerCase().trim();
  const senderName =
    sender.replace(/<[^>]+>/, "").trim() || senderEmail.split("@")[0];

  // Find or create the newsletter source
  const source = await prisma.newsletterSource.upsert({
    where: { senderEmail },
    update: {},
    create: {
      name: senderName,
      senderEmail,
      isApproved: false,
    },
  });

  // Parse publishedAt from the Date header, falling back to current time
  const dateHeader = formData.get("Date") as string | null;
  let publishedAt = new Date();
  if (dateHeader) {
    const parsed = new Date(dateHeader);
    if (!isNaN(parsed.getTime())) {
      publishedAt = parsed;
    }
  }

  // Create newsletter and import log in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const newsletter = await tx.newsletter.create({
      data: {
        sourceId: source.id,
        subject,
        rawHtml: bodyHtml,
        rawText: bodyPlain,
        publishedAt,
        isProcessed: false,
      },
    });

    const importLog = await tx.emailImportLog.create({
      data: {
        mailgunMessageId: normalizedMessageId,
        senderEmail,
        subject,
        status: "PENDING",
        newsletterId: newsletter.id,
      },
    });

    return { newsletter, importLog };
  });

  // Fire-and-forget notification to favorite subscribers
  notifyFavoriteSubscribers(result.newsletter.id, source.id).catch((err) =>
    console.error("Failed to notify subscribers:", err)
  );

  return NextResponse.json({
    status: "received",
    newsletterId: result.newsletter.id,
    importLogId: result.importLog.id,
  });
}
