import { NextResponse } from "next/server";

interface OpenAIModel {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
}

interface OpenAIModelsResponse {
  object: "list";
  data: OpenAIModel[];
}

export async function POST(req: Request) {
  const { apiKey } = await req.json();

  if (!apiKey?.startsWith("sk-")) {
    return NextResponse.json(
      { valid: false, error: "Invalid API key format" },
      { status: 400 },
    );
  }

  try {
    // 1️⃣ Test authentication + quota with a cheap request
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.status === 401) {
      return NextResponse.json(
        { valid: false, error: "Invalid API key" },
        { status: 401 },
      );
    }

    if (response.status === 429) {
      return NextResponse.json(
        {
          valid: false,
          quotaExceeded: true,
          error: "Quota exceeded or rate-limited",
        },
        { status: 429 },
      );
    }

    if (!response.ok) {
      throw new Error("Unexpected OpenAI error");
    }

    const data = (await response.json()) as OpenAIModelsResponse;

    // 2️⃣ Extract useful info
    const models = data.data.map((m) => m.id);

    return NextResponse.json({
      valid: true,
      quotaExceeded: false,
      models,
    });
  } catch (error) {
    return NextResponse.json(
      {
        valid: false,
        error:
          error instanceof Error ? error.message : "Failed to validate API key",
      },
      { status: 500 },
    );
  }
}
