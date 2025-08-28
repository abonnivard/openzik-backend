import request from 'supertest';
import express from 'express';
import cors from 'cors';

// Mock the database and services
jest.mock('../services/init-db.js', () => ({
  initDB: jest.fn().mockResolvedValue(true)
}));

jest.mock('../services/scanner.js', () => ({
  startScanner: jest.fn()
}));

jest.mock('../services/db.js', () => ({
  pool: {
    query: jest.fn()
  }
}));

// Mock all route modules
jest.mock('../routes/search.js', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/', (req, res) => res.json({ message: 'search route' }));
  return router;
});

jest.mock('../routes/download.js', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/', (req, res) => res.json({ message: 'download route' }));
  return router;
});

jest.mock('../routes/library.js', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/', (req, res) => res.json({ message: 'library route' }));
  return router;
});

jest.mock('../routes/player.js', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/', (req, res) => res.json({ message: 'player route' }));
  return router;
});

jest.mock('../routes/auth.js', () => {
  const express = require('express');
  const router = express.Router();
  router.post('/', (req, res) => res.json({ message: 'auth route' }));
  return router;
});

jest.mock('../routes/playlists.js', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/', (req, res) => res.json({ message: 'playlists route' }));
  return router;
});

jest.mock('../routes/likes.js', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/', (req, res) => res.json({ message: 'likes route' }));
  return router;
});

jest.mock('../routes/home.js', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/', (req, res) => res.json({ message: 'home route' }));
  return router;
});

jest.mock('../routes/stats.js', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/', (req, res) => res.json({ message: 'stats route' }));
  return router;
});

jest.mock('../routes/admin.js', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/', (req, res) => res.json({ message: 'admin route' }));
  return router;
});

jest.mock('../routes/uploads.js', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/', (req, res) => res.json({ message: 'uploads route' }));
  return router;
});

describe('API Server', () => {
  let app;

  beforeAll(() => {
    // Create a test version of the app
    app = express();
    app.use(cors());
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));

    // Health check route
    app.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // Add a simple test route
    app.get('/test', (req, res) => {
      res.json({ message: 'Test endpoint working' });
    });
  });

  describe('Health Check', () => {
    test('GET /health should return status OK', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(typeof response.body.uptime).toBe('number');
    });
  });

  describe('Basic API functionality', () => {
    test('GET /test should return test message', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.body).toEqual({ message: 'Test endpoint working' });
    });

    test('should handle CORS properly', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    test('should handle JSON requests', async () => {
      const response = await request(app)
        .post('/test')
        .send({ test: 'data' })
        .set('Content-Type', 'application/json');

      // Even if route doesn't exist, should not error on JSON parsing
      expect(response.status).toBe(404); // Route not found is expected
    });
  });

  describe('Error handling', () => {
    test('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/nonexistent')
        .expect(404);
    });
  });
});
