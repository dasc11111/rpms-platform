import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { MEDICINA_NUCLEAR_SUBCATEGORIES, slugify } from "@/lib/documents";

export const dynamic = "force-dynamic";

export async function GET() {
await sql`
CREATE TABLE IF NOT EXISTS workers (
id SERIAL PRIMARY KEY,
rut TEXT UNIQUE NOT NULL,
name TEXT NOT NULL,
role TEXT,
service TEXT,
category TEXT,
status TEXT NOT NULL DEFAULT 'active',
annual_dose NUMERIC NOT NULL DEFAULT 0,
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS dv TEXT`;
await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS sex TEXT`;
await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS address TEXT`;
await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS phone TEXT`;
await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS email TEXT`;
await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS birth_date TEXT`;
await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS estamento TEXT`;
await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS contract_type TEXT`;
await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS unit TEXT`;
await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`;

// Curso de Proteccion Radiologica (Curso PR)
await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS course_pr_completed BOOLEAN NOT NULL DEFAULT false`;
await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS course_pr_date TEXT`;

// Autorizacion de Desempeno: numero, fecha de emision y fecha de vencimiento.
// Los dias restantes y el estado se calculan siempre en tiempo real (ver src/lib/authorization.ts).
await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS authorization_number TEXT`;
await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS authorization_issue_date TEXT`;
await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS authorization_expiry_date TEXT`;
await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS notes TEXT`;

await sql`
CREATE TABLE IF NOT EXISTS dosimetry_readings (
id SERIAL PRIMARY KEY,
worker_rut TEXT,
worker_name TEXT NOT NULL,
dosimeter_type TEXT,
period TEXT NOT NULL,
dose NUMERIC NOT NULL DEFAULT 0,
status TEXT NOT NULL DEFAULT 'read',
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
UNIQUE (worker_name, period, dosimeter_type)
);
`;

const { rows: workerCount } = await sql`SELECT COUNT(*)::int AS count FROM workers`;
const workersTotal = workerCount[0]?.count ?? 0;
if (workersTotal === 0) {
await sql`
INSERT INTO workers (rut, name, role, service, category, status, annual_dose) VALUES
('17.245.892-0', 'Javiera Muñoz', 'Físico Médico', 'Radioterapia', 'A', 'active', 3.2),
('18.123.456-3', 'Marcelo Rojas', 'Tecnólogo Médico', 'Medicina Nuclear', 'A', 'active', 4.1),
('15.987.654-3', 'Camila Torres', 'Ingeniero', 'Biomédica', 'B', 'active', 0.8),
('16.456.789-3', 'Andrés Silva', 'Radiofarmaceuta', 'Medicina Nuclear', 'A', 'suspended', 2.4)
ON CONFLICT (rut) DO NOTHING;
`;
}

const { rows: readingCount } = await sql`SELECT COUNT(*)::int AS count FROM dosimetry_readings`;
const readingsTotal = readingCount[0]?.count ?? 0;
if (readingsTotal === 0) {
await sql`
INSERT INTO dosimetry_readings (worker_rut, worker_name, dosimeter_type, period, dose, status) VALUES
('17.245.892-0', 'Javiera Muñoz', 'TLD cuerpo entero', '2026-06', 0.28, 'read'),
('18.123.456-3', 'Marcelo Rojas', 'TLD cuerpo entero', '2026-06', 0.34, 'read'),
('15.987.654-3', 'Camila Torres', 'OSL anillo', '2026-06', 0.05, 'read'),
('16.456.789-3', 'Andrés Silva', 'TLD cuerpo entero', '2026-06', 0.19, 'pending'),
('16.456.789-3', 'Andrés Silva', 'TLD cuerpo entero', '2026-05', 0.22, 'lost')
ON CONFLICT (worker_name, period, dosimeter_type) DO NOTHING;
`;
}

// --- Modulo Documentos / Biblioteca ---------------------------------------
// Categorias dinamicas basadas en base de datos (soportan cualquier profundidad
// mediante parent_id), y documentos con su archivo almacenado en Vercel Blob.
await sql`
CREATE TABLE IF NOT EXISTS document_categories (
id SERIAL PRIMARY KEY,
name TEXT NOT NULL,
slug TEXT NOT NULL UNIQUE,
parent_id INTEGER REFERENCES document_categories(id) ON DELETE CASCADE,
sort_order INTEGER NOT NULL DEFAULT 0,
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
await sql`CREATE INDEX IF NOT EXISTS idx_document_categories_parent ON document_categories(parent_id)`;

await sql`
CREATE TABLE IF NOT EXISTS documents (
id SERIAL PRIMARY KEY,
category_id INTEGER NOT NULL REFERENCES document_categories(id) ON DELETE CASCADE,
original_name TEXT NOT NULL,
blob_url TEXT NOT NULL,
blob_pathname TEXT NOT NULL,
size_bytes BIGINT NOT NULL DEFAULT 0,
mime_type TEXT,
uploaded_by TEXT,
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
await sql`CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category_id)`;
await sql`CREATE INDEX IF NOT EXISTS idx_documents_name ON documents(lower(original_name))`;

// Semilla: categoria MEDICINA NUCLEAR y sus subcategorias (carpetas vacias,
// sin documentos). No se agrega ningun documento automaticamente.
const { rows: mnRows } = await sql`
INSERT INTO document_categories (name, slug, parent_id, sort_order)
VALUES ('MEDICINA NUCLEAR', 'medicina-nuclear', NULL, 1000)
ON CONFLICT (slug) DO NOTHING
RETURNING id
`;
let medicinaNuclearId = mnRows[0]?.id as number | undefined;
if (!medicinaNuclearId) {
const { rows } = await sql`SELECT id FROM document_categories WHERE slug = 'medicina-nuclear'`;
medicinaNuclearId = rows[0]?.id;
}

if (medicinaNuclearId) {
const subcategoryNames: string[] = MEDICINA_NUCLEAR_SUBCATEGORIES;
for (let i = 0; i < subcategoryNames.length; i++) {
const name: string = subcategoryNames[i] ?? "";
if (!name) continue;
const slug = `medicina-nuclear-${slugify(name)}`;
await sql`
INSERT INTO document_categories (name, slug, parent_id, sort_order)
VALUES (${name}, ${slug}, ${medicinaNuclearId}, ${i + 1})
ON CONFLICT (slug) DO NOTHING
`;
}
}

return NextResponse.json({ ok: true });
}
