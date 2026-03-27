import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createCheckoutSession,
  getOrCreateStripeCustomer,
} from "@/lib/stripe/helpers";

function appBaseUrl(req: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json();
    const priceId = String(payload?.priceId || "").trim();

    if (!priceId) {
      return NextResponse.json({ error: "priceId is required" }, { status: 400 });
    }

    const allowedPrices = [process.env.STRIPE_PRICE_MONTHLY, process.env.STRIPE_PRICE_YEARLY].filter(
      Boolean,
    ) as string[];

    if (allowedPrices.length && !allowedPrices.includes(priceId)) {
      return NextResponse.json({ error: "Invalid priceId" }, { status: 400 });
    }

    const customerId = await getOrCreateStripeCustomer({
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
    });

    const baseUrl = appBaseUrl(req);
    const checkoutSession = await createCheckoutSession({
      customerId,
      priceId,
      successUrl: `${baseUrl}/billing?success=true`,
      cancelUrl: `${baseUrl}/billing?canceled=true`,
    });

    if (!checkoutSession.url) {
      return NextResponse.json(
        { error: "Unable to create checkout session" },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Failed to create checkout session", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
