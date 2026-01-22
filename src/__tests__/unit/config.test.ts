/**
 * Unit tests for configuration module
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest"

describe("Configuration", () => {
  let originalEnv: typeof process.env

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe("getZohoConfig", () => {
    it("returns default API URL when not set", async () => {
      delete process.env.ZOHO_API_URL

      const { getZohoConfig } = await import("../../config.js")
      const config = getZohoConfig()

      expect(config.apiUrl).toBe("https://www.zohoapis.com/books/v3")
    })

    it("uses custom API URL when set", async () => {
      process.env.ZOHO_API_URL = "https://www.zohoapis.eu/books/v3"

      const { getZohoConfig } = await import("../../config.js")
      const config = getZohoConfig()

      expect(config.apiUrl).toBe("https://www.zohoapis.eu/books/v3")
    })

    it("returns credentials from environment", async () => {
      process.env.ZOHO_CLIENT_ID = "test-client"
      process.env.ZOHO_CLIENT_SECRET = "test-secret"
      process.env.ZOHO_REFRESH_TOKEN = "test-token"

      const { getZohoConfig } = await import("../../config.js")
      const config = getZohoConfig()

      expect(config.clientId).toBe("test-client")
      expect(config.clientSecret).toBe("test-secret")
      expect(config.refreshToken).toBe("test-token")
    })

    it("returns empty organizationId when not set", async () => {
      delete process.env.ZOHO_ORGANIZATION_ID

      const { getZohoConfig } = await import("../../config.js")
      const config = getZohoConfig()

      expect(config.organizationId).toBe("")
    })

    it("returns organizationId from environment when set", async () => {
      process.env.ZOHO_ORGANIZATION_ID = "912133831"

      const { getZohoConfig } = await import("../../config.js")
      const config = getZohoConfig()

      expect(config.organizationId).toBe("912133831")
    })
  })

  describe("getServerConfig", () => {
    it("returns default port when not set", async () => {
      delete process.env.PORT

      const { getServerConfig } = await import("../../config.js")
      const config = getServerConfig()

      expect(config.port).toBe(8004)
    })

    it("uses custom port when set", async () => {
      process.env.PORT = "9000"

      const { getServerConfig } = await import("../../config.js")
      const config = getServerConfig()

      expect(config.port).toBe(9000)
    })

    it("returns default host when not set", async () => {
      delete process.env.HOST

      const { getServerConfig } = await import("../../config.js")
      const config = getServerConfig()

      expect(config.host).toBe("0.0.0.0")
    })
  })

  describe("validateZohoConfig", () => {
    it("returns invalid when client ID is missing", async () => {
      const { validateZohoConfig } = await import("../../config.js")
      const result = validateZohoConfig({
        clientId: "",
        clientSecret: "secret",
        refreshToken: "token",
        apiUrl: "https://api.zoho.com",
        organizationId: "",
      })

      expect(result.valid).toBe(false)
      expect(result.error).toContain("ZOHO_CLIENT_ID")
    })

    it("returns invalid when client secret is missing", async () => {
      const { validateZohoConfig } = await import("../../config.js")
      const result = validateZohoConfig({
        clientId: "client",
        clientSecret: "",
        refreshToken: "token",
        apiUrl: "https://api.zoho.com",
        organizationId: "",
      })

      expect(result.valid).toBe(false)
      expect(result.error).toContain("ZOHO_CLIENT_SECRET")
    })

    it("returns invalid when refresh token is missing", async () => {
      const { validateZohoConfig } = await import("../../config.js")
      const result = validateZohoConfig({
        clientId: "client",
        clientSecret: "secret",
        refreshToken: "",
        apiUrl: "https://api.zoho.com",
        organizationId: "",
      })

      expect(result.valid).toBe(false)
      expect(result.error).toContain("ZOHO_REFRESH_TOKEN")
    })

    it("returns valid when all credentials are set", async () => {
      const { validateZohoConfig } = await import("../../config.js")
      const result = validateZohoConfig({
        clientId: "client",
        clientSecret: "secret",
        refreshToken: "token",
        apiUrl: "https://api.zoho.com",
        organizationId: "",
      })

      expect(result.valid).toBe(true)
    })

    it("returns valid when all credentials including organizationId are set", async () => {
      const { validateZohoConfig } = await import("../../config.js")
      const result = validateZohoConfig({
        clientId: "client",
        clientSecret: "secret",
        refreshToken: "token",
        apiUrl: "https://api.zoho.com",
        organizationId: "912133831",
      })

      expect(result.valid).toBe(true)
    })
  })

  describe("getZohoOAuthUrl", () => {
    it("returns US OAuth URL for US API URL", async () => {
      const { getZohoOAuthUrl } = await import("../../config.js")
      const oauthUrl = getZohoOAuthUrl("https://www.zohoapis.com/books/v3")

      expect(oauthUrl).toBe("https://accounts.zoho.com/oauth/v2/token")
    })

    it("returns EU OAuth URL for EU API URL", async () => {
      const { getZohoOAuthUrl } = await import("../../config.js")
      const oauthUrl = getZohoOAuthUrl("https://www.zohoapis.eu/books/v3")

      expect(oauthUrl).toBe("https://accounts.zoho.eu/oauth/v2/token")
    })

    it("returns IN OAuth URL for IN API URL", async () => {
      const { getZohoOAuthUrl } = await import("../../config.js")
      const oauthUrl = getZohoOAuthUrl("https://www.zohoapis.in/books/v3")

      expect(oauthUrl).toBe("https://accounts.zoho.in/oauth/v2/token")
    })

    it("returns AU OAuth URL for AU API URL", async () => {
      const { getZohoOAuthUrl } = await import("../../config.js")
      const oauthUrl = getZohoOAuthUrl("https://www.zohoapis.com.au/books/v3")

      expect(oauthUrl).toBe("https://accounts.zoho.com.au/oauth/v2/token")
    })
  })
})
