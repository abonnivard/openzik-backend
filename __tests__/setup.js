// Test setup file
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test', silent: true });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_key_for_testing_only';

// Mock database if needed
jest.setTimeout(10000);

// Basic setup test
describe('Test Environment Setup', () => {
  test('should load test environment', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.JWT_SECRET).toBeDefined();
  });
});

// Global test teardown
afterAll(async () => {
  // Clean up any resources
  await new Promise(resolve => setTimeout(() => resolve(), 500));
});
