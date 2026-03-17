/**
 * Environment configuration for Zoho Bookkeeper MCP Server
 */

// Security constants
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
export const REQUEST_TIMEOUT_MS = 30000 // 30 seconds

export interface OrgAlias {
  alias: string
  orgId: string
}

export interface ZohoConfig {
  clientId: string
  clientSecret: string
  refreshToken: string
  apiUrl: string
  organizationId: string
  orgAliases: OrgAlias[]
}

export interface ServerConfig {
  port: number
  host: string
}

export interface Config {
  zoho: ZohoConfig
  server: ServerConfig
}

/**
 * Get Zoho API configuration from environment variables
 */
export function getZohoConfig(): ZohoConfig {
  const clientId = process.env.ZOHO_CLIENT_ID || ""
  const clientSecret = process.env.ZOHO_CLIENT_SECRET || ""
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN || ""
  const apiUrl = process.env.ZOHO_API_URL || "https://www.zohoapis.in/books/v3"
  const organizationId = process.env.ZOHO_ORGANIZATION_ID || ""

  // Parse org aliases from env: "naturnest:60026116971,infrax:60002170422"
  const orgAliases: OrgAlias[] = []
  const aliasStr = process.env.ZOHO_ORG_ALIASES || ""
  if (aliasStr) {
    aliasStr.split(",").forEach((pair) => {
      const [alias, orgId] = pair.trim().split(":")
      if (alias && orgId) {
        orgAliases.push({ alias: alias.trim().toLowerCase(), orgId: orgId.trim() })
      }
    })
  }

  return {
    clientId,
    clientSecret,
    refreshToken,
    apiUrl,
    organizationId,
    orgAliases,
  }
}

/**
 * Get server configuration from environment variables
 */
export function getServerConfig(): ServerConfig {
  return {
    port: parseInt(process.env.PORT || "8004", 10),
    host: process.env.HOST || "0.0.0.0",
  }
}

/**
 * Get full configuration
 */
export function getConfig(): Config {
  return {
    zoho: getZohoConfig(),
    server: getServerConfig(),
  }
}

/**
 * Validate that required Zoho credentials are configured
 */
export function validateZohoConfig(config: ZohoConfig): { valid: boolean; error?: string } {
  if (!config.clientId) {
    return { valid: false, error: "ZOHO_CLIENT_ID is not configured" }
  }
  if (!config.clientSecret) {
    return { valid: false, error: "ZOHO_CLIENT_SECRET is not configured" }
  }
  if (!config.refreshToken) {
    return { valid: false, error: "ZOHO_REFRESH_TOKEN is not configured" }
  }
  // Security: Enforce HTTPS for API URL
  if (!config.apiUrl.startsWith("https://")) {
    return { valid: false, error: "ZOHO_API_URL must use HTTPS" }
  }
  return { valid: true }
}

// Session-level organization state (survives across tool calls within one MCP session)
let sessionOrgId: string | null = null
const orgNameCache = new Map<string, string>()

/**
 * Set the session-level default organization (used by switch_organization tool)
 */
export function setSessionOrganization(orgId: string, orgName?: string): void {
  sessionOrgId = orgId
  if (orgName) {
    orgNameCache.set(orgId, orgName)
  }
}

/**
 * Get the current effective organization ID (session override > env default)
 */
export function getEffectiveOrgId(): string {
  return sessionOrgId || getZohoConfig().organizationId
}

/**
 * Cache an organization name for display in responses
 */
export function cacheOrgName(orgId: string, name: string): void {
  orgNameCache.set(orgId, name)
}

/**
 * Get cached organization name (or null if not cached)
 */
export function getOrgName(orgId: string): string | null {
  return orgNameCache.get(orgId) || null
}

/**
 * Resolve an alias or numeric org ID to the actual org ID
 * Supports: numeric IDs, aliases from ZOHO_ORG_ALIASES, or returns as-is
 */
export function resolveOrgAlias(input: string): string {
  const config = getZohoConfig()
  const lower = input.toLowerCase().trim()

  // Check aliases first
  const match = config.orgAliases.find((a) => a.alias === lower)
  if (match) return match.orgId

  // Return as-is (numeric org ID)
  return input
}

/**
 * Get all configured org aliases for display
 */
export function getOrgAliases(): OrgAlias[] {
  return getZohoConfig().orgAliases
}

/**
 * Get Zoho OAuth token URL based on the API URL region
 */
export function getZohoOAuthUrl(apiUrl: string): string {
  // Map API URLs to their corresponding OAuth URLs
  if (apiUrl.includes("zohoapis.eu")) {
    return "https://accounts.zoho.eu/oauth/v2/token"
  }
  if (apiUrl.includes("zohoapis.in")) {
    return "https://accounts.zoho.in/oauth/v2/token"
  }
  if (apiUrl.includes("zohoapis.com.au")) {
    return "https://accounts.zoho.com.au/oauth/v2/token"
  }
  // Default to US
  return "https://accounts.zoho.com/oauth/v2/token"
}
