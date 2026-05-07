// PipelineEmitter - Event-driven architecture for real-time scraping pipeline updates
// This module provides both server-side EventEmitter and client-side WebSocket/SSE support

type LogType = 'RESEARCH' | 'ANALYTICS' | 'ENRICH' | 'DRAFT' | 'QUEUE' | 'SEND' | 'SYSTEM';

interface PipelineEvent {
  id: string;
  timestamp: number;
  type: LogType;
  message: string;
  data?: unknown;
}

type EventListener = (event: PipelineEvent) => void;

class PipelineEmitter {
  private listeners: Map<LogType | 'ALL', Set<EventListener>> = new Map();
  private events: PipelineEvent[] = [];
  private maxEvents: number = 100;

  constructor() {
    this.listeners.set('ALL', new Set());
  }

  // Subscribe to events
  on(type: LogType | 'ALL', listener: EventListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(type)?.delete(listener);
    };
  }

  // Emit an event
  emit(type: LogType, message: string, data?: unknown): PipelineEvent {
    const event: PipelineEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type,
      message,
      data,
    };

    // Store event
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Notify listeners
    this.listeners.get(type)?.forEach(listener => listener(event));
    this.listeners.get('ALL')?.forEach(listener => listener(event));

    return event;
  }

  // Get recent events
  getEvents(limit: number = 50): PipelineEvent[] {
    return this.events.slice(-limit);
  }

  // Clear all events
  clear(): void {
    this.events = [];
  }

  // Helper methods for specific log types
  research(message: string, data?: unknown): PipelineEvent {
    return this.emit('RESEARCH', message, data);
  }

  analytics(message: string, data?: unknown): PipelineEvent {
    return this.emit('ANALYTICS', message, data);
  }

  enrich(message: string, data?: unknown): PipelineEvent {
    return this.emit('ENRICH', message, data);
  }

  draft(message: string, data?: unknown): PipelineEvent {
    return this.emit('DRAFT', message, data);
  }

  queue(message: string, data?: unknown): PipelineEvent {
    return this.emit('QUEUE', message, data);
  }

  send(message: string, data?: unknown): PipelineEvent {
    return this.emit('SEND', message, data);
  }

  system(message: string, data?: unknown): PipelineEvent {
    return this.emit('SYSTEM', message, data);
  }
}

// Singleton instance for client-side use
export const pipelineEmitter = new PipelineEmitter();

// Hook for React components to subscribe to pipeline events
import { useEffect, useState, useCallback } from 'react';

export function usePipelineEvents() {
  const [events, setEvents] = useState<PipelineEvent[]>([]);

  useEffect(() => {
    const unsubscribe = pipelineEmitter.on('ALL', (event) => {
      setEvents(prev => [...prev.slice(-49), event]);
    });
    return unsubscribe;
  }, []);

  const clearEvents = useCallback(() => {
    pipelineEmitter.clear();
    setEvents([]);
  }, []);

  return { events, clearEvents, emitter: pipelineEmitter };
}

export type { PipelineEvent, LogType };
export default PipelineEmitter;
