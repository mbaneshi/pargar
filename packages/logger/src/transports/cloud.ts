import type { LogEntry, Transport } from '../types';

export class CloudTransport implements Transport {
  name = 'cloud';

  log(_entry: LogEntry): void {
    // Stub — Cloud Logging integration added when backend exists
  }
}
