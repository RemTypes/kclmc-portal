#!/usr/bin/env node
/**
 * CLI Tool: Automate BMC Insurance Form Release to Recreational Members
 * 
 * Usage:
 *   npx tsx scripts/send_bmc_insurance_emails.ts [options]
 * 
 * Options:
 *   --csv <path>        Path to KCLSU Product Purchasers Report CSV
 *   --link <url>        BMC Insurance Form link (Google Form viewform URL)
 *   --dry-run           Inspect parsed members and generate sample preview without sending (Default)
 *   --export-csv <path> Export clean mail-merge CSV with all 57 recreational members & prefilled links
 *   --test <email>      Send a single test email to verify template formatting
 *   --send              Dispatch emails to all recreational members via SMTP / Gmail
 * 
 * Examples:
 *   npx tsx scripts/send_bmc_insurance_emails.ts --dry-run
 *   npx tsx scripts/send_bmc_insurance_emails.ts --export-csv bmc_recipients.csv
 *   npx tsx scripts/send_bmc_insurance_emails.ts --test your-email@kcl.ac.uk
 *   GMAIL_USER="kclmc@gmail.com" GMAIL_APP_PASS="xxxx" npx tsx scripts/send_bmc_insurance_emails.ts --send
 */

import fs from 'fs';
import path from 'path';
import {
  parseKclsuSalesForBmc,
  generateBmcEmailContent,
  generateBmcMailMergeCsv,
  partitionRecipientsByDispatchStatus,
  DEFAULT_BMC_FORM_URL,
  BmcMemberRecipient,
  BmcDispatchMap,
} from '../lib/bmc_insurance';
import { sendSmtpEmail } from '../lib/bmc_smtp';

const CANDIDATE_CSV_PATHS = [
  '/Users/rem/Downloads/Product Purchasers Report (Complete 134 Members).csv',
  '/Users/rem/Downloads/Product Purchasers Report (System)(7).csv',
];

const DEFAULT_CSV_PATH = CANDIDATE_CSV_PATHS.find(p => fs.existsSync(p)) || CANDIDATE_CSV_PATHS[0];
const DEFAULT_FORM_URL_VALUE = process.env.BMC_INSURANCE_FORM_URL || DEFAULT_BMC_FORM_URL;
const SENT_LOG_PATH = path.resolve(process.cwd(), 'scripts', 'bmc_sent_log.json');

// CLI Argument Parser
const args = process.argv.slice(2);
function getArg(flag: string): string | null {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return null;
}
const hasFlag = (flag: string) => args.includes(flag);

const csvPath = getArg('--csv') || DEFAULT_CSV_PATH;
const formUrl = getArg('--link') || DEFAULT_FORM_URL_VALUE;
const isSendMode = hasFlag('--send');
const isForceAll = hasFlag('--force-all');
const testRecipient = getArg('--test');
const exportCsvPath = getArg('--export-csv');
const isDryRun = hasFlag('--dry-run') || (!isSendMode && !testRecipient);


function resolveSmtpConfig() {
  const isGmail = Boolean(process.env.GMAIL_USER || process.env.GMAIL_APP_PASS);
  const host = process.env.SMTP_HOST || (isGmail ? 'smtp.gmail.com' : 'smtp.purelymail.com');
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.GMAIL_USER || process.env.SMTP_USER || '';
  const pass = process.env.GMAIL_APP_PASS || process.env.SMTP_PASS || '';
  const from = process.env.SMTP_FROM || user || 'kclmc.committee@gmail.com';

  return { host, port, user, pass, from, isConfigured: Boolean(user && pass) };
}

async function main() {
  console.log('\n================================================================');
  console.log(' 🏔️  KCLMC BMC Insurance Automated Broadcast Engine');
  console.log('================================================================\n');

  // 1. Read CSV File
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Error: CSV report file not found at: ${csvPath}`);
    console.error('👉 Please specify a valid file path using --csv <path>\n');
    process.exit(1);
  }

  let csvContent = '';
  try {
    csvContent = fs.readFileSync(csvPath, 'utf8');
  } catch (err: any) {
    console.error(`❌ Error reading CSV file: ${err.message}`);
    process.exit(1);
  }

  console.log(`📄 Loaded report: ${path.basename(csvPath)} (${(csvContent.length / 1024).toFixed(1)} KB)`);
  console.log(`🔗 Target Form URL: ${formUrl}\n`);

  // 2. Parse & Classify Members
  const result = parseKclsuSalesForBmc(csvContent, formUrl);
  const { stats, recipients } = result;

  console.log('----------------------------------------------------------------');
  console.log(' ROSTER CLASSIFICATION SUMMARY:');
  console.log('----------------------------------------------------------------');
  console.log(` • Total Transaction Rows:       ${stats.totalRows}`);
  console.log(` • Unique Student Members:       ${stats.totalUniqueMembers}`);
  console.log(` • Recreational Members:         ${stats.recreationalCount}  ✅ (Eligible for BMC Insurance)`);
  console.log(` • Upgraded (Social ➔ Rec):      ${stats.upgradedCount}  ⚡ (Included in Recreational)`);
  console.log(` • Social Only Members:          ${stats.socialCount}  ⛔ (Excluded from Insurance Form)`);
  console.log('----------------------------------------------------------------\n');

  if (recipients.length === 0) {
    console.warn('⚠️ No recreational members found in CSV.');
    return;
  }

  // Load local dispatch log for duplicate prevention
  let localDispatches: BmcDispatchMap = {};
  if (fs.existsSync(SENT_LOG_PATH)) {
    try {
      localDispatches = JSON.parse(fs.readFileSync(SENT_LOG_PATH, 'utf8'));
    } catch {}
  }

  const { unsentRecipients, alreadySentRecipients } = partitionRecipientsByDispatchStatus(
    recipients,
    localDispatches
  );

  console.log('----------------------------------------------------------------');
  console.log(' DUPLICATE PREVENTION STATUS:');
  console.log('----------------------------------------------------------------');
  console.log(` • Already Emailed (Logged):     ${alreadySentRecipients.length} members  🛡️ (Skipped by default)`);
  console.log(` • New Members (Pending Send):   ${unsentRecipients.length} members  ⚡ (Target audience)`);
  console.log('----------------------------------------------------------------\n');

  // 3. Export CSV if requested
  if (exportCsvPath || hasFlag('--export-csv')) {
    const targetFile = exportCsvPath || 'kclmc_bmc_recreational_recipients.csv';
    const exportList = isForceAll ? recipients : unsentRecipients;
    const csvOutput = generateBmcMailMergeCsv(exportList, formUrl);
    fs.writeFileSync(targetFile, csvOutput, 'utf8');
    console.log(`✅ Mail-merge CSV exported to: ${path.resolve(targetFile)} (${exportList.length} members with prefilled links)\n`);
  }

  const smtp = resolveSmtpConfig();

  // 4. Test Email Mode
  if (testRecipient) {
    console.log(`🧪 Running Test Dispatch to: ${testRecipient}...`);
    const sampleMember = unsentRecipients[0] || recipients[0];
    const emailContent = generateBmcEmailContent(sampleMember, formUrl);

    if (!smtp.isConfigured) {
      console.warn('⚠️ SMTP credentials not found in environment.');
      console.log('To send live emails with Gmail or Purelymail, set:');
      console.log('  export GMAIL_USER="kclmc.committee@gmail.com"');
      console.log('  export GMAIL_APP_PASS="xxxx xxxx xxxx xxxx"');
      console.log('  OR');
      console.log('  export SMTP_USER="committee@kclmc.org"');
      console.log('  export SMTP_PASS="your-password"');
      console.log('  export SMTP_HOST="smtp.purelymail.com"\n');
      console.log('Sample test email content preview:\n');
      console.log(`Subject: ${emailContent.subject}\n`);
      console.log(emailContent.text);
      return;
    }

    const sendRes = await sendSmtpEmail({
      host: smtp.host,
      port: smtp.port,
      user: smtp.user,
      pass: smtp.pass,
      from: smtp.from,
      to: testRecipient,
      subject: `[TEST] ${emailContent.subject}`,
      text: emailContent.text,
      html: emailContent.html,
    });

    if (sendRes.success) {
      console.log(`🎉 Test email successfully dispatched to ${testRecipient} via ${smtp.host}!\n`);
    } else {
      console.error(`❌ Failed to send test email: ${sendRes.error}\n`);
    }
    return;
  }

  // 5. Dry-Run Mode Preview
  if (isDryRun && !isSendMode) {
    const previewList = isForceAll ? recipients : unsentRecipients;
    console.log('🔍 DRY-RUN PREVIEW (No emails sent):');
    console.log(`Showing first 5 of ${previewList.length} target recipients with personalized prefilled links:\n`);

    previewList.slice(0, 5).forEach((m, idx) => {
      console.log(` [${idx + 1}] ${m.formattedName} (${m.cardNumber})`);
      console.log(`     Email:       ${m.email}`);
      console.log(`     Tier:        ${m.tier.toUpperCase()}${m.isUpgradedFromSocial ? ' [Upgraded from Social]' : ''}`);
      console.log(`     Prefilled:   ${m.prefilledFormUrl}`);
      console.log(`     Transaction: ${m.transactionId} (${m.purchaseDate})`);
      console.log('');
    });

    console.log('----------------------------------------------------------------');
    console.log(' SAMPLE EMAIL CONTENT:');
    console.log('----------------------------------------------------------------');
    const sample = generateBmcEmailContent(previewList[0] || recipients[0], formUrl);
    console.log(`Subject: ${sample.subject}\n`);
    console.log(sample.text);
    console.log('----------------------------------------------------------------\n');

    console.log('💡 NEXT STEPS:');
    console.log(' • To export a mail-merge CSV:');
    console.log('   npx tsx scripts/send_bmc_insurance_emails.ts --export-csv bmc_recipients.csv\n');
    console.log(' • To send a test email:');
    console.log('   npx tsx scripts/send_bmc_insurance_emails.ts --test your-email@kcl.ac.uk\n');
    console.log(' • To trigger automated live broadcast to NEW members:');
    console.log('   GMAIL_USER="kclmc.committee@gmail.com" GMAIL_APP_PASS="xxxx" npx tsx scripts/send_bmc_insurance_emails.ts --send\n');
    console.log(' • To force broadcast to ALL members (including previously sent):');
    console.log('   GMAIL_USER="kclmc.committee@gmail.com" GMAIL_APP_PASS="xxxx" npx tsx scripts/send_bmc_insurance_emails.ts --send --force-all\n');
    return;
  }

  // 6. Live Send Mode
  if (isSendMode) {
    if (!smtp.isConfigured) {
      console.error('❌ Cannot send: Missing SMTP credentials in environment.');
      console.log('Please set Gmail or Purelymail credentials:');
      console.log('  export GMAIL_USER="kclmc.committee@gmail.com"');
      console.log('  export GMAIL_APP_PASS="xxxx xxxx xxxx xxxx"');
      console.log('  OR');
      console.log('  export SMTP_USER="committee@kclmc.org"');
      console.log('  export SMTP_PASS="your-password"\n');
      process.exit(1);
    }

    const targets = isForceAll ? recipients : unsentRecipients;

    if (targets.length === 0) {
      console.log('🎉 All recreational members in this report have already received their BMC insurance email!');
      console.log('🛡️ No duplicate emails will be sent.');
      console.log('💡 If you intentionally wish to resend to all members, pass the --force-all flag.\n');
      return;
    }

    if (!isForceAll && alreadySentRecipients.length > 0) {
      console.log(`🛡️ Anti-Duplicate Filter Active: Skipping ${alreadySentRecipients.length} members already emailed.`);
    }

    console.log(`🚀 Starting automated email dispatch to ${targets.length} recreational member(s) via ${smtp.host}...`);
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < targets.length; i++) {
      const member = targets[i];
      const emailContent = generateBmcEmailContent(member, formUrl);

      process.stdout.write(`[${i + 1}/${targets.length}] Sending to ${member.email} (${member.formattedName})... `);

      try {
        const sendRes = await sendSmtpEmail({
          host: smtp.host,
          port: smtp.port,
          user: smtp.user,
          pass: smtp.pass,
          from: smtp.from,
          to: member.email,
          subject: emailContent.subject,
          text: emailContent.text,
          html: emailContent.html,
        });

        if (sendRes.success) {
          sentCount++;
          console.log('✅ Sent');

          // Record in sent log
          localDispatches[member.cardNumber.toUpperCase()] = {
            sentAt: new Date().toISOString(),
            email: member.email,
            fullName: member.formattedName,
          };
          try {
            fs.writeFileSync(SENT_LOG_PATH, JSON.stringify(localDispatches, null, 2), 'utf8');
          } catch {}
        } else {
          failedCount++;
          console.log(`❌ Failed (${sendRes.error})`);
        }
      } catch (err: any) {
        failedCount++;
        console.log(`❌ Error (${err.message})`);
      }

      // 400ms pause between emails to protect SMTP socket
      await new Promise(r => setTimeout(r, 400));
    }

    console.log('\n================================================================');
    console.log(` Dispatch Finished: ${sentCount} Sent Successfully, ${failedCount} Failed, ${isForceAll ? 0 : alreadySentRecipients.length} Skipped`);
    console.log('================================================================\n');
  }
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
