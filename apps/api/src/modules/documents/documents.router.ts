import { Router, Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID, createHash } from 'crypto';
import { z } from 'zod';
import { Role, DocumentCategory } from '@depositdesk/shared';
import { prisma } from '../../config/prisma';
import { config } from '../../config/env';
import { createError } from '../../middleware/errorHandler';
import {
  requireAuth,
  requireRole,
  AuthenticatedRequest,
  requireInstitutionAccess,
} from '../../middleware/auth';
import { writeAuditEvent } from '../../lib/audit';
import { documentView } from '../../lib/instruments';

import { privateStorage, documentScanner } from '../../lib/documentStorage';

export const documentsRouter = Router();
documentsRouter.use(requireAuth as any);
const uploadDir = privateStorage.directory;
fs.mkdirSync(uploadDir, { recursive: true });
const fileUpload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, _file, done) => done(null, randomUUID()),
  }),
  limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024, files: 1, fields: 6 },
  fileFilter: (_req, file, done) => {
    if (
      !['.pdf', '.jpg', '.jpeg', '.png'].includes(
        path.extname(file.originalname).toLowerCase(),
      )
    ) {
      return done(
        createError(
          422,
          'INVALID_EXTENSION',
          'Only PDF, JPG and PNG files are accepted.',
        ),
      );
    }
    done(null, true);
  },
});
const metadata = z
  .object({
    instrumentId: z.string().cuid().optional(),
    releaseRequestId: z.string().cuid().optional(),
    category: z.nativeEnum(DocumentCategory),
    version: z.coerce.number().int().positive(),
    supersedesDocumentId: z.string().cuid().optional(),
  })
  .refine(
    (value) => Boolean(value.instrumentId) !== Boolean(value.releaseRequestId),
    'Choose exactly one document parent.',
  );

async function authorizeDocument(doc: any, req: Request) {
  const parents = [
    doc.instrument?.institutionId,
    doc.releaseRequest?.institutionId,
  ].filter(Boolean);
  if (!parents.length)
    throw createError(403, 'FORBIDDEN', 'Document has no authorized parent.');
  for (const institutionId of parents)
    await requireInstitutionAccess(institutionId, req);
}

documentsRouter.post(
  '/upload',
  requireRole(
    Role.INSTITUTION_USER,
    Role.SCRUTINY_OFFICER,
    Role.APPROVING_AUTHORITY,
  ) as any,
  fileUpload.single('file'),
  async (req, res, next) => {
    let committed = false;
    try {
      if (!req.file)
        throw createError(422, 'NO_FILE', 'Select a supporting document.');
      const parsed = metadata.safeParse(req.body);
      if (!parsed.success) {
        throw createError(422, 'VALIDATION_ERROR', 'Invalid document details.', parsed.error.issues);
      }
      const body = parsed.data;
      const actor = (req as unknown as AuthenticatedRequest).user;
      const { fileTypeFromFile } = await import('file-type');
      const detected = await fileTypeFromFile(req.file.path).catch(
        () => undefined,
      );
      const extension = path.extname(req.file.originalname).toLowerCase();
      const expected =
        extension === '.pdf'
          ? 'application/pdf'
          : extension === '.png'
            ? 'image/png'
            : 'image/jpeg';
      const declared =
        req.file.mimetype === 'image/jpg' ? 'image/jpeg' : req.file.mimetype;
      if (!detected || detected.mime !== expected || declared !== expected) {
        throw createError(
          422,
          'FILE_TYPE_MISMATCH',
          'The extension, content and declared file type must match.',
        );
      }
      const scan = await documentScanner.scan(req.file.path);
      if (scan === 'INFECTED')
        throw createError(
          422,
          'UNSAFE_DOCUMENT',
          'The document was rejected by the scanner.',
        );
      const hash = createHash('sha256');
      for await (const chunk of fs.createReadStream(req.file.path))
        hash.update(chunk);
      const sha256 = hash.digest('hex');
      const doc = await prisma.$transaction(async (tx) => {
        if (body.instrumentId) {
          const instrument = await tx.instrument.findUniqueOrThrow({
            where: { id: body.instrumentId },
          });
          await requireInstitutionAccess(instrument.institutionId, req);
          const allowed =
            actor.role === Role.INSTITUTION_USER
              ? ['DRAFT', 'ACTION_REQUIRED']
              : ['UNDER_REVIEW'];
          if (!allowed.includes(instrument.lifecycleStatus))
            throw createError(
              409,
              'INVALID_STATE',
              'Documents cannot be added in this state.',
            );
          await tx.instrument.update({
            where: { id: instrument.id, version: body.version },
            data: { version: { increment: 1 } },
          });
        } else {
          const release = await tx.releaseRequest.findUniqueOrThrow({
            where: { id: body.releaseRequestId },
          });
          await requireInstitutionAccess(release.institutionId, req);
          const allowed =
            actor.role === Role.INSTITUTION_USER
              ? ['DRAFT', 'RETURNED_FOR_INFORMATION']
              : ['UNDER_REVIEW'];
          if (!allowed.includes(release.status))
            throw createError(
              409,
              'INVALID_STATE',
              'Documents cannot be added in this request state.',
            );
          await tx.releaseRequest.update({
            where: { id: release.id, version: body.version },
            data: { version: { increment: 1 }, checklistSnapshot: (release.checklistSnapshot as any[]).map(item=>({...item,completed:false})) },
          });
        }
        let version = 1;
        if (body.supersedesDocumentId) {
          const previous = await tx.document.findUnique({
            where: { id: body.supersedesDocumentId },
          });
          if (
            !previous ||
            previous.isSuperseded ||
            previous.instrumentId !== (body.instrumentId ?? null) ||
            previous.releaseRequestId !== (body.releaseRequestId ?? null) ||
            previous.category !== body.category
          ) {
            throw createError(
              422,
              'INVALID_REPLACEMENT',
              'Choose a current document in this record and category.',
            );
          }
          await tx.document.update({
            where: { id: previous.id },
            data: { isSuperseded: true },
          });
          version = previous.version + 1;
        }
        const created = await tx.document.create({
          data: {
            instrumentId: body.instrumentId,
            releaseRequestId: body.releaseRequestId,
            category: body.category,
            originalFilename: Array.from(
              path.basename(req.file!.originalname),
              (character) => (character.charCodeAt(0) < 32 ? '_' : character),
            )
              .join('')
              .replace(/[\\/\r\n"]/g, '_'),
            storageKey: req.file!.filename,
            mimeType: expected,
            sizeBytes: req.file!.size,
            sha256,
            uploadedById: actor.id,
            version,
          },
          include: { uploadedBy: { select: { id: true, name: true } } },
        });
        await writeAuditEvent(tx, {
          actorUserId: actor.id,
          actorRole: actor.role,
          action: 'DOCUMENT_UPLOADED',
          entityType: 'Document',
          entityId: created.id,
          requestId: req.headers['x-request-id'] as string,
          changedFields: {
            instrumentId: body.instrumentId,
            releaseRequestId: body.releaseRequestId,
            sha256,
            supersedesDocumentId: body.supersedesDocumentId,
          },
        });
        return created;
      });
      committed = true;
      res.status(201).json(documentView(doc));
    } catch (error) {
      next(error);
    } finally {
      if (!committed && req.file)
        await privateStorage.remove(req.file.filename).catch(() => {});
    }
  },
);

documentsRouter.get('/instrument/:instrumentId', async (req, res, next) => {
  try {
    const instrument = await prisma.instrument.findUnique({
      where: { id: req.params.instrumentId },
    });
    if (!instrument)
      throw createError(404, 'NOT_FOUND', 'Instrument not found.');
    await requireInstitutionAccess(instrument.institutionId, req);
    const documents = await prisma.document.findMany({
      where: { instrumentId: instrument.id },
      orderBy: { uploadedAt: 'desc' },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });
    res.json(documents.map(documentView));
  } catch (error) {
    next(error);
  }
});

documentsRouter.get('/:id', async (req, res, next) => {
  try {
    const doc = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: {
        instrument: { select: { institutionId: true } },
        releaseRequest: { select: { institutionId: true } },
        uploadedBy: { select: { id: true, name: true } },
      },
    });
    if (!doc) throw createError(404, 'NOT_FOUND', 'Document not found.');
    await authorizeDocument(doc, req);
    res.json(documentView(doc));
  } catch (error) {
    next(error);
  }
});

documentsRouter.get('/:id/download', async (req, res, next) => {
  try {
    const actor = (req as unknown as AuthenticatedRequest).user;
    const doc = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: {
        instrument: { select: { institutionId: true } },
        releaseRequest: { select: { institutionId: true } },
      },
    });
    if (!doc) throw createError(404, 'NOT_FOUND', 'Document not found.');
    await authorizeDocument(doc, req);
    const filePath = path.resolve(uploadDir, doc.storageKey);
    if (path.dirname(filePath) !== uploadDir || !fs.existsSync(filePath))
      throw createError(404, 'FILE_NOT_FOUND', 'Document file is unavailable.');
    const realPath = await fs.promises.realpath(filePath);
    const relative = path.relative(
      await fs.promises.realpath(uploadDir),
      realPath,
    );
    if (relative.startsWith('..') || path.isAbsolute(relative))
      throw createError(403, 'FORBIDDEN', 'Invalid document location.');
    await prisma.auditEvent.create({
      data: {
        actorUserId: actor.id,
        actorRole: actor.role,
        action: 'DOCUMENT_DOWNLOADED',
        entityType: 'Document',
        entityId: doc.id,
        requestId: req.headers['x-request-id'] as string,
      },
    });
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.type(doc.mimeType);
    res.download(realPath, doc.originalFilename, (error) => {
      if (error) next(error);
    });
  } catch (error) {
    next(error);
  }
});
