import { Request, Response, NextFunction } from 'express';
import { ZodError } from '@depositdesk/shared';
import { logger } from '../config/logger';
import { Prisma } from '@prisma/client';
import multer from 'multer';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export function createError(
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): ApiError {
  const err = new Error(message) as ApiError;
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

export function errorHandler(
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const apiErr = err as ApiError;

  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    ['P2025', 'P2002'].includes(err.code)
  ) {
    res.status(409).json({
      error: {
        code: 'RECORD_CONFLICT',
        message: 'The record changed or already exists. Refresh and try again.',
      },
    });
    return;
  }
  if (err instanceof multer.MulterError) {
    res.status(422).json({
      error: {
        code: err.code,
        message:
          err.code === 'LIMIT_FILE_SIZE'
            ? 'The file exceeds the upload size limit.'
            : 'Invalid file upload.',
      },
    });
    return;
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
    });
    return;
  }

  const statusCode = apiErr.statusCode || 500;
  const code = apiErr.code || 'INTERNAL_ERROR';

  // Never expose internal details to client in production
  if (statusCode === 500) {
    logger.error(
      { err, requestId: req.headers['x-request-id'] },
      'Unhandled error',
    );
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred',
      },
    });
    return;
  }

  res.status(statusCode).json({
    error: {
      code,
      message: err.message,
      details: apiErr.details,
    },
  });
}
