import nodemailer from "nodemailer";
import { createLogger } from "@appranks/shared";

const log = createLogger("mailer");

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      throw new Error("SMTP_HOST, SMTP_USER, and SMTP_PASS are required");
    }

    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }
  return transporter;
}

export async function sendMail(
  to: string,
  subject: string,
  html: string,
  headers?: Record<string, string>
): Promise<{ messageId?: string }> {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  try {
    const info = await getTransporter().sendMail({
      from,
      to,
      subject,
      html,
      ...(headers ? { headers } : {}),
    });
    log.info("email sent", { to, subject });
    return { messageId: info.messageId };
  } catch (err) {
    log.error("failed to send email", { to, subject, error: String(err) });
    throw err;
  }
}
