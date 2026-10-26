import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';

const app = createApp();

describe('Unauthenticated API boundary', () => {
  it('serves health without fabricating an authenticated identity', async () => {
    const response = await request(app).get('/api/v1/health').expect(200);
    expect(response.body.status).toBe('ok');
    expect(typeof response.body.demo).toBe('boolean');
    expect(response.body.user).toBeUndefined();
    expect(response.headers['set-cookie']).toBeUndefined();
  });
  it('denies protected reads without a server-side session', async () => {
    for (const path of ['/auth/me', '/instruments', '/release-requests', '/documents/unknown/download']) {
      const response = await request(app).get('/api/v1' + path).expect(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    }
  });
  it('requires CSRF for mutations and does not exempt paths containing auth/login', async () => {
    await request(app).post('/api/v1/instruments').send({}).expect(403);
    const response = await request(app).post('/api/v1/auth/login/extra').send({}).expect(403);
    expect(response.body.error.code).toBe('CSRF_INVALID');
  });
  it('validates login before any database access and returns a structured error', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({ email: 'invalid', password: '' }).expect(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
