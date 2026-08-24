import { PasswordUtil } from '../../src/utils/password';

describe('PasswordUtil', () => {
  describe('validateStrength', () => {
    it('should pass for strong passwords', () => {
      const result = PasswordUtil.validateStrength('StrongP@ssw0rd!');
      expect(result.isValid).toBe(true);
    });

    it('should fail for passwords shorter than 8 characters', () => {
      const result = PasswordUtil.validateStrength('Sh0rt!');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('at least 8 characters');
    });

    it('should fail if missing uppercase letter', () => {
      const result = PasswordUtil.validateStrength('lowercase123!');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('uppercase');
    });

    it('should fail if missing numbers', () => {
      const result = PasswordUtil.validateStrength('NoNumbersHere!');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('number');
    });

    it('should fail if missing special characters', () => {
      const result = PasswordUtil.validateStrength('NoSpecialChar123');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('special character');
    });
  });

  describe('hash & compare', () => {
    it('should hash a password and verify it correctly', async () => {
      const plain = 'SecureP@ss123';
      const hash = await PasswordUtil.hash(plain);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(plain);

      const isMatch = await PasswordUtil.compare(plain, hash);
      expect(isMatch).toBe(true);

      const isWrongMatch = await PasswordUtil.compare('WrongPassword123!', hash);
      expect(isWrongMatch).toBe(false);
    });
  });
});
