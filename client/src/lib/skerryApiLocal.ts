/**
 * Local auth fallback for when server is unavailable
 * Provides direct login without server dependency
 */

export type UserRole = "user" | "developer";
export type AccountTier = "solo" | "team" | "agency";

export interface AuthUser {
  name: string;
  email: string;
  role: UserRole;
  tier: AccountTier;
}

interface AuthResponse {
  ok: boolean;
  user?: AuthUser;
  csrfToken?: string;
  error?: string;
}

// EXCLUSIVE DEVELOPER ACCOUNT - Only Connor has access
const DEVELOPER_ACCOUNT = {
  email: "connor@skerry.dev",
  password: "SkerryDev2024!LockIn",
  user: {
    name: "Connor (Developer)",
    email: "connor@skerry.dev",
    role: "developer" as UserRole,
    tier: "agency" as AccountTier,
  },
};

// Demo accounts for testing
const DEMO_ACCOUNTS = {
  "solo@skerry.io": {
    password: "solo123",
    user: {
      name: "Solo User",
      email: "solo@skerry.io",
      role: "user" as UserRole,
      tier: "solo" as AccountTier,
    },
  },
  "team@skerry.io": {
    password: "team123",
    user: {
      name: "Team User",
      email: "team@skerry.io",
      role: "user" as UserRole,
      tier: "team" as AccountTier,
    },
  },
  "agency@skerry.io": {
    password: "agency123",
    user: {
      name: "Agency User",
      email: "agency@skerry.io",
      role: "user" as UserRole,
      tier: "agency" as AccountTier,
    },
  },
};

export async function authLoginLocal(
  email: string,
  password: string
): Promise<AuthResponse> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));

  // Check for exclusive developer account
  if (email === DEVELOPER_ACCOUNT.email && password === DEVELOPER_ACCOUNT.password) {
    return {
      ok: true,
      user: DEVELOPER_ACCOUNT.user,
      csrfToken: "local-csrf-token",
    };
  }

  // Check demo accounts
  const demoAccount = DEMO_ACCOUNTS[email as keyof typeof DEMO_ACCOUNTS];
  if (demoAccount && demoAccount.password === password) {
    return {
      ok: true,
      user: demoAccount.user,
      csrfToken: "local-csrf-token",
    };
  }

  return {
    ok: false,
    error: "Invalid email or password",
  };
}

export async function authSessionLocal(): Promise<AuthResponse> {
  // In local mode, no persistent session without server
  return {
    ok: false,
    error: "No active session",
  };
}

export async function authLogoutLocal(): Promise<{ ok: boolean }> {
  return { ok: true };
}
