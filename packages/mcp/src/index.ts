#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createKernel } from './kernel-bridge.js';
import { startBridge } from './bridge.js';
import { createMcpServer } from './server.js';

async function main() {
  const kernel = await createKernel();
  const bridge = startBridge(kernel);
  const server = createMcpServer(kernel, bridge);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('NEXUS MCP server failed to start:', err);
  process.exit(1);
});
