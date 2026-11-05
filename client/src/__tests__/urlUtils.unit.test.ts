import { describe, it, expect } from '@jest/globals';
import { buildTargetUrl } from '../urlUtils';

describe('Unit: buildTargetUrl() Protocol Selector & Join Logic', () => {
  it('prepends the selected https:// or http:// protocol when input has no protocol', () => {
    expect(buildTargetUrl('irvin-lopez.com', 'https://')).toBe('https://irvin-lopez.com');
    expect(buildTargetUrl('irvin-lopez.com', 'http://')).toBe('http://irvin-lopez.com');
    expect(buildTargetUrl('  figma.com/file/123  ', 'https://')).toBe(
      'https://figma.com/file/123',
    );
  });

  it('omits joining the selector protocol when user already inputs http:// or https://', () => {
    expect(buildTargetUrl('https://irvin-lopez.com', 'https://')).toBe(
      'https://irvin-lopez.com',
    );
    expect(buildTargetUrl('http://irvin-lopez.com', 'https://')).toBe(
      'http://irvin-lopez.com',
    );
    expect(buildTargetUrl('https://irvin-lopez.com/docs', 'http://')).toBe(
      'https://irvin-lopez.com/docs',
    );
    expect(buildTargetUrl('HTTPS://Irvin-Lopez.com/Path', 'http://')).toBe(
      'https://Irvin-Lopez.com/Path',
    );
  });

  it('returns empty string when input is blank and preserves non-http schemes for validation rejection', () => {
    expect(buildTargetUrl('   ', 'https://')).toBe('');
    expect(buildTargetUrl('javascript:alert(1)', 'https://')).toBe('javascript:alert(1)');
  });
});
