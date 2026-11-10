import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..');

export function resolveTargetRepo(explicitDir?: string): string {
  if (explicitDir && fs.existsSync(path.join(explicitDir, 'package.json'))) {
    return path.resolve(explicitDir);
  }
  if (fs.existsSync(path.join(process.cwd(), 'package.json'))) {
    return process.cwd();
  }
  return DEFAULT_REPO_ROOT;
}

export interface CopyViolation {
  file: string;
  line: number;
  match: string;
  ruleId: string;
  severity: 'error' | 'warning';
  message: string;
  suggestion: string;
  context: string;
}

export interface RuleDefinition {
  id: string;
  severity: 'error' | 'warning';
  pattern: RegExp;
  // Optional predicate to check if the match is in user-facing context (JSX/text/strings) rather than internal variable naming
  filter?: (line: string, match: RegExpExecArray) => boolean;
  message: string;
  suggestion: string;
}

export const COPY_AUDIT_RULES: RuleDefinition[] = [
  {
    id: 'OUTDATED_STORAGE_SUPABASE',
    severity: 'error',
    // Matches "Supabase" in text or string literals
    pattern: /\bSupabase\b/gi,
    filter: (line: string) => {
      const trimmed = line.trim();
      // Skip import statements (e.g. import ... from '@/lib/supabase')
      if (trimmed.startsWith('import ') || trimmed.startsWith('import{')) return false;
      // Skip pure type imports or comments if marked as internal
      if (trimmed.startsWith('//') && !trimmed.toLowerCase().includes('todo') && !trimmed.toLowerCase().includes('ui')) return false;
      return true;
    },
    message: 'Outdated reference to "Supabase". The platform has migrated to Cloudflare D1 (SQLite) and Better Auth.',
    suggestion: 'Replace with "Cloudflare D1", "D1 SQLite", or "Better Auth" depending on whether this is database or authentication copy.'
  },
  {
    id: 'DEPRECATED_2FA_MESSAGING',
    severity: 'warning',
    pattern: /(2fa|two-factor|authenticator app|totp code|scan qr with authenticator)/gi,
    filter: (line: string) => {
      const trimmed = line.trim();
      // Ignore comments or internal token field names if not in user strings
      if (trimmed.startsWith('//') && !trimmed.includes('2FA')) return false;
      // Allow Google app password helper text in BMC if it explicitly refers to Google Account 2FA
      if (line.includes('myaccount.google.com/apppasswords')) return false;
      return true;
    },
    message: 'Reference to 2FA / Authenticator App in frontend copy. Mandatory 2FA has been decommissioned.',
    suggestion: 'Remove or update copy so users are not told they need to scan QR codes or enter 2FA codes.'
  },
  {
    id: 'DEV_LOCALHOST_URL_IN_UI',
    severity: 'error',
    pattern: /(https?:\/\/localhost:\d+|https?:\/\/127\.0\.0\.1:\d+)/gi,
    filter: (line: string) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//')) return false;
      return true;
    },
    message: 'Hardcoded localhost/127.0.0.1 URL detected in frontend component.',
    suggestion: 'Use relative paths (e.g. /api/...) or environment variable NEXT_PUBLIC_SITE_URL.'
  },
  {
    id: 'DEAD_2FA_API_ENDPOINTS',
    severity: 'warning',
    pattern: /(\/api\/auth\/(setup-2fa|verify-2fa|verify-otp)|\/api\/admin\/reset-2fa)/g,
    filter: (line: string) => !line.trim().startsWith('//'),
    message: 'Frontend component calls decommissioned 2FA API endpoints.',
    suggestion: 'Remove the API call or decouple component from retired 2FA flows.'
  }
];

const SCAN_DIRECTORIES = ['app', 'components', 'public'];
const FILE_EXTENSIONS = ['.tsx', '.jsx', '.html', '.md', '.json'];

export function findFilesToScan(baseDir: string = DEFAULT_REPO_ROOT, dirs: string[] = SCAN_DIRECTORIES): string[] {
  const targetRoot = resolveTargetRepo(baseDir);
  const result: string[] = [];

  for (const dir of dirs) {
    const fullDir = path.resolve(targetRoot, dir);
    if (!fs.existsSync(fullDir)) continue;

    function walk(current: string) {
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          // Skip node_modules, .next, .open-next, tests
          if (['node_modules', '.next', '.open-next', 'tests', '.git'].includes(entry.name)) continue;
          walk(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (FILE_EXTENSIONS.includes(ext)) {
            result.push(fullPath);
          }
        }
      }
    }

    walk(fullDir);
  }

  return result;
}

export function auditFileContent(filePath: string, content: string, rules = COPY_AUDIT_RULES): CopyViolation[] {
  const violations: CopyViolation[] = [];
  const lines = content.split('\n');

  lines.forEach((lineText, idx) => {
    const lineNum = idx + 1;

    for (const rule of rules) {
      // Reset regex state
      rule.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = rule.pattern.exec(lineText)) !== null) {
        if (!rule.filter || rule.filter(lineText, match)) {
          violations.push({
            file: filePath,
            line: lineNum,
            match: match[0],
            ruleId: rule.id,
            severity: rule.severity,
            message: rule.message,
            suggestion: rule.suggestion,
            context: lineText.trim()
          });
        }
        // Break out if pattern is not global to prevent infinite loop
        if (!rule.pattern.global) break;
      }
    }
  });

  return violations;
}

export function runFrontendCopyAudit(baseDir: string = DEFAULT_REPO_ROOT): {
  targetDir: string;
  totalFiles: number;
  violations: CopyViolation[];
  errors: CopyViolation[];
  warnings: CopyViolation[];
} {
  const targetDir = resolveTargetRepo(baseDir);
  const files = findFilesToScan(targetDir);
  const violations: CopyViolation[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const fileViolations = auditFileContent(file, content);
    violations.push(...fileViolations);
  }

  const errors = violations.filter(v => v.severity === 'error');
  const warnings = violations.filter(v => v.severity === 'warning');

  return {
    targetDir,
    totalFiles: files.length,
    violations,
    errors,
    warnings
  };
}

// CLI Runner
const isDirectCli = process.argv[1] && (
  process.argv[1].endsWith('check_frontend_copy.ts') ||
  process.argv[1].endsWith('check_frontend_copy.js') ||
  process.argv[1].includes('check_frontend_copy')
);

if (isDirectCli) {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');
  const warnOnly = args.includes('--warn-only');
  const repoRoot = resolveTargetRepo();

  const results = runFrontendCopyAudit(repoRoot);

  if (jsonMode) {
    console.log(JSON.stringify(results, null, 2));
    process.exit(results.errors.length > 0 && !warnOnly ? 1 : 0);
  }

  console.log(`\n=======================================================`);
  console.log(` 🔍 KCLMC FRONTEND TEXT & COPY AUDIT`);
  console.log(` Scanned: ${results.totalFiles} frontend files (app/, components/, public/)`);
  console.log(`=======================================================\n`);

  if (results.violations.length === 0) {
    console.log(`✅ All frontend text and copy is completely up to date!`);
    console.log(`   - 0 Supabase mentions found in UI`);
    console.log(`   - 0 Decommissioned 2FA prompts found`);
    console.log(`   - 0 Localhost URLs in client components\n`);
    process.exit(0);
  }

  console.log(`Found ${results.violations.length} total findings (${results.errors.length} errors, ${results.warnings.length} warnings):\n`);

  for (const v of results.violations) {
    const relPath = path.relative(repoRoot, v.file);
    const badge = v.severity === 'error' ? '❌ [ERROR]' : '⚠️  [WARN]';
    console.log(`${badge} ${v.ruleId} at ${relPath}:${v.line}`);
    console.log(`   Match:      "${v.match}"`);
    console.log(`   Context:    ${v.context}`);
    console.log(`   Details:    ${v.message}`);
    console.log(`   Suggestion: ${v.suggestion}`);
    console.log(``);
  }

  console.log(`-------------------------------------------------------`);
  console.log(`Summary: ${results.errors.length} Errors | ${results.warnings.length} Warnings`);
  console.log(`-------------------------------------------------------\n`);

  if (results.errors.length > 0 && !warnOnly) {
    console.error(`🚨 Copy audit failed with ${results.errors.length} errors.`);
    console.error(`   Run with --warn-only to bypass exit code 1 or update the copy.\n`);
    process.exit(1);
  } else {
    process.exit(0);
  }
}
