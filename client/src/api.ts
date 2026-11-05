export interface GoLink {
  id: number;
  slug: string;
  targetUrl: string;
  description: string;
  clicks: number;
  createdAt: string;
  lastAccessedAt: string | null;
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
    requestId?: string;
  };
}

export class ApiClientError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: Record<string, string[]>;
  public readonly requestId: string;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details: Record<string, string[]> = {},
    requestId = 'req_unknown',
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

async function parseErrorResponse(res: Response): Promise<ApiClientError> {
  const headerReqId = res.headers.get('X-Request-Id') ?? 'req_unknown';
  try {
    const body = (await res.json()) as ApiErrorPayload;
    if (body?.error) {
      return new ApiClientError(
        res.status,
        body.error.code,
        body.error.message,
        body.error.details ?? {},
        body.error.requestId ?? headerReqId,
      );
    }
  } catch {
    // Fallback if response body is not valid JSON
  }

  return new ApiClientError(
    res.status,
    'HTTP_ERROR',
    `Request failed with status ${res.status}`,
    {},
    headerReqId,
  );
}

export async function fetchLinks(query = ''): Promise<{
  data: GoLink[];
  total: number;
  requestId: string;
}> {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set('q', query.trim());
  }
  const qs = params.toString();
  const url = qs ? `/api/links?${qs}` : '/api/links';

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw await parseErrorResponse(res);
  }

  const requestId = res.headers.get('X-Request-Id') ?? 'req_ok';
  const payload = (await res.json()) as {
    data: GoLink[];
    meta: { total: number };
  };

  return {
    data: payload.data,
    total: payload.meta.total,
    requestId,
  };
}

export async function createLink(input: {
  slug: string;
  targetUrl: string;
  description: string;
}): Promise<{ data: GoLink; requestId: string }> {
  const res = await fetch('/api/links', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw await parseErrorResponse(res);
  }

  const requestId = res.headers.get('X-Request-Id') ?? 'req_created';
  const payload = (await res.json()) as { data: GoLink };

  return {
    data: payload.data,
    requestId,
  };
}

export async function deleteLink(id: number): Promise<{ requestId: string }> {
  const res = await fetch(`/api/links/${id}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    throw await parseErrorResponse(res);
  }

  const requestId = res.headers.get('X-Request-Id') ?? 'req_deleted';
  return { requestId };
}
