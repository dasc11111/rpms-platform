import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS pr_documents (
      id              SERIAL PRIMARY KEY,
      doc_code        VARCHAR(30) UNIQUE NOT NULL,
      title           TEXT NOT NULL,
      doc_type        VARCHAR(30) NOT NULL DEFAULT 'procedure',
      category        VARCHAR(50),
      description     TEXT,
      responsible     VARCHAR(120),
      reviewer        VARCHAR(120),
      approver        VARCHAR(120),
      version         VARCHAR(10) NOT NULL DEFAULT '1.0',
      status          VARCHAR(30) NOT NULL DEFAULT 'draft',
      issue_date      DATE,
      effective_date  DATE,
      next_review_date DATE,
      last_review_date DATE,
      cchen_required  BOOLEAN NOT NULL DEFAULT FALSE,
      cchen_approved  BOOLEAN NOT NULL DEFAULT FALSE,
      cchen_ref       VARCHAR(80),
      scope           TEXT,
      references_docs TEXT,
      document_path   TEXT,
      observations    TEXT,
      active          BOOLEAN NOT NULL DEFAULT TRUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const { rows: [{ cnt }] } = await sql`SELECT COUNT(*)::int AS cnt FROM pr_documents`;
  if (cnt > 0) return;

  const docs = [
    { code:"PR-PO-001", title:"Procedimiento de Dosimetría Personal y Ocupacional", type:"procedure", cat:"dosimetria", resp:"TM Jefe PR", rev:"Comité PR", appr:"Director Médico", ver:"3.1", status:"approved", eff:"2026-01-01", rev_date:"2027-01-01", cchen:true, cchen_ok:true, cchen_ref:"Res. CCHEN 2024-156" },
    { code:"PR-PO-002", title:"Procedimiento de Monitorización de Área y Zonas Clasificadas", type:"procedure", cat:"zonas", resp:"TM Jefe PR", rev:"Comité PR", appr:"Director Médico", ver:"2.4", status:"approved", eff:"2026-01-01", rev_date:"2027-01-01", cchen:true, cchen_ok:true, cchen_ref:"Res. CCHEN 2024-157" },
    { code:"PR-PO-003", title:"Procedimiento de Gestión de Residuos Radiactivos", type:"procedure", cat:"residuos", resp:"TM Jefe PR", rev:"Comité PR", appr:"Director Médico", ver:"2.1", status:"approved", eff:"2025-07-01", rev_date:"2026-07-01", cchen:true, cchen_ok:true, cchen_ref:"Res. CCHEN 2023-089" },
    { code:"PR-PO-004", title:"Procedimiento de Respuesta a Emergencias Radiológicas", type:"procedure", cat:"emergencias", resp:"TM Jefe PR", rev:"Comité PR", appr:"Director Médico", ver:"2.0", status:"approved", eff:"2025-04-01", rev_date:"2026-04-01", cchen:false, cchen_ok:false, cchen_ref:null },
    { code:"PR-PO-005", title:"Procedimiento de Administración de I-131 con Fines Terapéuticos", type:"procedure", cat:"medicina_nuclear", resp:"Médico Nuclear", rev:"TM Jefe PR", appr:"Director Médico", ver:"3.0", status:"approved", eff:"2026-03-01", rev_date:"2027-03-01", cchen:true, cchen_ok:true, cchen_ref:"Res. CCHEN 2025-042" },
    { code:"PR-IN-001", title:"Instructivo de Uso de Dosímetro TLD y OSL", type:"instructive", cat:"dosimetria", resp:"TM Jefe PR", rev:"TM PR", appr:"TM Jefe PR", ver:"2.2", status:"approved", eff:"2025-09-01", rev_date:"2026-09-01", cchen:false, cchen_ok:false, cchen_ref:null },
    { code:"PR-IN-002", title:"Instructivo de Verificación Operacional de Instrumentos", type:"instructive", cat:"instrumentos", resp:"TM PR", rev:"TM Jefe PR", appr:"TM Jefe PR", ver:"1.3", status:"approved", eff:"2025-11-01", rev_date:"2026-11-01", cchen:false, cchen_ok:false, cchen_ref:null },
    { code:"PR-IN-003", title:"Instructivo de Descontaminación de Personal y Áreas", type:"instructive", cat:"contaminacion", resp:"TM Jefe PR", rev:"Comité PR", appr:"TM Jefe PR", ver:"1.1", status:"under_review", eff:null, rev_date:"2027-02-01", cchen:false, cchen_ok:false, cchen_ref:null },
    { code:"PR-PT-001", title:"Protocolo de Control de Calidad PET/CT", type:"protocol", cat:"calidad", resp:"Físico Médico", rev:"TM Jefe PR", appr:"Director Médico", ver:"1.4", status:"approved", eff:"2026-02-01", rev_date:"2027-02-01", cchen:false, cchen_ok:false, cchen_ref:null },
    { code:"PR-PT-002", title:"Protocolo ALARA para Procedimientos de Alta Dosis", type:"protocol", cat:"alara", resp:"TM Jefe PR", rev:"Comité PR", appr:"Director Médico", ver:"1.0", status:"draft", eff:null, rev_date:null, cchen:false, cchen_ok:false, cchen_ref:null },
    { code:"PR-FO-001", title:"Formulario de Registro de Dosis Mensual", type:"form", cat:"dosimetria", resp:"TM PR", rev:"TM Jefe PR", appr:"TM Jefe PR", ver:"2.0", status:"approved", eff:"2025-01-01", rev_date:"2027-01-01", cchen:false, cchen_ok:false, cchen_ref:null },
    { code:"PR-FO-002", title:"Formulario de Acta de Sesión del Comité PR", type:"form", cat:"comite", resp:"Secretario Comité", rev:"Presidente Comité", appr:"Presidente Comité", ver:"1.1", status:"approved", eff:"2024-07-01", rev_date:"2027-07-01", cchen:false, cchen_ok:false, cchen_ref:null },
    { code:"PR-MN-001", title:"Manual del Programa de Protección Radiológica NS-06.0", type:"manual", cat:"programa", resp:"TM Jefe PR", rev:"Comité PR", appr:"Director", ver:"4.0", status:"approved", eff:"2026-01-01", rev_date:"2028-01-01", cchen:true, cchen_ok:true, cchen_ref:"Res. CCHEN 2025-001" },
    { code:"PR-RG-001", title:"Registro de Eventos Radiológicos e Incidentes", type:"record", cat:"incidentes", resp:"TM Jefe PR", rev:"Comité PR", appr:"Director Médico", ver:"1.2", status:"approved", eff:"2024-10-01", rev_date:"2027-10-01", cchen:false, cchen_ok:false, cchen_ref:null },
    { code:"PR-PO-006", title:"Procedimiento de Transporte de Material Radiactivo IAEA SSR-6", type:"procedure", cat:"transporte", resp:"TM Jefe PR", rev:"Comité PR", appr:"Director", ver:"1.0", status:"obsolete", eff:"2023-01-01", rev_date:"2025-01-01", cchen:true, cchen_ok:false, cchen_ref:null },
    { code:"PR-IN-004", title:"Instructivo de Calificación y Autorización de Zonas", type:"instructive", cat:"zonas", resp:"TM Jefe PR", rev:"Comité PR", appr:"Director", ver:"1.0", status:"draft", eff:null, rev_date:null, cchen:false, cchen_ok:false, cchen_ref:null },
  ];

  for (const d of docs) {
    await sql`
      INSERT INTO pr_documents
        (doc_code, title, doc_type, category, responsible, reviewer, approver,
         version, status, effective_date, next_review_date, cchen_required, cchen_approved, cchen_ref)
      VALUES
        (${d.code}, ${d.title}, ${d.type}, ${d.cat}, ${d.resp}, ${d.rev}, ${d.appr},
         ${d.ver}, ${d.status}, ${d.eff??null}, ${d.rev_date??null}, ${d.cchen}, ${d.cchen_ok}, ${d.cchen_ref??null})
      ON CONFLICT (doc_code) DO NOTHING
    `;
  }
}

export async function GET(req: NextRequest) {
  return safeQuery(async () => {
    await ensureTable();
    const sp = req.nextUrl.searchParams;
    const type   = sp.get("type") ?? "";
    const status = sp.get("status") ?? "";
    const cat    = sp.get("cat") ?? "";
    const cchen  = sp.get("cchen") ?? "";

    const { rows } = await sql`
      SELECT *,
        (next_review_date < NOW() AND status NOT IN ('obsolete','draft')) AS is_overdue,
        (cchen_required AND NOT cchen_approved AND status = 'approved')   AS cchen_pending
      FROM pr_documents
      WHERE active = TRUE
        AND (${type}   = '' OR doc_type  = ${type})
        AND (${status} = '' OR status    = ${status})
        AND (${cat}    = '' OR category  = ${cat})
        AND (${cchen}  = '' OR (${cchen} = 'true' AND cchen_required = TRUE)
                             OR (${cchen} = 'false' AND cchen_required = FALSE))
      ORDER BY doc_code
    `;

    const { rows: stats } = await sql`
      SELECT
        COUNT(*)                                              ::int AS total,
        COUNT(*) FILTER (WHERE status = 'approved')          ::int AS approved,
        COUNT(*) FILTER (WHERE status = 'draft')             ::int AS draft,
        COUNT(*) FILTER (WHERE status = 'under_review')      ::int AS under_review,
        COUNT(*) FILTER (WHERE status = 'obsolete')          ::int AS obsolete,
        COUNT(*) FILTER (WHERE next_review_date < NOW()
          AND status NOT IN ('obsolete','draft'))             ::int AS overdue_review,
        COUNT(*) FILTER (WHERE cchen_required)                ::int AS cchen_required,
        COUNT(*) FILTER (WHERE cchen_required AND cchen_approved) ::int AS cchen_approved
      FROM pr_documents WHERE active = TRUE
    `;

    return NextResponse.json({ rows, stats: stats[0] });
  }, NextResponse.json({ rows:[], stats:{} }, { status:500 }));
}

export async function POST(req: NextRequest) {
  return safeQuery(async () => {
    await ensureTable();
    const b = await req.json();

    // auto-generate code if not provided
    let code = b.doc_code;
    if (!code) {
      const prefix = { procedure:"PR-PO", instructive:"PR-IN", protocol:"PR-PT",
                       form:"PR-FO", manual:"PR-MN", record:"PR-RG" }[b.doc_type as string] ?? "PR-DC";
      const { rows:[{cnt}] } = await sql`SELECT COUNT(*)::int AS cnt FROM pr_documents WHERE doc_code LIKE ${prefix+'%'}`;
      code = `${prefix}-${String(cnt+1).padStart(3,"0")}`;
    }

    const { rows:[row] } = await sql`
      INSERT INTO pr_documents
        (doc_code, title, doc_type, category, description, responsible, reviewer, approver,
         version, status, issue_date, effective_date, next_review_date, cchen_required, cchen_approved,
         cchen_ref, scope, references_docs, document_path, observations)
      VALUES
        (${code}, ${b.title}, ${b.doc_type??'procedure'}, ${b.category??null},
         ${b.description??null}, ${b.responsible??null}, ${b.reviewer??null}, ${b.approver??null},
         ${b.version??'1.0'}, ${b.status??'draft'}, ${b.issue_date??null}, ${b.effective_date??null},
         ${b.next_review_date??null}, ${!!b.cchen_required}, ${!!b.cchen_approved},
         ${b.cchen_ref??null}, ${b.scope??null}, ${b.references_docs??null},
         ${b.document_path??null}, ${b.observations??null})
      RETURNING *
    `;
    return NextResponse.json(row, { status:201 });
  }, NextResponse.json({ error:"db error" }, { status:500 }));
}

export async function PATCH(req: NextRequest) {
  return safeQuery(async () => {
    await ensureTable();
    const b = await req.json();
    const { id, ...rest } = b;
    const fields = Object.keys(rest).filter(k=>k!=="id");
    if (!fields.length) return NextResponse.json({ error:"no fields" }, { status:400 });
    const setClauses = fields.map((f,i) => `"${f}" = $${i+2}`).join(", ");
    const vals = fields.map(f => (rest as Record<string,unknown>)[f]);
    const { rows:[row] } = await sql.unsafe(
      `UPDATE pr_documents SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...vals]
    );
    return NextResponse.json(row);
  }, NextResponse.json({ error:"db error" }, { status:500 }));
}

export async function DELETE(req: NextRequest) {
  return safeQuery(async () => {
    await ensureTable();
    const { id } = await req.json();
    await sql`UPDATE pr_documents SET active = FALSE WHERE id = ${id}`;
    return NextResponse.json({ ok:true });
  }, NextResponse.json({ error:"db error" }, { status:500 }));
}
