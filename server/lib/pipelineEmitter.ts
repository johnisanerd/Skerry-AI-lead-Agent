/**
 * Server-side PipelineEmitter for event-driven architecture
 * Broadcasts scraping pipeline events to connected clients via WebSocket
 */

import { EventEmitter } from "node:events";

export type ServerLogType = 'RESEARCH' | 'ANALYTICS' | 'ENRICH' | 'DRAFT' | 'QUEUE' | 'SEND' | 'SYSTEM';

export interface ServerPipelineEvent {
  id: string;
  timestamp: number;
  type: ServerLogType;
  message: string;
  workspaceId?: string;
  data?: unknown;
}

export class ServerPipelineEmitter extends EventEmitter {
  private events: Map<string, ServerPipelineEvent[]> = new Map();
  private maxEventsPerWorkspace: number = 100;

  // Emit an event and store for polling
  emitEvent(type: ServerLogType, message: string, workspaceId?: string, data?: unknown): ServerPipelineEvent {
    const event: ServerPipelineEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type,
      message,
      workspaceId,
      data,
    };

    // Store event for polling
    if (workspaceId) {
      const workspaceEvents = this.events.get(workspaceId) || [];
      workspaceEvents.push(event);
      if (workspaceEvents.length > this.maxEventsPerWorkspace) {
        workspaceEvents.shift();
      }
      this.events.set(workspaceId, workspaceEvents);
    }

    // Emit to local listeners
    this.emit('pipeline-event', event);
    if (workspaceId) {
      this.emit(`workspace-${workspaceId}`, event);
    }

    return event;
  }

  // Get events for a workspace
  getEvents(workspaceId: string, limit: number = 50): ServerPipelineEvent[] {
    const events = this.events.get(workspaceId) || [];
    return events.slice(-limit);
  }

  // Clear events for a workspace
  clearEvents(workspaceId: string): void {
    this.events.delete(workspaceId);
  }

  // Helper methods for specific log types
  research(message: string, workspaceId?: string, data?: unknown): ServerPipelineEvent {
    return this.emitEvent('RESEARCH', message, workspaceId, data);
  }

  analytics(message: string, workspaceId?: string, data?: unknown): ServerPipelineEvent {
    return this.emitEvent('ANALYTICS', message, workspaceId, data);
  }

  enrich(message: string, workspaceId?: string, data?: unknown): ServerPipelineEvent {
    return this.emitEvent('ENRICH', message, workspaceId, data);
  }

  draft(message: string, workspaceId?: string, data?: unknown): ServerPipelineEvent {
    return this.emitEvent('DRAFT', message, workspaceId, data);
  }

  queue(message: string, workspaceId?: string, data?: unknown): ServerPipelineEvent {
    return this.emitEvent('QUEUE', message, workspaceId, data);
  }

  send(message: string, workspaceId?: string, data?: unknown): ServerPipelineEvent {
    return this.emitEvent('SEND', message, workspaceId, data);
  }

  system(message: string, workspaceId?: string, data?: unknown): ServerPipelineEvent {
    return this.emitEvent('SYSTEM', message, workspaceId, data);
  }
}

// Singleton instance
export const serverPipelineEmitter = new ServerPipelineEmitter();
