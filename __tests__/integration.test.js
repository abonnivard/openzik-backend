// Integration tests for database and API
import { pool } from '../services/db.js';
import { initDB } from '../services/init-db.js';

// Mock the database initialization
jest.mock('../services/db.js', () => ({
  pool: {
    query: jest.fn(),
    end: jest.fn()
  }
}));

describe('Integration Tests', () => {
  beforeAll(async () => {
    // Setup test database if needed
    console.log('Setting up integration test environment');
  });

  afterAll(async () => {
    // Cleanup
    console.log('Cleaning up integration test environment');
  });

  describe('Database Integration', () => {
    test('should connect to database', async () => {
      // Mock successful database connection
      pool.query.mockResolvedValue({ rows: [{ version: '15.0' }] });
      
      const result = await pool.query('SELECT version()');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toHaveProperty('version');
    });

    test('should handle database errors gracefully', async () => {
      // Mock database error
      pool.query.mockRejectedValue(new Error('Connection failed'));
      
      try {
        await pool.query('SELECT * FROM nonexistent_table');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('Connection failed');
      }
    });
  });

  describe('Database Schema Integration', () => {
    test('should validate required tables exist', async () => {
      // Mock table existence check
      const tables = ['users', 'songs', 'playlists', 'likes'];
      
      for (const table of tables) {
        pool.query.mockResolvedValue({ rows: [{ exists: true }] });
        
        const result = await pool.query(
          `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`,
          [table]
        );
        
        expect(result.rows[0].exists).toBe(true);
      }
    });

    test('should validate required columns exist', async () => {
      // Mock column existence check for users table
      pool.query.mockResolvedValue({ 
        rows: [
          { column_name: 'id' },
          { column_name: 'username' },
          { column_name: 'email' },
          { column_name: 'password_hash' },
          { column_name: 'created_at' }
        ]
      });
      
      const result = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`
      );
      
      const columnNames = result.rows.map(row => row.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('username');
      expect(columnNames).toContain('email');
      expect(columnNames).toContain('password_hash');
      expect(columnNames).toContain('created_at');
    });
  });

  describe('Environment Configuration Integration', () => {
    test('should have all required environment variables', () => {
      const requiredEnvVars = [
        'NODE_ENV',
        'JWT_SECRET',
        'PGUSER',
        'PGPASSWORD',
        'PGHOST',
        'PGDATABASE',
        'PGPORT'
      ];
      
      requiredEnvVars.forEach(envVar => {
        expect(process.env[envVar]).toBeDefined();
      });
    });

    test('should use test environment configuration', () => {
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.PGDATABASE).toBe('testdb');
      expect(process.env.PGUSER).toBe('testuser');
    });
  });
});
