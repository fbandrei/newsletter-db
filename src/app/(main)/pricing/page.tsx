"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

type BillingCycle = "monthly" | "yearly";

const MONTHLY_PRICE = 9;
const YEARLY_PRICE = 86; // ~20% discount from $108

const plans = [
  {
    name: "Free",
    role: "FREE" as const,
    price: { monthly: 0, yearly: 0 },
    features: [
      "3 newsletters per week",
      "Basic search",
      "Community ratings",
      "Public comments",
    ],
    limitations: [
      "Limited reading access",
      "Standard notifications",
      "Ads supported",
    ],
  },
  {
    name: "Premium",
    role: "PREMIUM" as const,
    price: { monthly: MONTHLY_PRICE, yearly: YEARLY_PRICE },
    features: [
      "Unlimited reading",
      "Advanced filters & search",
      "Priority notifications",
      "No ads",
      "AI-powered summaries",
      "Export & bookmarks",
      "Early access to features",
    ],
    limitations: [],
  },
];

export default function PricingPage() {
  const { data: session } = useSession();
  const [billing, setBilling] = useState<BillingCycle>("monthly");

  const handleCheckout = async (plan: "FREE" | "PREMIUM") => {
    if (plan === "FREE") return;
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billing }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error("Checkout error:", err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 py-4">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold text-[var(--color-text)]">
          Simple, transparent pricing
        </h1>
        <p className="text-[var(--color-text-secondary)] max-w-lg mx-auto">
          Start for free, upgrade when you need more. Cancel anytime.
        </p>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setBilling("monthly")}
          className={cn(
            "text-sm font-medium transition-colors",
            billing === "monthly"
              ? "text-[var(--color-text)]"
              : "text-[var(--color-text-secondary)]"
          )}
        >
          Monthly
        </button>
        <button
          onClick={() =>
            setBilling(billing === "monthly" ? "yearly" : "monthly")
          }
          className="relative inline-flex h-6 w-11 items-center rounded-full bg-[var(--color-border)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          role="switch"
          aria-checked={billing === "yearly"}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
              billing === "yearly" ? "translate-x-6" : "translate-x-1"
            )}
          />
        </button>
        <button
          onClick={() => setBilling("yearly")}
          className={cn(
            "text-sm font-medium transition-colors",
            billing === "yearly"
              ? "text-[var(--color-text)]"
              : "text-[var(--color-text-secondary)]"
          )}
        >
          Yearly
        </button>
        {billing === "yearly" && (
          <Badge variant="success">Save 20%</Badge>
        )}
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {plans.map((plan) => {
          const isCurrentPlan =
            session?.user?.role === plan.role ||
            (!session && plan.role === "FREE");
          const price = plan.price[billing];

          return (
            <Card
              key={plan.name}
              className={cn(
                "relative flex flex-col p-6",
                plan.role === "PREMIUM" &&
                  "border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]"
              )}
            >
              {plan.role === "PREMIUM" && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="primary">Most Popular</Badge>
                </div>
              )}

              <div className="space-y-4 flex-1">
                <div>
                  <h2 className="text-xl font-bold text-[var(--color-text)]">
                    {plan.name}
                  </h2>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-[var(--color-text)]">
                      ${price}
                    </span>
                    {price > 0 && (
                      <span className="text-sm text-[var(--color-text-secondary)]">
                        /{billing === "monthly" ? "mo" : "yr"}
                      </span>
                    )}
                    {price === 0 && (
                      <span className="text-sm text-[var(--color-text-secondary)]">
                        forever
                      </span>
                    )}
                  </div>
                </div>

                <ul className="space-y-2.5">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-[var(--color-text)]"
                    >
                      <svg
                        className="h-5 w-5 text-[var(--color-success)] shrink-0"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {feature}
                    </li>
                  ))}
                  {plan.limitations.map((limit) => (
                    <li
                      key={limit}
                      className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]"
                    >
                      <svg
                        className="h-5 w-5 text-[var(--color-text-secondary)] shrink-0"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {limit}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6">
                {isCurrentPlan ? (
                  <Button variant="secondary" fullWidth disabled>
                    Current Plan
                  </Button>
                ) : plan.role === "FREE" ? (
                  <Link href="/sign-up">
                    <Button variant="secondary" fullWidth>
                      Get Started
                    </Button>
                  </Link>
                ) : (
                  <Button
                    fullWidth
                    onClick={() => handleCheckout(plan.role)}
                  >
                    Upgrade to Premium
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* FAQ or reassurance */}
      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        All plans include access to community features. Premium subscriptions
        can be cancelled anytime from your{" "}
        <Link
          href="/settings/profile"
          className="text-[var(--color-primary)] hover:underline"
        >
          account settings
        </Link>
        .
      </p>
    </div>
  );
}
