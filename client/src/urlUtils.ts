export type UrlProtocol = 'https://' | 'http://';

/**
 * Builds a complete destination URL from user input and the selected protocol.
 * If the user input already starts with `http://` or `https://` (case-insensitive),
 * or contains another explicit URI scheme (e.g. `javascript:` or `ftp://`),
 * the selected protocol prefix is omitted so it is not duplicated.
 */
export function buildTargetUrl(
  rawInput: string,
  protocol: UrlProtocol = 'https://',
): string {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return '';
  }

  // If the user already typed http:// or https://, normalize protocol casing and omit joining
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^https?:\/\//i, (match) => match.toLowerCase());
  }

  // If the input starts with another explicit scheme (e.g., javascript:, ftp://), do not prepend https://
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/i.test(trimmed)) {
    return trimmed;
  }

  return `${protocol}${trimmed.replace(/^\/+/, '')}`;
}
