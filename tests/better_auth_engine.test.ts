import { describe, it, expect, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { betterAuth } from 'better-auth';
import { hashPassword } from 'better-auth/crypto';
import { getMigrations } from 'better-auth/db/migration';
import { renderPasswordResetEmail, renderMagicLinkEmail } from '../lib/email/templates/auth-emails';
import { sendEmail } from '../lib/email/service';

describe('Better Auth & Cloudflare Email Engine', () => {
  it('renders branded password reset email with correct reset link', () => {
    const { html, text } = renderPasswordResetEmail('Alex Honnold', 'https://kclmc.org/update-password?token=test-reset-token');

    expect(html).toContain('Alex Honnold');
    expect(html).toContain('https://kclmc.org/update-password?token=test-reset-token');
    expect(html).toContain('KCL Mountaineering Club');
    expect(text).toContain('Alex Honnold');
    expect(text).toContain('https://kclmc.org/update-password?token=test-reset-token');
    expect(text).toContain('60 minutes');
  });

  it('renders branded 1-click magic link email', () => {
    const { html, text } = renderMagicLinkEmail('https://kclmc.org/api/auth/verify?token=magic-token');

    expect(html).toContain('https://kclmc.org/api/auth/verify?token=magic-token');
    expect(html).toContain('1-Click Instant Sign-In');
    expect(text).toContain('15 minutes');
  });

  it('sendEmail gracefully falls back to console simulation when env.EMAIL is missing', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await sendEmail({}, {
      to: 'climber@kcl.ac.uk',
      subject: 'Test Subject',
      html: '<p>Test</p>',
      text: 'Test',
    });

    expect(res.success).toBe(true);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('sendEmail dispatches through Cloudflare env.EMAIL.send when bound', async () => {
    const mockSend = vi.fn().mockResolvedValue(undefined);
    const mockEnv = {
      EMAIL: { send: mockSend },
      EMAIL_FROM: 'portal@kclmc.org',
    };

    const res = await sendEmail(mockEnv, {
      to: 'member@kcl.ac.uk',
      subject: 'Reset Password',
      html: '<p>Reset</p>',
      text: 'Reset link',
    });

    expect(res.success).toBe(true);
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
      to: [{ email: 'member@kcl.ac.uk', name: 'member' }],
      from: { email: 'portal@kclmc.org', name: 'KCLMC Portal' },
      subject: 'Reset Password',
    }));
  });

  it('executes JIT password auto-bump lifecycle in Better Auth', async () => {
    const sqlite = new DatabaseSync(':memory:');

    const auth = betterAuth({
      database: sqlite,
      secret: 'test-secret-key-at-least-32-chars-long',
      emailAndPassword: {
        enabled: true,
      },
    });

    const m = await getMigrations(auth.options);
    await m.runMigrations();

    // Seed a migrated user with MIGRATED_ACCOUNT placeholder
    sqlite.prepare("INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES ('u1', 'Migrated Member', 'member@kcl.ac.uk', 1, datetime('now'), datetime('now'))").run();
    sqlite.prepare("INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt) VALUES ('a1', 'u1', 'credential', 'u1', 'MIGRATED_ACCOUNT', datetime('now'), datetime('now'))").run();

    // Verify initially account has MIGRATED_ACCOUNT
    const initialAccount = sqlite.prepare("SELECT password FROM account WHERE userId = 'u1'").get() as any;
    expect(initialAccount.password).toBe('MIGRATED_ACCOUNT');

    // Simulate JIT auto-bump: when password matches legacy validation, bump to native hash
    const candidatePassword = 'ValidPassword123!';
    const newNativeHash = await hashPassword(candidatePassword);
    sqlite.prepare("UPDATE account SET password = ? WHERE userId = 'u1'").run(newNativeHash);

    // Verify user can now sign in natively with Better Auth
    const signInRes = await auth.api.signInEmail({
      body: {
        email: 'member@kcl.ac.uk',
        password: candidatePassword,
      },
    });

    expect(signInRes.user.email).toBe('member@kcl.ac.uk');
    const updatedAccount = sqlite.prepare("SELECT password FROM account WHERE userId = 'u1'").get() as any;
    expect(updatedAccount.password).not.toBe('MIGRATED_ACCOUNT');
    expect(updatedAccount.password.length).toBeGreaterThan(32);
  });
});
