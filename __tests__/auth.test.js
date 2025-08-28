import bcrypt from 'bcrypt';

describe('Authentication Utilities', () => {
  describe('Password hashing', () => {
    test('should hash password correctly', async () => {
      const password = 'testpassword123';
      const saltRounds = 10;
      
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50);
    });

    test('should verify password correctly', async () => {
      const password = 'testpassword123';
      const saltRounds = 10;
      
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      const isValid = await bcrypt.compare(password, hashedPassword);
      
      expect(isValid).toBe(true);
    });

    test('should reject wrong password', async () => {
      const password = 'testpassword123';
      const wrongPassword = 'wrongpassword';
      const saltRounds = 10;
      
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      const isValid = await bcrypt.compare(wrongPassword, hashedPassword);
      
      expect(isValid).toBe(false);
    });

    test('should generate different hashes for same password', async () => {
      const password = 'testpassword123';
      const saltRounds = 10;
      
      const hash1 = await bcrypt.hash(password, saltRounds);
      const hash2 = await bcrypt.hash(password, saltRounds);
      
      expect(hash1).not.toBe(hash2);
      
      // But both should verify the same password
      expect(await bcrypt.compare(password, hash1)).toBe(true);
      expect(await bcrypt.compare(password, hash2)).toBe(true);
    });
  });

  describe('Input validation', () => {
    test('should validate email format', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org'
      ];
      
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user@.com',
        ''
      ];
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      validEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(true);
      });
      
      invalidEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(false);
      });
    });

    test('should validate password strength', () => {
      // Simple strength check: at least 8 characters
      const isStrongPassword = (password) => {
        if (!password || typeof password !== 'string') return false;
        return password.length >= 8;
      };
      
      // Test strong passwords
      expect(isStrongPassword('StrongPass123!')).toBe(true);
      expect(isStrongPassword('MySecureP@ssw0rd')).toBe(true);
      expect(isStrongPassword('Complex!Password1')).toBe(true);
      
      // Test weak passwords
      expect(isStrongPassword('123')).toBe(false);
      expect(isStrongPassword('pass')).toBe(false);
      expect(isStrongPassword('abc')).toBe(false);
      expect(isStrongPassword('')).toBe(false);
      expect(isStrongPassword('1234567')).toBe(false);
      expect(isStrongPassword(null)).toBe(false);
      expect(isStrongPassword(undefined)).toBe(false);
    });
  });
});
