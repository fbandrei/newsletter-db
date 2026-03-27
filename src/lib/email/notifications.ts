import prisma from "@/lib/db";
import { NotificationType } from "@/generated/prisma/enums";

export async function notifyFavoriteSubscribers(
  newsletterId: string,
  sourceId: string
): Promise<{ notified: number }> {
  const newsletter = await prisma.newsletter.findUnique({
    where: { id: newsletterId },
    select: { subject: true, source: { select: { name: true } } },
  });

  if (!newsletter) return { notified: 0 };

  // Find all users who favorited this source and have notifications enabled
  const favorites = await prisma.userFavorite.findMany({
    where: {
      sourceId,
      notificationPref: { not: "OFF" },
    },
    select: {
      userId: true,
      notificationPref: true,
      user: { select: { email: true } },
    },
  });

  if (favorites.length === 0) return { notified: 0 };

  const message = `New newsletter from ${newsletter.source.name}: "${newsletter.subject}"`;

  // Batch-create notifications for all subscribers
  const instantUsers: string[] = [];
  const notificationData = favorites.map((fav) => {
    if (fav.notificationPref === "INSTANT") {
      instantUsers.push(fav.userId);
    }

    return {
      userId: fav.userId,
      type: "NEW_NEWSLETTER" as NotificationType,
      message,
      newsletterId,
    };
  });

  await prisma.notification.createMany({ data: notificationData });

  // TODO: For INSTANT preference users, send email via Resend
  // const instantEmails = favorites
  //   .filter((f) => f.notificationPref === "INSTANT")
  //   .map((f) => f.user.email);
  //
  // if (instantEmails.length > 0) {
  //   await resend.emails.send({
  //     from: "notifications@newsletter-db.com",
  //     to: instantEmails,
  //     subject: message,
  //     html: `<p>${message}</p>`,
  //   });
  // }

  return { notified: favorites.length };
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  message: string,
  newsletterId?: string
): Promise<string> {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      message,
      ...(newsletterId && { newsletterId }),
    },
  });

  return notification.id;
}
