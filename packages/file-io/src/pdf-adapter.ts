import type { FileFormatAdapter, FileEntity, FileLayer } from '@nexus/core';
import { exportPdf } from './pdf-export.js';

export const pdfAdapter: FileFormatAdapter = {
  id: 'pdf',
  name: 'PDF Document',
  extensions: ['pdf'],
  mimeType: 'application/pdf',
  capabilities: { import: false, export: true },

  export(
    entities: FileEntity[],
    layers: FileLayer[],
    options?: Record<string, unknown>,
  ): Uint8Array {
    return exportPdf(JSON.stringify(entities), JSON.stringify(layers), {
      margin: options?.margin as number | undefined,
      pageWidth: options?.pageWidth as number | undefined,
      pageHeight: options?.pageHeight as number | undefined,
    });
  },
};
