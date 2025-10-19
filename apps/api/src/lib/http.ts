import type { Response } from 'express';
import type { ZodIssue } from 'zod';

const formatIssues = (issues: ZodIssue[]) =>
  issues.map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`).join('; ');

export const sendValidationError = (res: Response, issues: ZodIssue[]) => {
  res.status(400).json({
    error: {
      code: 'BAD_REQUEST',
      message: formatIssues(issues)
    }
  });
};

export const sendNotFound = (res: Response, message: string) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message
    }
  });
};

export const sendServerError = (res: Response, message = 'Unexpected error') => {
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message
    }
  });
};
