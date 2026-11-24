/**
 * POST /api/email/send
 * Envía correos desde proteccionradiologica.hhha@gmail.com
 *
 * Acepta JSON o multipart/form-data (para adjuntar archivos).
 *
 * Campos:
 *   to          string | string[]   — destinatario(s)
 *   subject     string              — asunto
 *   html        string              — cuerpo HTML (o usar template)
 *   text?       string              — texto plano
 *   cc?         string | string[]   — con copia
 *   template?   string              — nombre de plantilla
 *   templateData? object/json string — datos para la plantilla
 *   attachment? File                — archivo adjunto (solo multipart)
 *
 * Plantillas disponibles:
 *   "dosimetria_reminder"   → templateData: { nombreTrabajador, periodo, fechaLimite? }
 *   "dosis_elevada"         → templateData: { nombreTrabajador, dosis, limite, periodo, modulo? }
 *   "capacitacion_reminder" → templateData: { nombreTrabajador, tipoCapacitacion, fechaVencimiento }
 *   "comunicado"            → templateData: { destinatario, asunto, cuerpo }
 */
import { NextRequest, NextResponse } from "next/server";
import {
  sendEmail,
  templateDosimetriaReminder,
  templateDosisElevada,
  templateCapacitacionReminder,
  templateComunicado,
} from "@/lib/email";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function ensureEmailLogTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS email_log (
      id          SERIAL PRIMARY KEY,
      recipient   TEXT NOT NULL,
      subject     TEXT NOT NULL,
      template    TEXT,
      status      TEXT NOT NULL DEFAULT 'sent',
      message_id  TEXT,
      error       TEXT,
      sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_email_log_sent ON email_log (sent_at DESC)`;
}

/** Parsear cuerpo: soporta JSON y multipart/form-data */
async function parseBody(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const to = formData.get("to") as string | null;
    const subject = formData.get("subject") as string | null;
    const html = formData.get("html") as string | null;
    const text = formData.get("text") as string | null;
    const cc = formData.get("cc") as string | null;
    const template = formData.get("template") as string | null;
    const templateDataRaw = formData.get("templateData") as string | null;
    const attachmentFile = formData.get("attachment") as File | null;

    let templateData: Record<string, unknown> | undefined;
    if (templateDataRaw) {
      try { templateData = JSON.parse(templateDataRaw); } catch { templateData = undefined; }
    }

    let attachments: Array<{ filename: string; content: Buffer; contentType?: string }> | undefined;
    if (attachmentFile && attachmentFile.size > 0) {
      const arrayBuffer = await attachmentFile.arrayBuffer();
      attachments = [{
        filename: attachmentFile.name,
        content: Buffer.from(arrayBuffer),
        contentType: attachmentFile.type || "application/octet-stream",
      }];
    }

    return { to, subject, html, text, cc, template, templateData, attachments };
  }

  // JSON por defecto
  const body = await req.json();
  return {
    to: body.to,
    subject: body.subject,
    html: body.html,
    text: body.text,
    cc: body.cc,
    template: body.template,
    templateData: body.templateData,
    attachments: undefined,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { to, subject: subjectIn, html: htmlIn, text: textIn, cc, template, templateData, attachments } =
      await parseBody(req);

    if (!to) {
      return NextResponse.json({ error: "El campo 'to' es requerido" }, { status: 400 });
    }

    let subject = subjectIn;
    let html = htmlIn;
    let text = textIn;

    // Resolver plantilla si se indicó
    if (template) {
      let resolved: { subject: string; html: string; text: string } | null = null;

      switch (template) {
        case "dosimetria_reminder":
          resolved = templateDosimetriaReminder(templateData);
          break;
        case "dosis_elevada":
          resolved = templateDosisElevada(templateData);
          break;
        case "capacitacion_reminder":
          resolved = templateCapacitacionReminder(templateData);
          break;
        case "comunicado":
          resolved = templateComunicado(templateData);
          break;
        default:
          return NextResponse.json({ error: `Plantilla desconocida: ${template}` }, { status: 400 });
      }

      subject = resolved.subject;
      html = resolved.html;
      text = resolved.text;
    }

    if (!subject || !html) {
      return NextResponse.json(
        { error: "Se requiere 'subject' y 'html' (o especificar un 'template')" },
        { status: 400 }
      );
    }

    const result = await sendEmail({ to, subject, html, text: text ?? undefined, cc: cc ?? undefined, attachments });

    // Registrar en log
    try {
      await ensureEmailLogTable();
      const recipients = Array.isArray(to) ? to.join(", ") : to;
      await sql`
        INSERT INTO email_log (recipient, subject, template, status, message_id, error)
        VALUES (
          ${recipients},
          ${subject},
          ${template ?? null},
          ${result.ok ? "sent" : "failed"},
          ${result.messageId ?? null},
          ${result.error ?? null}
        )
      `;
    } catch { /* log silent */ }

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      messageId: result.messageId,
      to,
      subject,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
