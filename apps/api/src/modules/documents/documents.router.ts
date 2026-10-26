import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Role, DocumentCategory } from '@depositdesk/shared';
import { prisma } from '../../config/prisma';
import { config } from '../../config/env';
import { createError } from '../../middleware/errorHandler';
import { requireAuth, AuthenticatedRequest, requireInstitutionAccess } from '../../middleware/auth';
import { writeAuditEvent } from '../../lib/audit';
import { logger } from '../../config/logger';

export const documentsRouter = Router();
documentsRouter.use(requireAuth as any);

// Allowed MIME types and their magic bytes (simplified)
const ALLOWED_MIMES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']);
const ALLOWED_EXTS = new Set(['.pdf', '.jpg', '.jpeg', '.png']);

// Ensure upload directory exists
const uploadDir = path.resolve(config.UPLOAD_DIR);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer: memory storage for validation, then stream to disk
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      return cb(new Error(`File extension not allowed: ${ext}`));
    }
    cb(null, true);
  },
});

// POST /documents/upload
documentsRouter.post('/upload', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!req.file) return next(createError(422, 'NO_FILE', 'No file provided'));

    const { instrumentId, releaseRequestId, category } = req.body;

    // At least one parent must be provided
    if (!instrumentId && !releaseRequestId) {
      return next(createError(422, 'MISSING_PARENT', 'instrumentId or releaseRequestId is required'));
    }

    if (!Object.values(DocumentCategory).includes(category)) {
      return next(createError(422, 'INVALID_CATEGORY', 'Invalid document category'));
    }

    // Validate file type via magic bytes
    const { fileTypeFromBuffer } = await import('file-type');
    const fileTypeResult = await fileTypeFromBuffer(req.file.buffer);
    if (!fileTypeResult || !ALLOWED_MIMES.has(fileTypeResult.mime)) {
      return next(createError(422, 'INVALID_FILE_TYPE', 'File type not allowed. Only PDF, JPG, PNG are accepted.'));
    }

    // Check declared MIME matches actual
    if (req.file.mimetype !== fileTypeResult.mime &&
        !(req.file.mimetype === 'image/jpg' && fileTypeResult.mime === 'image/jpeg')) {
      return next(createError(422, 'MIME_MISMATCH', 'Declared MIME type does not match file content'));
    }

    // Authorization: check parent
    if (instrumentId) {
      const instrument = await prisma.instrument.findUnique({ where: { id: instrumentId } });
      if (!instrument) return next(createError(404, 'NOT_FOUND', 'Instrument not found'));
      await requireInstitutionAccess(instrument.institutionId, req);

      // IU can only upload to own instruments in DRAFT, ACTION_REQUIRED, or RESUBMITTED
      if (authReq.user.role === Role.INSTITUTION_USER) {
        if (!['DRAFT', 'ACTION_REQUIRED', 'RESUBMITTED'].includes(instrument.lifecycleStatus)) {
          return next(createError(403, 'FORBIDDEN', 'Cannot upload documents in this instrument state'));
        }
      }
    }

    if (releaseRequestId) {
      const rr = await prisma.releaseRequest.findUnique({ where: { id: releaseRequestId } });
      if (!rr) return next(createError(404, 'NOT_FOUND', 'Release request not found'));
      await requireInstitutionAccess(rr.institutionId, req);
    }

    // Generate storage key (never trust original filename for paths)
    const storageKey = `${crypto.randomUUID()}${path.extname(req.file.originalname).toLowerCase()}`;
    const storagePath = path.join(uploadDir, storageKey);

    // Compute SHA-256
    const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

    // Write to disk
    fs.writeFileSync(storagePath, req.file.buffer);

    // Sanitize original filename for display (strip path separators)
    const safeFilename = path.basename(req.file.originalname).replace(/[/\\]/g, '');

    const document = await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          instrumentId: instrumentId || null,
          releaseRequestId: releaseRequestId || null,
          category: category as DocumentCategory,
          originalFilename: safeFilename,
          storageKey,
          mimeType: fileTypeResult.mime,
          sizeBytes: req.file!.size,
          sha256,
          uploadedById: authReq.user.id,
        },
      });
      await writeAuditEvent(tx, {
        actorUserId: authReq.user.id,
        actorRole: authReq.user.role,
        action: 'DOCUMENT_UPLOADED',
        entityType: 'Document',
        entityId: doc.id,
        requestId: req.headers['x-request-id'] as string,
        changedFields: {
          filename: safeFilename,
          category,
          instrumentId,
          releaseRequestId,
          sha256,
        },
      });
      return doc;
    });

    res.status(201).json({
      id: document.id,
      originalFilename: document.originalFilename,
      category: document.category,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      uploadedAt: document.uploadedAt,
      malwareScan: 'NOT_SCANNED', // Adapter interface only — no scanner configured
    });
  } catch (err) {
    next(err);
  }
});

// GET /documents/:id — metadata
documentsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const doc = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: {
        uploadedBy: { select: { id: true, name: true } },
        instrument: { select: { id: true, institutionId: true, referenceCode: true } },
        releaseRequest: { select: { id: true, institutionId: true, referenceCode: true } },
      },
    });

    if (!doc) return next(createError(404, 'NOT_FOUND', 'Document not found'));

    // Authorization via parent
    const institutionId = doc.instrument?.institutionId || doc.releaseRequest?.institutionId;
    if (institutionId) await requireInstitutionAccess(institutionId, req);

    res.json({ ...doc, malwareScan: 'NOT_SCANNED' });
  } catch (err) {
    next(err);
  }
});

// GET /documents/:id/download — authenticated, authorized download
documentsRouter.get('/:id/download', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const doc = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: {
        instrument: { select: { institutionId: true } },
        releaseRequest: { select: { institutionId: true } },
      },
    });

    if (!doc) return next(createError(404, 'NOT_FOUND', 'Document not found'));

    // Authorization
    const institutionId = doc.instrument?.institutionId || doc.releaseRequest?.institutionId;
    if (institutionId) await requireInstitutionAccess(institutionId, req);

    const filePath = path.join(uploadDir, doc.storageKey);
    if (!fs.existsSync(filePath)) {
      logger.error({ storageKey: doc.storageKey }, 'Document file missing from storage');
      return next(createError(404, 'FILE_NOT_FOUND', 'File not found in storage'));
    }

    // Prevent path traversal
    const realPath = fs.realpathSync(filePath);
    const realUploadDir = fs.realpathSync(uploadDir);
    if (!realPath.startsWith(realUploadDir)) {
      return next(createError(403, 'FORBIDDEN', 'Path traversal detected'));
    }

    // Log the download
    await prisma.auditEvent.create({
      data: {
        actorUserId: authReq.user.id,
        actorRole: authReq.user.role,
        action: 'DOCUMENT_DOWNLOADED',
        entityType: 'Document',
        entityId: doc.id,
        requestId: req.headers['x-request-id'] as string,
      },
    });

    res.setHeader('Content-Disposition', `attachment; filename="${doc.originalFilename}"`);
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');

    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
});

// GET /instruments/:id/documents — via document module
documentsRouter.get('/instrument/:instrumentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { instrumentId } = req.params;
    const instrument = await prisma.instrument.findUnique({ where: { id: instrumentId } });
    if (!instrument) return next(createError(404, 'NOT_FOUND', 'Instrument not found'));
    await requireInstitutionAccess(instrument.institutionId, req);

    const documents = await prisma.document.findMany({
      where: { instrumentId },
      orderBy: { uploadedAt: 'desc' },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });

    res.json(documents.map(d => ({ ...d, malwareScan: 'NOT_SCANNED' })));
  } catch (err) {
    next(err);
  }
});
