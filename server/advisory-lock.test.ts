/**
 * Advisory Lock Test - Proves that two parallel workers don't double execute
 * 
 * This test verifies that Supabase Advisory Locks work correctly to prevent
 * concurrent execution of background jobs across multiple worker instances.
 *
 * Test strategy:
 * 1. Create a test PostgreSQL database connection
 * 2. Simulate two concurrent "workers" trying to acquire the same advisory lock
 * 3. Prove that only one can acquire it at a time
 * 4. Verify that the second worker skips execution
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { Pool, type PoolClient } from "pg";

// Advisory Lock IDs (must match those in the job files)
const SEQUENCE_RUNNER_LOCK_ID = 123456789;
const GDPR_PROCESSOR_LOCK_ID = 987654321;

// Test database connection
const TEST_DB_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

if (!TEST_DB_URL) {
  console.warn("TEST_DATABASE_URL or DATABASE_URL not set, tests will be skipped");
}

describe("Supabase Advisory Lock - Prevent Double Execution", () => {
  let pool: Pool | null = null;
  let executionCount: number;
  let lockResults: boolean[];

  beforeAll(() => {
    if (TEST_DB_URL) {
      pool = new Pool({ connectionString: TEST_DB_URL });
    }
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  beforeEach(() => {
    executionCount = 0;
    lockResults = [];
  });

  /**
   * Simulate a worker trying to acquire the advisory lock and execute a job
   */
  async function simulateWorker(
    client: PoolClient,
    lockId: number,
    workerName: string
  ): Promise<{ acquired: boolean; executed: boolean }> {
    // Try to acquire the advisory lock
    const result = await client.query(
      "SELECT pg_try_advisory_lock($1) as acquired",
      [lockId]
    );
    const acquired = result.rows[0]?.acquired ?? false;
    lockResults.push(acquired);

    if (acquired) {
      // Simulate job execution
      executionCount++;
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Release the lock
      await client.query("SELECT pg_advisory_unlock($1)", [lockId]);
      
      return { acquired: true, executed: true };
    } else {
      // Lock not acquired, skip execution
      return { acquired: false, executed: false };
    }
  }

  it("should allow only one worker to acquire the advisory lock at a time", async () => {
    if (!pool) {
      console.warn("Skipping test - no database connection");
      return;
    }

    const client1 = await pool.connect();
    const client2 = await pool.connect();

    try {
      // Both workers try to acquire the same lock simultaneously
      const [result1, result2] = await Promise.all([
        simulateWorker(client1, SEQUENCE_RUNNER_LOCK_ID, "worker-1"),
        simulateWorker(client2, SEQUENCE_RUNNER_LOCK_ID, "worker-2"),
      ]);

      // Only one should have acquired the lock
      expect(result1.acquired !== result2.acquired).toBe(true);
      
      // Only one should have executed the job
      expect(executionCount).toBe(1);
      
      // Verify lock results
      expect(lockResults.filter(r => r === true)).toHaveLength(1);
      expect(lockResults.filter(r => r === false)).toHaveLength(1);
    } finally {
      client1.release();
      client2.release();
    }
  });

  it("should allow the second worker to acquire lock after first releases", async () => {
    if (!pool) {
      console.warn("Skipping test - no database connection");
      return;
    }

    const client1 = await pool.connect();
    const client2 = await pool.connect();

    try {
      // First worker acquires and releases lock
      const result1 = await simulateWorker(client1, SEQUENCE_RUNNER_LOCK_ID, "worker-1");
      expect(result1.acquired).toBe(true);
      expect(result1.executed).toBe(true);
      expect(executionCount).toBe(1);

      // Second worker should now be able to acquire the lock
      const result2 = await simulateWorker(client2, SEQUENCE_RUNNER_LOCK_ID, "worker-2");
      expect(result2.acquired).toBe(true);
      expect(result2.executed).toBe(true);
      expect(executionCount).toBe(2);
    } finally {
      client1.release();
      client2.release();
    }
  });

  it("should work correctly with different lock IDs for different job types", async () => {
    if (!pool) {
      console.warn("Skipping test - no database connection");
      return;
    }

    const client = await pool.connect();
    executionCount = 0;

    try {
      // Acquire sequence runner lock
      const result1 = await simulateWorker(client, SEQUENCE_RUNNER_LOCK_ID, "worker-seq");
      expect(result1.acquired).toBe(true);
      expect(result1.executed).toBe(true);

      // Release sequence runner lock
      await client.query("SELECT pg_advisory_unlock($1)", [SEQUENCE_RUNNER_LOCK_ID]);

      // Acquire GDPR processor lock (different lock ID)
      const result2 = await simulateWorker(client, GDPR_PROCESSOR_LOCK_ID, "worker-gdpr");
      expect(result2.acquired).toBe(true);
      expect(result2.executed).toBe(true);

      // Both jobs should have executed
      expect(executionCount).toBe(2);
    } finally {
      // Clean up locks
      await client.query("SELECT pg_advisory_unlock($1)", [SEQUENCE_RUNNER_LOCK_ID]).catch(() => {});
      await client.query("SELECT pg_advisory_unlock($1)", [GDPR_PROCESSOR_LOCK_ID]).catch(() => {});
      client.release();
    }
  });

  it("should handle concurrent workers with rapid successive attempts", async () => {
    if (!pool) {
      console.warn("Skipping test - no database connection");
      return;
    }

    // Create multiple clients to simulate multiple workers
    const clients = await Promise.all(
      Array.from({ length: 5 }, () => pool!.connect())
    );

    try {
      executionCount = 0;
      lockResults = [];

      // All workers try to acquire the lock at the same time
      const results = await Promise.all(
        clients.map((client, i) => 
          simulateWorker(client, SEQUENCE_RUNNER_LOCK_ID, `worker-${i + 1}`)
        )
      );

      // Only one should have acquired the lock
      const acquiredCount = results.filter(r => r.acquired).length;
      expect(acquiredCount).toBe(1);

      // Only one should have executed
      expect(executionCount).toBe(1);

      // The rest should have been skipped
      const skippedCount = results.filter(r => !r.acquired && !r.executed).length;
      expect(skippedCount).toBe(4);
    } finally {
      await Promise.all(clients.map(client => client.release()));
    }
  });

  it("should verify idempotency key prevents duplicate operations", async () => {
    if (!pool) {
      console.warn("Skipping test - no database connection");
      return;
    }

    const client = await pool.connect();
    const IDEMPOTENCY_TABLE = "job_idempotency_test";

    try {
      // Create test idempotency table
      await client.query(`
        DROP TABLE IF EXISTS ${IDEMPOTENCY_TABLE};
        CREATE TABLE ${IDEMPOTENCY_TABLE} (
          idempotency_key TEXT PRIMARY KEY,
          job_type TEXT NOT NULL,
          workspace_id TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          expires_at TIMESTAMPTZ NOT NULL
        )
      `);

      const testKey = "test_idempotency_key_123";
      const jobType = "test_job";
      const workspaceId = "workspace-123";

      // First attempt should succeed (insert)
      const result1 = await client.query(
        `INSERT INTO ${IDEMPOTENCY_TABLE} (idempotency_key, job_type, workspace_id, expires_at)
         VALUES ($1, $2, $3, now() + interval '1 hour')
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING idempotency_key`,
        [testKey, jobType, workspaceId]
      );

      expect(result1.rowCount).toBe(1); // Inserted

      // Second attempt with same key should be idempotent (no insert)
      const result2 = await client.query(
        `INSERT INTO ${IDEMPOTENCY_TABLE} (idempotency_key, job_type, workspace_id, expires_at)
         VALUES ($1, $2, $3, now() + interval '1 hour')
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING idempotency_key`,
        [testKey, jobType, workspaceId]
      );

      expect(result2.rowCount).toBe(0); // Not inserted, idempotent

      // Verify only one record exists
      const countResult = await client.query(
        `SELECT COUNT(*) as count FROM ${IDEMPOTENCY_TABLE} WHERE idempotency_key = $1`,
        [testKey]
      );
      expect(Number(countResult.rows[0].count)).toBe(1);
    } finally {
      // Clean up
      await client.query(`DROP TABLE IF EXISTS ${IDEMPOTENCY_TABLE}`).catch(() => {});
      client.release();
    }
  });

  it("should simulate the actual sequenceRunner with advisory lock", async () => {
    if (!pool) {
      console.warn("Skipping test - no database connection");
      return;
    }

    const client1 = await pool.connect();
    const client2 = await pool.connect();

    try {
      // Simulate two workers calling runSequenceProcessor simultaneously
      const worker1Result = await runJobWithLock(client1, SEQUENCE_RUNNER_LOCK_ID, "worker-1");
      const worker2Result = await runJobWithLock(client2, SEQUENCE_RUNNER_LOCK_ID, "worker-2");

      // Only one should have actually run the job
      expect(worker1Result.executed !== worker2Result.executed).toBe(true);
      
      // Total executions should be 1
      expect(worker1Result.executed || worker2Result.executed).toBe(true);
    } finally {
      client1.release();
      client2.release();
    }
  });

  /**
   * Helper: Simulate the actual job execution with advisory lock
   */
  async function runJobWithLock(
    client: PoolClient,
    lockId: number,
    workerName: string
  ): Promise<{ acquired: boolean; executed: boolean }> {
    // Try to acquire advisory lock
    const lockResult = await client.query(
      "SELECT pg_try_advisory_lock($1) as acquired",
      [lockId]
    );
    const acquired = lockResult.rows[0]?.acquired ?? false;

    if (!acquired) {
      return { acquired: false, executed: false };
    }

    try {
      // Simulate job execution (e.g., runSequenceProcessor logic)
      // In reality, this would call the actual job function
      const jobResult = await simulateJobExecution(workerName);
      
      return { acquired: true, executed: jobResult };
    } finally {
      // Always release the lock
      await client.query("SELECT pg_advisory_unlock($1)", [lockId]).catch(() => {});
    }
  }

  /**
   * Simulate job execution
   */
  async function simulateJobExecution(workerName: string): Promise<boolean> {
    // Simulate some async work
    await new Promise(resolve => setTimeout(resolve, 50));
    executionCount++;
    return true;
  }
});

describe("Idempotency Key Tests", () => {
  it("should demonstrate idempotency key pattern for email sends", async () => {
    if (!pool) {
      console.warn("Skipping test - no database connection");
      return;
    }

    const client = await pool.connect();
    const testTable = "email_sends_idempotency_test";

    try {
      // Create test table with idempotency key
      await client.query(`
        DROP TABLE IF EXISTS ${testTable};
        CREATE TABLE ${testTable} (
          id SERIAL PRIMARY KEY,
          lead_id TEXT NOT NULL,
          sequence_enrollment_id TEXT,
          idempotency_key TEXT UNIQUE,
          status TEXT,
          sent_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `);

      const idempotencyKey = `seq_enroll_123_step_1_2026-05-08`;
      const leadId = "lead-123";
      const enrollmentId = "enrollment-123";

      // First send attempt
      const result1 = await client.query(
        `INSERT INTO ${testTable} (lead_id, sequence_enrollment_id, idempotency_key, status, sent_at)
         VALUES ($1, $2, $3, 'sent', now())
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING id`,
        [leadId, enrollmentId, idempotencyKey]
      );

      expect(result1.rowCount).toBe(1); // Inserted

      // Second send attempt with same idempotency key (should be idempotent)
      const result2 = await client.query(
        `INSERT INTO ${testTable} (lead_id, sequence_enrollment_id, idempotency_key, status, sent_at)
         VALUES ($1, $2, $3, 'sent', now())
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING id`,
        [leadId, enrollmentId, idempotencyKey]
      );

      expect(result2.rowCount).toBe(0); // Not inserted, duplicate prevented

      // Verify only one email was "sent"
      const countResult = await client.query(
        `SELECT COUNT(*) as count FROM ${testTable} WHERE idempotency_key = $1`,
        [idempotencyKey]
      );
      expect(Number(countResult.rows[0].count)).toBe(1);
    } finally {
      await client.query(`DROP TABLE IF EXISTS ${testTable}`).catch(() => {});
      client.release();
    }
  });
});
