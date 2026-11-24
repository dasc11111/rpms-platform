/**
 * POST /api/email/send
 * Envía correos desde proteccionradiologica.hha@gmail.com
 *
 * Body:
 *   to          string | string[]   — destinatario(s)
 *   subject     string              — asunto
 *   html        string              — cuerpo HTML (o usar template)
 *   text?       string              — texto plano
 *   cc?         string | string[]   — con copia
 *   template?   string              — nombre de plantilla
 *   templateData? object            — datos para la plantilla
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, subject: subjectIn, html: htmlIn, text: textIn, cc, template, templateData } = body;

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

    const result = await sendEmail({ to, subject, html, text, cc });

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
