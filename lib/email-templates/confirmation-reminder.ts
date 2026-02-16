import crypto from "crypto";

export function getConfirmationReminderEmail(args: {
  email: string;
  baseUrl: string;
}) {
  const email = args.email.trim().toLowerCase();
  const baseUrl = args.baseUrl.replace(/\/+$/, "");

  const confirm = makeConfirmLink({ email, baseUrl });
  const dashboardUrl = `${baseUrl}/af-legacy`;

  const subject = "Don't lose your spot - Confirm your AllFantasy early access";

  const html = `
  <div style="background:#0b0b0f;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#fff">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.10);border-radius:16px;overflow:hidden">
      <tr>
        <td style="padding:22px 22px 10px 22px;">
          <div style="font-size:12px;letter-spacing:0.10em;text-transform:uppercase;color:rgba(255,255,255,0.65)">
            AllFantasy - Reminder
          </div>
          <div style="font-size:24px;font-weight:800;margin-top:8px;line-height:1.15">
            You haven't confirmed yet
          </div>
          <div style="font-size:14px;line-height:1.55;margin-top:10px;color:rgba(255,255,255,0.80)">
            We noticed you signed up for AllFantasy early access but haven't confirmed your email yet.
            Confirming your spot puts you ahead in line for access invites.
          </div>
        </td>
      </tr>

      <tr>
        <td style="padding:0 22px 18px 22px;">
          <div style="margin-top:10px;font-size:13px;color:rgba(255,255,255,0.70)">
            Your email: <span style="color:#fff;font-weight:600">${escapeHtml(email)}</span>
          </div>
        </td>
      </tr>

      <tr>
        <td style="padding:0 22px 22px 22px;">
          <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%">
            <tr>
              <td style="padding-right:10px;">
                <a href="${confirm.url}"
                  style="display:inline-block;background:#ffffff;color:#0b0b0f;text-decoration:none;font-weight:800;padding:14px 20px;border-radius:12px;font-size:15px">
                  Confirm My Spot
                </a>
              </td>
              <td>
                <a href="${dashboardUrl}"
                  style="display:inline-block;background:rgba(255,255,255,0.10);color:#ffffff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);font-size:15px">
                  Explore Legacy Tools
                </a>
              </td>
            </tr>
          </table>

          <div style="margin-top:16px;padding:14px;background:rgba(34,211,238,0.08);border:1px solid rgba(34,211,238,0.15);border-radius:10px;">
            <div style="font-size:13px;font-weight:700;color:#22d3ee;margin-bottom:6px">Why confirm?</div>
            <div style="font-size:13px;line-height:1.5;color:rgba(255,255,255,0.75)">
              Confirmed users get priority access to AI trade analysis, legacy tools, and league management features when we open invites.
            </div>
          </div>

          <div style="margin-top:14px;font-size:12px;color:rgba(255,255,255,0.50)">
            If you didn't sign up for AllFantasy, you can safely ignore this email.
          </div>
        </td>
      </tr>

      <tr>
        <td style="padding:14px 22px;border-top:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.55);font-size:12px">
          AllFantasy - Invite-only early access - This is a one-time reminder
        </td>
      </tr>
    </table>
  </div>
  `.trim();

  const text = `
AllFantasy - Reminder

You haven't confirmed yet

We noticed you signed up for AllFantasy early access but haven't confirmed your email yet.
Confirming your spot puts you ahead in line for access invites.

Your email: ${email}

Confirm My Spot: ${confirm.url}
Explore Legacy Tools: ${dashboardUrl}

Why confirm? Confirmed users get priority access to AI trade analysis, legacy tools, and league management features.

If you didn't sign up, ignore this email.
`.trim();

  return { subject, html, text };
}

function makeConfirmLink(args: { email: string; baseUrl: string }) {
  const { email, baseUrl } = args;
  const secret = (process.env.EARLY_ACCESS_CONFIRM_SECRET || "").trim();

  if (!secret) {
    return { url: `${baseUrl}/?welcome=1` };
  }

  const ts = Date.now();
  const payload = `${email}|${ts}`;
  const token = base64urlEncode(payload);
  const sig = hmacBase64url(secret, token);

  const url = `${baseUrl}/early-access/confirm?t=${encodeURIComponent(token)}&s=${encodeURIComponent(sig)}`;
  return { url };
}

function hmacBase64url(secret: string, message: string) {
  const h = crypto.createHmac("sha256", secret).update(message).digest();
  return toBase64url(h);
}

function base64urlEncode(s: string) {
  return toBase64url(Buffer.from(s, "utf8"));
}

function toBase64url(buf: Buffer) {
  return buf
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
