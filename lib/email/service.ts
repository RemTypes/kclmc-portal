/**
 * KCLMC Email Service
 * 
 * Outbound transactional mailer using Cloudflare Workers native Email Service (send_email binding).
 * Includes automatic fallback to console logging during local development and preview environments.
 */

export interface SendEmailOptions {
  to: string;
  name?: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailDispatchResult {
  success: boolean;
  error?: string;
}

export async function sendEmail(
  env: { EMAIL?: any; [key: string]: any },
  options: SendEmailOptions
): Promise<EmailDispatchResult> {
  const fromAddress = process.env.EMAIL_FROM || env?.EMAIL_FROM || "portal@kclmc.org";
  const replyToAddress = "kclmc.committee@gmail.com";
  const recipientName = options.name?.trim() || options.to.split("@")[0] || "Climber";

  // Production dispatch via Cloudflare Workers send_email binding
  if (env?.EMAIL && typeof env.EMAIL.send === 'function') {
    try {
      await env.EMAIL.send({
        to: [{ email: options.to, name: recipientName }],
        from: { email: fromAddress, name: "KCLMC Portal" },
        replyTo: { email: replyToAddress, name: "KCLMC Committee" },
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
      return { success: true };
    } catch (err: any) {
      console.error("[EmailService] Cloudflare send_email error:", err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  // Development / Staging simulation: Output formatted email link to console
  console.log("\n========================================================");
  console.log(`📧 [EMAIL DISPATCH - LOCAL SIMULATION]`);
  console.log(`To:      ${options.to}`);
  console.log(`From:    ${fromAddress}`);
  console.log(`Subject: ${options.subject}`);
  console.log("--------------------------------------------------------");
  console.log(options.text);
  console.log("========================================================\n");

  return { success: true };
}
