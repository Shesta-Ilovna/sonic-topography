export interface UpdateSource {
  configured: boolean;
  provider: 'github';
  owner: string;
  repo: string;
}

export function normalizeUpdateSource(value: unknown): UpdateSource {
  const input = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  let owner = String(input.owner || '').trim();
  let repo = String(input.repo || '').trim();

  if (owner.includes('/') && !repo) {
    const [nextOwner, nextRepo] = owner.split('/');
    owner = nextOwner || '';
    repo = nextRepo || '';
  }

  return {
    configured: Boolean(owner && repo),
    provider: 'github',
    owner,
    repo,
  };
}
