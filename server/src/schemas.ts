import { z } from 'zod';

const SLUG_REGEX = /^[a-z0-9]+(?:[-/][a-z0-9]+)*$/;

export type UrlProtocol = 'https://' | 'http://';

export const normalizeSlug = (raw: string): string =>
  raw
    .trim()
    .toLowerCase()
    .replace(/^go\/+/, '')
    .replace(/^\/+|\/+$/g, '');

/**
 * Builds a complete destination URL from user input and the selected protocol.
 * If the user input already starts with `http://` or `https://` (case-insensitive),
 * or contains another explicit URI scheme, the protocol prefix is omitted.
 */
export const buildTargetUrl = (
  rawInput: string,
  protocol: UrlProtocol = 'https://',
): string => {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^https?:\/\//i, (match) => match.toLowerCase());
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/i.test(trimmed)) {
    return trimmed;
  }

  return `${protocol}${trimmed.replace(/^\/+/, '')}`;
};

export const createLinkSchema = z.object({
  slug: z
    .string({ required_error: 'Shortcut slug is required' })
    .transform(normalizeSlug)
    .pipe(
      z
        .string()
        .min(2, 'Slug must be at least 2 characters long')
        .max(64, 'Slug must be at most 64 characters long')
        .regex(
          SLUG_REGEX,
          'Slug may only contain lowercase letters, numbers, hyphens, and slashes (e.g. design-system or eng/oncall)',
        ),
    ),
  targetUrl: z
    .string({ required_error: 'Destination URL is required' })
    .trim()
    .max(2048, 'Destination URL must be at most 2048 characters')
    .url('Destination URL must be a valid URL including http:// or https://')
    .refine((val) => {
      try {
        const parsed = new URL(val);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'Destination URL must use http:// or https:// protocol'),
  description: z
    .string()
    .trim()
    .max(200, 'Description must be at most 200 characters')
    .optional()
    .default(''),
});

export const listLinksQuerySchema = z.object({
  q: z.string().trim().optional().default(''),
});

export const idParamSchema = z.object({
  id: z.coerce
    .number({ invalid_type_error: 'Link ID must be a valid number' })
    .int('Link ID must be an integer')
    .positive('Link ID must be a positive integer'),
});

export type CreateLinkInput = z.infer<typeof createLinkSchema>;
