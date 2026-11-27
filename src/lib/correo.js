// ============================================================
//  Envío de correo por SMTP (cuenta Xinet) — reemplaza MailApp
//  Variables (wrangler.toml): SMTP_HOST, SMTP_PORT, SMTP_FROM_NAME
//  Secretos (dashboard):      SMTP_USER, SMTP_PASS
//  Si falta configuración, no truena: registra en log y devuelve false
//  (igual que el try/catch de los envíos en GAS).
// ============================================================
import { WorkerMailer } from "../vendor/worker-mailer.mjs";
import { EMAIL_FROM_NAME } from "./plantillas_correo.js";

export function correoConfigurado(env) {
  return !!(env.SMTP_HOST && !String(env.SMTP_HOST).startsWith("PENDIENTE") && env.SMTP_USER && env.SMTP_PASS);
}

export async function enviarCorreo(env, { to, subject, html, nombreRemitente }) {
  if (!correoConfigurado(env)) {
    console.log(`[Correo] SMTP no configurado; no se envió "${subject}" a ${to}`);
    return false;
  }
  const port = Number(env.SMTP_PORT || 465);
  try {
    await WorkerMailer.send(
      {
        host: env.SMTP_HOST,
        port,
        secure: port === 465,            // 465 = TLS directo; 587 = STARTTLS
        startTls: port !== 465,
        credentials: { username: env.SMTP_USER, password: env.SMTP_PASS },
        authType: ["plain", "login"],
        socketTimeoutMs: 15000,
        responseTimeoutMs: 15000,
      },
      {
        from: { name: nombreRemitente || env.SMTP_FROM_NAME || EMAIL_FROM_NAME, email: env.SMTP_USER },
        to,
        subject,
        html,
      }
    );
    console.log(`[Correo] Enviado "${subject}" a ${to}`);
    return true;
  } catch (e) {
    console.log(`[Correo] Error enviando "${subject}" a ${to}: ${e}`);
    return false;
  }
}

// Envía sin hacer esperar la respuesta (el correo sale en segundo plano)
export function enviarEnSegundoPlano(ctx, env, msg) {
  const p = enviarCorreo(env, msg);
  if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(p);
  return p;
}
