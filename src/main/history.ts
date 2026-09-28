import type { InvocationRecord } from '../shared/contracts';

export class InvocationHistory {
  private readonly records: InvocationRecord[] = [];

  add(record: InvocationRecord): void {
    this.records.unshift(record);
    this.records.splice(20);
  }

  recent(): InvocationRecord[] {
    return this.records.map((record) => ({ ...record }));
  }
}
