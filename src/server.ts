/**
 * HTTP server entry point for Zoho Bookkeeper MCP Server
 */

import server from "./index.js"
import { getServerConfig } from "./config.js"

const config = getServerConfig()

server.start({
  transportType: "httpStream",
  httpStream: {
    port: config.port,
    host: config.host,
  },
})

console.log(`Zoho Bookkeeper MCP Server running on http://${config.host}:${config.port}`)
console.log(`Health check: http://${config.host}:${config.port}/health`)
console.log(`MCP endpoint: http://${config.host}:${config.port}/mcp`)
