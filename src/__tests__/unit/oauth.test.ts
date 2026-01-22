/**
 * Unit tests for OAuth token management
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createFetchMock, createSuccessResponse, createErrorResponse } from "../mocks/fetch-mock.js"
import { oauthTokenResponse, oauthErrorResponse } from "../fixtures/zoho-responses.js"

describe("OAuth Token Management", () => {
  let originalEnv: typeof process.env
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalEnv = { ...process.env }
    originalFetch = globalThis.fetch
    vi.resetModules()
  })

  afterEach(() => {
    process.env = originalEnv
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  describe("getAccessToken", () => {
    it("throws error when credentials are not configured", async () => {
      delete process.env.ZOHO_CLIENT_ID
      delete process.env.ZOHO_CLIENT_SECRET
      delete process.env.ZOHO_REFRESH_TOKEN

      const { getAccessToken } = await import("../../auth/oauth.js")

      await expect(getAccessToken()).rejects.toThrow("Zoho OAuth not configured")
    })

    it("refreshes token when credentials are configured", async () => {
      process.env.ZOHO_CLIENT_ID = "test-client-id"
      process.env.ZOHO_CLIENT_SECRET = "test-client-secret"
      process.env.ZOHO_REFRESH_TOKEN = "test-refresh-token"

      const mockFetch = createFetchMock({
        defaultResponse: createSuccessResponse(oauthTokenResponse),
      })
      globalThis.fetch = mockFetch

      const { getAccessToken, clearTokenCache } = await import("../../auth/oauth.js")
      clearTokenCache()

      const token = await getAccessToken()

      expect(token).toBe(oauthTokenResponse.access_token)
      expect(mockFetch).toHaveBeenCalled()
    })

    it("returns cached token when still valid", async () => {
      process.env.ZOHO_CLIENT_ID = "test-client-id"
      process.env.ZOHO_CLIENT_SECRET = "test-client-secret"
      process.env.ZOHO_REFRESH_TOKEN = "test-refresh-token"

      const mockFetch = createFetchMock({
        defaultResponse: createSuccessResponse(oauthTokenResponse),
      })
      globalThis.fetch = mockFetch

      const { getAccessToken, clearTokenCache } = await import("../../auth/oauth.js")
      clearTokenCache()

      // First call refreshes token
      await getAccessToken()
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Second call should use cached token
      await getAccessToken()
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it("throws ZohoAuthError on refresh failure", async () => {
      process.env.ZOHO_CLIENT_ID = "test-client-id"
      process.env.ZOHO_CLIENT_SECRET = "test-client-secret"
      process.env.ZOHO_REFRESH_TOKEN = "invalid-refresh-token"

      const mockFetch = createFetchMock({
        defaultResponse: createErrorResponse(400, "Bad Request", oauthErrorResponse),
      })
      globalThis.fetch = mockFetch

      const { getAccessToken, clearTokenCache } = await import("../../auth/oauth.js")
      clearTokenCache()

      await expect(getAccessToken()).rejects.toThrow("Failed to refresh token")
    })
  })

  describe("isConfigured", () => {
    it("returns false when credentials are missing", async () => {
      delete process.env.ZOHO_CLIENT_ID
      delete process.env.ZOHO_CLIENT_SECRET
      delete process.env.ZOHO_REFRESH_TOKEN

      const { isConfigured } = await import("../../auth/oauth.js")

      expect(isConfigured()).toBe(false)
    })

    it("returns true when all credentials are set", async () => {
      process.env.ZOHO_CLIENT_ID = "test-client-id"
      process.env.ZOHO_CLIENT_SECRET = "test-client-secret"
      process.env.ZOHO_REFRESH_TOKEN = "test-refresh-token"

      const { isConfigured } = await import("../../auth/oauth.js")

      expect(isConfigured()).toBe(true)
    })
  })
})
