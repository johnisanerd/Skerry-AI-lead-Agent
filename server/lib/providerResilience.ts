/**
 * Provider Resilience Module
 * 
 * Combines:
 * - Retry with exponential backoff
 * - Circuit breaker pattern
 * - Timeout handling
 * - Graceful degradation
 * 
 * Usage:
 *   const result = await withResilience(() => callApollo(params), { provider: 'apollo' })
 */

import { CircuitBreaker, circuitBreakers } from "./circuitBreaker.js";
import { logEvent } from "./logger.js";

export interface ResilienceOptions {
  /** Provider name for circuit breaker identification */
  provider: string;
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay for exponential backoff in ms (default: 1000) */
  baseDelayMs?: number;
  /** Max delay cap in ms (default: 30000) */
  maxDelayMs?: number;
  /** Request timeout in ms (default: 30000) */
  timeoutMs?: number;
  /** Circuit breaker failure threshold (default: 5) */
  failureThreshold?: number;
  /** Circuit breaker reset timeout in ms (default: 60000) */
  resetTimeoutMs?: number;
  /** Request ID for tracing */
  requestId?: string;
  /** Whether to throw on final failure (default: true) or return null */
  throwOnError?: boolean;
}

const DEFAULT_OPTIONS: Required<Omit<ResilienceOptions, "provider" | "requestId">> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  timeoutMs: 30000,
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  throwOnError: true,
};

/**
 * Calculate exponential backoff delay with jitter
 */
function getRetryDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exponentialDelay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
  // Add 20% jitter to prevent thundering herd
  const jitter = exponentialDelay * 0.2 * Math.random();
  return exponentialDelay + jitter;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable
 */
function isRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    // Network errors
    if (err.name === "AbortError" || err.name === "TimeoutError") return true;
    if (err.message.includes("timeout")) return true;
    if (err.message.includes("ECONNREFUSED")) return true;
    if (err.message.includes("ECONNRESET")) return true;
    if (err.message.includes("ETIMEDOUT")) return true;
    
    // HTTP status-based (will be checked separately)
  }
  
  // Check for circuit open error
  if ((err as any)?.code === "CIRCUIT_OPEN") return false; // Don't retry circuit open
  
  return false;
}

/**
 * Check if HTTP response is retryable
 */
function isRetryableResponse(status: number): boolean {
  // 429 = rate limit, 500+ = server errors
  return status === 429 || status >= 500;
}

/**
 * Wrap a fetch call with resilience
 */
export async function fetchWithResilience(
  url: string,
  init: RequestInit,
  options: ResilienceOptions
): Promise<Response> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const breaker = circuitBreakers.getOrCreate(opts.provider, {
    failureThreshold: opts.failureThreshold,
    resetTimeoutMs: opts.resetTimeoutMs,
    timeoutMs: opts.timeoutMs,
    name: opts.provider,
  });

  return breaker.execute(async () => {
    let lastResponse: Response | null = null;
    
    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), opts.timeoutMs);
      
      try {
        const resp = await fetch(url, {
          ...init,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        
        // If response is ok, return it
        if (resp.ok) return resp;
        
        // If retryable status, retry
        if (isRetryableResponse(resp.status) && attempt < opts.maxRetries) {
          lastResponse = resp;
          const delay = getRetryDelay(attempt, opts.baseDelayMs, opts.maxDelayMs);
          
          logEvent("warn", "provider_retry", {
            requestId: opts.requestId,
            provider: opts.provider,
            attempt: attempt + 1,
            status: resp.status,
            delayMs: Math.round(delay),
          });
          
          await sleep(delay);
          continue;
        }
        
        // Non-retryable response
        return resp;
      } catch (err) {
        clearTimeout(timeout);
        
        if (attempt < opts.maxRetries && isRetryableError(err)) {
          const delay = getRetryDelay(attempt, opts.baseDelayMs, opts.maxDelayMs);
          
          logEvent("warn", "provider_retry", {
            requestId: opts.requestId,
            provider: opts.provider,
            attempt: attempt + 1,
            error: String(err),
            delayMs: Math.round(delay),
          });
          
          await sleep(delay);
          continue;
        }
        
        throw err;
      }
    }
    
    // This should not be reached, but just in case
    throw new Error(
      `Provider ${opts.provider} request failed after ${opts.maxRetries} retries`
    );
  });
}

/**
 * Wrap any async function with resilience (circuit breaker + retry)
 */
export async function withResilience<T>(
  fn: () => Promise<T>,
  options: ResilienceOptions
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const breaker = circuitBreakers.getOrCreate(opts.provider, {
    failureThreshold: opts.failureThreshold,
    resetTimeoutMs: opts.resetTimeoutMs,
    timeoutMs: opts.timeoutMs,
    name: opts.provider,
  });

  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const result = await breaker.execute(fn);
      return result;
    } catch (err) {
      lastError = err;
      
      // Don't retry if circuit is open
      if ((err as any)?.code === "CIRCUIT_OPEN") {
        logEvent("error", "circuit_open", {
          requestId: opts.requestId,
          provider: opts.provider,
        });
        break;
      }
      
      // Don't retry on last attempt
      if (attempt >= opts.maxRetries) break;
      
      // Check if error is retryable
      if (!isRetryableError(err)) break;
      
      const delay = getRetryDelay(attempt, opts.baseDelayMs, opts.maxDelayMs);
      
      logEvent("warn", "provider_retry", {
        requestId: opts.requestId,
        provider: opts.provider,
        attempt: attempt + 1,
        error: String(err),
        delayMs: Math.round(delay),
      });
      
      await sleep(delay);
    }
  }

  if (opts.throwOnError) {
    throw lastError;
  }
  
  // Return null as T (caller must handle)
  throw lastError;
}

/**
 * Get health status of all providers
 */
export function getProvidersHealth(): Record<string, ReturnType<CircuitBreaker["getMetrics"]>> {
  return circuitBreakers.getAllMetrics();
}

/**
 * Reset circuit breaker for a provider (useful for manual recovery)
 */
export function resetProviderCircuit(provider: string): void {
  circuitBreakers.reset(provider);
}

/**
 * Reset all circuit breakers
 */
export function resetAllCircuits(): void {
  circuitBreakers.resetAll();
}
