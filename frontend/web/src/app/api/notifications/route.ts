/**
 * API — Centro de Notificaciones
 * GET  /api/notifications         → lista de notificaciones (con filtros)
 * POST /api/notifications         → crear notificación manual
 * PATCH /api/notifications        → marcar todas como leídas
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id          SERIAL PRIMARY KEY,
      type        TEXT NOT NULL DEFAULT 'info',
      category    TEXT NOT NULL DEFAULT 'sistema',
      title       TEXT NOT NULL,
      message     TEXT,
      module      TEXT,
      action_url  TEXT,
      is_read     BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at     TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications (is_read)`;
}

// Seed from current alerts if table is empty
async function seedFromAlerts() {
  try {
    const { rows: count } = await sql`SELECT COUNT(*) AS n FROM notifications`;
    if (parseInt(String((count[0] as { n: string }).n)) > 0) return;

    // Pull top 20 alerts from the alerts table logic (re-use categories)
    const seeds = [
      { type: "warning", category: "dosimetria", title: "Dosimetrías sin registrar", message: "Existen trabajadores con períodos de dosimetría pendientes de registro.", module: "dosimetria", action_url: "/dosimetry" },
      { type: "info", category: "calibracion", title: "Calibraciones próximas a vencer", message: "Revise el estado de calibraciones de instrumentos en los próximos 30 días.", module: "instrumentos", action_url: "/instruments/calibrations" },
      { type: "info", category: "capacitacion", title: "Capacitaciones próximas a vencer", message: "Existen trabajadores con certificación de protección radiológica por renovar.", module: "capacitacion", action_url: "/training" },
      { type: "info", category: "sistema", title: "Sistema RPMS iniciado", message: "Plataforma de Radioprotección Médica lista.", module: "sistema", action_url: "/" },
    ];

    for (const s of seeds) {
      await sql`INSERT INTO notifications (type, category, title, message, module, action_url) VALUES (${s.type}, ${s.category}, ${s.title}, ${s.message}, ${s.module}, ${s.action_url})`;
    }
  } catch { /* silent */ }
}

export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    await seedFromAlerts();
  } catch { /* silent */ }

  const { searchParams } = new URL(req.url);
  const unread_only = searchParams.get("unread_only") === "true";
  const category = searchParams.get("category") ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  try {
    // Build dynamic filters
    const whereUnread = unread_only ? sql`AND is_read = false` : sql``;
    const whereCat    = category    ? sql`AND category = ${category}` : sql``;

    const { rows } = await sql`
      SELECT id, type, category, title, message, module, action_url, is_read, created_at, read_at
      FROM notifications
      WHERE 1=1 ${whereUnread} ${whereCat}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const { rows: stats } = await sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE is_read = false) AS unread,
        COUNT(*) FILTER (WHERE type = 'danger') AS danger,
        COUNT(*) FILTER (WHERE type = 'warning') AS warning,
        COUNT(*) FILTER (WHERE type = 'info') AS info
      FROM notifications
    `;

    const { rows: cats } = await sql`
      SELECT category, COUNT(*) AS total, COUNT(*) FILTER (WHERE is_read = false) AS unread
      FROM notifications
      GROUP BY category
      ORDER BY unread DESC, total DESC
    `;

    return NextResponse.json({
      notifications: rows,
      stats: stats[0],
      categories: cats,
    });
  } catch (err) {
    return NextResponse.json({ notifications: [], stats: { total: 0, unread: 0 }, categories: [], error: String(err) });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    const { type = "info", category = "sistema", title, message, module: mod, action_url } = body;

    if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

    const { rows } = await sql`
      INSERT INTO notifications (type, category, title, message, module, action_url)
      VALUES (${type}, ${category}, ${title}, ${message ?? null}, ${mod ?? null}, ${action_url ?? null})
      RETURNING *
    `;
    return NextResponse.json({ notification: rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureTable();
    const { action, ids } = await req.json().catch(() => ({ action: "mark_all_read", ids: [] }));

    if (action === "mark_all_read") {
      await sql`UPDATE notifications SET is_read = true, read_at = NOW() WHERE is_read = false`;
      return NextResponse.json({ ok: true });
    }
    if (action === "mark_read" && Array.isArray(ids) && ids.length > 0) {
      for (const id of ids) {
        await sql`UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = ${id}`;
      }
      return NextResponse.json({ ok: true, updated: ids.length });
    }
    if (action === "delete" && Array.isArray(ids) && ids.length > 0) {
      for (const id of ids) {
        await sql`DELETE FROM notifications WHERE id = ${id}`;
      }
      return NextResponse.json({ ok: true, deleted: ids.length });
    }
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
