/**
 * API de exportación CSV para módulo de Reportes
 * Genera archivos CSV descargables para los principales módulos de RPMS
 * DS 133/1984, DS 3/1985 MINSAL
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

function toCSV(rows: Record<string, unknown>[], columns: { key: string; label: string }[]): string {
  const header = columns.map((c) => `"${c.label}"`).join(",");
  const body = rows.map((row) =>
    columns
      .map((c) => {
        const val = row[c.key];
        if (val === null || val === undefined) return "";
        const s = String(val).replace(/"/g, '""');
        return `"${s}"`;
      })
      .join(",")
  );
  return [header, ...body].join("\r\n");
}

function csvResponse(csv: string, filename: string): NextResponse {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "summary";
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);

  try {
    switch (type) {
      case "workers": {
        const rows = await safeQuery(async () => {
          const { rows } = await sql`
            SELECT
              w.rut,
              w.dv,
              COALESCE(
                NULLIF(TRIM(CONCAT_WS(' ', w.last_name_1, w.last_name_2, w.first_names)), ''),
                w.name
              ) AS nombre,
              w.role,
              w.service,
              w.category,
              w.status,
              w.authorization_number,
              w.authorization_issue_date,
              w.authorization_expiry_date,
              w.course_pr_completed,
              w.course_pr_date,
              COALESCE(
                (SELECT SUM(hp10) FROM dosimetry_quarterly_readings qr
                 WHERE qr.worker_id = w.id AND qr.year = EXTRACT(YEAR FROM NOW())),
                0
              ) as dosis_anual_msv
            FROM workers w
            WHERE w.status IN ('active', 'suspended')
            ORDER BY w.service ASC, w.last_name_1 ASC, w.name ASC
            LIMIT 2000
          `;
          return rows as Record<string, unknown>[];
        }, []);
        const csv = toCSV(rows, [
          { key: "rut", label: "RUT" },
          { key: "dv", label: "DV" },
          { key: "nombre", label: "Nombre" },
          { key: "role", label: "Cargo" },
          { key: "service", label: "Servicio" },
          { key: "category", label: "Categoría ICRP" },
          { key: "status", label: "Estado" },
          { key: "authorization_number", label: "N° Autorización" },
          { key: "authorization_issue_date", label: "Fecha Emisión" },
          { key: "authorization_expiry_date", label: "Fecha Vencimiento" },
          { key: "course_pr_completed", label: "Curso PR" },
          { key: "course_pr_date", label: "Fecha Curso PR" },
          { key: "dosis_anual_msv", label: "Dosis Anual (mSv)" },
        ]);
        return csvResponse(csv, `registro_trabajadores_expuestos_${dateStr}.csv`);
      }

      case "i131": {
        const rows = await safeQuery(async () => {
          const { rows } = await sql`
            SELECT
              admin_date,
              paciente_nombre,
              paciente_run,
              ficha_clinica,
              sala,
              dosis_administrada,
              tasa_dosis,
              medico_solicitante,
              diagnostico,
              created_at
            FROM i131_administrations
            ORDER BY admin_date DESC, id DESC
            LIMIT 5000
          `;
          return rows as Record<string, unknown>[];
        }, []);
        const csv = toCSV(rows, [
          { key: "admin_date", label: "Fecha Administración" },
          { key: "paciente_nombre", label: "Paciente" },
          { key: "paciente_run", label: "RUN" },
          { key: "ficha_clinica", label: "Ficha Clínica" },
          { key: "sala", label: "Sala" },
          { key: "dosis_administrada", label: "Dosis (mCi)" },
          { key: "tasa_dosis", label: "Tasa de Dosis" },
          { key: "medico_solicitante", label: "Médico Solicitante" },
          { key: "diagnostico", label: "Diagnóstico" },
          { key: "created_at", label: "Fecha Registro" },
        ]);
        return csvResponse(csv, `registro_i131_${dateStr}.csv`);
      }

      case "compliance": {
        const rows = await safeQuery(async () => {
          const { rows } = await sql`
            SELECT
              code, requirement, regulation, article_ref, category, priority,
              owner, review_frequency, last_review_date, next_review_date, status,
              evidence_description, notes
            FROM compliance_requirements
            ORDER BY CASE priority
              WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4
            END, next_review_date ASC NULLS LAST
          `;
          return rows as Record<string, unknown>[];
        }, []);
        const csv = toCSV(rows, [
          { key: "code", label: "Código" },
          { key: "requirement", label: "Requisito" },
          { key: "regulation", label: "Regulación" },
          { key: "article_ref", label: "Artículo" },
          { key: "category", label: "Categoría" },
          { key: "priority", label: "Prioridad" },
          { key: "status", label: "Estado" },
          { key: "owner", label: "Responsable" },
          { key: "review_frequency", label: "Frecuencia Revisión" },
          { key: "last_review_date", label: "Última Revisión" },
          { key: "next_review_date", label: "Próxima Revisión" },
          { key: "evidence_description", label: "Evidencia" },
          { key: "notes", label: "Notas" },
        ]);
        return csvResponse(csv, `cumplimiento_normativo_${dateStr}.csv`);
      }

      case "incidents": {
        const rows = await safeQuery(async () => {
          const { rows } = await sql`
            SELECT
              event_date, event_time, category, severity, is_near_miss,
              location, person_involved, description, immediate_actions,
              notification_status, notified_to, investigation_status,
              corrective_actions, responsible, status, created_at
            FROM nm_incidents
            ORDER BY event_date DESC, id DESC
            LIMIT 5000
          `;
          return rows as Record<string, unknown>[];
        }, []);
        const csv = toCSV(rows, [
          { key: "event_date", label: "Fecha Evento" },
          { key: "event_time", label: "Hora" },
          { key: "category", label: "Categoría" },
          { key: "severity", label: "Severidad" },
          { key: "is_near_miss", label: "Cuasi-Accidente" },
          { key: "location", label: "Ubicación" },
          { key: "person_involved", label: "Persona Involucrada" },
          { key: "description", label: "Descripción" },
          { key: "immediate_actions", label: "Acciones Inmediatas" },
          { key: "notification_status", label: "Estado Notificación" },
          { key: "notified_to", label: "Notificado a" },
          { key: "investigation_status", label: "Estado Investigación" },
          { key: "corrective_actions", label: "Acciones Correctivas" },
          { key: "responsible", label: "Responsable" },
          { key: "status", label: "Estado" },
          { key: "created_at", label: "Fecha Registro" },
        ]);
        return csvResponse(csv, `incidentes_radiologicos_${dateStr}.csv`);
      }

      case "dosimetry": {
        const rows = await safeQuery(async () => {
          const { rows } = await sql`
            SELECT
              w.name as trabajador,
              w.rut,
              w.service,
              qr.year,
              qr.quarter,
              qr.hp10 as hp10_msv,
              qr.hp007 as hp007_msv,
              da.dosimeter_code,
              da.assigned_at,
              da.due_date,
              da.returned_at
            FROM dosimetry_quarterly_readings qr
            JOIN workers w ON w.id = qr.worker_id
            LEFT JOIN dosimeter_assignments da ON da.id = qr.assignment_id
            ORDER BY qr.year DESC, qr.quarter DESC, w.name ASC
            LIMIT 5000
          `;
          return rows as Record<string, unknown>[];
        }, []);
        const csv = toCSV(rows, [
          { key: "trabajador", label: "Trabajador" },
          { key: "rut", label: "RUT" },
          { key: "service", label: "Servicio" },
          { key: "year", label: "Año" },
          { key: "quarter", label: "Trimestre" },
          { key: "hp10_msv", label: "Hp(10) mSv" },
          { key: "hp007_msv", label: "Hp(0.07) mSv" },
          { key: "dosimeter_code", label: "Código Dosímetro" },
          { key: "assigned_at", label: "Fecha Asignación" },
          { key: "due_date", label: "Fecha Vencimiento" },
          { key: "returned_at", label: "Fecha Devolución" },
        ]);
        return csvResponse(csv, `dosimetria_individual_${dateStr}.csv`);
      }

      case "waste": {
        const rows = await safeQuery(async () => {
          const { rows } = await sql`
            SELECT
              record_code, radionuclide, waste_category, state,
              initial_activity_mbq, initial_activity_date,
              origin_area, generated_by, container_label,
              disposal_route, disposal_date, notes, created_at
            FROM waste_records
            ORDER BY initial_activity_date DESC, id DESC
            LIMIT 5000
          `;
          return rows as Record<string, unknown>[];
        }, []);
        const csv = toCSV(rows, [
          { key: "record_code", label: "Código" },
          { key: "radionuclide", label: "Radionúclido" },
          { key: "waste_category", label: "Categoría Residuo" },
          { key: "state", label: "Estado" },
          { key: "initial_activity_mbq", label: "Actividad Inicial (MBq)" },
          { key: "initial_activity_date", label: "Fecha Actividad Inicial" },
          { key: "origin_area", label: "Área de Origen" },
          { key: "generated_by", label: "Generado por" },
          { key: "container_label", label: "Etiqueta Contenedor" },
          { key: "disposal_route", label: "Vía Disposición" },
          { key: "disposal_date", label: "Fecha Disposición" },
          { key: "notes", label: "Notas" },
          { key: "created_at", label: "Fecha Registro" },
        ]);
        return csvResponse(csv, `gestion_residuos_radiactivos_${dateStr}.csv`);
      }

      case "equipment": {
        const rows = await safeQuery(async () => {
          const { rows } = await sql`
            SELECT
              inventory_number, name, equipment_type, brand, model, serial_number,
              location, status,
              authorization_number, authorization_issue_date, authorization_expiry_date,
              last_maintenance_date, next_maintenance_date,
              regulatory_class, tube_voltage_kv, power_kw,
              notes, created_at
            FROM radiology_equipment
            ORDER BY status ASC, equipment_type ASC, name ASC
            LIMIT 2000
          `;
          return rows as Record<string, unknown>[];
        }, []);
        const csv = toCSV(rows, [
          { key: "inventory_number", label: "N° Inventario" },
          { key: "name", label: "Nombre Equipo" },
          { key: "equipment_type", label: "Tipo" },
          { key: "brand", label: "Marca" },
          { key: "model", label: "Modelo" },
          { key: "serial_number", label: "N° Serie" },
          { key: "location", label: "Ubicación" },
          { key: "status", label: "Estado" },
          { key: "regulatory_class", label: "Clase Regulatoria" },
          { key: "authorization_number", label: "N° Autorización DS 133" },
          { key: "authorization_issue_date", label: "Fecha Emisión Autorización" },
          { key: "authorization_expiry_date", label: "Vencimiento Autorización" },
          { key: "tube_voltage_kv", label: "Voltaje tubo (kV)" },
          { key: "power_kw", label: "Potencia (kW)" },
          { key: "last_maintenance_date", label: "Último Mantenimiento" },
          { key: "next_maintenance_date", label: "Próximo Mantenimiento" },
          { key: "notes", label: "Notas" },
          { key: "created_at", label: "Fecha Registro" },
        ]);
        return csvResponse(csv, `equipos_radiologicos_${dateStr}.csv`);
      }

      case "summary":
      default: {
        // Resumen ejecutivo como CSV
        const [workers, incidents, compliance] = await Promise.all([
          safeQuery(async () => {
            const { rows } = await sql`
              SELECT status, COUNT(*) as count FROM workers GROUP BY status
            `;
            return rows as Record<string, unknown>[];
          }, [] as Record<string, unknown>[]),
          safeQuery(async () => {
            const { rows } = await sql`
              SELECT status, severity, COUNT(*) as count FROM nm_incidents GROUP BY status, severity
            `;
            return rows as Record<string, unknown>[];
          }, [] as Record<string, unknown>[]),
          safeQuery(async () => {
            const { rows } = await sql`
              SELECT status, priority, COUNT(*) as count FROM compliance_requirements GROUP BY status, priority
            `;
            return rows as Record<string, unknown>[];
          }, [] as Record<string, unknown>[]),
        ]);

        const summaryRows: Record<string, unknown>[] = [
          { seccion: "TRABAJADORES", indicador: "Activos", valor: workers.find((r) => r.status === "active")?.count ?? 0, unidad: "personas" },
          { seccion: "TRABAJADORES", indicador: "Suspendidos", valor: workers.find((r) => r.status === "suspended")?.count ?? 0, unidad: "personas" },
          { seccion: "INCIDENTES", indicador: "Abiertos", valor: incidents.filter((r) => r.status === "abierto").reduce((s, r) => s + Number(r.count), 0), unidad: "incidentes" },
          { seccion: "INCIDENTES", indicador: "Graves abiertos", valor: incidents.filter((r) => r.status === "abierto" && r.severity === "grave").reduce((s, r) => s + Number(r.count), 0), unidad: "incidentes" },
          { seccion: "CUMPLIMIENTO", indicador: "Al día", valor: compliance.filter((r) => r.status === "ok").reduce((s, r) => s + Number(r.count), 0), unidad: "requisitos" },
          { seccion: "CUMPLIMIENTO", indicador: "Pendientes", valor: compliance.filter((r) => r.status === "pendiente").reduce((s, r) => s + Number(r.count), 0), unidad: "requisitos" },
          { seccion: "CUMPLIMIENTO", indicador: "Vencidos", valor: compliance.filter((r) => r.status === "vencido").reduce((s, r) => s + Number(r.count), 0), unidad: "requisitos" },
        ];

        const csv = toCSV(summaryRows, [
          { key: "seccion", label: "Sección" },
          { key: "indicador", label: "Indicador" },
          { key: "valor", label: "Valor" },
          { key: "unidad", label: "Unidad" },
        ]);
        return csvResponse(csv, `resumen_ejecutivo_rpms_${dateStr}.csv`);
      }
    }
  } catch (err) {
    console.error("GET /api/reports/export", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
