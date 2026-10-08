interface ImportMeta {
  readonly env: Record<string, unknown>;
}

declare const process: { env: Record<string, string | undefined> } | undefined;
