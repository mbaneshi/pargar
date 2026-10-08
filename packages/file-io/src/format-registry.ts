import { FileFormatRegistry } from './FileFormatRegistry.js';
import { dxfAdapter } from './dxf-adapter.js';
import { pdfAdapter } from './pdf-adapter.js';
import { svgAdapter } from './svg-adapter.js';

export const formatRegistry = new FileFormatRegistry();
formatRegistry.register(dxfAdapter);
formatRegistry.register(pdfAdapter);
formatRegistry.register(svgAdapter);
