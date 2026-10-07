import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getAuthenticatedUserRole } from '@/lib/auth';
import {
  parseKclsuSalesForBmc,
  parseBmcFormResponses,
  generateBmcEmailContent,
  generateBmcMailMergeCsv,
  partitionRecipientsByDispatchStatus,
  DEFAULT_BMC_FORM_URL,
  BmcMemberRecipient,
} from '@/lib/bmc_insurance';
import { sendSmtpEmail } from '@/lib/bmc_smtp';

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bsvnyibipcwrcyzqilge.supabase.co';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_IZmrUzhCzPpLG5ZuWVxY_A_QxQJl5Hg';

    const serverSupabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          const cookieHeader = request.headers.get('cookie') || '';
          return cookieHeader.split(';').map(c => {
            const [name, ...rest] = c.trim().split('=');
            return { name, value: rest.join('=') };
          });
        },
        setAll() {},
      },
    });

    const { data: { user } } = await serverSupabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Sign in required' }, { status: 401 });
    }

    const role = await getAuthenticatedUserRole(serverSupabase, user);
    if (role < 1) {
      return NextResponse.json({ error: 'Forbidden: Committee clearance required' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      csvText,
      formUrl = DEFAULT_BMC_FORM_URL,
      action = 'preview',
      testEmail,
      responseCsvText,
      syncRecords,
    } = body;

    // Resolve SMTP settings (supports body overrides, Gmail, Purelymail)
    const isGmail = Boolean(
      body.smtpHost?.includes('gmail') ||
      body.smtpUser?.includes('gmail') ||
      body.gmailUser ||
      process.env.GMAIL_USER ||
      process.env.GMAIL_APP_PASS
    );
    const smtpHost = body.smtpHost || process.env.SMTP_HOST || (isGmail ? 'smtp.gmail.com' : 'smtp.purelymail.com');
    const smtpPort = parseInt(body.smtpPort || process.env.SMTP_PORT || '465', 10);
    const smtpUser = body.smtpUser || body.gmailUser || process.env.GMAIL_USER || process.env.SMTP_USER || '';
    const smtpPass = body.smtpPass || body.gmailAppPass || process.env.GMAIL_APP_PASS || process.env.SMTP_PASS || '';
    const smtpFrom = body.smtpFrom || process.env.SMTP_FROM || smtpUser || 'kclmc.committee@gmail.com';

    // ACTION: Status & SMTP readiness check
    if (action === 'status') {
      return NextResponse.json({
        success: true,
        isSmtpConfigured: Boolean(smtpUser && smtpPass),
        senderEmail: smtpUser || smtpFrom || 'kclmc.committee@gmail.com',
        smtpHost,
        smtpPort,
      });
    }

    // ACTION: Get existing BMC email dispatch records
    if (action === 'get-dispatches') {
      const dispatches: Record<string, { sentAt: string; email: string; fullName: string }> = {};

      try {
        const { data, error } = await serverSupabase
          .from('bmc_dispatches')
          .select('card_number, email, full_name, sent_at')
          .eq('academic_year', '2026/27');

        if (!error && Array.isArray(data)) {
          for (const item of data) {
            if (item.card_number) {
              dispatches[item.card_number.toUpperCase().trim()] = {
                sentAt: item.sent_at,
                email: item.email,
                fullName: item.full_name || '',
              };
            }
          }
        }
      } catch (e) {
        console.warn('[BMC] Supabase bmc_dispatches lookup failed:', e);
      }

      return NextResponse.json({
        success: true,
        dispatches,
      });
    }

    // ACTION: Import Google Form Responses
    if (action === 'import-responses') {
      if (!responseCsvText || !responseCsvText.trim()) {
        return NextResponse.json({ error: 'Google Form Response CSV text is required' }, { status: 400 });
      }

      // If sales roster CSV was also supplied, parse it for accurate name matching
      let rosterRecipients: BmcMemberRecipient[] = [];
      if (csvText && csvText.trim()) {
        const salesResult = parseKclsuSalesForBmc(csvText, formUrl);
        rosterRecipients = salesResult.recipients;
      }

      const responseResult = parseBmcFormResponses(responseCsvText, rosterRecipients);
      return NextResponse.json({
        success: true,
        ...responseResult,
      });
    }

    // ACTION: Sync verified records into database
    if (action === 'sync-db') {
      if (!Array.isArray(syncRecords) || syncRecords.length === 0) {
        return NextResponse.json({ error: 'No records provided for database sync' }, { status: 400 });
      }

      let updatedCount = 0;
      let skippedCount = 0;

      for (const rec of syncRecords) {
        if (!rec.studentId && !rec.kclEmail) {
          skippedCount++;
          continue;
        }

        // Try updating profile by student_id or email
        const updateData: Record<string, any> = {
          bmc_insured: true,
          updated_at: new Date().toISOString(),
        };

        if (rec.mobile) {
          updateData.phone = rec.mobile;
        }

        let query = serverSupabase.from('profiles').update(updateData);
        if (rec.studentId) {
          query = query.ilike('student_id', rec.studentId);
        } else if (rec.kclEmail) {
          query = query.ilike('email', rec.kclEmail);
        }

        const { error } = await query;
        if (!error) {
          updatedCount++;
        } else {
          skippedCount++;
        }
      }

      return NextResponse.json({
        success: true,
        updatedCount,
        skippedCount,
      });
    }

    // For email operations, require csvText
    if (!csvText || !csvText.trim()) {
      return NextResponse.json({ error: 'CSV report content is required' }, { status: 400 });
    }

    const result = parseKclsuSalesForBmc(csvText, formUrl);
    const { stats, recipients } = result;

    if (action === 'preview') {
      const sample = recipients.length > 0 ? generateBmcEmailContent(recipients[0], formUrl) : null;
      return NextResponse.json({
        success: true,
        stats,
        recipients,
        sampleEmail: sample,
      });
    }

    if (action === 'export') {
      const csvOutput = generateBmcMailMergeCsv(recipients, formUrl);
      return new NextResponse(csvOutput, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="kclmc_bmc_insurance_recipients_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    if (action === 'test') {
      const target = testEmail || user.email;
      if (!target) {
        return NextResponse.json({ error: 'Test recipient email is required' }, { status: 400 });
      }

      if (recipients.length === 0) {
        return NextResponse.json({ error: 'No recreational recipients to test' }, { status: 400 });
      }

      const memberIdx = typeof body.memberIndex === 'number' && body.memberIndex >= 0 && body.memberIndex < recipients.length
        ? body.memberIndex
        : 0;
      const sampleMember = recipients[memberIdx];
      const emailContent = generateBmcEmailContent(sampleMember, formUrl);

      if (!smtpUser || !smtpPass) {
        return NextResponse.json({
          success: false,
          error: 'SMTP credentials (SMTP_USER / GMAIL_USER) are not configured on the server. You can export the mail-merge CSV instead, or configure SMTP.',
          sampleEmail: emailContent,
        });
      }

      const sendRes = await sendSmtpEmail({
        host: smtpHost,
        port: smtpPort,
        user: smtpUser,
        pass: smtpPass,
        from: smtpFrom,
        to: target,
        subject: `[TEST SAMPLE: ${sampleMember.formattedName}] ${emailContent.subject}`,
        text: emailContent.text,
        html: emailContent.html,
      });

      return NextResponse.json({
        success: sendRes.success,
        message: sendRes.success ? `Test email (sample for ${sampleMember.formattedName}) successfully sent to ${target} via ${smtpHost}` : sendRes.error,
      });
    }

    if (action === 'send') {
      if (!smtpUser || !smtpPass) {
        return NextResponse.json({
          error: 'SMTP credentials (SMTP_USER / GMAIL_USER) are not configured. Please configure environment variables or supply them in Settings.',
        }, { status: 400 });
      }

      const skipAlreadySent = body.skipAlreadySent !== false;
      let targets = recipients;
      let skippedCount = 0;

      // Load existing dispatches to filter duplicates
      const existingDispatches: Record<string, { sentAt: string; email: string; fullName: string }> = {};
      try {
        const { data } = await serverSupabase
          .from('bmc_dispatches')
          .select('card_number, email, full_name, sent_at')
          .eq('academic_year', '2026/27');

        if (data && Array.isArray(data)) {
          for (const item of data) {
            if (item.card_number) {
              existingDispatches[item.card_number.toUpperCase().trim()] = {
                sentAt: item.sent_at,
                email: item.email,
                fullName: item.full_name || '',
              };
            }
          }
        }
      } catch (err) {
        console.warn('[BMC] Failed to load Supabase dispatches for filtering:', err);
      }

      if (skipAlreadySent) {
        const partition = partitionRecipientsByDispatchStatus(recipients, existingDispatches);
        targets = partition.unsentRecipients;
        skippedCount = partition.alreadySentRecipients.length;
      }

      if (targets.length === 0) {
        return NextResponse.json({
          success: true,
          message: `All ${recipients.length} eligible recreational members have already received their BMC insurance email. No duplicates were sent.`,
          sentCount: 0,
          skippedCount,
          failedCount: 0,
          totalRecipients: recipients.length,
          newDispatches: {},
        });
      }

      let sentCount = 0;
      let failedCount = 0;
      const failedEmails: string[] = [];
      const newDispatches: Record<string, { sentAt: string; email: string; fullName: string }> = {};

      for (const member of targets) {
        const emailContent = generateBmcEmailContent(member, formUrl);
        const sendRes = await sendSmtpEmail({
          host: smtpHost,
          port: smtpPort,
          user: smtpUser,
          pass: smtpPass,
          from: smtpFrom,
          to: member.email,
          subject: emailContent.subject,
          text: emailContent.text,
          html: emailContent.html,
        });

        if (sendRes.success) {
          sentCount++;
          const nowIso = new Date().toISOString();
          const cardKey = member.cardNumber.toUpperCase().trim();

          newDispatches[cardKey] = {
            sentAt: nowIso,
            email: member.email,
            fullName: member.formattedName,
          };

          // Record in Supabase
          try {
            await serverSupabase.from('bmc_dispatches').upsert({
              card_number: cardKey,
              email: member.email,
              full_name: member.formattedName,
              sent_at: nowIso,
              academic_year: '2026/27',
            }, { onConflict: 'card_number,academic_year' });
          } catch (dbErr) {
            console.warn('[BMC] Could not record dispatch in Supabase:', dbErr);
          }
        } else {
          failedCount++;
          failedEmails.push(member.email);
        }

        await new Promise(r => setTimeout(r, 350));
      }

      return NextResponse.json({
        success: true,
        sentCount,
        skippedCount,
        failedCount,
        failedEmails,
        totalRecipients: recipients.length,
        newDispatches,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error('BMC Insurance API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const isGmail = Boolean(
      process.env.GMAIL_USER ||
      process.env.GMAIL_APP_PASS
    );
    const smtpHost = process.env.SMTP_HOST || (isGmail ? 'smtp.gmail.com' : 'smtp.purelymail.com');
    const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
    const smtpUser = process.env.GMAIL_USER || process.env.SMTP_USER || '';
    const smtpPass = process.env.GMAIL_APP_PASS || process.env.SMTP_PASS || '';
    const smtpFrom = process.env.SMTP_FROM || smtpUser || 'kclmc.committee@gmail.com';

    return NextResponse.json({
      success: true,
      isSmtpConfigured: Boolean(smtpUser && smtpPass),
      senderEmail: smtpUser || smtpFrom || 'kclmc.committee@gmail.com',
      smtpHost,
      smtpPort,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

