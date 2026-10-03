import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UNIVERSITIES, DEFAULT_UNIVERSITY, sanitizeUniversity } from '@/lib/auth';

describe('University Selection & Profile Persistence', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('University Constants & Sanitizer', () => {
    it('provides comprehensive list of London and UK institutions', () => {
      expect(UNIVERSITIES).toContain("King's College London");
      expect(UNIVERSITIES).toContain("University College London (UCL)");
      expect(UNIVERSITIES).toContain("Imperial College London");
      expect(UNIVERSITIES).toContain("Queen Mary University of London (QMUL)");
      expect(UNIVERSITIES).toContain("London School of Economics (LSE)");
      expect(UNIVERSITIES).toContain("Brunel University London");
      expect(UNIVERSITIES).toContain("City, University of London");
      expect(UNIVERSITIES).toContain("St George's, University of London");
      expect(UNIVERSITIES).toContain("Birkbeck, University of London");
      expect(UNIVERSITIES).toContain("Royal Holloway, University of London");
      expect(UNIVERSITIES).toContain("SOAS University of London");
      expect(UNIVERSITIES).toContain("Other UK Institution");
      expect(UNIVERSITIES).toContain("Alumni / Associate / Guest");
    });

    it('defaults to King\'s College London', () => {
      expect(DEFAULT_UNIVERSITY).toBe("King's College London");
    });

    it('sanitizes university input correctly', () => {
      expect(sanitizeUniversity(null)).toBe("King's College London");
      expect(sanitizeUniversity(undefined)).toBe("King's College London");
      expect(sanitizeUniversity('')).toBe("King's College London");
      expect(sanitizeUniversity('   ')).toBe("King's College London");
      expect(sanitizeUniversity('  University of Oxford  ')).toBe('University of Oxford');
      expect(sanitizeUniversity('UCL')).toBe('UCL');
    });

    it('truncates excessively long institution names safely', () => {
      const longName = 'A'.repeat(200);
      const sanitized = sanitizeUniversity(longName);
      expect(sanitized.length).toBe(150);
    });

    it('handles custom university fallback logic appropriately', () => {
      const selectedOption = 'Other UK Institution';
      const customName = '  Durham University  ';
      const effectiveUniversity = sanitizeUniversity(
        selectedOption === 'Other UK Institution' ? customName : selectedOption
      );
      expect(effectiveUniversity).toBe('Durham University');
    });

    it('falls back to default university when custom input is blank', () => {
      const selectedOption = 'Other UK Institution';
      const customName = '   ';
      const effectiveUniversity = sanitizeUniversity(
        selectedOption === 'Other UK Institution' ? customName : selectedOption
      );
      expect(effectiveUniversity).toBe("King's College London");
    });
  });
});
