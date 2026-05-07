/**
 * Circuit Breaker Pattern for Provider Resilience
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit is tripped, requests fail fast
 * - HALF_OPEN: Testing if service has recovered
 * 
 * Features:
 * - Configurable failure threshold
 * - Configurable reset timeout
 * - Success threshold for half-open state
 * - Event emission for state changes
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold: number;
  /** Time in ms to wait before attempting to close circuit (default: 60000 = 1min) */
  resetTimeoutMs: number;
  /** Number of successful requests in HALF_OPEN to close circuit (default: 2) */
  successThreshold: number;
  /** Request timeout in ms (default: 30000 = 30s) */
  timeoutMs: number;
  /** Optional name for logging */
  name?: string;
}

interface CircuitBreakerEvents {
  stateChange: (from: CircuitState, to: CircuitState) => void;
  failure: (error: Error, failures: number) => void;
  success: () => void;
  timeout: () => void;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeoutMs: 60000, // 1 minute
  successThreshold: 2,
  timeoutMs: 30000, // 30 seconds
};

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private successCount = 0;
  private nextAttemptTime = 0;
  private readonly options: CircuitBreakerOptions;
  private listeners: Partial<CircuitBreakerEvents> = {};

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /** Register event listener */
  on<K extends keyof CircuitBreakerEvents>(
    event: K,
    handler: CircuitBreakerEvents[K]
  ): void {
    this.listeners[event] = handler;
  }

  /** Get current state */
  getState(): CircuitState {
    // Check if we should transition from OPEN to HALF_OPEN
    if (this.state === "OPEN" && Date.now() >= this.nextAttemptTime) {
      this.transitionTo("HALF_OPEN");
    }
    return this.state;
  }

  /** Check if the circuit is open (requests should fail fast) */
  isOpen(): boolean {
    return this.getState() === "OPEN";
  }

  /** Execute a function with circuit breaker protection */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === "OPEN") {
      const err = new Error(
        `Circuit breaker '${this.options.name || "unnamed"}' is OPEN`
      );
      (err as any).code = "CIRCUIT_OPEN";
      throw err;
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Request timeout"));
      }, this.options.timeoutMs);
    });

    try {
      // Race between the actual function and timeout
      const result = await Promise.race([fn(), timeoutPromise]);
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure(err as Error);
      throw err;
    }
  }

  private onSuccess(): void {
    if (this.state === "HALF_OPEN") {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        this.transitionTo("CLOSED");
      }
    } else if (this.state === "CLOSED") {
      // Reset failure count on success
      this.failureCount = 0;
    }
    this.listeners.success?.();
  }

  private onFailure(err: Error): void {
    this.failureCount++;

    if (this.state === "HALF_OPEN") {
      // Failed during test, reopen circuit
      this.transitionTo("OPEN");
    } else if (this.state === "CLOSED") {
      if (this.failureCount >= this.options.failureThreshold) {
        this.transitionTo("OPEN");
      }
    }

    this.listeners.failure?.(err, this.failureCount);
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === "OPEN") {
      this.nextAttemptTime = Date.now() + this.options.resetTimeoutMs;
      this.successCount = 0;
    } else if (newState === "CLOSED") {
      this.failureCount = 0;
      this.successCount = 0;
    } else if (newState === "HALF_OPEN") {
      this.successCount = 0;
    }

    this.listeners.stateChange?.(oldState, newState);
  }

  /** Reset the circuit breaker to closed state */
  reset(): void {
    this.transitionTo("CLOSED");
  }

  /** Get metrics for monitoring */
  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttemptTime: this.nextAttemptTime,
      isOpen: this.isOpen(),
    };
  }
}

/**
 * Create a circuit breaker registry to manage multiple providers
 */
export class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  getOrCreate(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const breaker = new CircuitBreaker({ ...options, name });
      this.breakers.set(name, breaker);
    }
    return this.breakers.get(name)!;
  }

  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  getAllMetrics(): Record<string, ReturnType<CircuitBreaker["getMetrics"]>> {
    const result: Record<string, ReturnType<CircuitBreaker["getMetrics"]>> = {};
    for (const [name, breaker] of Array.from(this.breakers.entries())) {
      result[name] = breaker.getMetrics();
    }
    return result;
  }
  
  reset(name: string): void {
    this.breakers.get(name)?.reset();
  }
  
  resetAll(): void {
    for (const breaker of Array.from(this.breakers.values())) {
      breaker.reset();
    }
  }
}

// Global registry instance
export const circuitBreakers = new CircuitBreakerRegistry();
