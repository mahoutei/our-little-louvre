import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../../src/auth/AuthProvider';

const { onAuthStateChange, signOut } = vi.hoisted(() => ({ onAuthStateChange: vi.fn(), signOut: vi.fn() }));

vi.mock('../../src/auth/supabase', () => ({
  demoMode: false,
  supabaseConfigured: true,
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'test-token' } }, error: null }),
      onAuthStateChange,
      signOut,
    },
  },
}));

const member = { id: 'member-1', name: 'Owner', email: 'owner@example.com', role: 'OWNER' };
const fetchMe = vi.fn<typeof fetch>();
let auth: ReturnType<typeof useAuth>;
let root: ReturnType<typeof createRoot>;

function ReadAuth() {
  auth = useAuth();
  return null;
}

beforeEach(async () => {
  vi.useFakeTimers();
  // The probe reads context and renders no elements. ReactDOM only needs to attach listeners.
  const document = Object.assign(new EventTarget(), { nodeType: 9 });
  const container = Object.assign(new EventTarget(), { nodeType: 1, tagName: 'DIV', ownerDocument: document });
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', { HTMLIFrameElement: class {}, location: { pathname: '/' }, setInterval, clearInterval });
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', fetchMe.mockReset().mockImplementation(async () => Response.json({ member })));
  onAuthStateChange.mockReset().mockReturnValue({ data: { subscription: { unsubscribe() {} } } });
  signOut.mockReset().mockResolvedValue({ error: null });

  root = createRoot(container as unknown as Element);
  await act(async () => root.render(createElement(AuthProvider, { children: createElement(ReadAuth) })));
});

afterEach(async () => {
  await act(async () => root?.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it.each([401, 403])('closes an open museum when the background check returns %d', async (status) => {
  expect(auth.member).toEqual(member);
  let finishSignOut!: () => void;
  signOut.mockImplementation(() => new Promise<void>((resolve) => { finishSignOut = resolve; }));
  fetchMe.mockResolvedValueOnce(Response.json({ error: 'Access ended' }, { status }));

  await act(async () => vi.advanceTimersByTimeAsync(60_000));

  expect(auth.member).toBeNull();
  expect(auth.session).toBeNull();
  await act(async () => finishSignOut());
});

it('keeps an open museum visible while the office cannot be reached', async () => {
  fetchMe.mockRejectedValueOnce(new TypeError('Failed to fetch'));

  await act(async () => vi.advanceTimersByTimeAsync(60_000));

  expect(auth.member).toEqual(member);
});

it('ignores a pending background response after signing out', async () => {
  let finishCheck!: (response: Response) => void;
  let signal: RequestInit['signal'];
  fetchMe.mockImplementationOnce((_input, options) => new Promise<Response>((resolve) => {
    signal = options?.signal;
    finishCheck = resolve;
  }));

  await act(async () => vi.advanceTimersByTimeAsync(60_000));
  await act(async () => auth.signOut());
  await act(async () => finishCheck(Response.json({ member })));

  expect(signal?.aborted).toBe(true);
  expect(auth.member).toBeNull();
});

it.each(['headers', 'body'])('tries again when waiting for the background response %s times out', async (stalled) => {
  fetchMe.mockImplementationOnce(async (_input, options) => {
    const onAbort = (fail: (error: Error) => void) => {
      options?.signal?.addEventListener('abort', () => fail(new DOMException('Request aborted', 'AbortError')), { once: true });
    };
    if (stalled === 'headers') return new Promise<Response>((_resolve, reject) => onAbort(reject));
    return new Response(new ReadableStream({ start: (stream) => onAbort((error) => stream.error(error)) }));
  });
  fetchMe.mockResolvedValueOnce(Response.json({ error: 'Access ended' }, { status: 403 }));

  await act(async () => vi.advanceTimersByTimeAsync(119_999));
  expect(auth.member).toEqual(member);

  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(auth.member).toBeNull();
});

it('keeps a refreshed session when the old background request receives a 401', async () => {
  let finishCheck!: (response: Response) => void;
  let signal: RequestInit['signal'];
  fetchMe.mockImplementationOnce((_input, options) => new Promise<Response>((resolve) => {
    signal = options?.signal;
    finishCheck = resolve;
  }));

  await act(async () => vi.advanceTimersByTimeAsync(60_000));
  await act(async () => {
    onAuthStateChange.mock.calls[0][0]('TOKEN_REFRESHED', { access_token: 'refreshed-token' });
    expect(signal?.aborted).toBe(true);
    finishCheck(Response.json({ error: 'Key expired' }, { status: 401 }));
  });

  expect(auth.session?.access_token).toBe('refreshed-token');
  expect(auth.member).toEqual(member);
});
