// 单号正则测试
import { describe, it, expect } from 'vitest';

// UPS: 1Z + 16位字母数字
const UPS_REGEX = /1Z[0-9A-Z]{16}/i;

// FedEx: 12、15 或 22 位纯数字
const FEDEX_REGEX = /\b(\d{12}|\d{15}|\d{22})\b/;

// 清理函数
function sanitizeTrackingNumber(value: string): string {
  return value.replace(/[\s\-]/g, '').toUpperCase().trim();
}

describe('Tracking Number Validation', () => {
  describe('UPS', () => {
    it('should match valid UPS tracking', () => {
      const valid = ['1Z12345E0293108684', '1Z999AA10123456784'];
      valid.forEach(num => {
        expect(UPS_REGEX.test(num)).toBe(true);
      });
    });

    it('should extract UPS from messy text', () => {
      const messy = 'Some text 1Z 123 456 7890 1234 here';
      const clean = sanitizeTrackingNumber(messy);
      const match = clean.match(UPS_REGEX);
      expect(match).toBeTruthy();
    });
  });

  describe('FedEx', () => {
    it('should match 12-digit FedEx', () => {
      expect(FEDEX_REGEX.test('123456789012')).toBe(true);
    });

    it('should match 15-digit FedEx', () => {
      expect(FEDEX_REGEX.test('123456789012345')).toBe(true);
    });

    it('should match 22-digit FedEx', () => {
      expect(FEDEX_REGEX.test('1234567890123456789012')).toBe(true);
    });
  });

  describe('Sanitization', () => {
    it('should remove spaces and hyphens', () => {
      const input = ' 1Z-123-456-789 ';
      expect(sanitizeTrackingNumber(input)).toBe('1Z123456789');
    });

    it('should convert to uppercase', () => {
      const input = '1z12345e0293108684';
      expect(sanitizeTrackingNumber(input)).toBe('1Z12345E0293108684');
    });
  });
});
