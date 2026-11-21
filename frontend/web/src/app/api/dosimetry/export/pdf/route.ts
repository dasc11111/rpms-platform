/**
 * Exportación PDF — Informe Dosimétrico Individual
 * Lecturas trimestrales Hp(10) y Hp(0.07) por trabajador y servicio
 * Normativa: DS 3/1985 MINSAL — Protección Radiológica
 */
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getInstitutionInfo } from "@/lib/institution-settings";

export const dynamic = "force-dynamic";

interface DosimetryRow {
  trabajador: string;
  rut: string;
  service: string;
  year: number;
  quarter: number;
  hp10_msv: number | null;
  hp007_msv: number | null;
  dosimeter_code: string | null;
  assigned_at: string | null;
  due_date: string | null;
  returned_at: string | null;
}

interface WorkerSummary {
  name: string;
  rut: string;
  service: string;
  readings: DosimetryRow[];
  annualHp10: number;
  annualHp007: number;
  quarters: string[];
}

async function fetchDosimetryData(year?: number): Promise<DosimetryRow[]> {
  try {
    if (year) {
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
        WHERE qr.year = ${year}
        ORDER BY w.service ASC, w.name ASC, qr.quarter ASC
        LIMIT 5000
      `;
      return rows as DosimetryRow[];
    } else {
      const currentYear = new Date().getFullYear();
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
        WHERE qr.year = ${currentYear}
        ORDER BY w.service ASC, w.name ASC, qr.quarter ASC
        LIMIT 5000
      `;
      return rows as DosimetryRow[];
    }
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const institution = await getInstitutionInfo();
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    const rows = await fetchDosimetryData(year);

    // Group by worker
    const workerMap = new Map<string, WorkerSummary>();
    for (const row of rows) {
      const key = `${row.rut}|${row.trabajador}`;
      if (!workerMap.has(key)) {
        workerMap.set(key, {
          name: row.trabajador,
          rut: row.rut ?? "—",
          service: row.service ?? "—",
          readings: [],
          annualHp10: 0,
          annualHp007: 0,
          quarters: [],
        });
      }
      const w = workerMap.get(key)!;
      w.readings.push(row);
      w.annualHp10 += Number(row.hp10_msv ?? 0);
      w.annualHp007 += Number(row.hp007_msv ?? 0);
      w.quarters.push(`T${row.quarter}`);
    }

    // Group workers by service
    const serviceMap = new Map<string, WorkerSummary[]>();
    for (const worker of workerMap.values()) {
      const svc = worker.service;
      if (!serviceMap.has(svc)) serviceMap.set(svc, []);
      serviceMap.get(svc)!.push(worker);
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString("es-CL", { dateStyle: "long" });
    const dateFile = now.toISOString().slice(0, 10);

    // DS 3/1985 MINSAL annual dose limits (whole body)
    const LIMIT_HP10 = 20; // mSv/year effective dose
    const LIMIT_HP007 = 500; // mSv/year skin dose

    // Dynamic imports (Node-compatible)
    const { jsPDF } = await import("jspdf");
    // @ts-ignore — no types for autotable default import
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = 210;

    // ── Header ──────────────────────────────────────────────────────────────────
    doc.setFillColor(15, 60, 110);
    doc.rect(0, 0, pageW, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Informe Dosimétrico Individual", 14, 11);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(institution.name, 14, 18);
    doc.setFontSize(7.5);
    const dosOprLine = institution.opr_name ? `OPR: ${institution.opr_name}  ·  ` : "";
    doc.text(`${dosOprLine}Lecturas trimestrales Hp(10)/Hp(0.07) — Año ${year}  ·  Generado: ${dateStr}`, 14, 24);

    // ── Regulatory note ────────────────────────────────────────────────────────
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(7.5);
    doc.text(
      `Normativa: DS 3/1985 MINSAL — Límites: Hp(10) ≤ ${LIMIT_HP10} mSv/año (cuerpo entero) · Hp(0.07) ≤ ${LIMIT_HP007} mSv/año (piel)`,
      14, 34
    );

    let startY = 38;
    const totalWorkers = workerMap.size;
    const workersExceedHp10 = [...workerMap.values()].filter(
      (w) => w.annualHp10 > LIMIT_HP10
    ).length;

    // ── Summary banner ─────────────────────────────────────────────────────────
    const bannerColor: [number, number, number] =
      workersExceedHp10 > 0 ? [220, 38, 38] : rows.length === 0 ? [100, 100, 100] : [22, 163, 74];
    doc.setFillColor(...bannerColor);
    doc.roundedRect(14, startY, pageW - 28, 9, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    const bannerText =
      rows.length === 0
        ? `Sin lecturas registradas para ${year}`
        : workersExceedHp10 > 0
        ? `${workersExceedHp10} trabajador(es) supera(n) límite anual Hp(10) — Acción correctiva requerida`
        : `${totalWorkers} trabajador(es) dentro de límites normativos DS 3/1985`;
    doc.text(bannerText, pageW / 2, startY + 6, { align: "center" });

    startY += 13;

    // ── Summary table ──────────────────────────────────────────────────────────
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Resumen por trabajador", 14, startY);
    startY += 3;

    const summaryRows = [...workerMap.values()].map((w) => {
      const hp10 = w.annualHp10.toFixed(3);
      const hp007 = w.annualHp007.toFixed(3);
      const hp10Status = w.annualHp10 > LIMIT_HP10 ? "SUPERA LÍMITE" : w.annualHp10 > LIMIT_HP10 * 0.75 ? "75% límite" : "OK";
      const hp007Status = w.annualHp007 > LIMIT_HP007 ? "SUPERA LÍMITE" : "OK";
      return [w.name, w.rut, w.service, hp10, hp007, hp10Status, hp007Status];
    });

    autoTable(doc, {
      startY,
      head: [["Trabajador", "RUT", "Servicio", "Hp(10) mSv", "Hp(0.07) mSv", "Est. Hp(10)", "Est. Hp(0.07)"]],
      body: summaryRows.length > 0 ? summaryRows : [["Sin lecturas", "—", "—", "—", "—", "—", "—"]],
      theme: "grid",
      headStyles: { fillColor: [15, 60, 110], textColor: 255, fontSize: 7.5, fontStyle: "bold" },
      bodyStyles: { fontSize: 7, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 46 },
        1: { cellWidth: 24 },
        2: { cellWidth: 30 },
        3: { cellWidth: 20, halign: "right" },
        4: { cellWidth: 22, halign: "right" },
        5: { cellWidth: 20, halign: "center" },
        6: { cellWidth: 20, halign: "center" },
      },
      didDrawCell: (data: any) => {
        if (data.section === "body" && (data.column.index === 5 || data.column.index === 6)) {
          const val = String(data.cell.raw ?? "");
          if (val === "SUPERA LÍMITE") {
            doc.setTextColor(220, 38, 38);
            doc.setFont("helvetica", "bold");
          } else if (val === "75% límite") {
            doc.setTextColor(202, 138, 4);
            doc.setFont("helvetica", "bold");
          } else {
            doc.setTextColor(22, 163, 74);
            doc.setFont("helvetica", "bold");
          }
        }
      },
    });

    startY = (doc as any).lastAutoTable.finalY + 10;

    // ── Quarterly detail per service ───────────────────────────────────────────
    for (const [service, workers] of serviceMap.entries()) {
      // Check for page break
      if (startY > 240) {
        doc.addPage();
        startY = 15;
      }

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`Servicio: ${service}`, 14, startY);
      startY += 3;

      // Build quarterly rows for all workers in this service
      const detailRows: string[][] = [];
      for (const worker of workers) {
        const quarterMap: Record<number, { hp10: number; hp007: number }> = {};
        for (const r of worker.readings) {
          quarterMap[r.quarter] = {
            hp10: Number(r.hp10_msv ?? 0),
            hp007: Number(r.hp007_msv ?? 0),
          };
        }
        const q1 = quarterMap[1] ?? null;
        const q2 = quarterMap[2] ?? null;
        const q3 = quarterMap[3] ?? null;
        const q4 = quarterMap[4] ?? null;

        detailRows.push([
          worker.name,
          worker.rut,
          q1 ? q1.hp10.toFixed(3) : "—",
          q2 ? q2.hp10.toFixed(3) : "—",
          q3 ? q3.hp10.toFixed(3) : "—",
          q4 ? q4.hp10.toFixed(3) : "—",
          worker.annualHp10.toFixed(3),
          q1 ? q1.hp007.toFixed(3) : "—",
          q2 ? q2.hp007.toFixed(3) : "—",
          q3 ? q3.hp007.toFixed(3) : "—",
          q4 ? q4.hp007.toFixed(3) : "—",
          worker.annualHp007.toFixed(3),
        ]);
      }

      autoTable(doc, {
        startY,
        head: [
          [
            { content: "Trabajador", rowSpan: 2 },
            { content: "RUT", rowSpan: 2 },
            { content: "Hp(10) mSv", colSpan: 5 },
            { content: "Hp(0.07) mSv", colSpan: 5 },
          ],
          ["T1", "T2", "T3", "T4", "Anual", "T1", "T2", "T3", "T4", "Anual"],
        ],
        body: detailRows,
        theme: "grid",
        headStyles: { fillColor: [30, 80, 140], textColor: 255, fontSize: 7, fontStyle: "bold", halign: "center" },
        bodyStyles: { fontSize: 6.5, cellPadding: 1.8, halign: "right" },
        columnStyles: {
          0: { cellWidth: 44, halign: "left" },
          1: { cellWidth: 22, halign: "left" },
          6: { cellWidth: 16, fontStyle: "bold" },
          11: { cellWidth: 16, fontStyle: "bold" },
        },
        didDrawCell: (data: any) => {
          // Highlight annual totals that exceed limits
          if (data.section === "body") {
            if (data.column.index === 6) {
              const val = parseFloat(String(data.cell.raw ?? "0").replace("—", "0") || "0");
              if (!isNaN(val) && val > LIMIT_HP10) {
                doc.setTextColor(220, 38, 38);
                doc.setFont("helvetica", "bold");
              }
            }
            if (data.column.index === 11) {
              const val = parseFloat(String(data.cell.raw ?? "0").replace("—", "0") || "0");
              if (!isNaN(val) && val > LIMIT_HP007) {
                doc.setTextColor(220, 38, 38);
                doc.setFont("helvetica", "bold");
              }
            }
          }
        },
      });

      startY = (doc as any).lastAutoTable.finalY + 8;
    }

    if (rows.length === 0) {
      if (startY > 240) { doc.addPage(); startY = 15; }
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.text(`No hay lecturas dosimétricas registradas para el año ${year}.`, 14, startY + 10);
    }

    // ── Footer on every page ───────────────────────────────────────────────────
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const pageHeight = doc.internal.pageSize.height;
      doc.setFillColor(240, 240, 240);
      doc.rect(0, pageHeight - 12, pageW, 12, "F");
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.text(
        `SPRM v1 · Informe Dosimétrico ${year} · DS 3/1985 MINSAL · Confidencial — uso interno · Pág. ${i} / ${pageCount}`,
        pageW / 2,
        pageHeight - 4,
        { align: "center" }
      );
    }

    const pdfBuffer = doc.output("arraybuffer");

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="informe_dosimetrico_${year}_${dateFile}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("GET /api/dosimetry/export/pdf", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
