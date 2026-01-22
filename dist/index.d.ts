import { FastMCP } from 'fastmcp';

/**
 * Zoho Bookkeeper MCP Server
 *
 * A Model Context Protocol server for Zoho Books integration with proper
 * multipart file upload support for attachments.
 */

declare const server: FastMCP<Record<string, unknown> | undefined>;

export { server as default };
