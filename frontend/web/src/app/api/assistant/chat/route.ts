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
      provider TEXT NOT NULL DEFAULT 'local',
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
    "Eres el Asistente Inteligente de RPMS (Radiation Protection Management System), " +
    "la plataforma de gestión del Programa de Protección Radiológica del Hospital Hernán Henríquez Aravena (Temuco, Chile). " +
    "Respondes en español, de forma concisa, clara y profesional. " +
    (moduleLabel ? `El usuario se encuentra actualmente en el módulo: ${moduleLabel}. ` : "") +
    "\n\n" +
    "CONOCIMIENTO DEL SISTEMA:\n" +
    "- Dosimetría: límites DS 3/1985 (Categoría A ≤20 mSv/año, B ≤6 mSv/año), importación planillas CCHEN, historial individual.\n" +
    "- Trabajadores POE: registro, categorías A/B, exámenes médicos anuales obligatorios.\n" +
    "- Residuos Radiactivos: clasificación IAEA GSG-1, cálculo de decay, fichas, rótulos, almacenamiento temporal.\n" +
    "- I-131: administración de dosis, aislamiento, criterio de alta ≤25 μSv/h a 1 metro.\n" +
    "- LINAC/CML: control de calidad AAPM TG-142, comisionamiento, incidentes, mantenimientos.\n" +
    "- Contaminación: límites IAEA/CCHEN por zona, monitoreo de superficies y ambiente.\n" +
    "- Fuentes radiactivas: inventario, prueba de estanqueidad cada 2 años, movimientos IMAR.\n" +
    "- Zonas clasificadas: zona controlada (>6 mSv/año), supervisada (1-6 mSv/año), libre (<1 mSv/año).\n" +
    "- CCHEN: declaración anual de dosis (antes 31/marzo), licencias, inspecciones, formulario F-01.\n" +
    "- Transporte: DS 12/1985 e IAEA SSR-6, conductores autorizados, documentos de despacho.\n" +
    "- Cumplimiento NS-06.0, CAPA, indicadores de desempeño PR, comité PR, auditorías.\n" +
    "\n" +
    "RESTRICCIONES: No tienes acceso directo a la base de datos (no puedes ver registros específicos, " +
    "ni modificar ni crear datos). Nunca indiques que has cambiado información en la base de datos."
  );
}

export async function POST(request: Request) {
  await ensureTable();
  const body: Record<string, unknown> = await request.json().catch(() => ({}));
  const messages: AssistantMessage[] = Array.isArray(body?.messages)
    ? (body.messages as Record<string, unknown>[])
        .filter(
          (m: Record<string, unknown>) =>
            m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
        )
        .map((m: Record<string, unknown>) => ({
          role: m.role as AssistantMessage["role"],
          content: m.content as string,
        }))
    : [];

  const moduleRoute = typeof body?.module === "string" ? body.module : undefined;
  const moduleLabel = getModuleLabel(moduleRoute);

  if (messages.length === 0) {
    return NextResponse.json({ error: "No se recibió ningún mensaje." }, { status: 400 });
  }

  const { rows } = await sql`SELECT * FROM assistant_settings WHERE id = 1`;
  const row: Record<string, unknown> | undefined = rows[0];

  // Si hay API key válida usar el proveedor configurado; si no, agente local (offline).
  const hasApiKey = !!row?.api_key && String(row.api_key).trim().length > 0;
  const providerId = hasApiKey ? String(row?.provider ?? "local") : "local";
  const provider = getProvider(providerId);

  const config = {
    model: String(row?.model ?? ""),
    apiKey: String(row?.api_key ?? ""),
    temperature: row ? Number(row.temperature) : 0.3,
    maxTokens: row ? Number(row.max_tokens) : 800,
    currentModule: moduleRoute,
  };

  try {
    const reply = await provider.send(messages, systemPrompt(moduleLabel), config);
    return NextResponse.json({ reply, provider: provider.id });
  } catch (err: unknown) {
    // Si el proveedor externo falla, hacer fallback al agente local
    if (providerId !== "local") {
      try {
        const { getProvider: gp } = await import("@/lib/assistant/providers");
        const local = gp("local");
        const reply = await local.send(messages, systemPrompt(moduleLabel), config);
        return NextResponse.json({ reply, provider: "local (fallback)" });
      } catch {
        // ignorar
      }
    }
    const errMsg = err instanceof Error ? err.message : "No se pudo obtener una respuesta.";
    return NextResponse.json(
      { error: errMsg },
      { status: 502 }
    );
  }
}
