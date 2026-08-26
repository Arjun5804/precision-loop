import { ScheduledEvent } from './types.js';
import { DuplicateEventIdError } from './errors.js';

interface QueueNode {
  event: ScheduledEvent;
  sequenceId: number;
}

export class EventQueue {
  private nodes: QueueNode[] = [];
  private eventIds = new Set<string>();
  private nextSequenceId = 0;

  add(event: ScheduledEvent): void {
    if (this.eventIds.has(event.id)) {
      throw new DuplicateEventIdError(event.id);
    }

    const node: QueueNode = {
      event,
      sequenceId: this.nextSequenceId++
    };

    this.nodes.push(node);
    this.eventIds.add(event.id);

    // Keep sorted by time ascending, then by sequenceId ascending
    this.nodes.sort((a, b) => {
      if (a.event.time !== b.event.time) {
        return a.event.time - b.event.time;
      }
      return a.sequenceId - b.sequenceId;
    });
  }

  remove(eventId: string): boolean {
    if (!this.eventIds.has(eventId)) {
      return false;
    }

    const index = this.nodes.findIndex(n => n.event.id === eventId);
    if (index !== -1) {
      this.nodes.splice(index, 1);
      this.eventIds.delete(eventId);
      return true;
    }
    return false;
  }

  removeWhere(predicate: (event: ScheduledEvent) => boolean): void {
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      if (predicate(this.nodes[i].event)) {
        this.eventIds.delete(this.nodes[i].event.id);
        this.nodes.splice(i, 1);
      }
    }
  }

  removeAll(): void {
    this.nodes = [];
    this.eventIds.clear();
  }

  peek(): ScheduledEvent | undefined {
    return this.nodes.length > 0 ? this.nodes[0].event : undefined;
  }

  pop(): ScheduledEvent | undefined {
    if (this.nodes.length === 0) {
      return undefined;
    }
    const node = this.nodes.shift()!;
    this.eventIds.delete(node.event.id);
    return node.event;
  }
  
  get pendingCount(): number {
    return this.nodes.length;
  }
  
  has(eventId: string): boolean {
    return this.eventIds.has(eventId);
  }
}
