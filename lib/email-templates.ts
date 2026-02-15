export function getEarlyAccessWelcomeEmail(email: string): { subject: string; html: string; text: string } {
  const subject = "Welcome to AllFantasy - You're In!";
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to AllFantasy</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse;">
          
          <!-- Header -->
          <tr>
            <td style="text-align: center; padding-bottom: 30px;">
              <h1 style="margin: 0; font-size: 32px; font-weight: 700; background: linear-gradient(90deg, #06b6d4, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                AllFantasy
              </h1>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="background: linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(139, 92, 246, 0.1)); border: 1px solid rgba(6, 182, 212, 0.3); border-radius: 16px; padding: 40px;">
              
              <h2 style="margin: 0 0 20px 0; font-size: 24px; color: #ffffff; text-align: center;">
                You're on the list!
              </h2>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #d1d5db;">
                Thanks for signing up for early access to AllFantasy. We're building the future of fantasy sports powered by AI, and you'll be among the first to experience it.
              </p>
              
              <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #d1d5db;">
                Here's what's coming:
              </p>
              
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <span style="color: #06b6d4; font-size: 18px; margin-right: 12px;">&#x1F3C6;</span>
                    <span style="color: #ffffff; font-size: 15px;">AF Legacy - Your complete fantasy career analysis</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <span style="color: #8b5cf6; font-size: 18px; margin-right: 12px;">&#x1F4CA;</span>
                    <span style="color: #ffffff; font-size: 15px;">AI Trade Evaluator - Never lose a trade again</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <span style="color: #10b981; font-size: 18px; margin-right: 12px;">&#x1F4A1;</span>
                    <span style="color: #ffffff; font-size: 15px;">Waiver AI - Smart waiver wire recommendations</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <span style="color: #f59e0b; font-size: 18px; margin-right: 12px;">&#x1F916;</span>
                    <span style="color: #ffffff; font-size: 15px;">AI Chat - Your personal fantasy assistant</span>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #d1d5db;">
                We'll notify you as soon as we're ready to launch. Get ready to build your fantasy legacy.
              </p>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="text-align: center; padding-top: 30px;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">
                The Future of Fantasy Sports
              </p>
              <p style="margin: 0; font-size: 12px; color: #4b5563;">
                &copy; 2026 AllFantasy. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
  
  const text = `Welcome to AllFantasy!

You're on the list!

Thanks for signing up for early access to AllFantasy. We're building the future of fantasy sports powered by AI, and you'll be among the first to experience it.

Here's what's coming:
- AF Legacy - Your complete fantasy career analysis
- AI Trade Evaluator - Never lose a trade again
- Waiver AI - Smart waiver wire recommendations
- AI Chat - Your personal fantasy assistant

We'll notify you as soon as we're ready to launch. Get ready to build your fantasy legacy.

---
The Future of Fantasy Sports
(c) 2026 AllFantasy. All rights reserved.`;

  return { subject, html, text };
}

export function getEarlyAccessWelcomeEmailV2(args: {
  email: string;
  baseUrl: string;
}) {
  const email = args.email.trim().toLowerCase();
  const baseUrl = args.baseUrl.replace(/\/+$/, "");

  const confirmUrl = `${baseUrl}/?welcome=1`;
  const dashboardUrl = `${baseUrl}/af-legacy`;
  const unsubscribeUrl = `${baseUrl}/unsubscribe?email=${encodeURIComponent(email)}`;

  const subject = "You're on the AllFantasy Early Access list";

  const html = `
  <div style="background:#0b0b0f;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#fff">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.10);border-radius:16px;overflow:hidden">
      <tr>
        <td style="padding:22px 22px 10px 22px;">
          <div style="font-size:12px;letter-spacing:0.10em;text-transform:uppercase;color:rgba(255,255,255,0.65)">
            AllFantasy - Early Access
          </div>
          <div style="font-size:24px;font-weight:800;margin-top:8px;line-height:1.15">
            You're in. Welcome to the list
          </div>
          <div style="font-size:14px;line-height:1.55;margin-top:10px;color:rgba(255,255,255,0.80)">
            We'll send your invite in waves. When your access opens, you'll be able to import your Sleeper history,
            unlock AI legacy analysis, and start building leagues.
          </div>
        </td>
      </tr>

      <tr>
        <td style="padding:0 22px 18px 22px;">
          <div style="margin-top:10px;font-size:13px;color:rgba(255,255,255,0.70)">
            Signed up as: <span style="color:#fff;font-weight:600">${escapeHtml(email)}</span>
          </div>
        </td>
      </tr>

      <tr>
        <td style="padding:0 22px 22px 22px;">
          <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%">
            <tr>
              <td style="padding-right:10px;">
                <a href="${confirmUrl}"
                  style="display:inline-block;background:#ffffff;color:#0b0b0f;text-decoration:none;font-weight:800;padding:12px 14px;border-radius:12px">
                  Confirm your spot
                </a>
              </td>
              <td>
                <a href="${dashboardUrl}"
                  style="display:inline-block;background:rgba(255,255,255,0.10);color:#ffffff;text-decoration:none;font-weight:700;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.12)">
                  Explore Legacy Tools
                </a>
              </td>
            </tr>
          </table>

          <div style="margin-top:14px;font-size:13px;line-height:1.5;color:rgba(255,255,255,0.70)">
            You'll get updates as we roll out early access. If you didn't sign up, you can ignore this email.
          </div>

          <div style="margin-top:14px;font-size:12px;color:rgba(255,255,255,0.50)">
            Optional: <a href="${unsubscribeUrl}" style="color:rgba(255,255,255,0.70)">unsubscribe</a>
          </div>
        </td>
      </tr>

      <tr>
        <td style="padding:14px 22px;border-top:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.55);font-size:12px">
          AllFantasy - Invite-only early access - Sent automatically
        </td>
      </tr>
    </table>
  </div>
  `.trim();

  const text = `
AllFantasy - Early Access

You're in. Welcome to the list

We'll send your invite in waves. When your access opens, you'll be able to import your Sleeper history,
unlock AI legacy analysis, and start building leagues.

Signed up as: ${email}

Confirm your spot: ${confirmUrl}
Explore Legacy Tools: ${dashboardUrl}

If you didn't sign up, ignore this email.
`.trim();

  return { subject, html, text };
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
