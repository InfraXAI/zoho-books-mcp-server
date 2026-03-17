import {
  src_default
} from "./chunk-I6MJYAFY.js";
import {
  getServerConfig
} from "./chunk-56R5MHE5.js";

// src/server.ts
var config = getServerConfig();
src_default.start({
  transportType: "httpStream",
  httpStream: {
    port: config.port,
    host: config.host
  }
});
console.log(`Zoho Bookkeeper MCP Server running on http://${config.host}:${config.port}`);
console.log(`Health check: http://${config.host}:${config.port}/health`);
console.log(`MCP endpoint: http://${config.host}:${config.port}/mcp`);
