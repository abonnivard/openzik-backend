// Basic utility tests
import jwt from 'jsonwebtoken';

describe('JWT Utilities', () => {
  const testSecret = 'test_secret_key_for_testing_only';
  
  test('should create and verify JWT token', () => {
    const payload = { userId: 1, username: 'testuser' };
    
    // Create token
    const token = jwt.sign(payload, testSecret, { expiresIn: '1h' });
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    
    // Verify token
    const decoded = jwt.verify(token, testSecret);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.username).toBe(payload.username);
  });
  
  test('should fail with invalid token', () => {
    const invalidToken = 'invalid.token.here';
    
    expect(() => {
      jwt.verify(invalidToken, testSecret);
    }).toThrow();
  });
  
  test('should fail with wrong secret', () => {
    const payload = { userId: 1, username: 'testuser' };
    const token = jwt.sign(payload, testSecret, { expiresIn: '1h' });
    
    expect(() => {
      jwt.verify(token, 'wrong_secret');
    }).toThrow();
  });
});
