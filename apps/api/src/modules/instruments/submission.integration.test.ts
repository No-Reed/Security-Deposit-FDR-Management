import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';
import { createApp } from '../../app';
import { prisma } from '../../config/prisma';
import { config } from '../../config/env';

const app = createApp();
const pdf = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF',
);
const actors: Record<
  string,
  {
    agent: ReturnType<typeof request.agent>;
    csrf: string;
    id: string;
    institutionId: string | null;
  }
> = {};
let institutionId: string;
let otherInstitutionId: string;
const owned: string[] = [];
const filePaths: string[] = [];
const payload = (number = randomBytes(8).toString('hex')) => ({
  institutionId,
  instrumentType: 'FDR',
  instrumentNumber: `FLOW-${number}`,
  bankName: 'Synthetic Bank',
  bankBranch: 'Demo Branch',
  amount: '250000.50',
  currency: 'INR',
  issueDate: '2026-01-01',
  maturityDate: '2028-01-01',
  validityEndDate: '2028-02-01',
  purpose: 'Synthetic workflow test',
  beneficiaryDetails: 'Demo beneficiary',
});
function post(actor: string, url: string, data: any) {
  return actors[actor].agent
    .post('/api/v1' + url)
    .set('x-csrf-token', actors[actor].csrf)
    .send(data);
}
function patch(actor: string, url: string, data: any) {
  return actors[actor].agent
    .patch('/api/v1' + url)
    .set('x-csrf-token', actors[actor].csrf)
    .send(data);
}
async function detail(id: string, actor = 'iu') {
  return (
    await actors[actor].agent.get('/api/v1/instruments/' + id).expect(200)
  ).body;
}
async function draft() {
  const result = await post('iu', '/instruments', payload()).expect(201);
  owned.push(result.body.id);
  return result.body;
}
async function upload(
  id: string,
  version: number,
  extra: Record<string, string> = {},
  actor = 'iu',
  content = pdf,
  filename = 'demo.pdf',
  contentType = 'application/pdf',
) {
  let call = actors[actor].agent
    .post('/api/v1/documents/upload')
    .set('x-csrf-token', actors[actor].csrf)
    .field('instrumentId', id)
    .field('category', 'FDR_COPY')
    .field('version', version);
  for (const [key, value] of Object.entries(extra))
    call = call.field(key, value);
  return call.attach('file', content, { filename, contentType });
}

beforeAll(async () => {
  if (
    process.env.NODE_ENV !== 'test' ||
    !config.DATABASE_URL.includes('/depositdesk_test')
  )
    throw new Error('Use the isolated test runner.');
  const makeInstitution = (name: string) =>
    prisma.institution.create({
      data: {
        name,
        institutionType: 'Demo',
        address: 'Synthetic',
        state: 'Delhi',
        contactName: 'Demo',
        contactEmail: 'demo@flow.invalid',
      },
    });
  institutionId = (await makeInstitution('Workflow institution A')).id;
  otherInstitutionId = (await makeInstitution('Workflow institution B')).id;
  const password = randomBytes(24).toString('base64url');
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  for (const [key, role, scope] of [
    ['iu', 'INSTITUTION_USER', institutionId],
    ['other', 'INSTITUTION_USER', otherInstitutionId],
    ['officer', 'SCRUTINY_OFFICER', null],
    ['outside', 'SCRUTINY_OFFICER', null],
    ['authority', 'APPROVING_AUTHORITY', null],
    ['admin', 'SYSTEM_ADMIN', null],
  ] as const) {
    const user = await prisma.user.create({
      data: {
        name: `Workflow ${key}`,
        email: `${key}@flow.invalid`,
        role,
        institutionId: scope,
        passwordHash: hash,
      },
    });
    if (['officer', 'authority'].includes(key))
      await prisma.staffInstitutionScope.create({
        data: { userId: user.id, institutionId },
      });
    const agent = request.agent(app);
    const response = await agent
      .post('/api/v1/auth/login')
      .send({ email: user.email, password })
      .expect(200);
    actors[key] = {
      agent,
      csrf: response.body.csrfToken,
      id: user.id,
      institutionId: scope,
    };
  }
});
afterAll(async () => {
  const documents = await prisma.document.findMany({
    where: { instrumentId: { in: owned } },
  });
  filePaths.push(
    ...documents.map((doc) => path.join(config.UPLOAD_DIR, doc.storageKey)),
  );
  for (const name of filePaths) await fs.promises.unlink(name).catch(() => {});
  await prisma.$disconnect();
});

describe('Submission, evidence, correction and scrutiny', () => {
  it('validates creation and denies unauthorized makers', async () => {
    for (const changes of [
      { amount: '0' },
      { amount: '-2' },
      { maturityDate: '2025-01-01' },
      { issueDate: '2026-02-30' },
      { amount: '9999999999999999' },
      { currency: 'USD' },
    ]) {
      await post('iu', '/instruments', { ...payload(), ...changes }).expect(
        422,
      );
    }
    await post('other', '/instruments', payload()).expect(403);
    for (const role of ['officer', 'authority', 'admin'])
      await post(role, '/instruments', payload()).expect(403);
    const data = payload('duplicate');
    owned.push((await post('iu', '/instruments', data).expect(201)).body.id);
    await post('iu', '/instruments', data).expect(409);
  });

  it('rejects missing, forged, oversized and unauthorized evidence without saving metadata', async () => {
    const record = await draft();
    await post('iu', `/instruments/${record.id}/submit`, {
      version: record.version,
    }).expect(422);
    await upload(record.id, record.version, {}, 'other').then((result) =>
      expect(result.status).toBe(403),
    );
    await upload(record.id, record.version, {}, 'admin').then((result) =>
      expect(result.status).toBe(403),
    );
    for (const [buffer, name, mime] of [
      [pdf, 'demo.png', 'image/png'],
      [pdf, 'demo.exe', 'application/octet-stream'],
      [Buffer.from('not a document'), 'demo.pdf', 'application/pdf'],
      [pdf, 'demo.pdf', 'image/png'],
    ] as const) {
      const result = await upload(
        record.id,
        record.version,
        {},
        'iu',
        buffer,
        name,
        mime,
      );
      expect(result.status).toBe(422);
    }
    const ambiguous = await upload(record.id, record.version, {
      releaseRequestId: record.id,
    });
    expect(ambiguous.status).toBe(422);
    const missingVersion = await actors.iu.agent
      .post('/api/v1/documents/upload')
      .set('x-csrf-token', actors.iu.csrf)
      .field('instrumentId', record.id)
      .field('category', 'FDR_COPY')
      .attach('file', pdf, {
        filename: 'demo.pdf',
        contentType: 'application/pdf',
      });
    expect(missingVersion.status).toBe(422);
    const large = Buffer.alloc(11 * 1024 * 1024);
    pdf.copy(large);
    expect(
      (await upload(record.id, record.version, {}, 'iu', large)).status,
    ).toBe(422);
    expect(
      await prisma.document.count({ where: { instrumentId: record.id } }),
    ).toBe(0);
  });

  it('requires versions for edits, validates merged dates and preserves omitted optional fields', async () => {
    const record = await draft();
    await patch('iu', `/instruments/${record.id}`, { amount: '500' }).expect(
      422,
    );
    await patch('iu', `/instruments/${record.id}`, {
      amount: '0',
      version: record.version,
    }).expect(422);
    await patch('iu', `/instruments/${record.id}`, {
      issueDate: '2029-01-01',
      version: record.version,
    }).expect(422);
    const changed = await patch('iu', `/instruments/${record.id}`, {
      amount: '300.25',
      version: record.version,
    }).expect(200);
    expect((await detail(record.id)).validityEndDate).toBe('2028-02-01');
    await patch('iu', `/instruments/${record.id}`, {
      amount: '800',
      version: record.version,
    }).expect(409);
    await patch('other', `/instruments/${record.id}`, {
      version: changed.body.version,
      amount: '1',
    }).expect(403);
    const updates = await Promise.all([
      patch('iu', `/instruments/${record.id}`, {
        version: changed.body.version,
        amount: '400',
      }),
      patch('iu', `/instruments/${record.id}`, {
        version: changed.body.version,
        amount: '500',
      }),
    ]);
    expect(updates.map((result) => result.status).sort()).toEqual([200, 409]);
  });

  it('completes upload → submit → review → discrepancy → correction → resubmit → outcome → scrutiny', async () => {
    let record = await draft();
    const initialUpload = await upload(record.id, record.version);
    expect(initialUpload.status).toBe(201);
    const firstDoc = initialUpload.body;
    expect(firstDoc.sha256Hash).toMatch(/^[a-f0-9]{64}$/);
    expect(firstDoc.storageKey).toBeUndefined();
    record = await detail(record.id);
    await actors.other.agent
      .get(`/api/v1/documents/${firstDoc.id}/download`)
      .expect(403);
    await actors.outside.agent
      .get(`/api/v1/documents/${firstDoc.id}/download`)
      .expect(403);
    const downloaded = await actors.iu.agent
      .get(`/api/v1/documents/${firstDoc.id}/download`)
      .expect(200);
    expect(downloaded.headers['content-disposition']).toContain('attachment');
    expect(downloaded.headers['x-content-type-options']).toBe('nosniff');
    const submittedVersion = record.version;
    await post('iu', `/instruments/${record.id}/submit`, {
      version: submittedVersion,
    }).expect(200);
    await post('iu', `/instruments/${record.id}/submit`, {
      version: submittedVersion,
    }).expect(200);
    expect(
      await prisma.instrumentSubmissionSnapshot.count({
        where: { instrumentId: record.id },
      }),
    ).toBe(1);
    record = await detail(record.id);
    expect(record.independentVerificationStatus).toBe('NOT_CHECKED');
    const queue = await actors.officer.agent
      .get('/api/v1/instruments?queue=true')
      .expect(200);
    expect(queue.body.data.some((item: any) => item.id === record.id)).toBe(
      true,
    );
    await patch('iu', `/instruments/${record.id}`, {
      version: record.version,
      amount: '1',
    }).expect(409);
    await post('outside', `/instruments/${record.id}/review`, {
      version: record.version,
    }).expect(403);
    await post('iu', `/instruments/${record.id}/review`, {
      version: record.version,
    }).expect(403);
    await post('officer', `/instruments/${record.id}/verify`, {
      version: record.version,
      reason: 'Attempt before review',
    }).expect(409);
    await post('officer', `/instruments/${record.id}/review`, {
      version: record.version,
    }).expect(200);
    record = await detail(record.id);
    await post('officer', `/instruments/${record.id}/verify`, {
      version: record.version,
      reason: 'No review outcome',
    }).expect(422);
    const review = {
      version: record.version,
      documentReviewStatus: 'COMPLETE',
      independentVerificationStatus: 'DEMO_SIMULATED',
      sourceName: 'Synthetic evidence',
      referenceNumber: 'TEST-001',
      result: 'Demo review only',
    };
    await post('officer', `/verification/instruments/${record.id}`, {
      ...review,
      independentVerificationStatus: 'CONFIRMED_BY_AUTHORIZED_SOURCE',
    }).expect(422);
    await post(
      'officer',
      `/verification/instruments/${record.id}`,
      review,
    ).expect(201);
    record = await detail(record.id);
    const flagged = await post('officer', '/discrepancies', {
      version: record.version,
      instrumentId: record.id,
      code: 'TEST_AMOUNT',
      severity: 'HIGH',
      description: 'Amount mismatch in synthetic evidence',
      reason: 'Please correct amount and attach replacement evidence.',
    }).expect(201);
    record = await detail(record.id);
    expect(record.lifecycleStatus).toBe('ACTION_REQUIRED');
    await patch('iu', `/discrepancies/${flagged.body.id}/resolve`, {
      version: record.version,
      status: 'RESOLVED',
      resolutionNotes: 'Trying self-resolution',
    }).expect(403);
    await patch('iu', `/instruments/${record.id}`, {
      version: record.version,
      amount: '260000.75',
      bankBranch: 'Corrected branch',
    }).expect(200);
    record = await detail(record.id);
    const replacement = await upload(record.id, record.version, {
      supersedesDocumentId: firstDoc.id,
    });
    expect(replacement.status).toBe(201);
    expect(replacement.body.version).toBe(2);
    record = await detail(record.id);
    await patch('iu', `/discrepancies/${flagged.body.id}/resolve`, {
      version: record.version,
      status: 'RESPONDED',
      resolutionNotes: 'Amount corrected and replacement attached.',
    }).expect(200);
    record = await detail(record.id);
    await post('iu', `/instruments/${record.id}/resubmit`, {
      version: record.version,
      corrections: 'Corrected amount, branch and supporting receipt.',
    }).expect(200);
    record = await detail(record.id);
    expect(record.snapshots).toHaveLength(2);
    expect(record.snapshots[0].payload.amount).toBe('260000.75');
    expect(record.snapshots[1].payload.amount).toBe('250000.5');
    expect(record.snapshots[1].payload.bankBranch).toBe('Demo Branch');
    expect(record.snapshots[1].payload.beneficiaryDetails).toBe(
      'Demo beneficiary',
    );
    expect(record.snapshots[1].payload.documents[0].id).toBe(firstDoc.id);
    expect(
      record.documents.some(
        (item: any) => item.id === firstDoc.id && item.isSuperseded,
      ),
    ).toBe(true);
    await actors.iu.agent
      .get(`/api/v1/documents/${firstDoc.id}/download`)
      .expect(200);
    await post('officer', `/instruments/${record.id}/review`, {
      version: record.version,
    }).expect(200);
    record = await detail(record.id);
    await post('officer', `/instruments/${record.id}/verify`, {
      version: record.version,
      reason: 'Unresolved discrepancy',
    }).expect(422);
    await patch('officer', `/discrepancies/${flagged.body.id}/resolve`, {
      version: record.version,
      status: 'RESOLVED',
      resolutionNotes: 'Corrections reviewed against synthetic receipt.',
    }).expect(200);
    record = await detail(record.id);
    await post('officer', `/instruments/${record.id}/verify`, {
      version: record.version,
      reason: 'Old outcome must not cover resubmission',
    }).expect(422);
    await post('officer', `/verification/instruments/${record.id}`, {
      ...review,
      version: record.version,
      result: 'Corrected submission reviewed; demo simulated.',
    }).expect(201);
    record = await detail(record.id);
    await post('officer', `/instruments/${record.id}/verify`, {
      version: record.version,
      reason: 'Corrections accepted; demo outcome recorded.',
    }).expect(200);
    record = await detail(record.id);
    expect(record.lifecycleStatus).toBe('VERIFIED');
    expect(record.independentVerificationStatus).toBe('DEMO_SIMULATED');
    const history = await actors.iu.agent
      .get(`/api/v1/instruments/${record.id}/history`)
      .expect(200);
    for (const action of [
      'INSTRUMENT_SUBMITTED',
      'INSTRUMENT_RESUBMITTED',
      'DOCUMENT_UPLOADED',
      'DOCUMENT_DOWNLOADED',
      'VERIFICATION_RECORDED',
      'DISCREPANCY_CREATED',
      'DISCREPANCY_RESOLVED',
      'INSTRUMENT_VERIFIED',
    ])
      expect(
        history.body.auditEvents.some((item: any) => item.action === action),
      ).toBe(true);
    await actors.other.agent
      .get(`/api/v1/instruments/${record.id}/history`)
      .expect(403);
    await post('officer', `/verification/instruments/${record.id}`, {
      ...review,
      version: record.version,
    }).expect(409);
  });

  it('keeps rejected instruments terminal and returns correct empty/paginated results', async () => {
    let record = await draft();
    expect((await upload(record.id, record.version)).status).toBe(201);
    record = await detail(record.id);
    await post('iu', `/instruments/${record.id}/submit`, {
      version: record.version,
    }).expect(200);
    record = await detail(record.id);
    await post('officer', `/instruments/${record.id}/review`, {
      version: record.version,
    }).expect(200);
    record = await detail(record.id);
    await post('officer', `/instruments/${record.id}/reject`, {
      version: record.version,
      reason: 'Synthetic rejection case.',
    }).expect(200);
    record = await detail(record.id);
    await post('iu', `/instruments/${record.id}/resubmit`, {
      version: record.version,
      corrections: 'Cannot reopen',
    }).expect(409);
    await patch('iu', `/instruments/${record.id}`, {
      version: record.version,
      amount: '4',
    }).expect(409);
    const empty = await actors.iu.agent
      .get('/api/v1/instruments')
      .query({ search: 'NONEXISTENT-CASE' })
      .expect(200);
    expect(empty.body.total).toBe(0);
    expect(empty.body.data).toEqual([]);
    const first = await actors.iu.agent
      .get('/api/v1/instruments')
      .query({ search: 'FLOW-', pageSize: 1, page: 1 })
      .expect(200);
    const second = await actors.iu.agent
      .get('/api/v1/instruments')
      .query({ search: 'FLOW-', pageSize: 1, page: 2 })
      .expect(200);
    expect(first.body.total).toBe(second.body.total);
    expect(first.body.data[0].id).not.toBe(second.body.data[0].id);
  });
});
