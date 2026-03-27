import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AIProviderType } from "@/generated/prisma/enums";
import { createProvider } from "@/lib/ai/registry";

type ProviderType = (typeof AIProviderType)[keyof typeof AIProviderType];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      provider?: ProviderType;
      apiKey?: string;
      apiEndpoint?: string;
      model?: string;
    };

    if (!body.provider || !body.model) {
      return NextResponse.json(
        { success: false, error: "provider and model are required." },
        { status: 400 },
      );
    }

    const provider = createProvider(body.provider, {
      apiKey: body.apiKey || "",
      apiEndpoint: body.apiEndpoint,
      model: body.model,
    });

    const success = await provider.testConnection();

    if (!success) {
      return NextResponse.json({ success: false, error: "Connection test failed." });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
