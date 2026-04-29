import request from 'supertest';
import app from '../server.js';
import assert from 'assert';

describe('GET /api/health', () => {
  it('should return status 200 and ok', async () => {
    const res = await request(app).get('/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
  });
});
