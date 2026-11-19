import type { Collection, Manifest, MemberView } from '../../shared/types';

export const demoMember: MemberView = {
  id: 'demo',
  name: 'Demo Curator',
  email: 'demo@ourlittlelouvre.test',
  role: 'OWNER',
};

export function demoCollection(manifest: Manifest): Collection {
  return {
    museum: { name: 'Our Little Louvre' },
    member: demoMember,
    manifest,
    wing: { capacity: 6, alleys: [], total: 0 },
  };
}
