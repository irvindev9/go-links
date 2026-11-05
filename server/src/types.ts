export interface GoLink {
  id: number;
  slug: string;
  targetUrl: string;
  description: string;
  clicks: number;
  createdAt: string;
  lastAccessedAt: string | null;
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'SLUG_ALREADY_EXISTS'
  | 'LINK_NOT_FOUND'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: Record<string, string[]>;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
