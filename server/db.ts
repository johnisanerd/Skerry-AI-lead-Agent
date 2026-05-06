import { Pool, type PoolClient } from "pg";

type AccountTier = "solo" | "team" | "agency";

export interface UsageSnapshot {
  runsUsed: number;
}

export interface EntitlementLimits {
  leads: number;
  exports: number;
  sends: number;
  apiCalls: number;
}

export interface EntitlementUsage {
  leads: number;
  exports: number;
  sends: number;
  apiCalls: number;
}

interface DbConfig {
  databaseUrl: string | undefined;
}

function poolSsl(): false | { rejectUnauthorized: boolean } {
  if (process.env.NODE_ENV !== "production") return false;
  return {
    rejectUnauthorized:
      process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
  };
}

export class EntitlementDb {
  private readonly pool: Pool | null;

  constructor(config: DbConfig) {
    this.pool = config.databaseUrl
      ? new Pool({
          connectionString: config.databaseUrl,
          ssl: poolSsl(),
        })
      : null;
  }

  get isConfigured(): boolean {
    return this.pool !== null;
  }

  /** Throws if pool is missing or `select 1` fails. */
  async ping(): Promise<void> {
    if (!this.pool) throw new Error("database not configured");
    await this.pool.query("select 1 as ok");
  }

  async init(): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(`
      create table if not exists entitlement_usage (
        email text not null,
        usage_month text not null,
        tier text not null,
        runs_used integer not null default 0,
        updated_at timestamptz not null default now(),
        primary key (email, usage_month)
      )
    `);
    await this.pool.query(`
      create table if not exists workspace_entitlements (
        workspace_id text not null,
        usage_month text not null,
        tier text not null,
        leads integer not null default 0,
        exports integer not null default 0,
        sends integer not null default 0,
        api_calls integer not null default 0,
        updated_at timestamptz not null default now(),
        primary key (workspace_id, usage_month)
      )
    `);
    await this.pool.query(`
      create table if not exists webhook_events (
        id uuid primary key default gen_random_uuid(),
        stripe_event_id text not null,
        workspace_id text not null,
        event_type text not null,
        processed_at timestamptz not null default now(),
        payload jsonb,
        unique (stripe_event_id, workspace_id)
      )
    `);
  }

  async getWorkspaceUsage(workspaceId: string, usageMonth: string): Promise<EntitlementUsage> {
    if (!this.pool) return { leads: 0, exports: 0, sends: 0, apiCalls: 0 };
    const result = await this.pool.query<{
      leads: number;
      exports: number;
      sends: number;
      api_calls: number;
    }>(
      `
        select leads, exports, sends, api_calls
        from workspace_entitlements
        where workspace_id = $1 and usage_month = $2
      `,
      [workspaceId, usageMonth]
    );
    const row = result.rows[0];
    return {
      leads: row?.leads ?? 0,
      exports: row?.exports ?? 0,
      sends: row?.sends ?? 0,
      apiCalls: row?.api_calls ?? 0,
    };
  }

  async consumeWorkspaceEntitlement(params: {
    workspaceId: string;
    tier: AccountTier;
    usageMonth: string;
    feature: keyof EntitlementUsage;
    limits: EntitlementLimits;
  }): Promise<{ allowed: boolean; usage: EntitlementUsage }> {
    if (!this.pool) return { allowed: false, usage: { leads: 0, exports: 0, sends: 0, apiCalls: 0 } };
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const current = await this.ensureWorkspaceRowForUpdate(client, params.workspaceId, params.tier, params.usageMonth);
      const limit = params.limits[params.feature];
      if (limit !== -1 && current[params.feature] >= limit) {
        await client.query("rollback");
        return { allowed: false, usage: current };
      }
      const next = { ...current };
      next[params.feature] += 1;
      await client.query(
        `
          update workspace_entitlements
          set leads = $3, exports = $4, sends = $5, api_calls = $6, tier = $7, updated_at = now()
          where workspace_id = $1 and usage_month = $2
        `,
        [params.workspaceId, params.usageMonth, next.leads, next.exports, next.sends, next.apiCalls, params.tier]
      );
      await client.query("commit");
      return { allowed: true, usage: next };
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
  }

  async consumeWorkspaceEntitlements(params: {
    workspaceId: string;
    tier: AccountTier;
    usageMonth: string;
    feature: keyof EntitlementUsage;
    amount: number;
    limits: EntitlementLimits;
  }): Promise<{ allowed: boolean; usage: EntitlementUsage }> {
    if (!this.pool) return { allowed: false, usage: { leads: 0, exports: 0, sends: 0, apiCalls: 0 } };
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const current = await this.ensureWorkspaceRowForUpdate(client, params.workspaceId, params.tier, params.usageMonth);
      const limit = params.limits[params.feature];
      if (limit !== -1 && current[params.feature] + params.amount > limit) {
        await client.query("rollback");
        return { allowed: false, usage: current };
      }
      const next = { ...current };
      next[params.feature] += params.amount;
      await client.query(
        `
          update workspace_entitlements
          set leads = $3, exports = $4, sends = $5, api_calls = $6, tier = $7, updated_at = now()
          where workspace_id = $1 and usage_month = $2
        `,
        [params.workspaceId, params.usageMonth, next.leads, next.exports, next.sends, next.apiCalls, params.tier]
      );
      await client.query("commit");
      return { allowed: true, usage: next };
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
  }

  async isWebhookProcessed(stripeEventId: string, workspaceId: string): Promise<boolean> {
    if (!this.pool) return false;
    const result = await this.pool.query(`select 1 from webhook_events where stripe_event_id = $1 and workspace_id = $2`, [stripeEventId, workspaceId]);
    return result.rows.length > 0;
  }

  async recordWebhookProcessed(stripeEventId: string, workspaceId: string, eventType: string, payload: any): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `insert into webhook_events (stripe_event_id, workspace_id, event_type, payload) values ($1, $2, $3, $4) on conflict (stripe_event_id, workspace_id) do nothing`,
      [stripeEventId, workspaceId, eventType, JSON.stringify(payload)]
    );
  }

  async consumeRun(params: {
    email: string;
    tier: AccountTier;
    usageMonth: string;
    monthlyRunsLimit: number;
  }): Promise<{ allowed: boolean; runsUsed: number }> {
    if (!this.pool) return { allowed: false, runsUsed: 0 };
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const current = await this.ensureRowForUpdate(
        client,
        params.email,
        params.tier,
        params.usageMonth
      );
      if (current >= params.monthlyRunsLimit) {
        await client.query("rollback");
        return { allowed: false, runsUsed: current };
      }
      const next = current + 1;
      await client.query(
        `
          update entitlement_usage
          set runs_used = $4, tier = $3, updated_at = now()
          where email = $1 and usage_month = $2
        `,
        [params.email, params.usageMonth, params.tier, next]
      );
      await client.query("commit");
      return { allowed: true, runsUsed: next };
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
  }

  private async ensureWorkspaceRowForUpdate(
    client: PoolClient,
    workspaceId: string,
    tier: AccountTier,
    usageMonth: string
  ): Promise<EntitlementUsage> {
    const existing = await client.query<{
      leads: number;
      exports: number;
      sends: number;
      api_calls: number;
    }>(
      `
        select leads, exports, sends, api_calls
        from workspace_entitlements
        where workspace_id = $1 and usage_month = $2
        for update
      `,
      [workspaceId, usageMonth]
    );
    if (existing.rows[0]) {
      return {
        leads: Math.max(0, existing.rows[0].leads),
        exports: Math.max(0, existing.rows[0].exports),
        sends: Math.max(0, existing.rows[0].sends),
        apiCalls: Math.max(0, existing.rows[0].api_calls),
      };
    }

    await client.query(
      `
        insert into workspace_entitlements (workspace_id, usage_month, tier, leads, exports, sends, api_calls)
        values ($1, $2, $3, 0, 0, 0, 0)
        on conflict (workspace_id, usage_month) do nothing
      `,
      [workspaceId, usageMonth, tier]
    );

    const afterInsert = await client.query<{
      leads: number;
      exports: number;
      sends: number;
      api_calls: number;
    }>(
      `
        select leads, exports, sends, api_calls
        from workspace_entitlements
        where workspace_id = $1 and usage_month = $2
        for update
      `,
      [workspaceId, usageMonth]
    );
    const row = afterInsert.rows[0];
    return {
      leads: Math.max(0, row?.leads ?? 0),
      exports: Math.max(0, row?.exports ?? 0),
      sends: Math.max(0, row?.sends ?? 0),
      apiCalls: Math.max(0, row?.api_calls ?? 0),
    };
  }

  private async ensureRowForUpdate(
    client: PoolClient,
    email: string,
    tier: AccountTier,
    usageMonth: string
  ): Promise<number> {
    const existing = await client.query<{ runs_used: number }>(
      `
        select runs_used
        from entitlement_usage
        where email = $1 and usage_month = $2
        for update
      `,
      [email, usageMonth]
    );
    if (existing.rows[0]) {
      return Math.max(0, existing.rows[0].runs_used);
    }

    await client.query(
      `
        insert into entitlement_usage (email, usage_month, tier, runs_used)
        values ($1, $2, $3, 0)
        on conflict (email, usage_month) do nothing
      `,
      [email, usageMonth, tier]
    );

    const afterInsert = await client.query<{ runs_used: number }>(
      `
        select runs_used
        from entitlement_usage
        where email = $1 and usage_month = $2
        for update
      `,
      [email, usageMonth]
    );
    return Math.max(0, afterInsert.rows[0]?.runs_used ?? 0);
  }
}
