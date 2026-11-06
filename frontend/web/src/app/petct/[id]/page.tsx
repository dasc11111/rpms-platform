import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { type PetctExam } from "@/lib/petct";
import { PetctExamDetail } from "@/components/petct/petct-exam-detail";

export const dynamic = "force-dynamic";

// Fase 23B — Ficha individual de examen PET/CT
// Dosimetría en vivo, cronología de workflow, gestión de estado y criterios
// de alta del paciente (DS 133/1984 Art. 22-26, IAEA HHS No. 1).
export default async function PetctExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id) || id <= 0) return notFound();

  let exam: PetctExam | null = null;
  try {
    const { rows } = await sql.query(
      `SELECT * FROM petct_examinations WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) return notFound();
    const r = rows[0] as Record<string, unknown>;
    exam = {
      ...r,
      id: String(r.id),
      injection_datetime: r.injection_datetime
        ? new Date(r.injection_datetime as string).toISOString()
        : "",
      exam_start: r.exam_start
        ? new Date(r.exam_start as string).toISOString()
        : null,
      exam_end: r.exam_end
        ? new Date(r.exam_end as string).toISOString()
        : null,
      created_at: r.created_at
        ? new Date(r.created_at as string).toISOString()
        : "",
      updated_at: r.updated_at
        ? new Date(r.updated_at as string).toISOString()
        : "",
      administered_mbq: Number(r.administered_mbq),
      patient_weight_kg: r.patient_weight_kg ? Number(r.patient_weight_kg) : null,
      uptake_minutes: Number(r.uptake_minutes),
    } as PetctExam;
  } catch {
    return notFound();
  }

  if (!exam) return notFound();

  return <PetctExamDetail exam={exam} />;
}
