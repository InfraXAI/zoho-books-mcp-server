#!/usr/bin/env node
/**
 * CLI entry point for Zoho Bookkeeper MCP Server (stdio transport)
 */

import server from "./index.js"

server.start({
  transportType: "stdio",
})
