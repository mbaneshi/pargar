export interface FileEntity {
  id: string;
  geometry: Record<string, unknown>;
  layer_id: string;
  layer?: string;
  color?: string;
  linetype?: string;
  style?: Record<string, unknown>;
}

export interface FileLayer {
  id: string;
  name?: string;
  color?: string;
  visible?: boolean;
  locked?: boolean;
  linetype?: string;
}

export interface ImportResult {
  entities: FileEntity[];
  layers: FileLayer[];
}

export type ExportOutput = string | Uint8Array | ArrayBuffer;

export interface FileFormatAdapter {
  readonly id: string;
  readonly name: string;
  readonly extensions: string[];
  readonly mimeType: string;
  readonly capabilities: {
    readonly import: boolean;
    readonly export: boolean;
  };
  import?(content: string): ImportResult;
  export?(
    entities: FileEntity[],
    layers: FileLayer[],
    options?: Record<string, unknown>,
  ): ExportOutput;
}
