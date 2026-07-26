import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getProvider } from "@/lib/assistant/providers";
import { getModuleLabel } from "@/lib/assistant/modules";
import type { AssistantMessage } from "@/lib/assistant/types";

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

function systemPrompt(moduleLabel?: string) {
  return (
    "Eres el Asistente Inteligente de RPMS (Radiation Protection Management System). " +
    "Respondes de forma breve, clara y profesional, en español, ayudando al usuario a resolver dudas sobre el uso de la plataforma. " +
    (moduleLabel ? `El usuario se encuentra actualmente en el módulo: ${moduleLabel}. ` : "") +
    "Aún no tienes acceso directo a los datos internos de la plataforma (trabajadores, dosimetría, equipos, etc.), por lo que no debes afirmar que puedes consultar, modificar o crear registros. " +
    "Nunca debes indicar que has modificado información de la base de datos: no tienes esa capacidad y, si en el futuro se habilita, siempre requerirá confirmación explícita del usuario."
  );
}

export async function POST(request: Request) {
  await ensureTable();
  const body: any = await request.json().catch(() => ({}));
  const messages: AssistantMessage[] = Array.isArray(body?.messages)
    ? body.messages
        .filter(
          (m: any) =>
            m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
        )
        .map((m: any) => ({ role: m.role, content: m.content }))
    : [];
  const moduleLabel = getModuleLabel(typeof body?.module === "string" ? body.module : undefined);

  if (messages.length === 0) {
    return NextResponse.json({ error: "No se recibió ningún mensaje." }, { status: 400 });
  }

  const { rows } = await sql`SELECT * FROM assistant_settings WHERE id = 1`;
  const row: any = rows[0];

  const providerId = row?.api_key ? String(row.provider ?? "mock") : "mock";
  const provider = getProvider(providerId);

  const config = {
    model: String(row?.model ?? ""),
    apiKey: String(row?.api_key ?? ""),
    temperature: row ? Number(row.temperature) : 0.3,
    maxTokens: row ? Number(row.max_tokens) : 800,
  };

  try {
    const reply = await provider.send(messages, systemPrompt(moduleLabel), config);
    return NextResponse.json({ reply, provider: provider.id });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "No se pudo obtener una respuesta del asistente." },
      { status: 502 }
    );
  }
}
