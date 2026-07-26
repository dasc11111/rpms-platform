import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS assistant_settings (
      id INT PRIMARY KEY DEFAULT 1,
      provider TEXT NOT NULL DEFAULT 'mock',
      model TEXT NOT NULL DEFAULT '',
      api_key TEXT,
      temperature NUMERIC NOT NULL DEFAULT 0.3,
      max_tokens INT NOT NULL DEFAULT 800,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT assistant_settings_singleton CHECK (id = 1)
    )
  `;
}

function shape(row: any) {
  return {
    provider: row?.provider ?? "mock",
    model: row?.model ?? "",
    temperature: row ? Number(row.temperature) : 0.3,
    maxTokens: row ? Number(row.max_tokens) : 800,
    hasApiKey: Boolean(row?.api_key),
  };
}

export async function GET() {
  await ensureTable();
  const { rows } = await sql`SELECT * FROM assistant_settings WHERE id = 1`;
  return NextResponse.json(shape(rows[0]));
}

export async function POST(request: Request) {
  await ensureTable();
  const body: any = await request.json().catch(() => ({}));
  const provider = String(body?.provider ?? "mock");
  const model = String(body?.model ?? "");
  const apiKey =
    typeof body?.apiKey === "string" && body.apiKey.trim() ? body.apiKey.trim() : null;
  const temperature = Number.isFinite(Number(body?.temperature)) ? Number(body.temperature) : 0.3;
  const maxTokens = Number.isFinite(Number(body?.maxTokens)) ? Number(body.maxTokens) : 800;

  await sql`
    INSERT INTO assistant_settings (id, provider, model, api_key, temperature, max_tokens, updated_at)
    VALUES (1, ${provider}, ${model}, ${apiKey}, ${temperature}, ${maxTokens}, now())
    ON CONFLICT (id) DO UPDATE SET
      provider = EXCLUDED.provider,
      model = EXCLUDED.model,
      api_key = COALESCE(EXCLUDED.api_key, assistant_settings.api_key),
      temperature = EXCLUDED.temperature,
      max_tokens = EXCLUDED.max_tokens,
      updated_at = now()
  `;

  const { rows } = await sql`SELECT * FROM assistant_settings WHERE id = 1`;
  return NextResponse.json(shape(rows[0]));
}
