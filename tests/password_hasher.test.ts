import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  isPlaceholderPassword,
  autoBumpUserPasswordInD1,
} from '@/lib/security/password-hasher';
import { D1Database, D1PreparedStatement, setD1DatabaseOverride } from '@/lib/db/d1';

class MockD1Database implements D1Database {
  public tables: Record<string, any[]> = {
    users: [],
  };

  prepare(query: string): D1PreparedStatement {
    return new MockD1PreparedStatement(query, this);
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<Array<{ results?: T[]; success: boolean; meta?: any }>> {
    const results: any[] = [];
    for (const stmt of statements) {
      results.push(await stmt.all());
    }
    return results;
  }

  async exec(query: string): Promise<{ count: number; duration: number }> {
    return { count: 0, duration: 1 };
  }
}

class MockD1PreparedStatement implements D1PreparedStatement {
  private boundValues: any[] = [];

  constructor(private query: string, private db: MockD1Database) {}

  bind(...values: any[]): D1PreparedStatement {
    this.boundValues = values;
    return this;
  }

  async first<T = unknown>(colName?: string): Promise<T | null> {
    const { results } = await this.all<T>();
    return results.length > 0 ? results[0] : null;
  }

  async all<T = unknown>(): Promise<{ results: T[]; success: boolean; meta?: any }> {
    const q = this.query.trim();

    // SELECT id, email, password_hash, salt FROM users WHERE id = ? OR LOWER(email) = LOWER(?)
    if (q.includes('FROM users')) {
      const id = this.boundValues[0];
      const email = this.boundValues[1];
      const match = this.db.tables.users.find(u => 
        u.id === id || (email && u.email && u.email.toLowerCase() === String(email).toLowerCase())
      );
      return { results: match ? [match as any] : [], success: true };
    }

    return { results: [], success: true };
  }

  async run(): Promise<{ success: boolean; meta?: any }> {
    const q = this.query.trim();

    // UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?
    if (q.includes('UPDATE users SET')) {
      const [hash, salt, updatedAt, id] = this.boundValues;
      const idx = this.db.tables.users.findIndex(u => u.id === id);
      if (idx >= 0) {
        this.db.tables.users[idx].password_hash = hash;
        this.db.tables.users[idx].salt = salt;
        this.db.tables.users[idx].updated_at = updatedAt;
      }
      return { success: true };
    }

    // INSERT INTO users ...
    if (q.includes('INSERT INTO users')) {
      const [id, email, password_hash, salt, role, created_at, updated_at] = this.boundValues;
      const idx = this.db.tables.users.findIndex(u => u.id === id);
      const row = { id, email, password_hash, salt, role, created_at, updated_at };
      if (idx >= 0) {
        this.db.tables.users[idx] = { ...this.db.tables.users[idx], ...row };
      } else {
        this.db.tables.users.push(row);
      }
      return { success: true };
    }

    return { success: true };
  }
}

describe('Password Hasher & JIT Bumping Engine (lib/security/password-hasher.ts)', () => {
  let mockDb: MockD1Database;

  beforeEach(() => {
    mockDb = new MockD1Database();
  });

  afterEach(() => {
    setD1DatabaseOverride(null);
  });

  describe('Cryptographic Hashing & Verification', () => {
    it('generates a 128-hex character PBKDF2-SHA512 hash and a 64-hex character salt', () => {
      const { hash, salt } = hashPassword('ClimberPassword123!');
      expect(hash).toHaveLength(128); // 64 bytes in hex
      expect(salt).toHaveLength(64);  // 32 bytes in hex
    });

    it('generates different salts for identical passwords', () => {
      const res1 = hashPassword('IdenticalPass123!');
      const res2 = hashPassword('IdenticalPass123!');
      expect(res1.salt).not.toBe(res2.salt);
      expect(res1.hash).not.toBe(res2.hash);
    });

    it('successfully verifies correct password against hash and salt', () => {
      const password = 'CorrectHorseBatteryStaple1!';
      const { hash, salt } = hashPassword(password);
      expect(verifyPassword(password, hash, salt)).toBe(true);
    });

    it('timing-safely rejects incorrect passwords', () => {
      const { hash, salt } = hashPassword('Secret123!');
      expect(verifyPassword('WrongPassword123!', hash, salt)).toBe(false);
    });

    it('safely handles empty or missing parameters', () => {
      expect(verifyPassword('', 'hash', 'salt')).toBe(false);
      expect(verifyPassword('pass', '', 'salt')).toBe(false);
      expect(verifyPassword('pass', 'hash', '')).toBe(false);
    });
  });

  describe('Placeholder Detection', () => {
    it('correctly identifies migration placeholders', () => {
      expect(isPlaceholderPassword('MIGRATED_ACCOUNT')).toBe(true);
      expect(isPlaceholderPassword('MIGRATED_PROFILE')).toBe(true);
      expect(isPlaceholderPassword('AUTH_EXTERNAL_SUPABASE')).toBe(true);
      expect(isPlaceholderPassword('')).toBe(true);
      expect(isPlaceholderPassword(null)).toBe(true);
      expect(isPlaceholderPassword(undefined)).toBe(true);
    });

    it('recognizes valid PBKDF2 hashes as non-placeholders', () => {
      const { hash } = hashPassword('ValidPass123!');
      expect(isPlaceholderPassword(hash)).toBe(false);
    });
  });

  describe('JIT Auto-Bump to D1', () => {
    it('silently auto-bumps a user with MIGRATED_ACCOUNT to a secure PBKDF2 hash', async () => {
      mockDb.tables.users.push({
        id: 'user-to-bump-123',
        email: 'climber@kcl.ac.uk',
        password_hash: 'MIGRATED_ACCOUNT',
        salt: '',
        role: 0,
      });

      setD1DatabaseOverride(mockDb);

      const bumped = await autoBumpUserPasswordInD1(
        'user-to-bump-123',
        'climber@kcl.ac.uk',
        'ClimberStrongPass123!',
        0
      );

      expect(bumped).toBe(true);

      const updatedUser = mockDb.tables.users.find(u => u.id === 'user-to-bump-123');
      expect(updatedUser).toBeDefined();
      expect(updatedUser?.password_hash).not.toBe('MIGRATED_ACCOUNT');
      expect(updatedUser?.password_hash).toHaveLength(128);
      expect(updatedUser?.salt).toHaveLength(64);

      // Verify the new hash is verifiable with the plaintext password
      expect(verifyPassword('ClimberStrongPass123!', updatedUser?.password_hash, updatedUser?.salt)).toBe(true);
    });

    it('does not re-hash or overwrite an already-bumped PBKDF2 user', async () => {
      const initial = hashPassword('AlreadyModernPass123!');
      mockDb.tables.users.push({
        id: 'user-modern-456',
        email: 'modern@kcl.ac.uk',
        password_hash: initial.hash,
        salt: initial.salt,
        role: 1,
      });

      setD1DatabaseOverride(mockDb);

      const bumped = await autoBumpUserPasswordInD1(
        'user-modern-456',
        'modern@kcl.ac.uk',
        'AlreadyModernPass123!',
        1
      );

      // Should be false (no-op)
      expect(bumped).toBe(false);

      const userAfter = mockDb.tables.users.find(u => u.id === 'user-modern-456');
      expect(userAfter?.password_hash).toBe(initial.hash);
      expect(userAfter?.salt).toBe(initial.salt);
    });

    it('safely catches errors and returns false without throwing if D1 is unavailable', async () => {
      // D1 override is null (unavailable)
      const bumped = await autoBumpUserPasswordInD1(
        'any-id',
        'test@kcl.ac.uk',
        'password123'
      );
      expect(bumped).toBe(false);
    });
  });
});
