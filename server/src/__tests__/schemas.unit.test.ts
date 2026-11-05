import { describe, it, expect } from '@jest/globals';
import {
  normalizeSlug,
  buildTargetUrl,
  createLinkSchema,
  listLinksQuerySchema,
  idParamSchema,
} from '../schemas.js';

describe('Unit: Schemas & Input Validation (FR-01, FR-02)', () => {
  describe('buildTargetUrl()', () => {
    it('joins the selected protocol when the input URL omits http:// or https://', () => {
      expect(buildTargetUrl('irvin-lopez.com', 'https://')).toBe('https://irvin-lopez.com');
      expect(buildTargetUrl('irvin-lopez.com', 'http://')).toBe('http://irvin-lopez.com');
    });

    it('omits joining the protocol selector when user input already starts with http:// or https://', () => {
      expect(buildTargetUrl('http://irvin-lopez.com', 'https://')).toBe('http://irvin-lopez.com');
      expect(buildTargetUrl('https://irvin-lopez.com', 'http://')).toBe('https://irvin-lopez.com');
    });
  });

  describe('normalizeSlug()', () => {
    it('trims whitespace, lowercases, and strips leading go/ or slashes', () => {
      expect(normalizeSlug('  GO/Design-System  ')).toBe('design-system');
      expect(normalizeSlug('/eng/oncall/')).toBe('eng/oncall');
      expect(normalizeSlug('go///payroll')).toBe('payroll');
    });
  });

  describe('createLinkSchema', () => {
    it('accepts valid slug, https URL, and optional description', () => {
      const parsed = createLinkSchema.parse({
        slug: 'go/Design-System',
        targetUrl: 'https://figma.com/file/123',
        description: '  Company design tokens  ',
      });

      expect(parsed).toEqual({
        slug: 'design-system',
        targetUrl: 'https://figma.com/file/123',
        description: 'Company design tokens',
      });
    });

    it('defaults description to empty string when omitted', () => {
      const parsed = createLinkSchema.parse({
        slug: 'oncall',
        targetUrl: 'http://internal.pagerduty.local/schedule',
      });

      expect(parsed.description).toBe('');
    });

    it('rejects slugs shorter than 2 characters or longer than 64 characters', () => {
      const tooShort = createLinkSchema.safeParse({
        slug: 'a',
        targetUrl: 'https://example.com',
      });
      expect(tooShort.success).toBe(false);

      const tooLong = createLinkSchema.safeParse({
        slug: 'a'.repeat(65),
        targetUrl: 'https://example.com',
      });
      expect(tooLong.success).toBe(false);
    });

    it('rejects slugs with spaces, special characters, or consecutive hyphens', () => {
      for (const invalidSlug of ['my link', 'design_system', 'eng//bad', 'bad--slug', '-start']) {
        const result = createLinkSchema.safeParse({
          slug: invalidSlug,
          targetUrl: 'https://example.com',
        });
        expect(result.success).toBe(false);
      }
    });

    it('rejects non-HTTP/HTTPS URLs such as javascript: or ftp:', () => {
      for (const unsafeUrl of ['javascript:alert(1)', 'ftp://files.example.com', 'not-a-url']) {
        const result = createLinkSchema.safeParse({
          slug: 'valid-slug',
          targetUrl: unsafeUrl,
        });
        expect(result.success).toBe(false);
      }
    });
  });

  describe('listLinksQuerySchema & idParamSchema', () => {
    it('normalizes optional search query parameter q', () => {
      expect(listLinksQuerySchema.parse({})).toEqual({ q: '' });
      expect(listLinksQuerySchema.parse({ q: '  payroll  ' })).toEqual({ q: 'payroll' });
    });

    it('coerces valid positive integer IDs and rejects invalid IDs', () => {
      expect(idParamSchema.parse({ id: '42' })).toEqual({ id: 42 });
      expect(idParamSchema.safeParse({ id: '0' }).success).toBe(false);
      expect(idParamSchema.safeParse({ id: '-5' }).success).toBe(false);
      expect(idParamSchema.safeParse({ id: 'abc' }).success).toBe(false);
    });
  });
});
