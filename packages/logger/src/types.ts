export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFormat = 'pretty' | 'json';

export interface LogEntry {
  ts: string;
  level: LogLevel;
  ns: string;
  msg: string;
  [key: string]: unknown;
}

export interface Transport {
  name: string;
  log(entry: LogEntry): void;
  flush?(): void;
}

export interface LoggerConfig {
  level: LogLevel;
  format: LogFormat;
  targets: string[];
  filter: string;
  buffer: boolean;
}
