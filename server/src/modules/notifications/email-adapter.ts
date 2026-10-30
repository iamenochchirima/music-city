import { env } from "../../config/env.js";
import { databaseService } from "../../services/database.service.js";

export type EmailMessage = {
  title: string;
  body: string;
  href: string;
  category?: string;
};
export type EmailDelivery = {
  id: string;
  email: string;
  message: EmailMessage;
};
export type EmailAdapter = (delivery: EmailDelivery) => Promise<string>;
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function renderEmail(message: EmailMessage, origin = env.CLIENT_ORIGIN) {
  const url = new URL(message.href, origin).toString();
  const footer =
    message.category && message.category !== "transactional"
      ? "You opted in to these Music City updates. Manage your email preferences in your Music City account."
      : "This is a transactional notification about your Music City account. Release, artist and product updates follow your notification preferences.";
  return {
    subject: message.title,
    text: `${message.title}\n\n${message.body}\n\nOpen Music City: ${url}\n\n${footer}`,
    html: `<h1>${escapeHtml(message.title)}</h1><p>${escapeHtml(message.body)}</p><p><a href="${escapeHtml(url)}">Open Music City</a></p><p>${escapeHtml(footer)}</p>`,
  };
}
export function emailConfigurationError() {
  if (env.NOTIFICATION_EMAIL_PROVIDER === "disabled")
    return "Email delivery is disabled. Configure NOTIFICATION_EMAIL_PROVIDER and sender credentials.";
  if (
    env.NOTIFICATION_EMAIL_PROVIDER === "sink" &&
    env.NODE_ENV === "production"
  )
    return "The local email sink is not allowed in production.";
  if (
    env.NOTIFICATION_EMAIL_PROVIDER === "resend" &&
    (!env.RESEND_API_KEY || !env.NOTIFICATION_EMAIL_FROM)
  )
    return "Resend requires RESEND_API_KEY and NOTIFICATION_EMAIL_FROM.";
  return null;
}
export const deliverEmail: EmailAdapter = async (delivery) => {
  const error = emailConfigurationError();
  if (error) throw new Error(error);
  const message = renderEmail(delivery.message);
  if (env.NOTIFICATION_EMAIL_PROVIDER === "sink") {
    await databaseService.transaction((client) =>
      client.query(
        "INSERT INTO notification_email_sink(id,email,message) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [delivery.id, delivery.email, message],
      ),
    );
    return `sink:${delivery.id}`;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": delivery.id,
    },
    body: JSON.stringify({
      from: env.NOTIFICATION_EMAIL_FROM,
      to: [delivery.email],
      ...message,
    }),
  });
  if (!response.ok)
    throw new Error(`Email provider returned HTTP ${response.status}`);
  const result = (await response.json()) as { id?: string };
  if (!result.id)
    throw new Error("Email provider did not return a delivery id");
  return result.id;
};
