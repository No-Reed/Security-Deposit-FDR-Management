import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { createApp } from '../../app';
import { prisma } from '../../config/prisma';

const app = createApp();
const password = randomBytes(24).toString('base64url');
let ownId: string;
let otherId: string;
let userId: string;
let otherInstrumentId: string;

beforeAll(async () => {
  if (process.env.NODE_ENV !== 'test' || new URL(process.env.DATABASE_URL!).pathname !== '/depositdesk_test') {
    throw new Error('Use the isolated integration test runner.');
  }
  const institution = (name: string) => ({ name, institutionType: 'Demo', address: 'Synthetic test address', state: 'Delhi', contactName: 'Demo contact', contactEmail: 'contact@test.invalid' });
  const own = await prisma.institution.create({ data: institution('Demo institution A') });
  const other = await prisma.institution.create({ data: institution('Demo institution B') });
  ownId = own.id;
  otherId = other.id;
  const user = await prisma.user.create({ data: {
    name: 'Test institution user', email: 'test-user@depositdesk.invalid', role: 'INSTITUTION_USER',
    institutionId: ownId, passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
  } });
  userId = user.id;
  for (const [index, institutionId] of [ownId, otherId].entries()) {
    const instrument = await prisma.instrument.create({ data: {
      referenceCode: `TEST-${index}`, institutionId, instrumentType: 'FDR', instrumentNumber: `TEST-${index}`,
      bankName: 'Synthetic Bank', bankBranch: 'Demo branch', amount: '100.00',
      issueDate: new Date('2026-01-01'), maturityDate: new Date('2027-01-01'), purpose: 'Test only',
    } });
    if (index === 1) otherInstrumentId = instrument.id;
  }
});

afterAll(async () => { await prisma.$disconnect(); });

describe('Persistent authentication and institution isolation', () => {
  it('requires a session and does not accept a client-selected role', async () => {
    await request(app).get('/api/v1/auth/me').expect(401);
    await request(app).get('/api/v1/instruments').set('x-role', 'SYSTEM_ADMIN').expect(401);
    await request(app).post('/api/v1/auth/login').send({ email: 'unknown@test.invalid', password }).expect(401);
  });

  it('persists login, enforces CSRF and scope, and invalidates logout', async () => {
    const agent = request.agent(app);
    const login = await agent.post('/api/v1/auth/login').send({ email: 'test-user@depositdesk.invalid', password }).expect(200);
    expect(login.body.user.role).toBe('INSTITUTION_USER');
    expect(login.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(login.headers['set-cookie'][0]).toContain('SameSite=Lax');
    const me = await agent.get('/api/v1/auth/me').expect(200);
    expect(me.body.user.id).toBe(userId);
    expect(me.body.csrfToken).toBe(login.body.csrfToken);
    const sessions = await prisma.session.findMany();
    expect(sessions.some((entry) => (entry.sess as any).userId === userId)).toBe(true);
    const list = await agent.get('/api/v1/instruments').expect(200);
    expect(list.body.total).toBe(1);
    expect(list.body.data[0].institutionId).toBe(ownId);
    const filtered = await agent.get('/api/v1/instruments').query({ institutionId: otherId }).expect(200);
    expect(filtered.body.total).toBe(0);
    await agent.get(`/api/v1/instruments/${otherInstrumentId}`).expect(403);
    await agent.post('/api/v1/verification/instruments/' + otherInstrumentId).set('x-csrf-token', login.body.csrfToken).send({}).expect(403);
    await agent.post('/api/v1/auth/logout').expect(403);
    await agent.post('/api/v1/auth/logout').set('x-csrf-token', 'wrong').expect(403);
    await agent.post('/api/v1/auth/logout').set('x-csrf-token', login.body.csrfToken).expect(200);
    await agent.get('/api/v1/auth/me').expect(401);
  });

  it('locks after five failed passwords, then accepts login after lock expiry', async () => {
    const agent = request.agent(app);
    for (let count = 0; count < 5; count++) {
      await agent.post('/api/v1/auth/login').send({ email: 'test-user@depositdesk.invalid', password: 'wrong' }).expect(401);
    }
    await agent.post('/api/v1/auth/login').send({ email: 'test-user@depositdesk.invalid', password }).expect(429);
    await prisma.user.update({ where: { id: userId }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    const response = await agent.post('/api/v1/auth/login').send({ email: 'test-user@depositdesk.invalid', password }).expect(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.failedLoginCount).toBe(0);
    await agent.post('/api/v1/auth/logout').set('x-csrf-token', response.body.csrfToken).expect(200);
  });

  it('rejects disabled accounts and records authentication audit events', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({ email: 'test-user@depositdesk.invalid', password }).expect(200);
    await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
    await agent.get('/api/v1/auth/me').expect(401);
    await request(app).post('/api/v1/auth/login').send({ email: 'test-user@depositdesk.invalid', password }).expect(401);
    const events = await prisma.auditEvent.findMany({ where: { actorUserId: userId } });
    expect(events.some((event) => event.action === 'AUTH_LOGIN_SUCCESS')).toBe(true);
    expect(events.filter((event) => event.action === 'AUTH_LOGIN_FAILURE')).toHaveLength(5);
    expect(JSON.stringify(events)).not.toContain(password);
  });

  it('enforces audit immutability below the application and rolls back paired writes', async () => {
    const event = await prisma.auditEvent.findFirstOrThrow();
    await expect(prisma.auditEvent.update({ where: { id: event.id }, data: { action: 'REWRITTEN' } })).rejects.toThrow();
    await expect(prisma.auditEvent.delete({ where: { id: event.id } })).rejects.toThrow();
    await expect(prisma.$executeRawUnsafe('TRUNCATE "AuditEvent"')).rejects.toThrow();
    await expect(prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { name: 'Should roll back' } });
      await tx.auditEvent.create({ data: { id: event.id, action: 'DUPLICATE', entityType: 'User' } });
    })).rejects.toThrow();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).name).toBe('Test institution user');
  });
});
