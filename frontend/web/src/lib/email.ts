/**
 * Módulo de envío de correos electrónicos — RPMS
 * Usa Gmail SMTP con App Password (no requiere OAuth)
 *
 * Variables de entorno requeridas:
 *   GMAIL_USER         = proteccionradiologica.hha@gmail.com
 *   GMAIL_APP_PASSWORD = (contraseña de aplicación de 16 chars de Google)
 */

import nodemailer from "nodemailer";

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface EmailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/** Crea el transporter de Nodemailer apuntando a Gmail SMTP */
function createTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error(
      "Variables GMAIL_USER y GMAIL_APP_PASSWORD no están configuradas en el entorno"
    );
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { type: "login", user, pass },
  });
}

/** Envía un correo. Retorna { ok: true, messageId } o { ok: false, error } */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  try {
    const transporter = createTransporter();
    const from = `"Diego Solís · Oficial de Protección Radiológica" <${process.env.GMAIL_USER}>`;

    const info = await transporter.sendMail({
      from,
      to: Array.isArray(payload.to) ? payload.to.join(", ") : payload.to,
      cc: payload.cc
        ? Array.isArray(payload.cc)
          ? payload.cc.join(", ")
          : payload.cc
        : undefined,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      attachments: payload.attachments,
    });

    return { ok: true, messageId: info.messageId };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/** Verifica la conexión SMTP (útil para diagnóstico) */
export async function verifyEmailConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ─── Plantillas HTML ──────────────────────────────────────────────────────────

const BASE_STYLE = `
  font-family: Arial, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  color: #1a1a2e;
  background: #f8f9fa;
  border-radius: 8px;
  overflow: hidden;
`;

const HEADER_HTML = `
  <div style="background: #1a1a2e; padding: 24px 32px; display:flex; align-items:center; gap:12px;">
    <div style="color:#60a5fa; font-size:28px; font-weight:bold;">☢</div>
    <div>
      <div style="color:#ffffff; font-weight:700; font-size:18px;">RPMS · Protección Radiológica</div>
      <div style="color:#94a3b8; font-size:13px;">Hospital Hernán Henríquez Aravena — Temuco</div>
    </div>
  </div>
`;

const FOOTER_HTML = `
  <div style="background:#0f172a; padding:16px 32px; text-align:center;">
    <div style="color:#64748b; font-size:12px; line-height:1.6;">
      Diego Solís Catalán · Tecnólogo Médico<br>
      Oficial de Protección Radiológica<br>
      Departamento de Prevención de Riesgos · HHHA Temuco<br>
      <a href="mailto:proteccionradiologica.hha@gmail.com" style="color:#60a5fa;">proteccionradiologica.hha@gmail.com</a>
    </div>
  </div>
`;

function wrapTemplate(body: string): string {
  return `
    <div style="${BASE_STYLE}">
      ${HEADER_HTML}
      <div style="padding: 32px; background: #ffffff;">
        ${body}
      </div>
      ${FOOTER_HTML}
    </div>
  `;
}

/** Plantilla: Recordatorio de dosimetría pendiente */
export function templateDosimetriaReminder(opts: {
  nombreTrabajador: string;
  periodo: string;
  fechaLimite?: string;
}): { subject: string; html: string; text: string } {
  const subject = `[RPMS] Dosimetría pendiente — ${opts.periodo}`;
  const body = `
    <h2 style="color:#1a1a2e; margin:0 0 16px;">Recordatorio: Dosimetría pendiente</h2>
    <p>Estimado/a <strong>${opts.nombreTrabajador}</strong>,</p>
    <p>Le informamos que su registro de dosimetría del período <strong>${opts.periodo}</strong> aún no ha sido ingresado al sistema RPMS.</p>
    ${opts.fechaLimite ? `<div style="background:#fef3c7; border-left:4px solid #f59e0b; padding:12px 16px; border-radius:4px; margin:16px 0;">
      <strong>⚠ Fecha límite:</strong> ${opts.fechaLimite}
    </div>` : ""}
    <p>Por favor, coordine con el Oficial de Protección Radiológica para el registro oportuno según la normativa CCHEN / DS 3/1985.</p>
    <p>Si ya realizó la entrega, puede ignorar este mensaje.</p>
  `;
  return {
    subject,
    html: wrapTemplate(body),
    text: `Recordatorio de dosimetría pendiente para el período ${opts.periodo}. Contacte a la Unidad de Protección Radiológica.`,
  };
}

/** Plantilla: Alerta de dosis elevada */
export function templateDosisElevada(opts: {
  nombreTrabajador: string;
  dosis: string;
  limite: string;
  periodo: string;
  modulo?: string;
}): { subject: string; html: string; text: string } {
  const subject = `[RPMS] ⚠ Dosis elevada detectada — ${opts.nombreTrabajador}`;
  const body = `
    <h2 style="color:#dc2626; margin:0 0 16px;">⚠ Alerta: Dosis elevada detectada</h2>
    <p>Se ha detectado una dosis que requiere atención:</p>
    <table style="width:100%; border-collapse:collapse; margin:16px 0;">
      <tr style="background:#f8fafc;">
        <td style="padding:10px; border:1px solid #e2e8f0; font-weight:600;">Trabajador</td>
        <td style="padding:10px; border:1px solid #e2e8f0;">${opts.nombreTrabajador}</td>
      </tr>
      <tr>
        <td style="padding:10px; border:1px solid #e2e8f0; font-weight:600;">Período</td>
        <td style="padding:10px; border:1px solid #e2e8f0;">${opts.periodo}</td>
      </tr>
      <tr style="background:#f8fafc;">
        <td style="padding:10px; border:1px solid #e2e8f0; font-weight:600;">Dosis registrada</td>
        <td style="padding:10px; border:1px solid #e2e8f0; color:#dc2626; font-weight:700;">${opts.dosis}</td>
      </tr>
      <tr>
        <td style="padding:10px; border:1px solid #e2e8f0; font-weight:600;">Límite de referencia</td>
        <td style="padding:10px; border:1px solid #e2e8f0;">${opts.limite}</td>
      </tr>
      ${opts.modulo ? `<tr style="background:#f8fafc;"><td style="padding:10px; border:1px solid #e2e8f0; font-weight:600;">Módulo</td><td style="padding:10px; border:1px solid #e2e8f0;">${opts.modulo}</td></tr>` : ""}
    </table>
    <p>Se requiere revisión y seguimiento según el programa de vigilancia radiológica.</p>
  `;
  return {
    subject,
    html: wrapTemplate(body),
    text: `Alerta dosis elevada: ${opts.nombreTrabajador}, ${opts.dosis} en período ${opts.periodo}.`,
  };
}

/** Plantilla: Recordatorio de capacitación por vencer */
export function templateCapacitacionReminder(opts: {
  nombreTrabajador: string;
  tipoCapacitacion: string;
  fechaVencimiento: string;
}): { subject: string; html: string; text: string } {
  const subject = `[RPMS] Capacitación por vencer — ${opts.tipoCapacitacion}`;
  const body = `
    <h2 style="color:#1a1a2e; margin:0 0 16px;">Recordatorio: Capacitación próxima a vencer</h2>
    <p>Estimado/a <strong>${opts.nombreTrabajador}</strong>,</p>
    <p>Su certificación en <strong>${opts.tipoCapacitacion}</strong> vence el <strong>${opts.fechaVencimiento}</strong>.</p>
    <div style="background:#eff6ff; border-left:4px solid #3b82f6; padding:12px 16px; border-radius:4px; margin:16px 0;">
      Para mantener su habilitación como trabajador ocupacionalmente expuesto (POE),
      es necesario renovar esta capacitación antes de la fecha indicada.
    </div>
    <p>Contáctenos para coordinar la renovación.</p>
  `;
  return {
    subject,
    html: wrapTemplate(body),
    text: `Recordatorio: capacitación ${opts.tipoCapacitacion} vence el ${opts.fechaVencimiento} para ${opts.nombreTrabajador}.`,
  };
}

/** Plantilla: Comunicado general */
export function templateComunicado(opts: {
  destinatario: string;
  asunto: string;
  cuerpo: string;
}): { subject: string; html: string; text: string } {
  const body = `
    <h2 style="color:#1a1a2e; margin:0 0 16px;">${opts.asunto}</h2>
    <p>Estimado/a <strong>${opts.destinatario}</strong>,</p>
    <div style="line-height:1.7;">${opts.cuerpo.replace(/\n/g, "<br>")}</div>
    <br>
    <p style="color:#64748b; font-size:14px;">Atentamente,<br><strong>Unidad de Protección Radiológica</strong><br>Hospital Hernán Henríquez Aravena</p>
  `;
  return {
    subject: `[RPMS] ${opts.asunto}`,
    html: wrapTemplate(body),
    text: opts.cuerpo,
  };
}
