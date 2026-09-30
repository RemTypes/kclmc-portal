import dns from 'dns/promises';
import tls from 'tls';

interface CheckResult {
  category: string;
  item: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  details: string;
  recommendation?: string;
}

const DOMAIN = 'kclmc.org';
const PURELYMAIL_MX = 'mailserver.purelymail.com';
const PURELYMAIL_IMAP = 'imap.purelymail.com';
const PURELYMAIL_SMTP = 'smtp.purelymail.com';

async function checkDns(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // 1. MX Record Check
  try {
    const mxRecords = await dns.resolveMx(DOMAIN);
    const pmMx = mxRecords.find(r => r.exchange.toLowerCase().includes('purelymail.com'));
    if (pmMx) {
      results.push({
        category: 'DNS (Inbound)',
        item: `MX Record (${DOMAIN})`,
        status: 'PASS',
        details: `Found: ${pmMx.exchange} (Priority: ${pmMx.priority})`,
      });
    } else {
      results.push({
        category: 'DNS (Inbound)',
        item: `MX Record (${DOMAIN})`,
        status: 'FAIL',
        details: `No Purelymail MX record found. Got: ${mxRecords.map(r => r.exchange).join(', ')}`,
        recommendation: `Add MX record in Cloudflare: Host @, Priority 50, Target: ${PURELYMAIL_MX}`,
      });
    }
  } catch (err: any) {
    results.push({
      category: 'DNS (Inbound)',
      item: `MX Record (${DOMAIN})`,
      status: 'FAIL',
      details: `Failed to resolve MX records: ${err.message}`,
      recommendation: `Add MX record in Cloudflare pointing to ${PURELYMAIL_MX}`,
    });
  }

  // 2. SPF Record Check
  try {
    const txtRecords = await dns.resolveTxt(DOMAIN);
    const flatTxt = txtRecords.map(chunks => chunks.join('')).filter(t => t.startsWith('v=spf1'));
    if (flatTxt.length === 0) {
      results.push({
        category: 'DNS (Sender Auth)',
        item: `SPF Record (${DOMAIN})`,
        status: 'FAIL',
        details: 'No SPF (v=spf1) record found',
        recommendation: 'Add TXT record: v=spf1 include:_spf.purelymail.com ~all',
      });
    } else {
      const spfRecord = flatTxt[0];
      const hasPurelymail = spfRecord.includes('_spf.purelymail.com');
      if (hasPurelymail) {
        results.push({
          category: 'DNS (Sender Auth)',
          item: `SPF Record (${DOMAIN})`,
          status: 'PASS',
          details: `Valid: "${spfRecord}"`,
        });
      } else {
        results.push({
          category: 'DNS (Sender Auth)',
          item: `SPF Record (${DOMAIN})`,
          status: 'FAIL',
          details: `SPF exists but missing Purelymail inclusion: "${spfRecord}"`,
          recommendation: 'Update SPF record to include: include:_spf.purelymail.com',
        });
      }
    }
  } catch (err: any) {
    results.push({
      category: 'DNS (Sender Auth)',
      item: `SPF Record (${DOMAIN})`,
      status: 'WARN',
      details: `Could not query SPF TXT: ${err.message}`,
    });
  }

  // 3. DKIM Checks (purelymail1, purelymail2, purelymail3)
  const dkimSelectors = ['purelymail1', 'purelymail2', 'purelymail3'];
  for (let i = 0; i < dkimSelectors.length; i++) {
    const selector = dkimSelectors[i];
    const host = `${selector}._domainkey.${DOMAIN}`;

    try {
      // Check CNAME first
      const cnames = await dns.resolveCname(host);
      if (cnames && cnames.length > 0) {
        results.push({
          category: 'DNS (DKIM Crypto)',
          item: `DKIM ${selector}`,
          status: 'PASS',
          details: `CNAME correctly aliases to: ${cnames.join(', ')}`,
        });
        continue;
      }
    } catch {
      // If CNAME query failed, check if accidentally added as TXT
      try {
        const txts = await dns.resolveTxt(host);
        const joinedTxt = txts.map(chunks => chunks.join('')).join(' ');
        if (joinedTxt.includes('dkimroot.purelymail.com')) {
          results.push({
            category: 'DNS (DKIM Crypto)',
            item: `DKIM ${selector}`,
            status: 'FAIL',
            details: `Found TXT record containing "${joinedTxt}" instead of a CNAME!`,
            recommendation: `In Cloudflare, change type from TXT to CNAME for ${selector}._domainkey pointing to key${i + 1}.dkimroot.purelymail.com (DNS Only).`,
          });
          continue;
        } else if (joinedTxt.startsWith('v=DKIM1')) {
          results.push({
            category: 'DNS (DKIM Crypto)',
            item: `DKIM ${selector}`,
            status: 'PASS',
            details: 'Direct TXT DKIM public key detected and valid.',
          });
          continue;
        }
      } catch {
        // Record does not exist
      }
    }

    // If not found
    if (i === 0) {
      results.push({
        category: 'DNS (DKIM Crypto)',
        item: `DKIM ${selector} (Primary)`,
        status: 'FAIL',
        details: `Record ${host} not found in DNS`,
        recommendation: `Add CNAME in Cloudflare: ${selector}._domainkey -> key1.dkimroot.purelymail.com`,
      });
    } else {
      results.push({
        category: 'DNS (DKIM Crypto)',
        item: `DKIM ${selector} (Rotation)`,
        status: 'WARN',
        details: `Optional rotation key ${host} not published`,
        recommendation: `Add CNAME: ${selector}._domainkey -> key${i + 1}.dkimroot.purelymail.com`,
      });
    }
  }

  // 4. DMARC Check
  try {
    const dmarcHost = `_dmarc.${DOMAIN}`;
    const txts = await dns.resolveTxt(dmarcHost);
    const dmarc = txts.map(chunks => chunks.join('')).find(t => t.startsWith('v=DMARC1'));
    if (dmarc) {
      results.push({
        category: 'DNS (DMARC Policy)',
        item: `DMARC (${dmarcHost})`,
        status: 'PASS',
        details: `Found: "${dmarc}"`,
      });
    } else {
      results.push({
        category: 'DNS (DMARC Policy)',
        item: `DMARC (${dmarcHost})`,
        status: 'WARN',
        details: 'DMARC record not found',
        recommendation: 'Add TXT record for _dmarc: v=DMARC1; p=none;',
      });
    }
  } catch {
    results.push({
      category: 'DNS (DMARC Policy)',
      item: `DMARC (_dmarc.${DOMAIN})`,
      status: 'WARN',
      details: 'DMARC record not published',
      recommendation: 'Add TXT record for _dmarc: v=DMARC1; p=none;',
    });
  }

  return results;
}

function testTlsConnection(
  host: string,
  port: number,
  expectedBanner: string,
  quitCommand: string
): Promise<{ success: boolean; banner: string; error?: string }> {
  return new Promise((resolve) => {
    let banner = '';
    const socket = tls.connect(port, host, { servername: host }, () => {
      // connected
    });

    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({ success: false, banner, error: 'Connection timed out after 5000ms' });
    }, 5000);

    socket.on('data', (data) => {
      banner += data.toString();
      if (banner.toLowerCase().includes(expectedBanner.toLowerCase())) {
        clearTimeout(timeout);
        try {
          socket.write(quitCommand);
        } catch {}
        setTimeout(() => {
          socket.destroy();
          resolve({ success: true, banner: banner.trim().split('\n')[0] });
        }, 300);
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      resolve({ success: false, banner, error: err.message });
    });

    socket.on('end', () => {
      clearTimeout(timeout);
      if (!banner) {
        resolve({ success: false, banner: '', error: 'Socket closed without banner' });
      }
    });
  });
}

async function checkNetworkSockets(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // 1. IMAP SSL (Port 993)
  const imapResult = await testTlsConnection(PURELYMAIL_IMAP, 993, '* OK', 'a001 LOGOUT\r\n');
  if (imapResult.success) {
    results.push({
      category: 'Network (IMAP SSL)',
      item: `${PURELYMAIL_IMAP}:993`,
      status: 'PASS',
      details: `Secure TLS handshake successful. Banner: "${imapResult.banner}"`,
    });
  } else {
    results.push({
      category: 'Network (IMAP SSL)',
      item: `${PURELYMAIL_IMAP}:993`,
      status: 'FAIL',
      details: `Failed to connect: ${imapResult.error || 'No response'}`,
      recommendation: 'Check local firewall or network connection.',
    });
  }

  // 2. SMTP SSL (Port 465)
  const smtpResult = await testTlsConnection(PURELYMAIL_SMTP, 465, '220', 'QUIT\r\n');
  if (smtpResult.success) {
    results.push({
      category: 'Network (SMTP SSL)',
      item: `${PURELYMAIL_SMTP}:465`,
      status: 'PASS',
      details: `Secure TLS handshake successful. Banner: "${smtpResult.banner}"`,
    });
  } else {
    results.push({
      category: 'Network (SMTP SSL)',
      item: `${PURELYMAIL_SMTP}:465`,
      status: 'FAIL',
      details: `Failed to connect: ${smtpResult.error || 'No response'}`,
      recommendation: 'Check local firewall or network connection.',
    });
  }

  return results;
}

async function runDiagnostic() {
  console.log('\n================================================================');
  console.log(` 🏔️  KCLMC Automated Email Diagnostic Suite [${DOMAIN}]`);
  console.log(` 📅  Audit Timestamp: ${new Date().toISOString()}`);
  console.log('================================================================\n');

  console.log('📡 Step 1: Performing DNS Resolutions...');
  const dnsResults = await checkDns();

  console.log('🔌 Step 2: Testing Secure Mail Protocols (IMAP & SMTP Sockets)...');
  const netResults = await checkNetworkSockets();

  const allResults = [...dnsResults, ...netResults];

  console.log('\n----------------------------------------------------------------');
  console.log(' DIAGNOSTIC AUDIT RESULTS:');
  console.log('----------------------------------------------------------------\n');

  let passes = 0;
  let warnings = 0;
  let failures = 0;

  for (const r of allResults) {
    let icon = '✅';
    if (r.status === 'WARN') {
      icon = '⚠️ ';
      warnings++;
    } else if (r.status === 'FAIL') {
      icon = '❌';
      failures++;
    } else {
      passes++;
    }

    console.log(`${icon} [${r.status.padEnd(4)}] [${r.category}] ${r.item}`);
    console.log(`       Details: ${r.details}`);
    if (r.recommendation) {
      console.log(`       👉 Action: ${r.recommendation}`);
    }
    console.log('');
  }

  console.log('================================================================');
  console.log(` Summary: ${passes} Passed | ${warnings} Warnings | ${failures} Action Items`);
  console.log('================================================================\n');

  if (failures > 0) {
    console.log('🚨 Action items detected above require attention in Cloudflare DNS.\n');
  } else {
    console.log('🎉 All core email protocols and routing checks are fully operational!\n');
  }
}

runDiagnostic().catch((err) => {
  console.error('Fatal diagnostic error:', err);
  process.exit(1);
});
