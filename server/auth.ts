import type { Member } from '@prisma/client';
import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import type { MiddlewareHandler } from 'hono';
import { pausedMessageFor } from '../shared/pause.js';
import { ApiError } from './http.js';
import { env, guestListReady, isAllowedEmail, nameFor, roleFor, serverReady } from './env.js';
import { prisma } from './prisma.js';
import { supabaseAdmin } from './supabase.js';

export type AppBindings = {
  Variables: {
    member: Member;
  };
};

export const requireMember: MiddlewareHandler<AppBindings> = async (c, next) => {
  if (!serverReady()) throw new ApiError(503, 'The museum backend is not configured yet.');
  if (!guestListReady()) throw new ApiError(503, 'The guest list is empty. Add OWNER_EMAIL and PARTNER_EMAIL.');

  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  if (!token) throw new ApiError(401, 'Sign in to enter the museum.');

  const { data, error } = await supabaseAdmin().auth.getUser(token);
  if (isAuthRetryableFetchError(error) || (error?.status ?? 0) >= 500) {
    throw new ApiError(503, 'The museum could not check your key. Try again in a moment.');
  }
  const email = data.user?.email?.trim().toLowerCase();
  if (error || !data.user || !email) throw new ApiError(401, 'Your key has expired. Sign in again.');
  if (!isAllowedEmail(email)) throw new ApiError(403, 'This museum is kept for two people.');

  let member = await prisma.member.findUnique({ where: { authId: data.user.id } });
  if (!member) {
    // Concurrent first requests would otherwise both try to create the same row.
    member = await prisma.member.upsert({
      where: { email },
      update: { authId: data.user.id },
      create: {
        authId: data.user.id,
        email,
        name: nameFor(email),
        role: roleFor(email),
      },
    });
  }

  if (member.email !== email) throw new ApiError(403, 'This museum is kept for two people.');
  c.set('member', member);
  await next();
};

/**
 * The owner can keep preparing a surprise while the partner's session exists but
 * reveals no collection data. /api/me stays readable so the browser knows which
 * holding page to show.
 */
export function pauseMessageFor(member: Member): string | null {
  return pausedMessageFor(member.role, env.partnerPaused, env.partnerPausedMessage);
}

export const requireOpenMuseum: MiddlewareHandler<AppBindings> = async (c, next) => {
  const pause = pauseMessageFor(c.get('member'));
  if (pause) throw new ApiError(423, pause);
  await next();
};

export function allowedEmailResult(email: string) {
  const normalized = email.trim().toLowerCase();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
  return {
    allowed: valid && guestListReady() && isAllowedEmail(normalized),
    configured: guestListReady(),
  };
}

export function memberView(member: Member) {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
  };
}
