import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getModuleLabel } from "@/lib/assistant/modules";
import type { AssistantMessage } from "@/lib/assistant/types";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// DB helpers — devuelven datos reales del sistema para el contexto del asistente
// ---------------------------------------------------------------------------

async function getSystemSnapshot() {
  try {
    const [workers, dosimetry, notReturned] = await Promise.all([
      sql`SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE status = 'active') AS active,
             COUNT(*) FILTER (WHERE status = 'inactive') AS inactive,
             COUNT(*) FILTER (WHERE category = 'A') AS cat_a,
             COUNT(*) FILTER (WHERE category = 'B') AS cat_b
          FROM workers`.catch(() => ({ rows: [] })),

      sql`SELECT COUNT(DISTINCT rut_trabajador) AS total_workers_with_doses,
             COUNT(*) AS total_records,
             MAX(year) AS latest_year,
             COUNT(*) FILTER (WHERE dose_mSv > 20) AS over_limit_a,
             COUNT(*) FILTER (WHERE dose_mSv > 6 AND dose_mSv <= 20) AS near_limit_b
          FROM dosimetry`.catch(() => ({ rows: [] })),

      sql`SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE extraviado = true) AS extraviados
          FROM dosimetry_tracking
          WHERE returned = false`.catch(() => ({ rows: [] })),
    ]);

    return {
      workers: workers.rows[0] || {},
      dosimetry: dosimetry.rows[0] || {},
      notReturned: notReturned.rows[0] || {},
    };
  } catch {
    return null;
  }
}

async function queryWorkers(query: string) {
  try {
    const name = `%${query.toLowerCase()}%`;
    const { rows } = await sql`
      SELECT rut, name, category, status, service, email
      FROM workers
      WHERE LOWER(name) LIKE ${name} OR rut LIKE ${name}
      LIMIT 5
    `;
    return rows;
  } catch {
    return [];
  }
}

async function getDosimetryStats(year?: number) {
  try {
    const targetYear = year || new Date().getFullYear();
    const { rows } = await sql`
      SELECT w.name, w.category, w.service,
             SUM(d.dose_mSv) AS total_dose,
             MAX(d.dose_mSv) AS max_quarterly_dose
      FROM dosimetry d
      JOIN workers w ON w.rut = d.rut_trabajador
      WHERE d.year = ${targetYear}
      GROUP BY w.rut, w.name, w.category, w.service
      ORDER BY total_dose DESC
      LIMIT 10
    `;
    return { year: targetYear, workers: rows };
  } catch {
    return null;
  }
}

async function getNotReturnedDosimeters(extraviado?: boolean) {
  try {
    const query = extraviado !== undefined
      ? sql`SELECT d.nombrepart, d.dcto, d.dosimetro, d.trimestre_d, d.extraviado
            FROM dosimetry_tracking d
            WHERE d.returned = false AND d.extraviado = ${extraviado}
            ORDER BY d.trimestre_d DESC LIMIT 20`
      : sql`SELECT d.nombrepart, d.dcto, d.dosimetro, d.trimestre_d, d.extraviado
            FROM dosimetry_tracking d
            WHERE d.returned = false
            ORDER BY d.extraviado DESC, d.trimestre_d DESC LIMIT 20`;
    const { rows } = await query;
    return rows;
  } catch {
    return [];
  }
}

async function searchWeb(query: string): Promise<string> {
  try {
    const url =
      "https://api.duckduckgo.com/?q=" +
      encodeURIComponent(query + " radiología protección radiológica Chile") +
      "&format=json&no_html=1&skip_disambig=1&kl=cl-es";

    const res = await fetch(url, {
      headers: { "User-Agent": "RPMS-Assistant/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return "Sin resultados web disponibles.";

    const data = await res.json();

    if (data?.AbstractText?.length > 50) {
      return `${data.AbstractText.slice(0, 600)}\n\nFuente: ${data.AbstractURL || data.AbstractSource || "DuckDuckGo"}`;
    }
    if (Array.isArray(data?.RelatedTopics) && data.RelatedTopics[0]?.Text?.length > 30) {
      return data.RelatedTopics[0].Text.slice(0, 500);
    }
    return "No se encontraron resultados relevantes en la web.";
  } catch {
    return "No se pudo realizar la búsqueda web.";
  }
}

// ---------------------------------------------------------------------------
// Tabla de configuración
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// System prompt con contexto dinámico
// ---------------------------------------------------------------------------

function buildSystemPrompt(moduleLabel?: string, snapshot?: Record<string, Record<string, unknown>> | null): string {
  const now = new Date().toLocaleDateString("es-CL", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  let context = "";
  if (snapshot) {
    const w = snapshot.workers as Record<string, number> || {};
    const d = snapshot.dosimetry as Record<string, number> || {};
    const nr = snapshot.notReturned as Record<string, number> || {};
    context = `\n\nESTADO ACTUAL DEL SISTEMA (${now}):\n` +
      `- Trabajadores POE: ${w.total ?? "?"} total (${w.active ?? "?"} activos, ${w.inactive ?? "?"} inactivos)\n` +
      `  - Categoría A: ${w.cat_a ?? "?"} | Categoría B: ${w.cat_b ?? "?"}\n` +
      `- Dosimetría: ${d.total_records ?? "?"} registros, ${d.total_workers_with_doses ?? "?"} trabajadores con dosis\n` +
      `  - Año más reciente: ${d.latest_year ?? "?"}\n` +
      (Number(d.over_limit_a) > 0 ? `  ⚠️ ${d.over_limit_a} registros superan 20 mSv/año (límite Cat. A)\n` : "") +
      `- Dosímetros no devueltos: ${nr.total ?? "?"} (${nr.extraviados ?? 0} marcados como extraviados)\n`;
  }

  return (
    "Eres el Asistente Inteligente de RPMS (Radiation Protection Management System), " +
    "la plataforma de gestión del Programa de Protección Radiológica del " +
    "Hospital Hernán Henríquez Aravena (HHHA), Temuco, Chile.\n\n" +

    "INSTRUCCIONES:\n" +
    "- Respondes en español, de forma concisa, clara y profesional.\n" +
    "- Cuando el usuario pregunta por datos específicos (trabajadores, dosis, dosímetros), " +
    "usa las herramientas disponibles para consultar la base de datos en tiempo real.\n" +
    "- Para preguntas normativas o técnicas, usa search_web para buscar información actualizada.\n" +
    "- Siempre usa las herramientas cuando puedas obtener datos más precisos con ellas.\n" +
    "- Responde de forma directa; evita introducciones largas.\n\n" +

    "CONOCIMIENTO DEL SISTEMA:\n" +
    "- Dosimetría: límites DS 3/1985 (Cat. A ≤20 mSv/año, Cat. B ≤6 mSv/año), importación planillas CCHEN.\n" +
    "- Trabajadores POE: registro, categorías A/B, exámenes médicos anuales obligatorios.\n" +
    "- Residuos Radiactivos: clasificación IAEA GSG-1, cálculo de decay, fichas, rótulos.\n" +
    "- I-131: administración de dosis, aislamiento, criterio de alta ≤25 μSv/h a 1 metro.\n" +
    "- LINAC/CML: control de calidad AAPM TG-142, comisionamiento, incidentes, mantenimientos.\n" +
    "- Contaminación: límites IAEA/CCHEN por zona, monitoreo de superficies y ambiente.\n" +
    "- Fuentes radiactivas: inventario, prueba de estanqueidad cada 2 años, movimientos IMAR.\n" +
    "- Zonas: controlada (>6 mSv/año), supervisada (1-6 mSv/año), libre (<1 mSv/año).\n" +
    "- CCHEN: declaración anual de dosis (antes 31/marzo), licencias, inspecciones, formulario F-01.\n" +
    "- Transporte: DS 12/1985 e IAEA SSR-6.\n" +
    "- Cumplimiento NS-06.0, CAPA, indicadores PR, comité PR, auditorías.\n" +

    (moduleLabel ? `\nMódulo actual del usuario: ${moduleLabel}.\n` : "") +
    context
  );
}

// ---------------------------------------------------------------------------
// Definición de herramientas para Anthropic tool calling
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: "query_workers",
    description: "Busca trabajadores POE en la base de datos por nombre o RUT. Úsalo cuando el usuario pregunta por un trabajador específico.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Nombre o RUT del trabajador a buscar" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_dosimetry_stats",
    description: "Obtiene estadísticas de dosimetría del sistema. Muestra trabajadores con sus dosis totales del año.",
    input_schema: {
      type: "object",
      properties: {
        year: { type: "number", description: "Año de consulta (por defecto el año actual)" },
      },
    },
  },
  {
    name: "get_not_returned_dosimeters",
    description: "Lista los dosímetros no devueltos. Puede filtrar por extraviados o no.",
    input_schema: {
      type: "object",
      properties: {
        extraviado: {
          type: "boolean",
          description: "Si es true, muestra solo extraviados. Si es false, solo no extraviados. Si no se especifica, muestra todos.",
        },
      },
    },
  },
  {
    name: "search_web",
    description: "Busca información en internet sobre normativa radiológica, regulaciones CCHEN, IAEA, o cualquier tema técnico que no esté en la base de conocimiento local.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Consulta de búsqueda web" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_system_summary",
    description: "Obtiene un resumen del estado actual del sistema: total de trabajadores, registros de dosimetría, dosímetros no devueltos.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
];

// ---------------------------------------------------------------------------
// Ejecutar una herramienta
// ---------------------------------------------------------------------------

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "query_workers": {
      const rows = await queryWorkers(String(input.query || ""));
      if (!rows.length) return "No se encontraron trabajadores con ese criterio.";
      return (rows as Array<Record<string, unknown>>).map(r =>
        `• **${r.name}** (RUT: ${r.rut})\n  - Categoría: ${r.category} | Estado: ${r.status} | Servicio: ${r.service || "-"}${r.email ? ` | Email: ${r.email}` : ""}`
      ).join("\n");
    }

    case "get_dosimetry_stats": {
      const stats = await getDosimetryStats(input.year as number | undefined);
      if (!stats) return "No se pudieron obtener datos de dosimetría.";
      const rows = stats.workers as Array<Record<string, unknown>>;
      if (!rows.length) return `No hay registros de dosimetría para ${stats.year}.`;
      return `**Dosis acumuladas ${stats.year}** (top 10):\n\n` +
        rows.map((r, i) =>
          `${i + 1}. **${r.name}** (Cat. ${r.category}): ${Number(r.total_dose).toFixed(2)} mSv` +
          (Number(r.total_dose) > 20 ? " ⚠️ SUPERA LÍMITE" : Number(r.total_dose) > 15 ? " ⚠️ Cerca del límite" : "")
        ).join("\n");
    }

    case "get_not_returned_dosimeters": {
      const rows = await getNotReturnedDosimeters(input.extraviado as boolean | undefined);
      if (!rows.length) return "No hay dosímetros pendientes de devolución.";
      const extraviados = rows.filter((r: Record<string, unknown>) => r.extraviado).length;
      return `**Dosímetros no devueltos: ${rows.length}** (${extraviados} extraviados)\n\n` +
        (rows as Array<Record<string, unknown>>).slice(0, 15).map(r =>
          `• ${r.nombrepart} — Trimestre: ${r.trimestre_d}${r.extraviado ? " 🔴 EXTRAVIADO" : ""}`
        ).join("\n") +
        (rows.length > 15 ? `\n...y ${rows.length - 15} más.` : "");
    }

    case "search_web": {
      return await searchWeb(String(input.query || ""));
    }

    case "get_system_summary": {
      const snap = await getSystemSnapshot();
      if (!snap) return "No se pudo obtener el resumen del sistema.";
      const w = snap.workers as Record<string, number>;
      const d = snap.dosimetry as Record<string, number>;
      const nr = snap.notReturned as Record<string, number>;
      return `**Estado actual del sistema RPMS:**\n\n` +
        `👥 **Trabajadores POE**: ${w.total || 0} total — ${w.active || 0} activos (Cat. A: ${w.cat_a || 0}, Cat. B: ${w.cat_b || 0})\n` +
        `📊 **Dosimetría**: ${d.total_records || 0} registros, año más reciente: ${d.latest_year || "-"}\n` +
        (Number(d.over_limit_a) > 0 ? `⚠️ ${d.over_limit_a} registros superan 20 mSv/año\n` : "") +
        `📦 **Dosímetros no devueltos**: ${nr.total || 0} (${nr.extraviados || 0} extraviados)`;
    }

    default:
      return `Herramienta desconocida: ${name}`;
  }
}

// ---------------------------------------------------------------------------
// Llamada a Anthropic con tool use
// ---------------------------------------------------------------------------

async function callAnthropicWithTools(
  messages: AssistantMessage[],
  systemPromptText: string,
  apiKey: string,
  model: string,
  temperature: number,
  maxTokens: number
): Promise<string> {
  const apiMessages: Array<{ role: string; content: unknown }> = messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  let iterations = 0;
  const MAX_ITERATIONS = 5;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model || "claude-3-5-haiku-20241022",
        max_tokens: maxTokens || 1024,
        temperature,
        system: systemPromptText,
        tools: TOOLS,
        messages: apiMessages,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Anthropic error (${res.status}): ${text.slice(0, 300)}`);
    }

    const data = await res.json();

    // Si el modelo terminó o devolvió texto, retornar
    if (data.stop_reason === "end_turn") {
      const textBlock = data.content?.find((b: { type: string }) => b.type === "text");
      return textBlock?.text?.trim() || "";
    }

    // Si el modelo quiere usar herramientas
    if (data.stop_reason === "tool_use") {
      // Agregar la respuesta del asistente al historial
      apiMessages.push({ role: "assistant", content: data.content });

      // Ejecutar cada herramienta y construir respuesta de usuario
      const toolResults: Array<{ type: string; tool_use_id: string; content: string }> = [];
      for (const block of data.content) {
        if (block.type === "tool_use") {
          const result = await executeTool(block.name, block.input || {});
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      apiMessages.push({ role: "user", content: toolResults });
      continue;
    }

    // Respuesta inesperada — tomar el texto si existe
    const textBlock = data.content?.find((b: { type: string }) => b.type === "text");
    if (textBlock?.text) return textBlock.text.trim();
    break;
  }

  return "No se pudo obtener una respuesta completa del asistente.";
}

// ---------------------------------------------------------------------------
// Llamada a OpenAI con function calling
// ---------------------------------------------------------------------------

async function callOpenAIWithTools(
  messages: AssistantMessage[],
  systemPromptText: string,
  apiKey: string,
  model: string,
  temperature: number,
  maxTokens: number
): Promise<string> {
  const openAITools = TOOLS.map(t => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));

  const apiMessages: Array<{ role: string; content: string | null; tool_calls?: unknown; tool_call_id?: string; name?: string }> = [
    { role: "system", content: systemPromptText },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];

  let iterations = 0;
  const MAX_ITERATIONS = 5;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "gpt-4o-mini",
        messages: apiMessages,
        tools: openAITools,
        tool_choice: "auto",
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenAI error (${res.status}): ${text.slice(0, 300)}`);
    }

    const data = await res.json();
    const choice = data?.choices?.[0];

    if (choice?.finish_reason === "stop") {
      return choice?.message?.content?.trim() || "";
    }

    if (choice?.finish_reason === "tool_calls") {
      apiMessages.push({ role: "assistant", content: null, tool_calls: choice.message.tool_calls });

      for (const tc of choice.message.tool_calls) {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function.arguments); } catch { /* ignore */ }
        const result = await executeTool(tc.function.name, args);
        apiMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          name: tc.function.name,
          content: result,
        });
      }
      continue;
    }

    return choice?.message?.content?.trim() || "";
  }

  return "No se pudo obtener una respuesta completa del asistente.";
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------

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

  const hasApiKey = !!row?.api_key && String(row.api_key).trim().length > 0;
  const providerId = hasApiKey ? String(row?.provider ?? "local") : "local";

  // Obtener snapshot del sistema para enriquecer el prompt
  const snapshot = await getSystemSnapshot();
  const sysPrompt = buildSystemPrompt(moduleLabel, snapshot);

  const apiKey = String(row?.api_key ?? "");
  const model = String(row?.model ?? "");
  const temperature = row ? Number(row.temperature) : 0.3;
  const maxTokens = row ? Number(row.max_tokens) : 1024;

  try {
    let reply: string;

    if (providerId === "anthropic" && hasApiKey) {
      reply = await callAnthropicWithTools(messages, sysPrompt, apiKey, model, temperature, maxTokens);
    } else if (providerId === "openai" && hasApiKey) {
      reply = await callOpenAIWithTools(messages, sysPrompt, apiKey, model, temperature, maxTokens);
    } else {
      // Fallback: agente local con búsqueda web
      const { generateLocalResponse } = await import("@/lib/assistant/local-agent");
      reply = await generateLocalResponse(messages, moduleRoute);
    }

    return NextResponse.json({ reply, provider: providerId });
  } catch (err: unknown) {
    // Si el proveedor externo falla, hacer fallback al agente local
    if (providerId !== "local") {
      try {
        const { generateLocalResponse } = await import("@/lib/assistant/local-agent");
        const reply = await generateLocalResponse(messages, moduleRoute);
        return NextResponse.json({ reply, provider: "local (fallback)" });
      } catch {
        // ignorar
      }
    }
    const errMsg = err instanceof Error ? err.message : "No se pudo obtener una respuesta.";
    return NextResponse.json({ error: errMsg }, { status: 502 });
  }
}
