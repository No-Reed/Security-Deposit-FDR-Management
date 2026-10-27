import {
  beforeAll,
  afterAll,
  afterEach,
  describe,
  it,
  expect,
  vi,
} from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { createApp } from '../app';
import { prisma } from '../config/prisma';
import { runMaturityCheck } from '../jobs/maturityCheck';
import { todayInTz, addDays } from './dates';
import { Role } from '@depositdesk/shared';

const app = createApp();
const sessions: Record<
  string,
  { agent: ReturnType<typeof request.agent>; token: string; id: string }
> = {};
let institutionId: string, remoteId: string;
let ownInstrument: string, remoteInstrument: string;
const pdf = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF',
);
const post = (who: string, url: string, data: any) =>
  sessions[who].agent
    .post('/api/v1' + url)
    .set('x-csrf-token', sessions[who].token)
    .send(data);
const patch = (who: string, url: string, data: any) =>
  sessions[who].agent
    .patch('/api/v1' + url)
    .set('x-csrf-token', sessions[who].token)
    .send(data);
const get = (who: string, url: string) =>
  sessions[who].agent.get('/api/v1' + url);
async function instrument(days = 180, institution = institutionId) {
  const date = addDays(todayInTz(), days);
  return prisma.instrument.create({
    data: {
      institutionId: institution,
      referenceCode: 'ACCEPT-' + randomBytes(6).toString('hex'),
      instrumentNumber: 'ACCEPT-' + randomBytes(6).toString('hex'),
      instrumentType: 'FDR',
      bankName: 'Synthetic Bank',
      bankBranch: 'Demo branch',
      amount: '12345.67',
      currency: 'INR',
      issueDate: addDays(todayInTz(), -400),
      maturityDate: date,
      purpose: 'Synthetic acceptance case',
      lifecycleStatus: 'VERIFIED',
      submittedById:
        sessions[institution === institutionId ? 'iu' : 'other'].id,
      submittedAt: addDays(todayInTz(), -10),
    },
  });
}
async function rr(id: string, who = 'iu') {
  return (
    await post(who, '/release-requests', {
      instrumentId: id,
      requestType: 'RELEASE',
      reason: 'Synthetic release request, subject to demo policy.',
    }).expect(201)
  ).body;
}
async function current(id: string, who = 'iu') {
  return (await get(who, '/release-requests/' + id).expect(200)).body;
}
async function evidence(record: any, who = 'iu') {
  const response = await sessions[who].agent
    .post('/api/v1/documents/upload')
    .set('x-csrf-token', sessions[who].token)
    .field('releaseRequestId', record.id)
    .field('version', record.version)
    .field('category', 'RELEASE_SUPPORTING')
    .attach('file', pdf, {
      filename: 'synthetic-release.pdf',
      contentType: 'application/pdf',
    })
    .expect(201);
  expect(response.body.storageKey).toBeUndefined();
  return current(record.id, who);
}
async function ready(id: string) {
  let record = await rr(id);
  record = await evidence(record);
  await post('iu', `/release-requests/${record.id}/submit`, {
    version: record.version,
  }).expect(200);
  record = await current(record.id);
  await post('so', `/release-requests/${record.id}/review`, {
    version: record.version,
  }).expect(200);
  return current(record.id);
}
async function checklist(record: any) {
  for (const item of record.checklistSnapshot.filter(
    (item: any) => item.isRequired,
  )) {
    await patch('so', `/release-requests/${record.id}/checklist`, {
      itemId: item.id,
      completed: true,
      version: record.version,
    }).expect(200);
    record = await current(record.id);
  }
  return record;
}
async function forward(record: any) {
  record = await checklist(record);
  await post('so', `/release-requests/${record.id}/forward`, {
    version: record.version,
    notes: 'Synthetic evidence and required items reviewed.',
  }).expect(200);
  return current(record.id);
}

beforeAll(async () => {
  if (
    process.env.NODE_ENV !== 'test' ||
    new URL(process.env.DATABASE_URL!).pathname !== '/depositdesk_test'
  )
    throw new Error('Use isolated test runner.');
  const makeInstitution = (name: string) =>
    prisma.institution.create({
      data: {
        name,
        institutionType: 'Demo',
        address: 'Synthetic address',
        state: 'Delhi',
        contactName: 'Demo contact',
        contactEmail: 'contact@acceptance.invalid',
      },
    });
  institutionId = (await makeInstitution('Acceptance institution')).id;
  remoteId = (await makeInstitution('Remote institution')).id;
  const password = randomBytes(18).toString('base64url'),
    hash = await argon2.hash(password, { type: argon2.argon2id });
  for (const [name, role, id] of [
    ['iu', 'INSTITUTION_USER', institutionId],
    ['other', 'INSTITUTION_USER', remoteId],
    ['so', 'SCRUTINY_OFFICER', null],
    ['outside', 'SCRUTINY_OFFICER', null],
    ['aa', 'APPROVING_AUTHORITY', null],
    ['remote-aa', 'APPROVING_AUTHORITY', null],
    ['sa', 'SYSTEM_ADMIN', null],
  ] as const) {
    const user = await prisma.user.create({
      data: {
        name: 'Acceptance ' + name,
        email: name + '@acceptance.invalid',
        role,
        institutionId: id,
        passwordHash: hash,
      },
    });
    if (['so', 'aa'].includes(name))
      await prisma.staffInstitutionScope.create({
        data: { userId: user.id, institutionId },
      });
    if (['outside', 'remote-aa'].includes(name))
      await prisma.staffInstitutionScope.create({
        data: { userId: user.id, institutionId: remoteId },
      });
    const agent = request.agent(app);
    const login = await agent
      .post('/api/v1/auth/login')
      .send({ email: user.email, password })
      .expect(200);
    sessions[name] = { agent, token: login.body.csrfToken, id: user.id };
  }
  ownInstrument = (await instrument()).id;
  remoteInstrument = (await instrument(180, remoteId)).id;
  await prisma.releaseChecklistItem.create({
    data: {
      label: 'Required synthetic clearance (demo policy)',
      isRequired: true,
      isActive: true,
      sortOrder: 1,
    },
  });
});
afterAll(async () => {
  vi.useRealTimers();
  await prisma.systemSetting.upsert({
    where: { key: 'maturityAlertDays' },
    create: { key: 'maturityAlertDays', value: '90,60,30,15,7,1' },
    update: { value: '90,60,30,15,7,1' },
  });
  await prisma.$disconnect();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Remaining lifecycle acceptance', () => {
  it('reads saved reminder settings and derives matching registry/dashboard states', async () => {
    const record = await instrument(7);
    await patch('iu', '/admin/settings', {
      key: 'maturityAlertDays',
      value: '7',
    }).expect(403);
    await patch('sa', '/admin/settings', {
      key: 'maturityAlertDays',
      value: '30,7,7',
    }).expect(200);
    expect((await get('iu', '/instruments/' + record.id)).body.dateStatus).toBe(
      'EXPIRING_SOON',
    );
    await patch('sa', '/admin/settings', {
      key: 'maturityAlertDays',
      value: '1',
    }).expect(200);
    expect((await get('iu', '/instruments/' + record.id)).body.dateStatus).toBe(
      'ACTIVE',
    );
    await patch('sa', '/admin/settings', {
      key: 'maturityAlertDays',
      value: '7',
    }).expect(200);
    await patch('sa', '/admin/settings', {
      key: 'escalationRepeatDays',
      value: '0',
    }).expect(422);
    await patch('sa', '/admin/settings', {
      key: 'demoMode',
      value: 'false',
    }).expect(422);
    const before = await prisma.notification.count({
      where: { relatedEntityId: record.id },
    });
    await runMaturityCheck();
    const first = await prisma.notification.findMany({
      where: { relatedEntityId: record.id },
    });
    expect(first.length).toBeGreaterThan(before);
    expect(first.every((item) => item.deliveryChannel === 'IN_APP')).toBe(true);
    expect(new Set(first.map((item) => item.recipientUserId))).toEqual(
      new Set([sessions.iu.id, sessions.so.id]),
    );
    await runMaturityCheck();
    expect(
      await prisma.notification.count({
        where: { relatedEntityId: record.id },
      }),
    ).toBe(first.length);
    const snapshot = await get('iu', '/dashboard/summary').expect(200);
    expect(typeof snapshot.body.totalValue).toBe('string');
    expect(snapshot.body.thresholds).toEqual([7]);
    const registry = await get(
      'iu',
      '/instruments?monitoring=true&dateStatus=EXPIRING_SOON&pageSize=100',
    ).expect(200);
    expect(registry.body.total).toBe(snapshot.body.expiringSoonCount);
    const deadline = await get('iu', '/dashboard/upcoming-maturities').expect(
      200,
    );
    expect(
      deadline.body.buckets['0-7'].some((item: any) => item.id === record.id),
    ).toBe(true);
  });
  it('delays and repeats scoped escalations without duplicate notifications', async () => {
    await patch('sa', '/admin/settings', {
      key: 'escalationDays',
      value: '7',
    }).expect(200);
    await patch('sa', '/admin/settings', {
      key: 'escalationRepeatDays',
      value: '3',
    }).expect(200);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2030-01-01T10:00:00Z'));
    const record = await instrument(-6);
    await runMaturityCheck();
    expect(
      await prisma.notification.count({
        where: { relatedEntityId: record.id, type: 'MATURITY_ESCALATION' },
      }),
    ).toBe(0);
    vi.setSystemTime(new Date('2030-01-02T10:00:00Z'));
    await runMaturityCheck();
    const first = await prisma.notification.findMany({
      where: { relatedEntityId: record.id, type: 'MATURITY_ESCALATION' },
    });
    expect(new Set(first.map((item) => item.recipientUserId))).toEqual(
      new Set([sessions.so.id, sessions.aa.id]),
    );
    await runMaturityCheck();
    expect(
      await prisma.notification.count({
        where: { relatedEntityId: record.id },
      }),
    ).toBe(first.length);
    vi.setSystemTime(new Date('2030-01-05T10:00:00Z'));
    await runMaturityCheck();
    expect(
      await prisma.notification.count({
        where: { relatedEntityId: record.id },
      }),
    ).toBe(first.length * 2);
    vi.useRealTimers();
  });
  it('links a replacement, preserves the predecessor, and reports renewal progress before maturity', async () => {
    const parent = await instrument(20),
      initial = parent.instrumentNumber;
    const payload = {
      version: parent.version,
      instrumentType: 'FDR',
      instrumentNumber: 'RENEW-' + randomBytes(5).toString('hex'),
      bankName: 'Synthetic Bank',
      bankBranch: 'Demo renewed branch',
      amount: '12345.67',
      currency: 'INR',
      issueDate: todayInTz().toISOString().slice(0, 10),
      maturityDate: addDays(todayInTz(), 400).toISOString().slice(0, 10),
      purpose: 'Synthetic replacement',
    };
    await post('other', `/instruments/${parent.id}/renewal`, payload).expect(
      403,
    );
    const renewal = (
      await post('iu', `/instruments/${parent.id}/renewal`, payload).expect(201)
    ).body;
    await post('iu', `/instruments/${parent.id}/renewal`, {
      ...payload,
      instrumentNumber: 'ANOTHER',
    }).expect(409);
    const before = (await get('iu', '/instruments/' + parent.id).expect(200))
      .body;
    expect(before.instrumentNumber).toBe(initial);
    expect(before.renewalStatus).toBe('IN_PROGRESS');
    expect(before.successorInstrument.id).toBe(renewal.id);
    await prisma.instrument.update({
      where: { id: renewal.id },
      data: { lifecycleStatus: 'VERIFIED' },
    });
    expect(
      (await get('iu', '/instruments/' + parent.id)).body.renewalStatus,
    ).toBe('COMPLETED');
    const chain = await get('iu', '/instruments?renewals=all').expect(200);
    expect(chain.body.data.some((item: any) => item.id === parent.id)).toBe(
      true,
    );
    const history = await get('iu', `/instruments/${parent.id}/history`).expect(
      200,
    );
    expect(
      history.body.auditEvents.some(
        (item: any) => item.action === 'INSTRUMENT_SUCCESSOR_LINKED',
      ),
    ).toBe(true);
  });
  it('enforces verified eligibility and one open request, including concurrent creation', async () => {
    const source = await instrument();
    await prisma.instrument.update({
      where: { id: source.id },
      data: { lifecycleStatus: 'DRAFT' },
    });
    await post('iu', '/release-requests', {
      instrumentId: source.id,
      requestType: 'RELEASE',
      reason: 'Demo',
    }).expect(422);
    await post('other', '/release-requests', {
      instrumentId: ownInstrument,
      requestType: 'REFUND',
      reason: 'Demo',
    }).expect(403);
    for (const role of ['so', 'aa', 'sa'])
      await post(role, '/release-requests', {
        instrumentId: ownInstrument,
        requestType: 'RELEASE',
        reason: 'Demo',
      }).expect(403);
    const concurrent = await instrument();
    const body = {
      instrumentId: concurrent.id,
      requestType: 'REFUND',
      reason: 'Concurrent demo request',
    };
    const responses = await Promise.all([
      post('iu', '/release-requests', body),
      post('iu', '/release-requests', body),
    ]);
    expect(responses.map((item) => item.status).sort()).toEqual([201, 409]);
  });
  it('blocks incomplete and out-of-order release steps, then records approval and completion separately', async () => {
    const source = await instrument();
    let record = await rr(source.id);
    await post('iu', `/release-requests/${record.id}/submit`, {
      version: record.version,
    }).expect(422);
    await post('aa', `/release-requests/${record.id}/approve`, {
      version: record.version,
      decisionReason: 'Out of order',
    }).expect(409);
    record = await evidence(record);
    const submittedVersion = record.version;
    await post('iu', `/release-requests/${record.id}/submit`, {
      version: submittedVersion,
    }).expect(200);
    await post('iu', `/release-requests/${record.id}/submit`, {
      version: submittedVersion,
    }).expect(200);
    await get('other', '/release-requests/' + record.id).expect(403);
    await get('outside', '/release-requests/' + record.id).expect(403);
    record = await current(record.id);
    await post('so', `/release-requests/${record.id}/review`, {
      version: record.version,
    }).expect(200);
    record = await current(record.id);
    await post('so', `/release-requests/${record.id}/forward`, {
      version: record.version,
      notes: 'Not complete',
    }).expect(422);
    await patch('iu', `/release-requests/${record.id}/checklist`, {
      version: record.version,
      itemId: record.checklistSnapshot[0].id,
      completed: true,
    }).expect(403);
    await patch('so', `/release-requests/${record.id}/checklist`, {
      version: record.version,
      itemId: 'unknown',
      completed: true,
    }).expect(422);
    const oldVersion = record.version;
    record = await checklist(record);
    await patch('so', `/release-requests/${record.id}/checklist`, {
      version: oldVersion,
      itemId: record.checklistSnapshot[0].id,
      completed: false,
    }).expect(409);
    record = await forward(record);
    await post('so', `/release-requests/${record.id}/approve`, {
      version: record.version,
      decisionReason: 'Unauthorized',
    }).expect(403);
    await post('aa', `/release-requests/${record.id}/approve`, {
      version: record.version,
      decisionReason: ' ',
    }).expect(422);
    const decisionVersion = record.version;
    await post('aa', `/release-requests/${record.id}/approve`, {
      version: decisionVersion,
      decisionReason: 'Synthetic checklist complete.',
      notes: 'Demo authority decision',
    }).expect(200);
    await post('aa', `/release-requests/${record.id}/approve`, {
      version: decisionVersion,
      decisionReason: 'Synthetic checklist complete.',
    }).expect(200);
    record = await current(record.id);
    expect(record.status).toBe('APPROVED');
    expect(record.completedAt).toBeNull();
    expect(record.decisionNotes).toBe('Demo authority decision');
    await post('aa', `/release-requests/${record.id}/complete`, {
      version: record.version,
      completionReference: '',
      completionDate: '2030-02-30',
    }).expect(422);
    await post('aa', `/release-requests/${record.id}/complete`, {
      version: record.version,
      completionReference: 'DEMO-COMPLETE-001',
      completionDate: todayInTz().toISOString().slice(0, 10),
      notes: 'Synthetic external-completion evidence.',
    }).expect(200);
    record = await current(record.id);
    expect(record.status).toBe('COMPLETED');
    expect(record.completionReference).toBe('DEMO-COMPLETE-001');
    expect(record.completionNotes).toContain('Synthetic');
    await post('iu', '/release-requests', {
      instrumentId: source.id,
      requestType: 'RELEASE',
      reason: 'Second release',
    }).expect(422);
    const events = await prisma.auditEvent.findMany({
      where: { entityType: 'ReleaseRequest', entityId: record.id },
    });
    for (const action of [
      'RELEASE_CHECKLIST_UPDATED',
      'RELEASE_REQUEST_APPROVED',
      'RELEASE_REQUEST_COMPLETED',
    ])
      expect(events.some((item) => item.action === action)).toBe(true);
  });
  it('returns for information, resets checklist on resubmission and allows a new request after rejection', async () => {
    const source = await instrument();
    let record = await ready(source.id);
    record = await checklist(record);
    await post('so', `/release-requests/${record.id}/return`, {
      version: record.version,
      reason: 'Synthetic supporting clarification required.',
    }).expect(200);
    record = await current(record.id);
    await post('iu', `/release-requests/${record.id}/resubmit`, {
      version: record.version,
      information: 'Clarification supplied.',
    }).expect(200);
    record = await current(record.id);
    expect(record.checklistSnapshot.every((item: any) => !item.completed)).toBe(
      true,
    );
    await post('so', `/release-requests/${record.id}/review`, {
      version: record.version,
    }).expect(200);
    record = await forward(await current(record.id));
    await post('aa', `/release-requests/${record.id}/reject`, {
      version: record.version,
      decisionReason: 'Synthetic rejection example.',
    }).expect(200);
    const next = await rr(source.id);
    expect(next.id).not.toBe(record.id);
  });
  it('enforces maker-checker even if a reviewing officer changes role', async () => {
    const record = await forward(await ready((await instrument()).id));
    await prisma.user.update({
      where: { id: sessions.so.id },
      data: { role: 'APPROVING_AUTHORITY' },
    });
    await post('so', `/release-requests/${record.id}/approve`, {
      version: record.version,
      decisionReason: 'Self-approval attempt',
    }).expect(403);
    await prisma.user.update({
      where: { id: sessions.so.id },
      data: { role: 'SCRUTINY_OFFICER' },
    });
  });
  it('scopes dashboard, audit, CSV and notification ownership; neutralizes CSV formulas', async () => {
    const own = (
      await post('iu', '/instruments', {
        institutionId,
        instrumentType: 'FDR',
        instrumentNumber: 'CSV-' + randomBytes(4).toString('hex'),
        bankName: '=HYPERLINK("example.invalid")',
        bankBranch: 'Demo',
        amount: '1.01',
        currency: 'INR',
        issueDate: '2026-01-01',
        maturityDate: '2030-01-01',
        purpose: 'CSV test',
      }).expect(201)
    ).body;
    const remote = await instrument(180, remoteId);
    await prisma.auditEvent.create({
      data: {
        action: 'REMOTE_ONLY_SENTINEL',
        entityType: 'Instrument',
        entityId: remote.id,
      },
    });
    const events = await get('so', '/audit-events?pageSize=100').expect(200);
    expect(
      events.body.data.some(
        (item: any) => item.action === 'REMOTE_ONLY_SENTINEL',
      ),
    ).toBe(false);
    const narrowed = await get(
      'so',
      `/audit-events?entityId=${remote.id}`,
    ).expect(200);
    expect(narrowed.body.total).toBe(0);
    await get('iu', '/audit-events').expect(403);
    const global = await get(
      'sa',
      '/audit-events?action=REMOTE_ONLY_SENTINEL',
    ).expect(200);
    expect(global.body.total).toBe(1);
    const csv = await get('so', '/reports/instruments.csv').expect(200);
    expect(csv.text).not.toContain(remote.instrumentNumber);
    expect(csv.text).toContain("'=HYPERLINK");
    await get('iu', '/reports/audit-events.csv').expect(403);
    const scopedAudit = await get('so', '/reports/audit-events.csv').expect(
      200,
    );
    expect(scopedAudit.text).not.toContain('REMOTE_ONLY_SENTINEL');
    const dashboard = await get('so', '/dashboard/summary').expect(200);
    expect(
      dashboard.body.recentActivity.some(
        (item: any) => item.action === 'REMOTE_ONLY_SENTINEL',
      ),
    ).toBe(false);
    const notification = await prisma.notification.create({
      data: {
        recipientUserId: sessions.iu.id,
        type: 'TEST',
        title: 'Own test alert',
        message: 'Synthetic',
        dedupeKey: randomBytes(8).toString('hex'),
      },
    });
    await post('other', `/notifications/${notification.id}/read`, {}).expect(
      403,
    );
    await post('iu', `/notifications/${notification.id}/read`, {}).expect(200);
    expect(
      (await get('other', '/notifications').expect(200)).body.data.some(
        (item: any) => item.id === notification.id,
      ),
    ).toBe(false);
    expect(
      await prisma.auditEvent.count({
        where: { action: 'REPORT_EXPORTED', actorUserId: sessions.so.id },
      }),
    ).toBeGreaterThan(0);
  });

  it('creates fresh reminders for a replacement deadline without reviving predecessor reminders', async () => {
    const parent = await instrument(7);
    await runMaturityCheck();
    const before = await prisma.notification.count({
      where: { relatedEntityId: parent.id },
    });
    expect(before).toBeGreaterThan(0);
    const child = await instrument(7);
    await prisma.instrument.update({
      where: { id: child.id },
      data: { predecessorInstrumentId: parent.id },
    });
    await runMaturityCheck();
    expect(
      await prisma.notification.count({ where: { relatedEntityId: child.id } }),
    ).toBe(2);
    expect(
      await prisma.notification.count({
        where: { relatedEntityId: parent.id },
      }),
    ).toBe(before);
    await runMaturityCheck();
    expect(
      await prisma.notification.count({ where: { relatedEntityId: child.id } }),
    ).toBe(2);
  });
  it('checks the captured required checklist at authority approval, even if forwarding was bypassed', async () => {
    const source = await instrument();
    let record = await ready(source.id);
    await prisma.releaseRequest.update({
      where: { id: record.id },
      data: { status: 'PENDING_AUTHORITY_DECISION' },
    });
    record = await current(record.id);
    await post('aa', `/release-requests/${record.id}/approve`, {
      version: record.version,
      decisionReason: 'Incomplete checklist attempt',
    }).expect(422);
    expect((await current(record.id)).status).toBe(
      'PENDING_AUTHORITY_DECISION',
    );
  });
  it('serializes release creation with scoped, reasoned administrative closure', async () => {
    const source = await instrument();
    await post('outside', `/instruments/${source.id}/close`, {
      version: source.version,
      reason: 'Unauthorized',
    }).expect(403);
    await post('aa', `/instruments/${source.id}/close`, {
      version: source.version,
      reason: ' ',
    }).expect(422);
    const result = await Promise.all([
      post('aa', `/instruments/${source.id}/close`, {
        version: source.version,
        reason: 'Synthetic administrative closure',
      }),
      post('iu', '/release-requests', {
        instrumentId: source.id,
        requestType: 'RELEASE',
        reason: 'Synthetic concurrent request',
      }),
    ]);
    expect(
      result.filter((item) => [200, 201].includes(item.status)),
    ).toHaveLength(1);
    const fresh = await prisma.instrument.findUniqueOrThrow({
      where: { id: source.id },
      include: { releaseRequests: true },
    });
    if (fresh.lifecycleStatus === 'CLOSED')
      expect(fresh.releaseRequests).toHaveLength(0);
    else expect(fresh.releaseRequests).toHaveLength(1);
  });
  it('manages accounts, scopes, institution records and checklist configuration only as authorized', async () => {
    await post('iu', '/admin/users', {
      name: 'Fake',
      email: 'fake@test.invalid',
      role: 'SYSTEM_ADMIN',
    }).expect(403);
    await post('sa', '/admin/users', {
      name: 'Missing mapping',
      email: 'nomap@test.invalid',
      role: 'INSTITUTION_USER',
    }).expect(422);
    const created = await post('sa', '/admin/users', {
      name: 'Synthetic account',
      email: 'new@test.invalid',
      role: 'INSTITUTION_USER',
      institutionId,
    }).expect(201);
    expect(created.body.temporaryPassword.length).toBeGreaterThan(20);
    const logs = await prisma.auditEvent.findMany({
      where: { entityId: created.body.id },
    });
    expect(JSON.stringify(logs)).not.toContain(created.body.temporaryPassword);
    await patch('sa', '/admin/users/' + created.body.id, {
      isActive: false,
    }).expect(200);
    await patch('sa', '/admin/users/' + sessions.sa.id, {
      isActive: false,
    }).expect(422);
    await post('so', '/admin/institution-scope', {
      userId: sessions.outside.id,
      institutionId,
    }).expect(403);
    await get('outside', '/instruments/' + ownInstrument).expect(403);
    await post('sa', '/admin/institution-scope', {
      userId: sessions.outside.id,
      institutionId,
    }).expect(201);
    await get('outside', '/instruments/' + ownInstrument).expect(200);
    await sessions.sa.agent
      .delete(
        `/api/v1/admin/institution-scope/${sessions.outside.id}/${institutionId}`,
      )
      .set('x-csrf-token', sessions.sa.token)
      .expect(200);
    await get('outside', '/instruments/' + ownInstrument).expect(403);
    const data = {
      name: 'Created by scoped officer',
      aicteId: 'TEST-' + randomBytes(4).toString('hex'),
      institutionType: 'Demo',
      address: 'Synthetic address',
      state: 'Delhi',
      contactName: 'Demo Contact',
      contactEmail: 'demo@test.invalid',
    };
    await post('aa', '/institutions', data).expect(403);
    const institution = await post('so', '/institutions', data).expect(201);
    await get('so', '/institutions/' + institution.body.id).expect(200);
    await patch('so', '/institutions/' + remoteId, {
      name: 'Unauthorized change',
    }).expect(403);
    await post('so', '/admin/release-checklist', {
      label: 'Illegal',
      isRequired: true,
      isActive: true,
      sortOrder: 1,
    }).expect(403);
    const item = await post('sa', '/admin/release-checklist', {
      label: 'New synthetic policy item',
      isRequired: false,
      isActive: true,
      sortOrder: 2,
    }).expect(201);
    await patch('sa', '/admin/release-checklist/' + item.body.id, {
      isRequired: true,
    }).expect(200);
    await post('so', '/admin/maturity-check', {}).expect(403);
    await post('sa', '/admin/maturity-check', {}).expect(200);
  });
});
