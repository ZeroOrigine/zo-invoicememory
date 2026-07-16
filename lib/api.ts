// lib/api.ts
//
// Shared API plumbing for every InvoiceMemory route handler.
//
// THE ONE TRUE RESPONSE SHAPE (every endpoint, no exceptions):
//
//   Success:  { data: <resource>, error: null }
//   Lists:    { data: <resource[]>, pagination: { page, limit, total, totalPages }, error: null }
//   Failure:  { data: null, error: <human sentence>, code: <MACHINE_CODE>, fields?: { field: message } }
//
// Error copy is written for humans: it says what happened and what to do next.
// The machine-readable `code` is for programmatic handling. Internal details
// go to server logs — they never leak into a response body.

import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'BAD_REQUEST'
  | 'WEBHOOK_SIGNATURE_INVALID'
  | 'INTERNAL_ERROR';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PageRequest {
  page: number;
  limit: number;
  from: number;
  to: number;
}

// Jensen Huang rule: pagination on every list endpoint. Default 20, max 100.
export const PAGINATION_DEFAULT_LIMIT = 20;
export const PAGINATION_MAX_LIMIT = 100;

export function jsonData<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json({ data, error: null }, { status });
}

export function jsonList<T>(items: T[], pagination: PaginationMeta): NextResponse {
  return NextResponse.json({ data: items, pagination, error: null }, { status: 200 });
}

export function jsonError(
  message: string,
  code: ApiErrorCode,
  status: number,
  fields?: Record<string, string>,
): NextResponse {
  return NextResponse.json(
    { data: null, error: message, code, ...(fields ? { fields } : {}) },
    { status },
  );
}

/**
 * Turns a ZodError into a 400 with field-level messages, so the UI can
 * highlight exactly which input needs attention.
 */
export function jsonValidationError(zodError: ZodError): NextResponse {
  const fields: Record<string, string> = {};
  for (const issue of zodError.issues) {
    const fieldPath = issue.path.length > 0 ? issue.path.join('.') : 'body';
    if (!fields[fieldPath]) {
      fields[fieldPath] = issue.message;
    }
  }
  return jsonError(
    "Some of that didn't look right — check the highlighted fields and try again.",
    'VALIDATION_ERROR',
    400,
    fields,
  );
}

export function parsePagination(searchParams: URLSearchParams): PageRequest {
  const rawPage = Number.parseInt(searchParams.get('page') ?? '', 10);
  const rawLimit = Number.parseInt(searchParams.get('limit') ?? '', 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, PAGINATION_MAX_LIMIT)
      : PAGINATION_DEFAULT_LIMIT;

  const from = (page - 1) * limit;
  return { page, limit, from, to: from + limit - 1 };
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * Reads a JSON request body without throwing. Returns null when the body is
 * missing or malformed — callers turn that into a friendly 400.
 */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
