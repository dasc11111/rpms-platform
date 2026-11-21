import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS emergency_plans (
      id               SERIAL PRIMARY KEY,
      plan_code        TEXT NOT NULL,
      title            TEXT NOT NULL,
      category         TEXT NOT NULL DEFAULT 'radiologica',
      ines_level       INT  NOT NULL DEFAULT 0,
      description      TEXT,
      trigger_criteria TEXT,
      immediate_actions TEXT,
      notification_chain TEXT,
      evacuation_zones TEXT,
      equipment_required TEXT,
      responsible_officer TEXT,
      backup_officer   TEXT,
      cchen_notification BOOLEAN NOT NULL DEFAULT FALSE,
      minsal_notification BOOLEAN NOT NULL DEFAULT FALSE,
      last_drill_date  DATE,
      next_drill_date  DATE,
      drill_frequency_months INT NOT NULL DEFAULT 12,
      status           TEXT NOT NULL DEFAULT 'vigente',
      notes            TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS emergency_contacts (
      id          SERIAL PRIMARY KEY,
      plan_id     INT REFERENCES emergency_plans(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      role        TEXT NOT NULL,
      phone       TEXT,
      phone_alt   TEXT,
      email       TEXT,
      organization TEXT,
      priority    INT NOT NULL DEFAULT 1,
      available_24h BOOLEAN NOT NULL DEFAULT FALSE,
      notes       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS emergency_drills (
      id              SERIAL PRIMARY KEY,
      plan_id         INT REFERENCES emergency_plans(id) ON DELETE SET NULL,
      drill_date      DATE NOT NULL,
      drill_type      TEXT NOT NULL DEFAULT 'simulacro',
      scenario        TEXT NOT NULL,
      participants    INT,
      duration_min    INT,
      coordinator     TEXT,
      outcome         TEXT NOT NULL DEFAULT 'exitoso',
      findings        TEXT,
      corrective_actions TEXT,
      next_drill_date DATE,
      report_file_path TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

// GET — list plans + summary stats
export async function GET(req: NextRequest) {
  await ensureTable();
  const url = new URL(req.url);
  const resource = url.searchParams.get("resource") ?? "plans";

  if (resource === "contacts") {
    const plan_id = url.searchParams.get("plan_id");
    if (!plan_id) return NextResponse.json({ error: "plan_id requerido" }, { status: 400 });
    const { rows } = await sql`
      SELECT * FROM emergency_contacts
      WHERE plan_id = ${parseInt(plan_id, 10)}
      ORDER BY priority, name
    `;
    return NextResponse.json({ contacts: rows });
  }

  if (resource === "drills") {
    const { rows } = await sql`
      SELECT d.*, p.title AS plan_title, p.plan_code
      FROM emergency_drills d
      LEFT JOIN emergency_plans p ON p.id = d.plan_id
      ORDER BY d.drill_date DESC
    `;
    return NextResponse.json({ drills: rows });
  }

  // default: plans
  const { rows: plans } = await sql`
    SELECT p.*,
           COUNT(c.id)::int AS contacts_count,
           COUNT(d.id)::int AS drills_count,
           MAX(d.drill_date)  AS last_drill_actual
    FROM emergency_plans p
    LEFT JOIN emergency_contacts c ON c.plan_id = p.id
    LEFT JOIN emergency_drills   d ON d.plan_id = p.id
    GROUP BY p.id
    ORDER BY p.ines_level DESC, p.plan_code
  `;

  const { rows: stats } = await sql`
    SELECT
      COUNT(*)::int                                                     AS total_plans,
      COUNT(*) FILTER (WHERE status = 'vigente')::int                   AS active_plans,
      COUNT(*) FILTER (WHERE next_drill_date < CURRENT_DATE)::int       AS overdue_drills,
      COUNT(*) FILTER (WHERE next_drill_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 90)::int AS upcoming_drills,
      (SELECT COUNT(*)::int FROM emergency_drills WHERE drill_date >= CURRENT_DATE - 365)      AS drills_last_year
    FROM emergency_plans
  `;

  return NextResponse.json({ plans, stats: stats[0] ?? {} });
}

// POST — create plan
export async function POST(req: NextRequest) {
  await ensureTable();
  const url = new URL(req.url);
  const resource = url.searchParams.get("resource") ?? "plans";

  const body = await req.json();

  if (resource === "contact") {
    const { plan_id, name, role, phone, phone_alt, email, organization, priority, available_24h, notes } = body;
    const { rows } = await sql`
      INSERT INTO emergency_contacts (plan_id, name, role, phone, phone_alt, email, organization, priority, available_24h, notes)
      VALUES (${plan_id}, ${name}, ${role}, ${phone ?? null}, ${phone_alt ?? null}, ${email ?? null}, ${organization ?? null}, ${priority ?? 1}, ${available_24h ?? false}, ${notes ?? null})
      RETURNING *
    `;
    return NextResponse.json({ contact: rows[0] }, { status: 201 });
  }

  if (resource === "drill") {
    const { plan_id, drill_date, drill_type, scenario, participants, duration_min, coordinator, outcome, findings, corrective_actions, next_drill_date } = body;
    const { rows } = await sql`
      INSERT INTO emergency_drills (plan_id, drill_date, drill_type, scenario, participants, duration_min, coordinator, outcome, findings, corrective_actions, next_drill_date)
      VALUES (${plan_id ?? null}, ${drill_date}, ${drill_type ?? "simulacro"}, ${scenario}, ${participants ?? null}, ${duration_min ?? null}, ${coordinator ?? null}, ${outcome ?? "exitoso"}, ${findings ?? null}, ${corrective_actions ?? null}, ${next_drill_date ?? null})
      RETURNING *
    `;
    // Update plan's last_drill_date
    if (plan_id) {
      await sql`UPDATE emergency_plans SET last_drill_date = ${drill_date}, updated_at = NOW() WHERE id = ${plan_id}`;
    }
    return NextResponse.json({ drill: rows[0] }, { status: 201 });
  }

  // default: plan
  const {
    plan_code, title, category, ines_level, description, trigger_criteria,
    immediate_actions, notification_chain, evacuation_zones, equipment_required,
    responsible_officer, backup_officer, cchen_notification, minsal_notification,
    last_drill_date, next_drill_date, drill_frequency_months, status, notes,
  } = body;

  const { rows } = await sql`
    INSERT INTO emergency_plans (
      plan_code, title, category, ines_level, description, trigger_criteria,
      immediate_actions, notification_chain, evacuation_zones, equipment_required,
      responsible_officer, backup_officer, cchen_notification, minsal_notification,
      last_drill_date, next_drill_date, drill_frequency_months, status, notes
    ) VALUES (
      ${plan_code}, ${title}, ${category ?? "radiologica"}, ${ines_level ?? 0},
      ${description ?? null}, ${trigger_criteria ?? null}, ${immediate_actions ?? null},
      ${notification_chain ?? null}, ${evacuation_zones ?? null}, ${equipment_required ?? null},
      ${responsible_officer ?? null}, ${backup_officer ?? null},
      ${cchen_notification ?? false}, ${minsal_notification ?? false},
      ${last_drill_date ?? null}, ${next_drill_date ?? null},
      ${drill_frequency_months ?? 12}, ${status ?? "vigente"}, ${notes ?? null}
    ) RETURNING *
  `;
  return NextResponse.json({ plan: rows[0] }, { status: 201 });
}

// PATCH
export async function PATCH(req: NextRequest) {
  await ensureTable();
  const url = new URL(req.url);
  const resource = url.searchParams.get("resource") ?? "plans";
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const body = await req.json();

  if (resource === "contact") {
    const { name, role, phone, phone_alt, email, organization, priority, available_24h, notes } = body;
    const { rows } = await sql`
      UPDATE emergency_contacts SET
        name          = COALESCE(${name ?? null}, name),
        role          = COALESCE(${role ?? null}, role),
        phone         = COALESCE(${phone ?? null}, phone),
        phone_alt     = COALESCE(${phone_alt ?? null}, phone_alt),
        email         = COALESCE(${email ?? null}, email),
        organization  = COALESCE(${organization ?? null}, organization),
        priority      = COALESCE(${priority ?? null}::int, priority),
        available_24h = COALESCE(${available_24h ?? null}::boolean, available_24h),
        notes         = COALESCE(${notes ?? null}, notes)
      WHERE id = ${parseInt(id, 10)}
      RETURNING *
    `;
    if (!rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ contact: rows[0] });
  }

  if (resource === "drill") {
    const { drill_date, drill_type, scenario, participants, duration_min, coordinator, outcome, findings, corrective_actions, next_drill_date } = body;
    const { rows } = await sql`
      UPDATE emergency_drills SET
        drill_date          = COALESCE(${drill_date ?? null}::date, drill_date),
        drill_type          = COALESCE(${drill_type ?? null}, drill_type),
        scenario            = COALESCE(${scenario ?? null}, scenario),
        participants        = COALESCE(${participants ?? null}::int, participants),
        duration_min        = COALESCE(${duration_min ?? null}::int, duration_min),
        coordinator         = COALESCE(${coordinator ?? null}, coordinator),
        outcome             = COALESCE(${outcome ?? null}, outcome),
        findings            = COALESCE(${findings ?? null}, findings),
        corrective_actions  = COALESCE(${corrective_actions ?? null}, corrective_actions),
        next_drill_date     = COALESCE(${next_drill_date ?? null}::date, next_drill_date)
      WHERE id = ${parseInt(id, 10)}
      RETURNING *
    `;
    if (!rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ drill: rows[0] });
  }

  // default: plan
  const {
    plan_code, title, category, ines_level, description, trigger_criteria,
    immediate_actions, notification_chain, evacuation_zones, equipment_required,
    responsible_officer, backup_officer, cchen_notification, minsal_notification,
    last_drill_date, next_drill_date, drill_frequency_months, status, notes,
  } = body;

  const { rows } = await sql`
    UPDATE emergency_plans SET
      plan_code             = COALESCE(${plan_code ?? null}, plan_code),
      title                 = COALESCE(${title ?? null}, title),
      category              = COALESCE(${category ?? null}, category),
      ines_level            = COALESCE(${ines_level ?? null}::int, ines_level),
      description           = COALESCE(${description ?? null}, description),
      trigger_criteria      = COALESCE(${trigger_criteria ?? null}, trigger_criteria),
      immediate_actions     = COALESCE(${immediate_actions ?? null}, immediate_actions),
      notification_chain    = COALESCE(${notification_chain ?? null}, notification_chain),
      evacuation_zones      = COALESCE(${evacuation_zones ?? null}, evacuation_zones),
      equipment_required    = COALESCE(${equipment_required ?? null}, equipment_required),
      responsible_officer   = COALESCE(${responsible_officer ?? null}, responsible_officer),
      backup_officer        = COALESCE(${backup_officer ?? null}, backup_officer),
      cchen_notification    = COALESCE(${cchen_notification ?? null}::boolean, cchen_notification),
      minsal_notification   = COALESCE(${minsal_notification ?? null}::boolean, minsal_notification),
      last_drill_date       = COALESCE(${last_drill_date ?? null}::date, last_drill_date),
      next_drill_date       = COALESCE(${next_drill_date ?? null}::date, next_drill_date),
      drill_frequency_months = COALESCE(${drill_frequency_months ?? null}::int, drill_frequency_months),
      status                = COALESCE(${status ?? null}, status),
      notes                 = COALESCE(${notes ?? null}, notes),
      updated_at            = NOW()
    WHERE id = ${parseInt(id, 10)}
    RETURNING *
  `;
  if (!rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ plan: rows[0] });
}

// DELETE
export async function DELETE(req: NextRequest) {
  await ensureTable();
  const url = new URL(req.url);
  const resource = url.searchParams.get("resource") ?? "plans";
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  if (resource === "contact") {
    await sql`DELETE FROM emergency_contacts WHERE id = ${parseInt(id, 10)}`;
  } else if (resource === "drill") {
    await sql`DELETE FROM emergency_drills WHERE id = ${parseInt(id, 10)}`;
  } else {
    await sql`DELETE FROM emergency_plans WHERE id = ${parseInt(id, 10)}`;
  }
  return NextResponse.json({ ok: true });
}
