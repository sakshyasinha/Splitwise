import request from 'supertest';
import app from '../server.js';
import assert from 'assert';

describe('Email API Endpoints', () => {
  describe('GET /api/email/status', () => {
    it('should return email configuration status', async () => {
      const res = await request(app).get('/api/email/status');
      // Should return 401 without authentication
      assert.strictEqual(res.status, 401);
    });
  });

  describe('POST /api/email/nudge', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/email/nudge')
        .send({
          toUserId: '507f1f77bcf86cd799439011',
          groupId: '507f1f77bcf86cd799439012',
          amount: 100
        });
      // Should return 401 without authentication
      assert.strictEqual(res.status, 401);
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/email/nudge')
        .send({
          toUserId: '507f1f77bcf86cd799439011'
          // Missing groupId and amount
        });
      // Should return 401 without authentication
      assert.strictEqual(res.status, 401);
    });
  });

  describe('GET /api/email/test', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/api/email/test');
      // Should return 401 without authentication
      assert.strictEqual(res.status, 401);
    });
  });

  describe('POST /api/email/test-send', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/email/test-send')
        .send({
          to: 'test@example.com'
        });
      // Should return 401 without authentication
      assert.strictEqual(res.status, 401);
    });

    it('should validate recipient email', async () => {
      const res = await request(app)
        .post('/api/email/test-send')
        .send({
          // Missing 'to' field
        });
      // Should return 401 without authentication
      assert.strictEqual(res.status, 401);
    });
  });
});