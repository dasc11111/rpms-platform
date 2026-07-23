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

// Sub-subcategorias de "Autorizaciones de Desempeño": Medicina Interna,
// Medicina Nuclear y Transporte. Permiten las mismas acciones que cualquier
// otra carpeta de documentos (subir, reemplazar, eliminar, descargar, vista
// previa, ordenar y buscar).
if (medicinaNuclearId) {
const desempenoSlug = `medicina-nuclear-${slugify("Autorizaciones de Desempeño")}`;
const { rows: adRows } = await sql`
SELECT id FROM document_categories
WHERE parent_id = ${medicinaNuclearId} AND slug = ${desempenoSlug}
`;
const autorizacionDesempenoId = adRows[0]?.id as number | undefined;
if (autorizacionDesempenoId) {
const desempenoSubNames: string[] = ["Medicina Interna", "Medicina Nuclear", "Transporte"];
for (let i = 0; i < desempenoSubNames.length; i++) {
const name = desempenoSubNames[i] ?? "";
if (!name) continue;
const slug = `${desempenoSlug}-${slugify(name)}`;
await sql`
INSERT INTO document_categories (name, slug, parent_id, sort_order)
VALUES (${name}, ${slug}, ${autorizacionDesempenoId}, ${i + 1})
ON CONFLICT (slug) DO NOTHING
`;
}
}
}

// Nueva subcategoria "Autorización de OPR" (Oficial de Protección Radiológica)
// directamente dentro de MEDICINA NUCLEAR, con las mismas acciones que
// cualquier otra carpeta (subir, reemplazar, eliminar, descargar, vista previa).
if (medicinaNuclearId) {
const oprName = "Autorización de OPR";
const oprSlug = `medicina-nuclear-${slugify(oprName)}`;
await sql`
INSERT INTO document_categories (name, slug, parent_id, sort_order)
VALUES (${oprName}, ${oprSlug}, ${medicinaNuclearId}, 58)
ON CONFLICT (slug) DO NOTHING
`;
}

// Estructura de "Capacitación": Medicina Interna, Medicina Nuclear y
// Transporte, cada una organizada por año (2026-2030). Dentro de cada año,
// Medicina Interna y Medicina Nuclear tienen carpetas "Capacitación" y
// "Simulacro"; Transporte solo tiene carpeta "Capacitación".
if (medicinaNuclearId) {
const capacitacionSlug = `medicina-nuclear-${slugify("Capacitación")}`;
const { rows: capRows } = await sql`
SELECT id FROM document_categories
WHERE parent_id = ${medicinaNuclearId} AND slug = ${capacitacionSlug}
`;
const capacitacionId = capRows[0]?.id as number | undefined;
if (capacitacionId) {
const years = [2026, 2027, 2028, 2029, 2030];
const groups: { name: string; withSimulacro: boolean }[] = [
{ name: "Medicina Interna", withSimulacro: true },
{ name: "Medicina Nuclear", withSimulacro: true },
{ name: "Transporte", withSimulacro: false },
];
for (let g = 0; g < groups.length; g++) {
const group = groups[g];
if (!group) continue;
const groupSlug = `${capacitacionSlug}-${slugify(group.name)}`;
const { rows: groupRows } = await sql`
INSERT INTO document_categories (name, slug, parent_id, sort_order)
VALUES (${group.name}, ${groupSlug}, ${capacitacionId}, ${g + 1})
ON CONFLICT (slug) DO NOTHING
RETURNING id
`;
let groupId = groupRows[0]?.id as number | undefined;
if (!groupId) {
const { rows } = await sql`SELECT id FROM document_categories WHERE slug = ${groupSlug}`;
groupId = rows[0]?.id;
}
if (groupId) {
for (let y = 0; y < years.length; y++) {
const year = years[y];
const yearSlug = `${groupSlug}-${year}`;
const { rows: yearRows } = await sql`
INSERT INTO document_categories (name, slug, parent_id, sort_order)
VALUES (${String(year)}, ${yearSlug}, ${groupId}, ${y + 1})
ON CONFLICT (slug) DO NOTHING
RETURNING id
`;
let yearId = yearRows[0]?.id as number | undefined;
if (!yearId) {
const { rows } = await sql`SELECT id FROM document_categories WHERE slug = ${yearSlug}`;
yearId = rows[0]?.id;
}
if (yearId) {
const folders = group.withSimulacro ? ["Capacitación", "Simulacro"] : ["Capacitación"];
for (let f = 0; f < folders.length; f++) {
const folderName = folders[f] ?? "";
if (!folderName) continue;
const folderSlug = `${yearSlug}-${slugify(folderName)}`;
await sql`
INSERT INTO document_categories (name, slug, parent_id, sort_order)
VALUES (${folderName}, ${folderSlug}, ${yearId}, ${f + 1})
ON CONFLICT (slug) DO NOTHING
`;
}
}
}
}
}
}
}

// Subcategorias de "Detectores de Contaminación": Geiger Muller MN,
// Geiger Muller PR, Detector de Manos y Pies, Cámara de Ionización.
if (medicinaNuclearId) {
const detContSlug = `medicina-nuclear-${slugify("Detectores de Contaminación")}`;
const { rows: dcRows } = await sql`
SELECT id FROM document_categories
WHERE parent_id = ${medicinaNuclearId} AND slug = ${detContSlug}
`;
const detContId = dcRows[0]?.id as number | undefined;
if (detContId) {
const names: string[] = ["Geiger Muller MN", "Geiger Muller PR", "Detector de Manos y Pies", "Cámara de Ionización"];
for (let i = 0; i < names.length; i++) {
const name = names[i] ?? "";
if (!name) continue;
const slug = `${detContSlug}-${slugify(name)}`;
await sql`
INSERT INTO document_categories (name, slug, parent_id, sort_order)
VALUES (${name}, ${slug}, ${detContId}, ${i + 1})
ON CONFLICT (slug) DO NOTHING
`;
}
}
}

// Subcategorias de "Detectores Portátiles": Dosímetro de Lectura Directa
// Medicina Interna, Dosímetro de Lectura Directa OPR.
if (medicinaNuclearId) {
const detPortSlug = `medicina-nuclear-${slugify("Detectores Portátiles")}`;
const { rows: dpRows } = await sql`
SELECT id FROM document_categories
WHERE parent_id = ${medicinaNuclearId} AND slug = ${detPortSlug}
`;
const detPortId = dpRows[0]?.id as number | undefined;
if (detPortId) {
const names: string[] = ["Dosímetro de Lectura Directa Medicina Interna", "Dosímetro de Lectura Directa OPR"];
for (let i = 0; i < names.length; i++) {
const name = names[i] ?? "";
if (!name) continue;
const slug = `${detPortSlug}-${slugify(name)}`;
await sql`
INSERT INTO document_categories (name, slug, parent_id, sort_order)
VALUES (${name}, ${slug}, ${detPortId}, ${i + 1})
ON CONFLICT (slug) DO NOTHING
`;
}
}
}


// Nueva subcategoria "Administración de I-131" directamente dentro de
// MEDICINA NUCLEAR, con las mismas acciones que cualquier otra carpeta
// (subir, reemplazar, eliminar, descargar, vista previa, buscar).
if (medicinaNuclearId) {
const i131Name = "Administración de I-131";
const i131Slug = `medicina-nuclear-${slugify(i131Name)}`;
await sql`
INSERT INTO document_categories (name, slug, parent_id, sort_order)
VALUES (${i131Name}, ${i131Slug}, ${medicinaNuclearId}, 59)
ON CONFLICT (slug) DO NOTHING
`;
}


// --- Modulo Administracion de I-131 ---------------------------------------
// Tabla principal de administraciones (una fila = una dosis administrada a un
// paciente en una fecha). Se organiza cronologicamente por admin_date, con
// admin_year/admin_month/admin_day disponibles para filtros rapidos. Incluye
// campos preparados para futuras funciones (RUN, medico solicitante,
// procedencia, tipo de examen, equipo, motivo, protocolo) aunque no existian
// en la planilla original.
await sql`
CREATE TABLE IF NOT EXISTS i131_administrations (
id SERIAL PRIMARY KEY,
admin_year INTEGER NOT NULL,
admin_month INTEGER NOT NULL,
admin_day INTEGER NOT NULL,
admin_date DATE NOT NULL,
partida TEXT,
pedido_numero TEXT,
radiofarmaco TEXT NOT NULL DEFAULT 'I-131',
cantidad_solicitada NUMERIC,
paciente_nombre TEXT NOT NULL,
paciente_run TEXT,
ficha_clinica TEXT,
prevision TEXT,
diagnostico TEXT,
medico_solicitante TEXT,
procedencia TEXT,
tipo_examen TEXT,
equipo TEXT,
motivo TEXT,
protocolo TEXT,
tasa_dosis TEXT,
dosis_administrada NUMERIC,
responsable TEXT NOT NULL DEFAULT 'Médico Nuclear',
notas TEXT,
dedupe_key TEXT UNIQUE,
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
await sql`CREATE INDEX IF NOT EXISTS idx_i131_admin_date ON i131_administrations(admin_date)`;
await sql`CREATE INDEX IF NOT EXISTS idx_i131_paciente ON i131_administrations(lower(paciente_nombre))`;
await sql`CREATE INDEX IF NOT EXISTS idx_i131_radiofarmaco ON i131_administrations(radiofarmaco)`;
await sql`CREATE INDEX IF NOT EXISTS idx_i131_year_month ON i131_administrations(admin_year, admin_month)`;

// Catalogo de sugerencias inteligentes: acumula valores usados por campo y
// cuenta su frecuencia para alimentar el autocompletado del formulario.
await sql`
CREATE TABLE IF NOT EXISTS i131_field_suggestions (
id SERIAL PRIMARY KEY,
field_name TEXT NOT NULL,
value TEXT NOT NULL,
usage_count INTEGER NOT NULL DEFAULT 1,
last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
UNIQUE (field_name, value)
);
`;
await sql`CREATE INDEX IF NOT EXISTS idx_i131_suggestions_field ON i131_field_suggestions(field_name, usage_count DESC)`;

// Semilla historica: registros migrados desde la planilla "ADMINISTRACION DOSIS DE YODO"
// (hoja BD). Se preserva toda la informacion original tal cual fue registrada.
const { rows: i131Count } = await sql`SELECT COUNT(*)::int AS count FROM i131_administrations`;
if ((i131Count[0]?.count ?? 0) === 0) {
const i131SeedRows: Array<{
y: number; mo: number; d: number; partida: string | null; pedido: string | null;
cantidad: number | null; paciente: string; tasaDosis: string | null; dosis: number | null;
ficha: string | null; prevision: string | null; diagnostico: string | null; responsable: string | null;
}> = [
  { y: 2026, mo: 7, d: 10, partida: "3137", pedido: "M10626005", cantidad: 100, paciente: "Javiera Constanza Marquez Cardenas", tasaDosis: null, dosis: 95, ficha: "145487", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 7, d: 10, partida: "3135", pedido: "M10626005", cantidad: 30, paciente: "Claudia Alejandra Gonzalez Reyes", tasaDosis: null, dosis: 27, ficha: "381782", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 7, d: 10, partida: "3136", pedido: "M10626005", cantidad: 30, paciente: "Dalila Odeth San Martin Muñoz", tasaDosis: null, dosis: 27, ficha: "724766", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 7, d: 10, partida: "3134", pedido: "M10626005", cantidad: 20, paciente: "Stephanie Betzabe Diaz Leiva", tasaDosis: null, dosis: 22, ficha: "734898", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 7, d: 3, partida: "3016", pedido: "M10626005", cantidad: 30, paciente: "Margarita Ines Venegas Vega", tasaDosis: null, dosis: 33, ficha: "911483", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 7, d: 3, partida: "3017", pedido: "M10626005", cantidad: 30, paciente: "Paola Beatriz Saravia Navarrete", tasaDosis: null, dosis: 31, ficha: "1292560", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 7, d: 3, partida: "3018", pedido: "M10626005", cantidad: 30, paciente: "Marcela Alejandra Albarran Flores", tasaDosis: null, dosis: 28, ficha: "1277201", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 7, d: 3, partida: "3019", pedido: "M10626005", cantidad: 150, paciente: "Aurora del Carmen Estrada Ramirez", tasaDosis: null, dosis: 138, ficha: "27245", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 6, d: 26, partida: "107252", pedido: "M10626005", cantidad: 30, paciente: "Estela Leiva Antileo", tasaDosis: null, dosis: 29, ficha: "107252", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 6, d: 26, partida: "2917", pedido: "M10626005", cantidad: 30, paciente: "Rosa Maria Morales Millaqueo", tasaDosis: null, dosis: 29, ficha: "36956", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 6, d: 26, partida: "2916", pedido: "M10626005", cantidad: 20, paciente: "Luisa Lina Cural Curivil", tasaDosis: null, dosis: 19, ficha: "26613", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 6, d: 26, partida: "2919", pedido: "M10626005", cantidad: 150, paciente: "Jorge Edgardo Perez Muñoz", tasaDosis: null, dosis: 147, ficha: "22433", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 6, d: 19, partida: "2830", pedido: "M10626005", cantidad: 20, paciente: "Margarita Erika Barrientos Lipilao", tasaDosis: null, dosis: 19, ficha: "1305107", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 6, d: 19, partida: "2831", pedido: "M10626005", cantidad: 20, paciente: "Viola Del Rosario Ojeda Ruiz", tasaDosis: null, dosis: 18, ficha: "109322", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 6, d: 19, partida: "2832", pedido: "M10626005", cantidad: 20, paciente: "Emilia Patricia Llancañir Mora", tasaDosis: null, dosis: 18, ficha: "1238559", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 6, d: 19, partida: "2829", pedido: "M10626005", cantidad: 20, paciente: "Maria Elena Urrutia Riquelme", tasaDosis: null, dosis: 21, ficha: "899718", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 6, d: 19, partida: "2833", pedido: "M10626005", cantidad: 100, paciente: "Marcos Juvenal Coloma Saez", tasaDosis: null, dosis: 96, ficha: "31020", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 6, d: 5, partida: "1940", pedido: "M10426004", cantidad: 10, paciente: "Alejandra Guillermina Dominguez Hechtle", tasaDosis: null, dosis: 6, ficha: null, prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 6, d: 5, partida: "2053", pedido: "M10426004", cantidad: 20, paciente: "Luis Antonio Carrasco Peña", tasaDosis: null, dosis: 22, ficha: "421110", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 6, d: 5, partida: "2052", pedido: "M10426004", cantidad: 20, paciente: "Luis Felipe Vidal Segura", tasaDosis: null, dosis: 22, ficha: "1305220", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 6, d: 5, partida: "2055", pedido: "M10426004", cantidad: 100, paciente: "Javiera Francisca Meliñir Marihuan", tasaDosis: null, dosis: 93, ficha: "1191890", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 6, d: 5, partida: "2054", pedido: "M10426004", cantidad: 100, paciente: "Javiera Francisca Meliñir Marihuan", tasaDosis: null, dosis: 98, ficha: "1191890", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 5, d: 29, partida: "1942", pedido: "M10426004", cantidad: 30, paciente: "Nathaly Huenchual Escobar", tasaDosis: null, dosis: 30, ficha: "776665", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 5, d: 29, partida: "1941", pedido: "M10426004", cantidad: 30, paciente: "Julio Jara Delgado", tasaDosis: null, dosis: 30, ficha: "1278753", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 5, d: 29, partida: null, pedido: "M10426004", cantidad: 150, paciente: "Maria Cecilia Rifo Muñoz", tasaDosis: null, dosis: 141, ficha: "1266944", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 5, d: 15, partida: "1822", pedido: "M10426003", cantidad: 20, paciente: "Laura Burgos Medina", tasaDosis: null, dosis: 19, ficha: "78765", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 5, d: 15, partida: "1823", pedido: "M10426003", cantidad: 30, paciente: "Jose Lizama Vera", tasaDosis: null, dosis: 28, ficha: "147729", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 5, d: 15, partida: "1824", pedido: "M10426003", cantidad: 30, paciente: "Sofia Martinez Parra", tasaDosis: null, dosis: 28, ficha: "160798", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 5, d: 15, partida: "1825", pedido: "M10426003", cantidad: 30, paciente: "Juan Igor Catricura", tasaDosis: null, dosis: 28, ficha: "147524", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 5, d: 1, partida: "1644", pedido: "M10426003", cantidad: 100, paciente: "Hector Castillo Molina", tasaDosis: null, dosis: 99, ficha: "347594", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 5, d: 1, partida: "1645", pedido: "M10426003", cantidad: 100, paciente: "Hector Castillo Molina", tasaDosis: null, dosis: 100, ficha: "347594", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 4, d: 30, partida: "1642", pedido: "M10426003", cantidad: 30, paciente: "Sergio Fabian Garrido Garrido", tasaDosis: null, dosis: 32, ficha: "24241", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 4, d: 30, partida: "1641", pedido: "M10426003", cantidad: 20, paciente: "Dariela Iveth Castro Gatica", tasaDosis: null, dosis: 22, ficha: "197886", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 4, d: 30, partida: "1643", pedido: "M10426003", cantidad: 30, paciente: "Karina Johana Araneda Leiva", tasaDosis: null, dosis: 33, ficha: "134937", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 4, d: 24, partida: "1615", pedido: "M10426003", cantidad: 100, paciente: "Angela Quintriqueo Nahuelan", tasaDosis: null, dosis: 103, ficha: "120048", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 4, d: 24, partida: "1614", pedido: "M10426003", cantidad: 30, paciente: "Pamela Montre Morales", tasaDosis: null, dosis: 30.1, ficha: "134232", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 4, d: 24, partida: "1613", pedido: "M10426003", cantidad: 30, paciente: "Yessenia Yañez Yañez", tasaDosis: null, dosis: 30.1, ficha: "1280801", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 4, d: 10, partida: "1432", pedido: "M10326002", cantidad: 100, paciente: "Cecilia Ponce Valenzuela", tasaDosis: null, dosis: 98, ficha: "61369", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 4, d: 10, partida: "1430", pedido: "M10326002", cantidad: 30, paciente: "Maria Jose Meza Collinao", tasaDosis: null, dosis: 29, ficha: "144125", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 4, d: 10, partida: "1431", pedido: "M10326002", cantidad: 50, paciente: "Eduardo Leal Chavez", tasaDosis: null, dosis: 47, ficha: "928305", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 3, d: 27, partida: "1257", pedido: "M10126001", cantidad: 10, paciente: "", tasaDosis: null, dosis: null, ficha: null, prevision: "FONASA", diagnostico: "PROGRAMADA PARA EXPLORACION DG, PACIENTE TENIA PROGRAMADA CIRUGIA, SE DIFIERE", responsable: "VICTOR VERA" },
  { y: 2026, mo: 3, d: 27, partida: "1258", pedido: "M10126001", cantidad: 20, paciente: "Luis Humberto Rodriguez Fuentes", tasaDosis: null, dosis: 20, ficha: "110107", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 3, d: 27, partida: "1259", pedido: "M10126001", cantidad: 20, paciente: "Jesenia Araceli Palma Henriquez", tasaDosis: null, dosis: 20, ficha: "1275809", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 3, d: 27, partida: "1260", pedido: "M10126001", cantidad: 20, paciente: "Maria Angelica Leal Sandoval", tasaDosis: null, dosis: 19, ficha: "43517", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 3, d: 20, partida: "1174", pedido: "M10126001", cantidad: 20, paciente: "Veronica de Lourdes Fuentes Opazo", tasaDosis: null, dosis: 19, ficha: "1298568", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 3, d: 20, partida: "1173", pedido: "M10126001", cantidad: 20, paciente: "Cinthia Paola Diaz Lopez", tasaDosis: null, dosis: 19, ficha: "1111797", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 3, d: 20, partida: "1172", pedido: "M10126001", cantidad: 20, paciente: "Maryorie Yalily Hormazabal Concha", tasaDosis: null, dosis: 19, ficha: "729102", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 2, d: 13, partida: null, pedido: "M10126001", cantidad: 150, paciente: "Cristobal Andres Figueroa Muñoz", tasaDosis: null, dosis: 145, ficha: "128804", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 2, d: 13, partida: "978", pedido: "M10126001", cantidad: 29, paciente: "Pabla Luisa Salazar Oliveros", tasaDosis: null, dosis: 29, ficha: "1262781", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 2, d: 13, partida: "976", pedido: "M10126001", cantidad: 29, paciente: "Scarlett Marucela Rubilar Tapia", tasaDosis: null, dosis: 29, ficha: "777919", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 2, d: 6, partida: "853", pedido: "M11225015", cantidad: 10, paciente: "Bersabeth Gonzalez Fuentes", tasaDosis: null, dosis: null, ficha: null, prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 2, d: 6, partida: "913", pedido: "M11225015", cantidad: 50, paciente: "Aura Alicia Vidal Sinisterra", tasaDosis: "101", dosis: 54, ficha: "61039", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 2, d: 6, partida: "855", pedido: "M11225015", cantidad: 100, paciente: "Aura Alicia Vidal Sinisterra", tasaDosis: "101", dosis: 47, ficha: "61039", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 1, d: 23, partida: "751", pedido: "M11225015", cantidad: 20, paciente: "Soledad Maldonado Bustamante", tasaDosis: null, dosis: 21, ficha: "259893", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 1, d: 23, partida: "752", pedido: "M11225015", cantidad: 20, paciente: "Elizabeth Giacomozzi Reyes", tasaDosis: null, dosis: 22, ficha: "1295714", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 1, d: 23, partida: "750", pedido: "M11225015", cantidad: 20, paciente: "Ricardo Castro Martinez", tasaDosis: null, dosis: 20, ficha: "1200726", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 1, d: 16, partida: "656", pedido: "M11225015", cantidad: 30, paciente: "Viviana Figueroa Rodriguez", tasaDosis: null, dosis: 26, ficha: "57383", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 1, d: 16, partida: "654", pedido: "M11225015", cantidad: 20, paciente: "Daniela Verdugo Montanares", tasaDosis: null, dosis: 18, ficha: "540601", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 1, d: 16, partida: "657", pedido: "M11225015", cantidad: 100, paciente: "Audolina Aliante Ñancupan", tasaDosis: null, dosis: 102, ficha: "74642", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2026, mo: 1, d: 16, partida: "655", pedido: "M11225015", cantidad: 30, paciente: "Yacqueline Colipe Schmidt", tasaDosis: null, dosis: 30, ficha: "152089", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 12, d: 12, partida: "4902", pedido: "M11125013", cantidad: 100, paciente: "Jose Figueroa Mendoza", tasaDosis: null, dosis: 60, ficha: "1277001", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 12, d: 12, partida: "5035", pedido: "M11125013", cantidad: 100, paciente: "Jose Figueroa Mendoza", tasaDosis: null, dosis: 99, ficha: "1277001", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 12, d: 5, partida: "4901", pedido: "M11125013", cantidad: 30, paciente: "Ana Delicia Mendoza Castillo", tasaDosis: null, dosis: 33, ficha: "141326", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 12, d: 5, partida: "4900", pedido: "M11125013", cantidad: 30, paciente: "Elizabeth Andrea Jaramillo Levil", tasaDosis: null, dosis: 33, ficha: "125558", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 11, d: 28, partida: "4864", pedido: "M10925012", cantidad: 30, paciente: "Ana Silva Burgos", tasaDosis: null, dosis: 27, ficha: "1263657", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 11, d: 28, partida: "4865", pedido: "M10925012", cantidad: 50, paciente: "Amada Aqueveque Guerrero", tasaDosis: null, dosis: 45, ficha: "1271784", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 11, d: 21, partida: "4781", pedido: "M10925012", cantidad: 100, paciente: "Camila Painen Nain", tasaDosis: null, dosis: 96, ficha: "117874", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 11, d: 21, partida: "4655", pedido: "M10925012", cantidad: 10, paciente: "Ana Maria Herrera Acevedo", tasaDosis: null, dosis: 6, ficha: null, prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 11, d: 21, partida: "4654", pedido: "M10925012", cantidad: 10, paciente: "Anita Cristina Vargas Velasquez", tasaDosis: null, dosis: 6, ficha: null, prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 11, d: 21, partida: "4653", pedido: "M10925012", cantidad: 10, paciente: "Maria Isabel Sanhueza Carrillo", tasaDosis: null, dosis: 6, ficha: null, prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 11, d: 14, partida: null, pedido: "M10925012", cantidad: 20, paciente: "Valentina Diaz Aravena", tasaDosis: null, dosis: 23, ficha: "128735", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 10, d: 10, partida: "4524", pedido: null, cantidad: 30, paciente: "Ximena Claverie Valenzuela", tasaDosis: null, dosis: 33, ficha: "1238030", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 11, d: 7, partida: "4524", pedido: "M10925012", cantidad: 29, paciente: "Clara Huenchual Navarrete", tasaDosis: null, dosis: 29, ficha: "1261050", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 11, d: 7, partida: "4526", pedido: "M10925012", cantidad: 50, paciente: "Claudia Bustos Fuentes", tasaDosis: null, dosis: 50, ficha: "781570", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 11, d: 7, partida: "4527", pedido: "M10925012", cantidad: 100, paciente: "Maria Sepulveda Lavin", tasaDosis: null, dosis: 93, ficha: "667552", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 11, d: 7, partida: "4525", pedido: "M10925012", cantidad: 29, paciente: "Maritza Valderrama Navarrete", tasaDosis: null, dosis: 31, ficha: "1254360", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 10, d: 17, partida: "4339", pedido: null, cantidad: 20, paciente: "Yudihx Marin Mellado", tasaDosis: null, dosis: 19, ficha: "1247220", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 10, d: 17, partida: "4338", pedido: null, cantidad: 20, paciente: "Nidia Ñancupil Ñancuan", tasaDosis: null, dosis: 19, ficha: "734443", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 10, d: 17, partida: "4337", pedido: null, cantidad: 18, paciente: "Fabiola Flores Pinto", tasaDosis: null, dosis: 20, ficha: "228078", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 9, d: 12, partida: "3995", pedido: "M10825010", cantidad: 18, paciente: "Sandra Valencia Caicedo", tasaDosis: null, dosis: 20, ficha: "49160", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 9, d: 12, partida: "3997", pedido: "M10825010", cantidad: 18, paciente: "Marlenne Luengo Leal", tasaDosis: null, dosis: 19, ficha: "76334", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 9, d: 12, partida: "3996", pedido: "M10825010", cantidad: 20, paciente: "Edwin Duque Rosales", tasaDosis: null, dosis: 20, ficha: "54256", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 8, d: 8, partida: "3620", pedido: "M10725008", cantidad: 20, paciente: "Scarlett Antipe Vasquez", tasaDosis: null, dosis: 20, ficha: "90372", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 7, d: 4, partida: "3154", pedido: "M10525007", cantidad: 20, paciente: "Gloria Cayupul Ñanco", tasaDosis: null, dosis: 19, ficha: "445779", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 7, d: 4, partida: "3153", pedido: "M10525007", cantidad: 25, paciente: "Margarita Rain Paillamil", tasaDosis: null, dosis: 27, ficha: "586", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 7, d: 4, partida: "3152", pedido: "M1052007", cantidad: 18, paciente: "Hector Huenupil Antillanca", tasaDosis: null, dosis: 19, ficha: "47562", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 7, d: 4, partida: "3151", pedido: "M1052007", cantidad: 18, paciente: "Javier Rojas Valdes", tasaDosis: null, dosis: 19, ficha: "4817", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 4, d: 25, partida: "1797", pedido: "M10325004", cantidad: 50, paciente: "Karina Montecinos Cayufilo", tasaDosis: null, dosis: 48, ficha: "1230769", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 4, d: 25, partida: "1798", pedido: "M10325004", cantidad: 100, paciente: "Alicia Garrido Fernandez", tasaDosis: null, dosis: 95, ficha: "327792", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 6, d: 13, partida: "2404", pedido: "M10525006", cantidad: 18, paciente: "Norma Huenulao Veloso", tasaDosis: null, dosis: 20, ficha: "2004488", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 6, d: 13, partida: "2401", pedido: "M10525006", cantidad: 20, paciente: "Ana Torres Opazo", tasaDosis: null, dosis: 20, ficha: "1282392", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 6, d: 6, partida: "2335", pedido: "M10525006", cantidad: 29, paciente: "Celso Gonzalez Pino", tasaDosis: null, dosis: 29, ficha: "1250814", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 6, d: 6, partida: "2336", pedido: "M10525006", cantidad: 29, paciente: "Carla Aravena Seguel", tasaDosis: null, dosis: 29, ficha: "1262722", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 6, d: 13, partida: "2402", pedido: "M10525006", cantidad: 20, paciente: "Gloria Leiva Sobarzo", tasaDosis: null, dosis: 21, ficha: "1269399", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 4, d: 11, partida: "2403", pedido: "M10525006", cantidad: 18, paciente: "Maribel Navarrete Vidal", tasaDosis: null, dosis: 20, ficha: "1274803", prevision: "FONASA", diagnostico: "HIPERTIROIDISMO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 5, d: 9, partida: "1989", pedido: "M10425005", cantidad: 100, paciente: "Macarena Elgueta Pereira", tasaDosis: null, dosis: 98, ficha: "890761", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 5, d: 23, partida: "2164", pedido: "M10425005", cantidad: 100, paciente: "Flor Cofre Mondaca", tasaDosis: null, dosis: 101, ficha: "85527", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 5, d: 9, partida: "1987", pedido: "M10425005", cantidad: 29, paciente: "Juana Contreras Navarrete", tasaDosis: null, dosis: 32, ficha: "111248", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 5, d: 9, partida: "1988", pedido: "M10425005", cantidad: 29, paciente: "Juana Contreras Navarrete", tasaDosis: null, dosis: 31, ficha: "1212139", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 5, d: 9, partida: "1990", pedido: "M10425005", cantidad: 50, paciente: "Yenny Muñoz Mellado", tasaDosis: null, dosis: 49, ficha: "1261032", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 5, d: 15, partida: "1989", pedido: "M10425005", cantidad: 29, paciente: "Susan Quilodran Acuña", tasaDosis: null, dosis: 30, ficha: "1270698", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 5, d: 23, partida: "2165", pedido: "M10425005", cantidad: 29, paciente: "Victor Espinoza Figueroa", tasaDosis: null, dosis: 31, ficha: "103445", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 5, d: 23, partida: "2166", pedido: "M10425005", cantidad: 29, paciente: "Guacolda Traipe Hueniñir", tasaDosis: null, dosis: 31, ficha: "1077120", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 5, d: 30, partida: "2167", pedido: "M10425005", cantidad: 50, paciente: "Claudia Huentenao Painehual", tasaDosis: null, dosis: 52, ficha: "798847", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 5, d: 30, partida: "2253", pedido: "M10525006", cantidad: 50, paciente: "Cecilia Escobar Ulloa", tasaDosis: null, dosis: 49, ficha: "1271086", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 5, d: 30, partida: "2250", pedido: "M10525006", cantidad: 29, paciente: "Ingrid Nahuelan Astete", tasaDosis: null, dosis: 30, ficha: "117867", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 5, d: 30, partida: "2251", pedido: "M10525006", cantidad: 29, paciente: "Mannoly Leon Benavides", tasaDosis: null, dosis: 30, ficha: "1269418", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
  { y: 2025, mo: 5, d: 30, partida: "2252", pedido: "M10525006", cantidad: 29, paciente: "Feliz Monsalves Contreras", tasaDosis: "29", dosis: 29, ficha: "1267607", prevision: "FONASA", diagnostico: "CANCER DE TIROIDES OPERADO", responsable: "VICTOR VERA" },
];

for (const r of i131SeedRows) {
const admin_date = `${r.y}-${String(r.mo).padStart(2, "0")}-${String(r.d).padStart(2, "0")}`;
const dedupeKey = [admin_date, (r.ficha ?? "").toUpperCase(), r.paciente.trim().toUpperCase(), r.dosis ?? "", r.partida ?? ""].join("|");
await sql`
INSERT INTO i131_administrations (
admin_year, admin_month, admin_day, admin_date, partida, pedido_numero, radiofarmaco,
cantidad_solicitada, paciente_nombre, ficha_clinica, prevision, diagnostico, tasa_dosis,
dosis_administrada, responsable, dedupe_key
) VALUES (
${r.y}, ${r.mo}, ${r.d}, ${admin_date}, ${r.partida}, ${r.pedido}, 'I-131',
${r.cantidad}, ${r.paciente}, ${r.ficha}, ${r.prevision}, ${r.diagnostico}, ${r.tasaDosis},
${r.dosis}, ${r.responsable || "Médico Nuclear"}, ${dedupeKey}
)
ON CONFLICT (dedupe_key) DO NOTHING
`;

const suggestionPairs: [string, string | null][] = [
["radiofarmaco", "I-131"],
["diagnostico", r.diagnostico],
["prevision", r.prevision],
["paciente_nombre", r.paciente],
];
for (const [field, value] of suggestionPairs) {
if (!value) continue;
await sql`
INSERT INTO i131_field_suggestions (field_name, value, usage_count, last_used_at)
VALUES (${field}, ${value}, 1, now())
ON CONFLICT (field_name, value) DO UPDATE SET
usage_count = i131_field_suggestions.usage_count + 1,
last_used_at = now()
`;
}
}
}


// Nueva subcategoria "Registro de Contaminación" directamente dentro de
// MEDICINA NUCLEAR, con las mismas acciones que cualquier otra carpeta
// (subir, reemplazar, eliminar, descargar, vista previa, buscar).
if (medicinaNuclearId) {
const contName = "Registro de Contaminación";
const contSlug = `medicina-nuclear-${slugify(contName)}`;
await sql`
INSERT INTO document_categories (name, slug, parent_id, sort_order)
VALUES (${contName}, ${contSlug}, ${medicinaNuclearId}, 60)
ON CONFLICT (slug) DO NOTHING
`;
}

// --- Modulo Registro de Contaminacion --------------------------------------
// Monitoreo de contaminacion superficial. Cada fila es una medicion en un
// punto/fecha determinados. Los campos calculados (conteo neto, actividad
// superficial en Bq/cm2 y Bq/m2, porcentaje del limite, clasificacion y
// semaforo) se recalculan siempre en el backend (ver /api/contamination),
// nunca se ingresan manualmente. Ver src/lib/contamination.ts para el
// detalle y la validacion cientifica de las formulas empleadas.
await sql`
CREATE TABLE IF NOT EXISTS contamination_records (
id SERIAL PRIMARY KEY,
monitor_year INTEGER NOT NULL,
monitor_month INTEGER NOT NULL,
monitor_day INTEGER NOT NULL,
monitor_date DATE NOT NULL,
area TEXT,
sala TEXT,
dependencia TEXT,
punto_medicion TEXT NOT NULL,
equipo TEXT,
superficie TEXT,
radionuclido TEXT NOT NULL DEFAULT 'TC-99M',
instrumento TEXT,
numero_serie_detector TEXT,
factor_calibracion NUMERIC,
factor_eficiencia NUMERIC NOT NULL DEFAULT 0.15,
area_monitoreada_cm2 NUMERIC NOT NULL DEFAULT 15,
tiempo_medicion_seg NUMERIC,
fondo_cps NUMERIC NOT NULL DEFAULT 0,
conteo_bruto_cps NUMERIC NOT NULL DEFAULT 0,
conteo_neto_cps NUMERIC NOT NULL DEFAULT 0,
actividad_bq_cm2 NUMERIC NOT NULL DEFAULT 0,
actividad_bq_m2 NUMERIC NOT NULL DEFAULT 0,
tasa_dosis_usv_h NUMERIC,
limite_bq_m2_aplicado NUMERIC,
pct_limite NUMERIC,
clasificacion TEXT NOT NULL DEFAULT 'sin_contaminacion',
semaforo TEXT NOT NULL DEFAULT 'verde',
requiere_limpieza BOOLEAN NOT NULL DEFAULT false,
limpieza_realizada BOOLEAN NOT NULL DEFAULT false,
conteo_post_limpieza_cps NUMERIC,
actividad_post_limpieza_bq_cm2 NUMERIC,
factor_descontaminacion NUMERIC,
pct_actividad_residual NUMERIC,
accion_correctiva TEXT,
estado TEXT NOT NULL DEFAULT 'ABIERTO',
motivo TEXT,
responsable TEXT NOT NULL,
observaciones TEXT,
dedupe_key TEXT UNIQUE,
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
await sql`CREATE INDEX IF NOT EXISTS idx_contamination_date ON contamination_records(monitor_date)`;
await sql`CREATE INDEX IF NOT EXISTS idx_contamination_punto ON contamination_records(lower(punto_medicion))`;
await sql`CREATE INDEX IF NOT EXISTS idx_contamination_radionuclido ON contamination_records(radionuclido)`;
await sql`CREATE INDEX IF NOT EXISTS idx_contamination_year_month ON contamination_records(monitor_year, monitor_month)`;
await sql`CREATE INDEX IF NOT EXISTS idx_contamination_clasificacion ON contamination_records(clasificacion)`;

// Catalogo de sugerencias inteligentes (autocompletado), igual patron que I-131.
await sql`
CREATE TABLE IF NOT EXISTS contamination_field_suggestions (
id SERIAL PRIMARY KEY,
field_name TEXT NOT NULL,
value TEXT NOT NULL,
usage_count INTEGER NOT NULL DEFAULT 1,
last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
UNIQUE (field_name, value)
);
`;
await sql`CREATE INDEX IF NOT EXISTS idx_contamination_suggestions_field ON contamination_field_suggestions(field_name, usage_count DESC)`;

// Historial de cambios (trazabilidad): se conserva incluso si el registro
// original es eliminado (no tiene FK con ON DELETE CASCADE), cumpliendo con
// el requisito de no eliminar la trazabilidad.
await sql`
CREATE TABLE IF NOT EXISTS contamination_history (
id SERIAL PRIMARY KEY,
record_id INTEGER NOT NULL,
action TEXT NOT NULL,
changed_by TEXT,
snapshot JSONB,
changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
await sql`CREATE INDEX IF NOT EXISTS idx_contamination_history_record ON contamination_history(record_id)`;

// Limites de contaminacion superficial configurables por radionuclido. Los
// valores por defecto son parametros iniciales razonables (consistentes con
// el nivel de referencia de 370.000 Bq/m2 ya utilizado en la planilla
// original para el caso general, aplicando un limite mas estricto para I-131
// dada su mayor radiotoxicidad). Deben ser revisados y ajustados por el
// Oficial de Proteccion Radiologica segun la normativa nacional vigente y las
// guias IAEA/ICRP aplicables: estos valores se pueden modificar en cualquier
// momento desde el panel "Limites" del modulo, sin tocar el codigo.
await sql`
CREATE TABLE IF NOT EXISTS contamination_limits (
id SERIAL PRIMARY KEY,
radionuclido TEXT UNIQUE NOT NULL,
limite_bq_m2 NUMERIC NOT NULL,
pct_registro NUMERIC NOT NULL DEFAULT 5,
pct_investigacion NUMERIC NOT NULL DEFAULT 30,
pct_intervencion NUMERIC NOT NULL DEFAULT 50,
unidad TEXT NOT NULL DEFAULT 'Bq/m2',
notas TEXT,
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

const { rows: limitsCount } = await sql`SELECT COUNT(*)::int AS count FROM contamination_limits`;
if ((limitsCount[0]?.count ?? 0) === 0) {
await sql`
INSERT INTO contamination_limits (radionuclido, limite_bq_m2, pct_registro, pct_investigacion, pct_intervencion, notas) VALUES
('TC-99M', 370000, 5, 30, 50, 'Valor por defecto configurable, consistente con el nivel de referencia usado en la planilla original. Debe ser validado por el OPR segun normativa vigente (IAEA/ICRP/normativa nacional).'),
('I-131', 37000, 5, 30, 50, 'Valor por defecto configurable, 10 veces mas estricto que Tc-99m dada la mayor radiotoxicidad del I-131 (afinidad tiroidea). Debe ser validado por el OPR segun normativa vigente.'),
('GENERICO', 370000, 5, 30, 50, 'Limite generico aplicado cuando el radionuclido registrado no tiene un limite especifico configurado.')
ON CONFLICT (radionuclido) DO NOTHING;
`;
}

// Semilla de areas y puntos de medicion segun el documento origen (planilla
  // "REGISTRO DE CONTAMINACION", hojas FORMULARIO/PLANILLA): alimenta el
  // autocompletado de "area" y "punto de medicion" para que esten disponibles
  // desde el primer uso, sin depender de que el usuario los escriba a mano.
  const contaminationAreaSeed: string[] = ["LABORATORIO", "SALA DE PACIENTES"];
  for (const value of contaminationAreaSeed) {
    await sql`
    INSERT INTO contamination_field_suggestions (field_name, value, usage_count, last_used_at)
    VALUES ('area', ${value}, 1, now())
    ON CONFLICT (field_name, value) DO NOTHING
    `;
  }
  
  const contaminationPuntoSeed: string[] = [
    "Mesón de laboratorio",
    "Bandejas",
    "Capacho plomado",
    "Mesa de punción",
    "Portajeringas",
    "Camilla laboratorio",
    "Piso gammacámara",
    "Sala de pacientes",
    "Piso baño de pacientes",
    "WC de pacientes",
    "Lavamanos pacientes",
    "Piso baño personal",
    "Lavamanos baño personal",
    "Basurero cortopunzante",
    ];
  for (const value of contaminationPuntoSeed) {
    await sql`
    INSERT INTO contamination_field_suggestions (field_name, value, usage_count, last_used_at)
    VALUES ('punto_medicion', ${value}, 1, now())
    ON CONFLICT (field_name, value) DO NOTHING
    `;
  }
  
  return NextResponse.json({ ok: true });
}
