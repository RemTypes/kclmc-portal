/**
 * KCLMC SMTP Client
 * Direct TLS SMTP dispatch utility for transactional broadcasts (e.g. Purelymail / Gmail / port 465).
 * Kept in a dedicated server module so client bundles do not attempt to import Node 'tls'.
 */

import tls from 'tls';

export interface SmtpEmailOptions {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface SmtpSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Extracts raw email address from potential display name format (e.g. "Club <abc@xyz.com>" -> "abc@xyz.com").
 */
function extractRawEmail(input: string): string {
  const match = input.match(/<([^>]+)>/);
  return (match ? match[1] : input).trim();
}

/**
 * Zero-dependency TLS SMTP sender function (works seamlessly with Gmail, Purelymail, or standard SMTP).
 */
export async function sendSmtpEmail(
  options: SmtpEmailOptions
): Promise<SmtpSendResult> {
  return new Promise((resolve) => {
    const { host, port, user, pass, from, to, subject, text, html } = options;

    const rawFrom = extractRawEmail(from || user);
    const rawTo = extractRawEmail(to);
    const displayFrom = from.includes('<') ? from : `"KCLMC Committee" <${from || user}>`;

    let responseBuffer = '';
    let currentStep = 0;
    const boundary = `kclmc_boundary_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const socket = tls.connect(port, host, { servername: host }, () => {
      // Connected via TLS
    });

    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({ success: false, error: 'SMTP connection timed out after 12000ms' });
    }, 12000);

    const sendCmd = (cmd: string) => {
      socket.write(cmd + '\r\n');
    };

    socket.on('data', (data) => {
      const resp = data.toString();
      responseBuffer += resp;

      const lines = resp.trim().split('\n');
      const lastLine = lines[lines.length - 1];
      const code = parseInt(lastLine.slice(0, 3), 10);

      // Simple state machine for SMTP conversation
      if (currentStep === 0 && code === 220) {
        currentStep = 1;
        sendCmd('EHLO kclmc.org');
      } else if (currentStep === 1 && code === 250) {
        currentStep = 2;
        sendCmd('AUTH LOGIN');
      } else if (currentStep === 2 && code === 334) {
        currentStep = 3;
        sendCmd(Buffer.from(user).toString('base64'));
      } else if (currentStep === 3 && code === 334) {
        currentStep = 4;
        sendCmd(Buffer.from(pass.replace(/\s+/g, '')).toString('base64'));
      } else if (currentStep === 4 && code === 235) {
        currentStep = 5;
        sendCmd(`MAIL FROM:<${rawFrom}>`);
      } else if (currentStep === 5 && code === 250) {
        currentStep = 6;
        sendCmd(`RCPT TO:<${rawTo}>`);
      } else if (currentStep === 6 && code === 250) {
        currentStep = 7;
        sendCmd('DATA');
      } else if (currentStep === 7 && code === 354) {
        currentStep = 8;
        const rawMessage = [
          `From: ${displayFrom}`,
          `To: ${rawTo}`,
          `Reply-To: kclmc.committee@gmail.com`,
          `Subject: ${subject}`,
          'MIME-Version: 1.0',
          `Content-Type: multipart/alternative; boundary="${boundary}"`,
          '',
          `--${boundary}`,
          'Content-Type: text/plain; charset="UTF-8"',
          'Content-Transfer-Encoding: 7bit',
          '',
          text,
          '',
          `--${boundary}`,
          'Content-Type: text/html; charset="UTF-8"',
          'Content-Transfer-Encoding: 7bit',
          '',
          html,
          '',
          `--${boundary}--`,
          '.',
        ].join('\r\n');
        sendCmd(rawMessage);
      } else if (currentStep === 8 && code === 250) {
        clearTimeout(timeout);
        sendCmd('QUIT');
        setTimeout(() => {
          socket.destroy();
          resolve({ success: true, messageId: lastLine });
        }, 100);
      } else if (code >= 400) {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ success: false, error: `SMTP error at step ${currentStep}: ${lastLine}` });
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      resolve({ success: false, error: err.message });
    });
  });
}
