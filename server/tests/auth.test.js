import request from 'supertest';
import mongoose from 'mongoose';
import assert from 'node:assert/strict';
import app from '../server.js';
import User from '../models/user.model.js';

describe('Auth API', () => {
  const testUser = {
    name: 'Test User',
    email: `testuser_${Date.now()}@example.com`,
    password: 'SuperSecret123',
  };

  let connectedHere = false;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
      connectedHere = true;
    }
  });

  after(async () => {
    await User.deleteOne({ email: testUser.email });
    if (connectedHere) {
      await mongoose.disconnect();
    }
  });

  describe('POST /api/auth/register', () => {
    it('registers a new user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      assert.equal(res.status, 201);
      assert.equal(res.body.email, testUser.email);
      assert.equal(res.body.name, testUser.name);
      assert.equal(res.body.password, undefined); // password must never be returned
    });

    it('rejects duplicate email registration', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      assert.equal(res.status, 409);
    });

    it('rejects registration with missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'incomplete@example.com' });

      assert.equal(res.status, 400);
    });

    it('rejects registration with an invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Bad Email', email: 'not-an-email', password: 'password123' });

      assert.equal(res.status, 400);
    });

    it('rejects a password shorter than 8 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Short Pass', email: 'shortpass@example.com', password: '123' });

      assert.equal(res.status, 400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with correct credentials and returns tokens', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      assert.equal(res.status, 200);
      assert.ok(res.body.accessToken);
      assert.ok(res.body.refreshToken);
      assert.equal(res.body.user.email, testUser.email);
    });

    it('rejects login with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'wrongPassword' });

      assert.equal(res.status, 401);
    });

    it('rejects login for a non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'doesnotexist@example.com', password: 'whatever123' });

      assert.equal(res.status, 404);
    });

    it('rejects login with missing password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email });

      assert.equal(res.status, 400);
    });
  });

  describe('GET /api/auth/me', () => {
    let accessToken;

    before(async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });
      accessToken = res.body.accessToken;
    });

    it('returns the current user when authenticated', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.email, testUser.email);
    });

    it('rejects the request with no token', async () => {
      const res = await request(app).get('/api/auth/me');
      assert.equal(res.status, 401);
    });

    it('rejects the request with an invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.here');

      assert.equal(res.status, 401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('rejects refresh with a missing refreshToken', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({});

      assert.equal(res.status, 400);
    });

    it('rejects refresh with an invalid refreshToken', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'not-a-real-token' });

      assert.equal(res.status, 401);
    });
  });
});