/**
 * DepositDesk Demo Seed Script
 *
 * Generates realistic synthetic demo data for all roles and scenarios.
 * Uses DEMO_PASSWORD env var if set, otherwise generates random passwords.
 * REFUSES to run in production.
 *
 * All data is synthetic. Bank names, institutions, and reference numbers
 * are fictional and clearly labelled as demo data.
 */

import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { randomBytes, createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../src/config/env';
import { submissionSnapshot } from '../src/lib/instruments';
import { todayInTz } from '../src/lib/dates';

const prisma = new PrismaClient();

// Safety: refuse to run in production unless explicitly allowed for live demo
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_IN_PROD !== 'true') {
  console.error('❌ Seed script refuses to run in NODE_ENV=production without ALLOW_DEMO_IN_PROD=true');
  process.exit(1);
}

function randomPassword(): string {
  return (
    randomBytes(12)
      .toString('base64url')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 14) + 'A1!'
  );
}

// Date helpers — relative to today so scenarios stay valid
function today(): Date {
  return todayInTz('Asia/Kolkata');
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function daysAgo(n: number): Date {
  return addDays(today(), -n);
}
function daysFromNow(n: number): Date {
  return addDays(today(), n);
}

let idxCounter = 0;
function nextRef(prefix: string): string {
  idxCounter++;
  return `${prefix}-DEMO-${String(idxCounter).padStart(4, '0')}`;
}

async function main() {
  if ((await prisma.instrument.count()) > 0) {
    if (process.env.NODE_ENV === 'production' || process.env.SKIP_SEED_IF_POPULATED === 'true') {
      console.log('ℹ️  Database already contains instruments. Skipping demo seed.');
      return;
    }
    throw new Error(
      'Seed requires an empty demo database. Use the explicitly confirmed local demo reset command to rebuild it.',
    );
  }
  console.log('\n🌱 DepositDesk Demo Seed Starting...\n');
  console.log(
    '⚠️  DEMO DATA — All institutions, banks, and instruments are synthetic.\n',
  );

  // Read or generate passwords
  const DEMO_PASSWORD = process.env.DEMO_PASSWORD;
  const passwords: Record<string, string> = {};

  const userDefs = [
    {
      key: 'sa',
      name: 'Admin User',
      email: 'admin@depositdesk.invalid',
      role: 'SYSTEM_ADMIN',
    },
    {
      key: 'so1',
      name: 'Officer Priya Sharma',
      email: 'officer.priya@depositdesk.invalid',
      role: 'SCRUTINY_OFFICER',
    },
    {
      key: 'so2',
      name: 'Officer Rahul Verma',
      email: 'officer.rahul@depositdesk.invalid',
      role: 'SCRUTINY_OFFICER',
    },
    {
      key: 'aa',
      name: 'Authority Anita Mehta',
      email: 'authority.anita@depositdesk.invalid',
      role: 'APPROVING_AUTHORITY',
    },
    {
      key: 'iu1',
      name: 'User Vikram Patel (Sunrise Tech)',
      email: 'vikram@sunrise.invalid',
      role: 'INSTITUTION_USER',
      institutionKey: 'sunrise',
    },
    {
      key: 'iu2',
      name: 'User Meera Nair (Coastal Engineering)',
      email: 'meera@coastal.invalid',
      role: 'INSTITUTION_USER',
      institutionKey: 'coastal',
    },
    {
      key: 'iu3',
      name: 'User Sanjay Kumar (Hillside Medical)',
      email: 'sanjay@hillside.invalid',
      role: 'INSTITUTION_USER',
      institutionKey: 'hillside',
    },
    {
      key: 'iuNorthern',
      name: 'Demo Northern Registrar',
      email: 'registrar@northern.invalid',
      role: 'INSTITUTION_USER',
      institutionKey: 'northern',
    },
    {
      key: 'iuSouthern',
      name: 'Demo Southern Registrar',
      email: 'registrar@southern.invalid',
      role: 'INSTITUTION_USER',
      institutionKey: 'southern',
    },
    {
      key: 'iuEastern',
      name: 'Demo Eastern Registrar',
      email: 'registrar@eastern.invalid',
      role: 'INSTITUTION_USER',
      institutionKey: 'eastern',
    },
    {
      key: 'iuCentral',
      name: 'Demo Central Registrar',
      email: 'registrar@central.invalid',
      role: 'INSTITUTION_USER',
      institutionKey: 'central',
    },
    {
      key: 'iuWestern',
      name: 'Demo Western Registrar',
      email: 'registrar@western.invalid',
      role: 'INSTITUTION_USER',
      institutionKey: 'western',
    },
  ] as const;

  for (const u of userDefs) {
    passwords[u.key] = DEMO_PASSWORD || randomPassword();
  }

  // ─── Institutions ────────────────────────────────────────────────────────────
  console.log('Creating institutions...');

  const institutionData = [
    {
      key: 'sunrise',
      aicteId: 'AICTE-DEMO-1001',
      name: 'Sunrise Institute of Technology (Demo)',
      institutionType: 'Engineering College',
      address: '42, Tech Park Road, Andheri East',
      state: 'Maharashtra',
      contactName: 'Prof. R.K. Desai',
      contactEmail: 'contact@sunrise.invalid',
      contactPhone: '9800000001',
    },
    {
      key: 'coastal',
      aicteId: 'AICTE-DEMO-1002',
      name: 'Coastal Engineering College (Demo)',
      institutionType: 'Engineering College',
      address: '15, Marine Drive, Panaji',
      state: 'Goa',
      contactName: 'Dr. A.V. Borkar',
      contactEmail: 'contact@coastal.invalid',
      contactPhone: '9800000002',
    },
    {
      key: 'hillside',
      aicteId: 'AICTE-DEMO-1003',
      name: 'Hillside Medical & Technology College (Demo)',
      institutionType: 'Medical College',
      address: '7, Hill Station Road, Shimla',
      state: 'Himachal Pradesh',
      contactName: 'Dr. S. Kapoor',
      contactEmail: 'contact@hillside.invalid',
      contactPhone: '9800000003',
    },
    {
      key: 'northern',
      aicteId: 'AICTE-DEMO-1004',
      name: 'Northern Polytechnic Institute (Demo)',
      institutionType: 'Polytechnic',
      address: '88, Industrial Area, Ludhiana',
      state: 'Punjab',
      contactName: 'Mr. Gurjit Singh',
      contactEmail: 'contact@northern.invalid',
    },
    {
      key: 'southern',
      aicteId: 'AICTE-DEMO-1005',
      name: 'Southern College of Management (Demo)',
      institutionType: 'Management College',
      address: '23, Business Park, Electronic City',
      state: 'Karnataka',
      contactName: 'Dr. Lakshmi Rao',
      contactEmail: 'contact@southern.invalid',
    },
    {
      key: 'eastern',
      aicteId: 'AICTE-DEMO-1006',
      name: 'Eastern Institute of Sciences (Demo)',
      institutionType: 'Science College',
      address: '56, Salt Lake, Sector V',
      state: 'West Bengal',
      contactName: 'Prof. Dipak Roy',
      contactEmail: 'contact@eastern.invalid',
    },
    {
      key: 'central',
      aicteId: 'AICTE-DEMO-1007',
      name: 'Central University of Technology (Demo)',
      institutionType: 'University',
      address: '1, University Road, Bhopal',
      state: 'Madhya Pradesh',
      contactName: 'Dr. M.L. Tiwari',
      contactEmail: 'contact@central.invalid',
    },
    {
      key: 'western',
      aicteId: 'AICTE-DEMO-1008',
      name: 'Western School of Architecture (Demo)',
      institutionType: 'Architecture College',
      address: '9, Art District, Ahmedabad',
      state: 'Gujarat',
      contactName: 'Ar. Preeti Shah',
      contactEmail: 'contact@western.invalid',
    },
  ];

  const institutions: Record<string, any> = {};
  for (const inst of institutionData) {
    const { key, ...data } = inst;
    institutions[key] = await prisma.institution.upsert({
      where: { aicteId: data.aicteId },
      create: data,
      update: data,
    });
  }
  console.log(`  ✓ ${Object.keys(institutions).length} institutions`);

  // ─── Users ───────────────────────────────────────────────────────────────────
  console.log('Creating users...');
  const users: Record<string, any> = {};

  for (const u of userDefs) {
    const institutionId =
      'institutionKey' in u ? institutions[u.institutionKey]?.id : null;
    const passwordHash = await argon2.hash(passwords[u.key], {
      type: argon2.argon2id,
    });
    users[u.key] = await prisma.user.upsert({
      where: { email: u.email },
      create: {
        name: u.name,
        email: u.email,
        passwordHash,
        role: u.role as any,
        institutionId,
      },
      update: { passwordHash, isActive: true },
    });
  }
  console.log(`  ✓ ${Object.keys(users).length} users`);

  // Assign scopes for officers
  const allInstitutionIds = Object.values(institutions).map((i: any) => i.id);
  for (const officerId of [users.so1.id, users.so2.id, users.aa.id]) {
    for (const instId of allInstitutionIds) {
      await prisma.staffInstitutionScope.upsert({
        where: {
          userId_institutionId: { userId: officerId, institutionId: instId },
        },
        create: { userId: officerId, institutionId: instId },
        update: {},
      });
    }
  }
  console.log('  ✓ Staff scopes assigned');

  // ─── System Settings ─────────────────────────────────────────────────────────
  const settings = [
    { key: 'maturityAlertDays', value: '90,60,30,15,7,1' },
    { key: 'escalationDays', value: '7' },
    { key: 'escalationRepeatDays', value: '3' },
    { key: 'maxUploadMB', value: '10' },
    { key: 'timezone', value: 'Asia/Kolkata' },
    { key: 'demoMode', value: 'true' },
    { key: 'appVersion', value: '1.0.0-demo' },
  ];
  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      create: s,
      update: s,
    });
  }

  // ─── Release Checklist Items ─────────────────────────────────────────────────
  const checklistItems = [
    {
      label:
        'NOC from competent authority obtained (Demo policy — confirm with domain expert)',
      isRequired: true,
      sortOrder: 1,
      isActive: true,
    },
    {
      label:
        'Outstanding dues cleared as per records (Demo policy — confirm with domain expert)',
      isRequired: true,
      sortOrder: 2,
      isActive: true,
    },
    {
      label:
        'Affiliation status verified (Demo policy — confirm with domain expert)',
      isRequired: true,
      sortOrder: 3,
      isActive: true,
    },
    {
      label:
        'Bank communication attached (Demo policy — confirm with domain expert)',
      isRequired: false,
      sortOrder: 4,
      isActive: true,
    },
    {
      label:
        'Institution authorization letter submitted (Demo policy — confirm with domain expert)',
      isRequired: false,
      sortOrder: 5,
      isActive: true,
    },
  ];
  await prisma.releaseChecklistItem.deleteMany();
  await prisma.releaseChecklistItem.createMany({ data: checklistItems });
  const savedChecklistItems = await prisma.releaseChecklistItem.findMany({
    orderBy: { sortOrder: 'asc' },
  });
  console.log('  ✓ Checklist items');

  // ─── Instruments ─────────────────────────────────────────────────────────────
  console.log('Creating instruments...');

  const fictionalBanks = [
    { name: 'Demo National Bank', branch: 'Demo Main Branch, Mumbai' },
    {
      name: 'Demo State Co-operative Bank',
      branch: 'Demo Sector 5 Branch, Pune',
    },
    {
      name: 'Fictional Commerce Bank',
      branch: 'Demo Connaught Place Branch, Delhi',
    },
    { name: 'Sample Gramin Bank', branch: 'Demo Andheri Branch, Mumbai' },
    {
      name: 'Demo Regional Rural Bank',
      branch: 'Demo HSR Layout Branch, Bangalore',
    },
  ];

  function getBank(idx: number) {
    return fictionalBanks[idx % fictionalBanks.length];
  }

  type InstrumentSpec = {
    key: string;
    institutionKey: string;
    type: 'FDR' | 'SECURITY_DEPOSIT';
    amount: string;
    issueOffset: number; // days ago
    maturityOffset: number; // days from now (negative = past)
    lifecycleStatus: string;
    verificationStatus?: string;
    validityEndOffset?: number;
    bankIdx?: number;
  };

  const instrumentSpecs: InstrumentSpec[] = [
    // Approaching maturity (various thresholds)
    {
      key: 'i1',
      institutionKey: 'sunrise',
      type: 'FDR',
      amount: '500000.00',
      issueOffset: 365,
      maturityOffset: 7,
      lifecycleStatus: 'VERIFIED',
      bankIdx: 0,
    },
    {
      key: 'i2',
      institutionKey: 'coastal',
      type: 'FDR',
      amount: '750000.00',
      issueOffset: 365,
      maturityOffset: 15,
      lifecycleStatus: 'VERIFIED',
      bankIdx: 1,
    },
    {
      key: 'i3',
      institutionKey: 'hillside',
      type: 'FDR',
      amount: '1000000.00',
      issueOffset: 365,
      maturityOffset: 30,
      lifecycleStatus: 'VERIFIED',
      bankIdx: 2,
    },
    {
      key: 'i4',
      institutionKey: 'northern',
      type: 'SECURITY_DEPOSIT',
      amount: '300000.00',
      issueOffset: 365,
      maturityOffset: 60,
      lifecycleStatus: 'VERIFIED',
      bankIdx: 3,
    },
    {
      key: 'i5',
      institutionKey: 'southern',
      type: 'FDR',
      amount: '600000.00',
      issueOffset: 365,
      maturityOffset: 90,
      lifecycleStatus: 'VERIFIED',
      bankIdx: 4,
    },

    // Matured instruments
    {
      key: 'i6',
      institutionKey: 'eastern',
      type: 'FDR',
      amount: '450000.00',
      issueOffset: 730,
      maturityOffset: -15,
      lifecycleStatus: 'VERIFIED',
      bankIdx: 0,
    },
    {
      key: 'i7',
      institutionKey: 'central',
      type: 'SECURITY_DEPOSIT',
      amount: '800000.00',
      issueOffset: 730,
      maturityOffset: -30,
      lifecycleStatus: 'VERIFIED',
      bankIdx: 1,
    },
    {
      key: 'i8',
      institutionKey: 'western',
      type: 'FDR',
      amount: '250000.00',
      issueOffset: 365,
      maturityOffset: -5,
      validityEndOffset: -3,
      lifecycleStatus: 'VERIFIED',
      bankIdx: 2,
    },

    // Under review / pending verification
    {
      key: 'i9',
      institutionKey: 'sunrise',
      type: 'FDR',
      amount: '350000.00',
      issueOffset: 30,
      maturityOffset: 335,
      lifecycleStatus: 'SUBMITTED',
      bankIdx: 3,
    },
    {
      key: 'i10',
      institutionKey: 'coastal',
      type: 'SECURITY_DEPOSIT',
      amount: '420000.00',
      issueOffset: 25,
      maturityOffset: 340,
      lifecycleStatus: 'UNDER_REVIEW',
      bankIdx: 4,
    },
    {
      key: 'i11',
      institutionKey: 'hillside',
      type: 'FDR',
      amount: '550000.00',
      issueOffset: 20,
      maturityOffset: 345,
      lifecycleStatus: 'UNDER_REVIEW',
      bankIdx: 0,
    },
    {
      key: 'i12',
      institutionKey: 'northern',
      type: 'FDR',
      amount: '670000.00',
      issueOffset: 15,
      maturityOffset: 350,
      lifecycleStatus: 'SUBMITTED',
      bankIdx: 1,
    },

    // Action required
    {
      key: 'i13',
      institutionKey: 'sunrise',
      type: 'FDR',
      amount: '200000.00',
      issueOffset: 60,
      maturityOffset: 305,
      lifecycleStatus: 'ACTION_REQUIRED',
      bankIdx: 2,
    },
    {
      key: 'i14',
      institutionKey: 'southern',
      type: 'SECURITY_DEPOSIT',
      amount: '900000.00',
      issueOffset: 45,
      maturityOffset: 320,
      lifecycleStatus: 'ACTION_REQUIRED',
      bankIdx: 3,
    },

    // Draft
    {
      key: 'i15',
      institutionKey: 'eastern',
      type: 'FDR',
      amount: '125000.00',
      issueOffset: 5,
      maturityOffset: 360,
      lifecycleStatus: 'DRAFT',
      bankIdx: 4,
    },

    // Rejected
    {
      key: 'i16',
      institutionKey: 'western',
      type: 'FDR',
      amount: '175000.00',
      issueOffset: 90,
      maturityOffset: 275,
      lifecycleStatus: 'REJECTED',
      bankIdx: 0,
    },

    // Verified (various states for release request scenarios)
    {
      key: 'i17',
      institutionKey: 'sunrise',
      type: 'FDR',
      amount: '1500000.00',
      issueOffset: 400,
      maturityOffset: -20,
      lifecycleStatus: 'VERIFIED',
      bankIdx: 1,
    },
    {
      key: 'i18',
      institutionKey: 'coastal',
      type: 'FDR',
      amount: '2000000.00',
      issueOffset: 500,
      maturityOffset: -45,
      lifecycleStatus: 'VERIFIED',
      bankIdx: 2,
    },
    {
      key: 'i19',
      institutionKey: 'hillside',
      type: 'FDR',
      amount: '750000.00',
      issueOffset: 450,
      maturityOffset: -10,
      lifecycleStatus: 'VERIFIED',
      bankIdx: 3,
    },
    {
      key: 'i20',
      institutionKey: 'northern',
      type: 'SECURITY_DEPOSIT',
      amount: '350000.00',
      issueOffset: 600,
      maturityOffset: -60,
      lifecycleStatus: 'VERIFIED',
      bankIdx: 4,
    },

    // Additional active FDRs
    {
      key: 'i21',
      institutionKey: 'southern',
      type: 'FDR',
      amount: '500000.00',
      issueOffset: 100,
      maturityOffset: 265,
      lifecycleStatus: 'VERIFIED',
      bankIdx: 0,
    },
    {
      key: 'i22',
      institutionKey: 'central',
      type: 'FDR',
      amount: '625000.00',
      issueOffset: 150,
      maturityOffset: 215,
      lifecycleStatus: 'VERIFIED',
      bankIdx: 1,
    },
    {
      key: 'i23',
      institutionKey: 'western',
      type: 'SECURITY_DEPOSIT',
      amount: '450000.00',
      issueOffset: 200,
      maturityOffset: 165,
      lifecycleStatus: 'VERIFIED',
      bankIdx: 2,
    },
    {
      key: 'i24',
      institutionKey: 'eastern',
      type: 'FDR',
      amount: '325000.00',
      issueOffset: 250,
      maturityOffset: 115,
      lifecycleStatus: 'VERIFIED',
      bankIdx: 3,
    },
    {
      key: 'i25',
      institutionKey: 'sunrise',
      type: 'FDR',
      amount: '850000.00',
      issueOffset: 300,
      maturityOffset: 65,
      lifecycleStatus: 'VERIFIED',
      bankIdx: 4,
    },
    {
      key: 'i26',
      institutionKey: 'sunrise',
      type: 'FDR',
      amount: '150000.00',
      issueOffset: 1,
      maturityOffset: 364,
      lifecycleStatus: 'DRAFT',
      bankIdx: 0,
    },
    {
      key: 'i27',
      institutionKey: 'coastal',
      type: 'FDR',
      amount: '225000.00',
      issueOffset: 1,
      maturityOffset: 364,
      lifecycleStatus: 'DRAFT',
      bankIdx: 1,
    },
  ];

  const instruments: Record<string, any> = {};
  for (const spec of instrumentSpecs) {
    const bank = getBank(spec.bankIdx ?? 0);
    const issueDate = daysAgo(spec.issueOffset);
    const maturityDate =
      spec.maturityOffset >= 0
        ? daysFromNow(spec.maturityOffset)
        : daysAgo(-spec.maturityOffset);
    const validityEndDate =
      spec.validityEndOffset !== undefined
        ? spec.validityEndOffset >= 0
          ? daysFromNow(spec.validityEndOffset)
          : daysAgo(-spec.validityEndOffset)
        : null;

    const institutionId = institutions[spec.institutionKey].id;
    const submittedById =
      spec.lifecycleStatus !== 'DRAFT'
        ? Object.values(users).find(
            (user: any) => user.institutionId === institutionId,
          )?.id
        : null;
    const submittedAt =
      spec.lifecycleStatus !== 'DRAFT'
        ? daysAgo(Math.floor(spec.issueOffset * 0.3))
        : null;

    instruments[spec.key] = await prisma.instrument.create({
      data: {
        referenceCode: nextRef('DD'),
        institutionId,
        instrumentType: spec.type as any,
        instrumentNumber: `DEMO-${spec.key.toUpperCase()}-${Math.floor(Math.random() * 9000 + 1000)}`,
        bankName: bank.name,
        bankBranch: bank.branch,
        amount: spec.amount,
        currency: 'INR',
        issueDate,
        maturityDate,
        validityEndDate,
        purpose: 'AICTE Approval Security Deposit (Demo)',
        lifecycleStatus: spec.lifecycleStatus as any,
        submittedAt,
        submittedById,
      },
    });
  }
  console.log(`  ✓ ${Object.keys(instruments).length} instruments`);

  // ─── Verifications ───────────────────────────────────────────────────────────
  console.log('Creating verifications...');
  const verifiedKeys = Object.entries(instruments)
    .filter(([_, inst]: any) => inst.lifecycleStatus === 'VERIFIED')
    .map(([k]) => k);

  for (const key of verifiedKeys) {
    await prisma.verification.create({
      data: {
        instrumentId: instruments[key].id,
        documentReviewStatus: 'COMPLETE',
        independentVerificationStatus: 'DEMO_SIMULATED',
        sourceType: 'MANUAL_REVIEW',
        sourceName: 'Demo Internal Review',
        referenceNumber: `DEMO-VER-${key.toUpperCase()}`,
        result: 'ACCEPTED',
        notes:
          'Verified in demo environment. This is simulated verification — not bank-confirmed.',
        verifiedById: users.so1.id,
        verifiedAt: daysAgo(5),
      },
    });
  }

  // Some pending verifications
  for (const key of ['i10', 'i11']) {
    await prisma.verification.create({
      data: {
        instrumentId: instruments[key].id,
        documentReviewStatus: 'IN_PROGRESS',
        independentVerificationStatus: 'PENDING',
        notes: 'Document review in progress (demo)',
        verifiedById: users.so1.id,
        verifiedAt: daysAgo(2),
      },
    });
  }
  console.log('  ✓ Verifications');

  // ─── Discrepancies ────────────────────────────────────────────────────────────
  console.log('Creating discrepancies...');
  const discrepancyData = [
    {
      instrumentId: instruments.i13.id,
      code: 'DATE_INCONSISTENCY',
      severity: 'HIGH' as const,
      description:
        'Maturity date on uploaded document differs from entered data by 15 days',
      reason: 'Document shows 15-Jan-2026 but entered as 30-Jan-2026',
      status: 'OPEN' as const,
    },
    {
      instrumentId: instruments.i14.id,
      code: 'AMOUNT_MISMATCH',
      severity: 'CRITICAL' as const,
      description: 'Amount entered does not match the supporting document',
      reason: 'Entered: ₹9,00,000 vs Document: ₹9,50,000',
      status: 'OPEN' as const,
    },
    {
      instrumentId: instruments.i11.id,
      code: 'MISSING_DOCUMENT',
      severity: 'MEDIUM' as const,
      description: 'Bank communication letter not attached',
      reason: 'Required document category BANK_COMMUNICATION is missing',
      status: 'RESPONDED' as const,
      resolutionNotes: 'Institution has uploaded the document',
    },
  ];

  for (const disc of discrepancyData) {
    await prisma.discrepancy.create({
      data: {
        ...disc,
        assignedToId: users.so1.id,
        history: [],
      },
    });
  }
  console.log('  ✓ Discrepancies');

  // ─── Renewal Chains ──────────────────────────────────────────────────────────
  console.log('Creating renewal chains...');

  // Chain 1: i6 (matured) → renewal instrument (VERIFIED)
  const renewal1 = await prisma.instrument.create({
    data: {
      referenceCode: nextRef('DD'),
      institutionId: institutions.eastern.id,
      instrumentType: 'FDR',
      instrumentNumber: `DEMO-REN1-${Math.floor(Math.random() * 9000 + 1000)}`,
      bankName: fictionalBanks[0].name,
      bankBranch: fictionalBanks[0].branch,
      amount: '450000.00',
      currency: 'INR',
      issueDate: daysAgo(10),
      maturityDate: daysFromNow(355),
      purpose: 'AICTE Approval Security Deposit Renewal (Demo)',
      lifecycleStatus: 'VERIFIED',
      submittedAt: daysAgo(8),
      submittedById: users.iuEastern.id,
      predecessorInstrumentId: instruments.i6.id,
    },
  });
  await prisma.verification.create({
    data: {
      instrumentId: renewal1.id,
      documentReviewStatus: 'COMPLETE',
      independentVerificationStatus: 'DEMO_SIMULATED',
      sourceName: 'Demo Review',
      referenceNumber: 'DEMO-RENVER-001',
      result: 'ACCEPTED',
      notes: 'Demo simulated verification',
      verifiedById: users.so2.id,
      verifiedAt: daysAgo(3),
    },
  });

  // Chain 2: i7 (matured) → renewal instrument (UNDER_REVIEW)
  await prisma.instrument.create({
    data: {
      referenceCode: nextRef('DD'),
      institutionId: institutions.central.id,
      instrumentType: 'SECURITY_DEPOSIT',
      instrumentNumber: `DEMO-REN2-${Math.floor(Math.random() * 9000 + 1000)}`,
      bankName: fictionalBanks[1].name,
      bankBranch: fictionalBanks[1].branch,
      amount: '800000.00',
      currency: 'INR',
      issueDate: daysAgo(5),
      maturityDate: daysFromNow(360),
      purpose: 'AICTE Approval Security Deposit Renewal (Demo)',
      lifecycleStatus: 'UNDER_REVIEW',
      submittedAt: daysAgo(4),
      submittedById: users.iuCentral.id,
      predecessorInstrumentId: instruments.i7.id,
    },
  });

  // Chain 3: i25 (expiring soon) → renewal (SUBMITTED)
  await prisma.instrument.create({
    data: {
      referenceCode: nextRef('DD'),
      institutionId: institutions.sunrise.id,
      instrumentType: 'FDR',
      instrumentNumber: `DEMO-REN3-${Math.floor(Math.random() * 9000 + 1000)}`,
      bankName: fictionalBanks[4].name,
      bankBranch: fictionalBanks[4].branch,
      amount: '850000.00',
      currency: 'INR',
      issueDate: daysAgo(3),
      maturityDate: daysFromNow(362),
      purpose: 'AICTE Approval Security Deposit Renewal (Demo)',
      lifecycleStatus: 'SUBMITTED',
      submittedAt: daysAgo(2),
      submittedById: users.iu1.id,
      predecessorInstrumentId: instruments.i25.id,
    },
  });
  console.log('  ✓ Renewal chains');

  // ─── Release Requests ─────────────────────────────────────────────────────────
  console.log('Creating release requests...');

  const checklistSnapshot = savedChecklistItems.map((item, idx) => ({
    id: item.id,
    label: item.label,
    isRequired: item.isRequired,
    sortOrder: item.sortOrder,
    completed: idx < 2, // First two completed for demo
  }));

  // RR1: PENDING_AUTHORITY_DECISION (reviewed by so1, decision by aa — maker-checker ok)
  const rr1 = await prisma.releaseRequest.create({
    data: {
      referenceCode: nextRef('RR'),
      instrumentId: instruments.i17.id,
      institutionId: institutions.sunrise.id,
      requestType: 'RELEASE',
      reason:
        'FDR matured. Institution requests release and refund of security deposit amount (Demo).',
      status: 'PENDING_AUTHORITY_DECISION',
      submittedById: users.iu1.id,
      submittedAt: daysAgo(10),
      reviewedById: users.so1.id,
      reviewedAt: daysAgo(7),
      scrutinyNotes:
        'All documents reviewed. Forwarding for authority decision.',
      checklistSnapshot: checklistSnapshot.map((i) => ({
        ...i,
        completed: i.isRequired,
      })),
      version: 3,
      history: [
        {
          action: 'SUBMITTED',
          at: daysAgo(10).toISOString(),
          byUserId: users.iu1.id,
        },
        {
          action: 'UNDER_REVIEW',
          at: daysAgo(8).toISOString(),
          byUserId: users.so1.id,
        },
        {
          action: 'FORWARDED',
          at: daysAgo(7).toISOString(),
          byUserId: users.so1.id,
        },
      ],
    },
  });

  // RR2: UNDER_REVIEW
  await prisma.releaseRequest.create({
    data: {
      referenceCode: nextRef('RR'),
      instrumentId: instruments.i18.id,
      institutionId: institutions.coastal.id,
      requestType: 'REFUND',
      reason:
        'FDR matured and institution is winding down the program. Refund requested (Demo).',
      status: 'UNDER_REVIEW',
      submittedById: users.iu2.id,
      submittedAt: daysAgo(5),
      reviewedById: users.so2.id,
      reviewedAt: daysAgo(3),
      checklistSnapshot,
      version: 2,
      history: [
        {
          action: 'SUBMITTED',
          at: daysAgo(5).toISOString(),
          byUserId: users.iu2.id,
        },
        {
          action: 'UNDER_REVIEW',
          at: daysAgo(3).toISOString(),
          byUserId: users.so2.id,
        },
      ],
    },
  });

  // RR3: RETURNED_FOR_INFORMATION
  await prisma.releaseRequest.create({
    data: {
      referenceCode: nextRef('RR'),
      instrumentId: instruments.i19.id,
      institutionId: institutions.hillside.id,
      requestType: 'DISCHARGE',
      reason:
        'Security deposit no longer required after program closure (Demo).',
      status: 'RETURNED_FOR_INFORMATION',
      submittedById: users.iu3.id,
      submittedAt: daysAgo(15),
      reviewedById: users.so1.id,
      reviewedAt: daysAgo(12),
      returnReason:
        'NOC from competent authority is missing. Please attach the required document.',
      checklistSnapshot,
      version: 3,
      history: [
        {
          action: 'SUBMITTED',
          at: daysAgo(15).toISOString(),
          byUserId: users.iu3.id,
        },
        {
          action: 'UNDER_REVIEW',
          at: daysAgo(13).toISOString(),
          byUserId: users.so1.id,
        },
        {
          action: 'RETURNED',
          at: daysAgo(12).toISOString(),
          byUserId: users.so1.id,
          reason: 'NOC missing',
        },
      ],
    },
  });

  // RR4: APPROVED
  const rr4 = await prisma.releaseRequest.create({
    data: {
      referenceCode: nextRef('RR'),
      instrumentId: instruments.i20.id,
      institutionId: institutions.northern.id,
      requestType: 'RELEASE',
      reason:
        'Security deposit for approved program. Matured; release requested (Demo).',
      status: 'APPROVED',
      submittedById: users.iuNorthern.id,
      submittedAt: daysAgo(30),
      reviewedById: users.so2.id,
      reviewedAt: daysAgo(25),
      decisionById: users.aa.id,
      decisionAt: daysAgo(20),
      decisionReason: 'All conditions met. Release approved. (Demo decision)',
      checklistSnapshot: checklistSnapshot.map((i) => ({
        ...i,
        completed: true,
      })),
      version: 5,
      history: [
        { action: 'SUBMITTED', at: daysAgo(30).toISOString() },
        {
          action: 'APPROVED',
          at: daysAgo(20).toISOString(),
          byUserId: users.aa.id,
        },
      ],
    },
  });
  console.log('  ✓ Release requests');

  // Private synthetic evidence for all non-draft scenarios and release requests.
  const directory = path.resolve(config.UPLOAD_DIR);
  fs.mkdirSync(directory, { recursive: true });
  function demoPdf(reference: string) {
    const text = `DEMO ONLY - SYNTHETIC EVIDENCE - NOT BANK CONFIRMATION. Reference: ${reference}`;
    const stream = `BT /F1 11 Tf 40 750 Td (${text}) Tj ET`;
    const objects = [
      '<</Type/Catalog /Pages 2 0 R>>',
      '<</Type/Pages /Kids[3 0 R] /Count 1>>',
      '<</Type/Page /Parent 2 0 R /MediaBox[0 0 612 792] /Resources<</Font<</F1 4 0 R>>>> /Contents 5 0 R>>',
      '<</Type/Font /Subtype/Type1 /BaseFont/Helvetica>>',
      `<</Length ${Buffer.byteLength(stream)}>>\nstream\n${stream}\nendstream`,
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(pdf));
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const start = Buffer.byteLength(pdf);
    pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
      .slice(1)
      .map((offset) => String(offset).padStart(10, '0') + ' 00000 n ')
      .join('\n')}\ntrailer<</Size 6 /Root 1 0 R>>\nstartxref\n${start}\n%%EOF`;
    return Buffer.from(pdf);
  }
  const seededInstruments = await prisma.instrument.findMany({
    where: { lifecycleStatus: { not: 'DRAFT' } },
  });
  const releases = await prisma.releaseRequest.findMany();
  for (const parent of [
    ...seededInstruments.map((item) => ({
      instrumentId: item.id,
      releaseRequestId: null,
      reference: item.referenceCode,
      userId: item.submittedById!,
    })),
    ...releases.map((item) => ({
      instrumentId: null,
      releaseRequestId: item.id,
      reference: item.referenceCode,
      userId: item.submittedById,
    })),
  ]) {
    const bytes = demoPdf(parent.reference),
      key = `seed-${parent.reference}.pdf`;
    fs.writeFileSync(path.join(directory, key), bytes);
    await prisma.document.create({
      data: {
        instrumentId: parent.instrumentId,
        releaseRequestId: parent.releaseRequestId,
        category: parent.releaseRequestId ? 'RELEASE_SUPPORTING' : 'FDR_COPY',
        originalFilename: `DEMO-${parent.reference}.pdf`,
        storageKey: key,
        mimeType: 'application/pdf',
        sizeBytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        uploadedById: parent.userId,
      },
    });
  }
  console.log(
    '  ✓ Private synthetic evidence (never real financial documents)',
  );

  // ─── Submission Snapshots ─────────────────────────────────────────────────────
  for (const inst of await prisma.instrument.findMany({
    where: { submittedById: { not: null } },
    include: { documents: true },
  })) {
    await prisma.instrumentSubmissionSnapshot.create({
      data: {
        instrumentId: inst.id,
        submittedById: inst.submittedById!,
        submittedAt: inst.submittedAt || inst.createdAt,
        payload: submissionSnapshot(inst),
      },
    });
  }
  console.log('  ✓ Submission snapshots');

  // ─── Notifications ────────────────────────────────────────────────────────────
  console.log('Creating notifications...');
  const notifDefs = [
    {
      userId: users.iu1.id,
      type: 'MATURITY_REMINDER',
      title: 'FDR Maturing in 7 days',
      message: `Instrument ${instruments.i1.referenceCode} matures in 7 days. Please initiate renewal or release action.`,
      dedupeKey: `seed-notif-1-${users.iu1.id}`,
      entityId: instruments.i1.id,
    },
    {
      userId: users.iu2.id,
      type: 'MATURITY_REMINDER',
      title: 'FDR Maturing in 15 days',
      message: `Instrument ${instruments.i2.referenceCode} matures in 15 days.`,
      dedupeKey: `seed-notif-2-${users.iu2.id}`,
      entityId: instruments.i2.id,
    },
    {
      userId: users.so1.id,
      type: 'MATURITY_REMINDER',
      title: 'FDR Maturing in 7 days',
      message: `Instrument ${instruments.i1.referenceCode} (Sunrise) matures in 7 days.`,
      dedupeKey: `seed-notif-3-${users.so1.id}`,
      entityId: instruments.i1.id,
    },
    {
      userId: users.so2.id,
      type: 'MATURITY_ESCALATION',
      title: 'ESCALATION: Matured without action',
      message: `Instrument ${instruments.i7.referenceCode} (Central University) matured 30 days ago with no renewal or release.`,
      dedupeKey: `seed-escal-1-${users.so2.id}`,
      entityId: instruments.i7.id,
    },
    {
      userId: users.aa.id,
      type: 'RELEASE_PENDING_DECISION',
      title: 'Release Request Awaiting Decision',
      message: `Release request ${rr1.referenceCode} is awaiting your decision.`,
      dedupeKey: `seed-rr-notif-1-${users.aa.id}`,
      entityId: rr1.id,
    },
    {
      userId: users.iu1.id,
      type: 'SCRUTINY_ACTION_REQUIRED',
      title: 'Action Required on FDR',
      message: `Instrument ${instruments.i13.referenceCode} requires correction. A discrepancy has been flagged.`,
      dedupeKey: `seed-ar-notif-1-${users.iu1.id}`,
      entityId: instruments.i13.id,
    },
  ];

  for (const n of notifDefs) {
    try {
      await prisma.notification.create({
        data: {
          recipientUserId: n.userId,
          type: n.type,
          title: n.title,
          message: n.message,
          relatedEntityType:
            n.type === 'RELEASE_PENDING_DECISION'
              ? 'ReleaseRequest'
              : 'Instrument',
          relatedEntityId: n.entityId,
          dedupeKey: n.dedupeKey,
          deliveryStatus: 'DELIVERED',
          sentAt: daysAgo(1),
        },
      });
    } catch {
      // Already exists
    }
  }
  console.log('  ✓ Notifications');

  // ─── Audit Events ─────────────────────────────────────────────────────────────
  console.log('Creating audit timeline...');
  const auditDefs = [
    {
      actorUserId: users.iu1.id,
      actorRole: 'INSTITUTION_USER',
      action: 'AUTH_LOGIN_SUCCESS',
      entityType: 'User',
      entityId: users.iu1.id,
      timestamp: daysAgo(20),
    },
    {
      actorUserId: users.iu1.id,
      actorRole: 'INSTITUTION_USER',
      action: 'INSTRUMENT_CREATED',
      entityType: 'Instrument',
      entityId: instruments.i1.id,
      timestamp: daysAgo(18),
    },
    {
      actorUserId: users.iu1.id,
      actorRole: 'INSTITUTION_USER',
      action: 'INSTRUMENT_SUBMITTED',
      entityType: 'Instrument',
      entityId: instruments.i1.id,
      timestamp: daysAgo(17),
    },
    {
      actorUserId: users.so1.id,
      actorRole: 'SCRUTINY_OFFICER',
      action: 'INSTRUMENT_UNDER_REVIEW',
      entityType: 'Instrument',
      entityId: instruments.i1.id,
      timestamp: daysAgo(15),
    },
    {
      actorUserId: users.so1.id,
      actorRole: 'SCRUTINY_OFFICER',
      action: 'VERIFICATION_RECORDED',
      entityType: 'Verification',
      entityId: instruments.i1.id,
      timestamp: daysAgo(12),
    },
    {
      actorUserId: users.so1.id,
      actorRole: 'SCRUTINY_OFFICER',
      action: 'INSTRUMENT_VERIFIED',
      entityType: 'Instrument',
      entityId: instruments.i1.id,
      timestamp: daysAgo(10),
    },
    {
      actorUserId: users.iu1.id,
      actorRole: 'INSTITUTION_USER',
      action: 'RELEASE_REQUEST_CREATED',
      entityType: 'ReleaseRequest',
      entityId: rr1.id,
      timestamp: daysAgo(10),
    },
    {
      actorUserId: users.so1.id,
      actorRole: 'SCRUTINY_OFFICER',
      action: 'RELEASE_REQUEST_FORWARDED',
      entityType: 'ReleaseRequest',
      entityId: rr1.id,
      timestamp: daysAgo(7),
    },
    {
      actorUserId: users.so1.id,
      actorRole: 'SCRUTINY_OFFICER',
      action: 'DISCREPANCY_CREATED',
      entityType: 'Discrepancy',
      entityId: instruments.i13.id,
      timestamp: daysAgo(6),
    },
    {
      actorUserId: users.sa.id,
      actorRole: 'SYSTEM_ADMIN',
      action: 'SETTING_UPDATED',
      entityType: 'SystemSetting',
      timestamp: daysAgo(3),
    },
  ];

  for (const ae of auditDefs) {
    await prisma.auditEvent.create({
      data: {
        actorUserId: ae.actorUserId,
        actorRole: ae.actorRole,
        action: ae.action,
        entityType: ae.entityType,
        entityId: ae.entityId,
        timestamp: ae.timestamp,
        metadata: { seeded: true },
      },
    });
  }
  console.log('  ✓ Audit events');

  // ─── Print credentials ────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('🔑 DEMO ACCOUNTS (development only — never use in production)');
  console.log('═'.repeat(70));
  console.log('⚠️  These credentials are for the demo environment only.');
  console.log('⚠️  All data is synthetic. Not real AICTE data.\n');

  console.log(
    'Role                 | Email                                  | Password',
  );
  console.log('-'.repeat(80));
  const printUser = (role: string, email: string, key: string) =>
    console.log(`${role.padEnd(21)}| ${email.padEnd(39)} | ${passwords[key]}`);

  for (const definition of userDefs)
    printUser(definition.role, definition.email, definition.key);

  console.log('\n' + '═'.repeat(70));
  console.log(
    '✅ Seed complete! Start the dev server and open http://localhost:5173',
  );
  console.log('═'.repeat(70) + '\n');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
