import type {
  Collection,
  ExhibitPatch,
  LetterView,
  MemberView,
  NewExhibitInput,
  SessionView,
  StudioData,
  WingSlot,
} from '../../shared/types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  token?: string | null;
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
};

async function request<T>(path: string, { token, method = 'GET', body, signal }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  let data: { error?: string; fields?: Record<string, string> };
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      cache: 'no-store',
      signal,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    data = await response.json().catch((error: unknown) => {
      if (signal?.aborted) throw error;
      return {};
    });
  } catch {
    throw new ApiError(0, 'The museum office could not be reached. Check your connection.');
  }

  if (!response.ok) {
    throw new ApiError(response.status, data.error ?? 'The museum office could not complete that request.', data.fields);
  }
  return data as T;
}

export const api = {
  allowed: (email: string) =>
    request<{ allowed: boolean; configured: boolean }>(`/auth/allowed?email=${encodeURIComponent(email)}`),
  async me(token: string, signal?: AbortSignal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 15_000);
    try {
      return await request<SessionView>('/me', { token, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  },
  collection: (token: string) => request<{ collection: unknown }>('/collection', { token }),
  studio: (token: string) => request<Omit<StudioData, 'stats'>>('/studio', { token }),
  updateProfile: (token: string, name: string) =>
    request<{ member: MemberView }>('/me', { token, method: 'PATCH', body: { name } }),
  createUploads: (token: string, files: { kind: 'full' | 'thumb'; contentType: string }[]) =>
    request<{ files: { kind: string; path: string; token: string; contentType: string }[] }>('/uploads', {
      token,
      method: 'POST',
      body: { files },
    }),
  discardUploads: (token: string, paths: string[]) =>
    request<{ ok: true }>('/uploads/discard', { token, method: 'POST', body: { paths } }),
  createExhibit: (token: string, input: NewExhibitInput) =>
    request<{ collection: Collection; slot: WingSlot }>('/exhibits', { token, method: 'POST', body: input }),
  updateExhibit: (token: string, id: string, patch: ExhibitPatch, view?: 'gallery') =>
    request<{ collection: Collection }>(`/exhibits/${encodeURIComponent(id)}${view ? '?view=gallery' : ''}`, { token, method: 'PATCH', body: patch }),
  deleteExhibit: (token: string, id: string, view?: 'gallery') =>
    request<{ collection: Collection }>(`/exhibits/${encodeURIComponent(id)}${view ? '?view=gallery' : ''}`, { token, method: 'DELETE' }),
  saveLetter: (token: string, letter: { title: string; paragraphs: string[]; updatedAt: string }) =>
    request<{ letter: LetterView; collection: Collection }>('/letter', { token, method: 'PUT', body: letter }),
};
