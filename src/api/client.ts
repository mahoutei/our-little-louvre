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
};

async function request<T>(path: string, { token, method = 'GET', body }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      cache: 'no-store',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError(0, 'The museum office could not be reached. Check your connection.');
  }

  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    fields?: Record<string, string>;
  };
  if (!response.ok) {
    throw new ApiError(response.status, data.error ?? 'The museum office could not complete that request.', data.fields);
  }
  return data as T;
}

export const api = {
  health: () => request<{ ok: boolean; configured: boolean; guestList: boolean }>('/health'),
  allowed: (email: string) =>
    request<{ allowed: boolean; configured: boolean }>(`/auth/allowed?email=${encodeURIComponent(email)}`),
  me: (token: string) => request<SessionView>('/me', { token }),
  collection: (token: string) => request<{ collection: unknown }>('/collection', { token }),
  studio: (token: string) => request<StudioData>('/studio', { token }),
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
  updateExhibit: (token: string, id: string, patch: ExhibitPatch) =>
    request<{ collection: Collection }>(`/exhibits/${encodeURIComponent(id)}`, { token, method: 'PATCH', body: patch }),
  deleteExhibit: (token: string, id: string) =>
    request<{ collection: Collection }>(`/exhibits/${encodeURIComponent(id)}`, { token, method: 'DELETE' }),
  saveLetter: (token: string, letter: { title: string; paragraphs: string[] }) =>
    request<{ letter: LetterView; collection: Collection }>('/letter', { token, method: 'PUT', body: letter }),
};
