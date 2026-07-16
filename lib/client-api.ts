// lib/client-api.ts
//
// The one thin wrapper every client component uses to talk to our API routes.
// It never throws: network failures become the same friendly envelope shape
// the API itself returns ({ data, error, code, fields, pagination }), so UI
// code has exactly one error-handling path.

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiEnvelope<T> {
  data: T | null;
  error: string | null;
  code?: string;
  fields?: Record<string, string>;
  pagination?: PaginationMeta;
}

const NETWORK_ERROR_MESSAGE =
  'Your connection hiccuped — check your network and try that again.';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
    if (!body || typeof body !== 'object') {
      return { data: null, error: NETWORK_ERROR_MESSAGE };
    }
    return body;
  } catch {
    return { data: null, error: NETWORK_ERROR_MESSAGE };
  }
}
