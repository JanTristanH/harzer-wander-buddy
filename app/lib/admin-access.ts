const ROLE_CLAIM_KEYS = [
  'roles',
  'role',
  'permissions',
  'https://harzer-wander-buddy.de/roles',
  'https://app.harzer-wander-buddy.de/roles',
  'https://harzer-wander-buddy.de/claims/roles',
] as const;

const ADMIN_ROLE_TOKENS = ['admin', 'administrator'] as const;

function normalizeRoleToken(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toLocaleLowerCase();
}

function tokenizeRoleString(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return [] as string[];
  }

  const maybeJson = trimmed.startsWith('[') || trimmed.startsWith('{');
  if (maybeJson) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return normalizeRoleTokens(parsed);
    } catch {
      // Ignore invalid JSON and fall back to delimiter splitting below.
    }
  }

  return trimmed
    .split(/[,\s;|]+/g)
    .map((token) => normalizeRoleToken(token))
    .filter(Boolean);
}

export function normalizeRoleTokens(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.flatMap((entry) => normalizeRoleTokens(entry)).filter(Boolean))];
  }

  if (typeof value === 'string') {
    return [...new Set(tokenizeRoleString(value))];
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;

    if (Array.isArray(record.roles)) {
      return normalizeRoleTokens(record.roles);
    }

    if (typeof record.roles === 'string') {
      return normalizeRoleTokens(record.roles);
    }

    return [];
  }

  return [];
}

export function hasAdminRole(roleTokens: string[]) {
  return roleTokens.some((role) => ADMIN_ROLE_TOKENS.includes(role as (typeof ADMIN_ROLE_TOKENS)[number]));
}

export function extractRolesFromClaims(claims: unknown): string[] {
  if (!claims || typeof claims !== 'object') {
    return [];
  }

  const claimRecord = claims as Record<string, unknown>;
  const rolesFromKnownClaims = ROLE_CLAIM_KEYS.flatMap((claimKey) =>
    normalizeRoleTokens(claimRecord[claimKey])
  );
  const keycloakRealmRoles = normalizeRoleTokens(
    (claimRecord.realm_access as { roles?: unknown } | undefined)?.roles
  );
  const dedupedRoles = new Set([...rolesFromKnownClaims, ...keycloakRealmRoles].filter(Boolean));

  return [...dedupedRoles];
}
