// Outbound email, in the company's own livery.
//
// Resend already sends the sign-in links, so the domain, sender and
// deliverability are solved; this reuses that account for the app's own
// notifications rather than standing up a second channel.
//
// Everything here fails soft. A notification that cannot be sent must never
// take down the action that triggered it — an employee assigning a vendor has
// done something real, and an email problem is not a reason to lose it. Callers
// get {ok,error} back so they can tell the user the truth about what happened.

const FROM_NAME = "Stephen Fleming Realty";

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_DOMAIN);
}

const senderAddress = () => `${FROM_NAME} <noreply@${process.env.RESEND_DOMAIN}>`;

// Brand shell so every message looks like it came from the same company.
// Inlined styles because mail clients discard <style> blocks.
export function wrap({ heading, intro, bodyHtml = "", footNote = "" }) {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F2F0EB;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(13,27,51,0.08);">
      <tr><td style="background:#0D1B33;padding:24px 30px;">
        <div style="font-size:17px;font-weight:600;letter-spacing:.12em;color:#ffffff;">STEPHEN FLEMING REALTY</div>
      </td></tr>
      <tr><td style="padding:26px 30px 6px;">
        <div style="font-size:19px;font-weight:700;color:#0D1B33;margin-bottom:10px;">${heading}</div>
        <div style="font-size:14.5px;line-height:1.6;color:#4A6A80;">${intro}</div>
      </td></tr>
      ${bodyHtml ? `<tr><td style="padding:14px 30px 6px;">${bodyHtml}</td></tr>` : ""}
      ${footNote ? `<tr><td style="padding:6px 30px 24px;"><div style="font-size:12.5px;line-height:1.6;color:#8A93A5;">${footNote}</div></td></tr>` : ""}
    </table>
    <div style="font-size:11.5px;color:#8A93A5;margin-top:16px;">Stephen Fleming Realty · Camp Hill, PA</div>
  </td></tr>
</table>`.trim();
}

// A labelled row, used by the report and notification bodies.
export const row = (label, value) => `
<div style="display:block;padding:9px 12px;border:1px solid #E5E1D8;border-radius:9px;background:#FAF8F4;margin-bottom:7px;">
  <div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8A93A5;">${label}</div>
  <div style="font-size:14px;font-weight:600;color:#0D1B33;margin-top:2px;">${value}</div>
</div>`;

const clean = (list) =>
  [...new Set((Array.isArray(list) ? list : [list])
    .map((e) => String(e || "").trim().toLowerCase())
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)))];

export async function sendEmail({ to, subject, html, replyTo }) {
  const recipients = clean(to);
  if (!emailConfigured()) return { ok: false, error: "Email isn't configured on this deployment." };
  if (!recipients.length) return { ok: false, error: "No valid email address to send to." };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: senderAddress(),
        to: recipients,
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body?.message || `Send failed (${res.status})` };
    return { ok: true, id: body?.id || null, sentTo: recipients };
  } catch (e) {
    return { ok: false, error: e?.message || "Could not reach the email service." };
  }
}
