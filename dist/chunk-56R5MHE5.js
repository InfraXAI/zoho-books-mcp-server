// src/config.ts
var MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
var REQUEST_TIMEOUT_MS = 3e4;
function getZohoConfig() {
  const clientId = process.env.ZOHO_CLIENT_ID || "";
  const clientSecret = process.env.ZOHO_CLIENT_SECRET || "";
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN || "";
  const apiUrl = process.env.ZOHO_API_URL || "https://www.zohoapis.in/books/v3";
  const organizationId = process.env.ZOHO_ORGANIZATION_ID || "";
  const orgAliases = [];
  const aliasStr = process.env.ZOHO_ORG_ALIASES || "";
  if (aliasStr) {
    aliasStr.split(",").forEach((pair) => {
      const [alias, orgId] = pair.trim().split(":");
      if (alias && orgId) {
        orgAliases.push({ alias: alias.trim().toLowerCase(), orgId: orgId.trim() });
      }
    });
  }
  return {
    clientId,
    clientSecret,
    refreshToken,
    apiUrl,
    organizationId,
    orgAliases
  };
}
function getServerConfig() {
  return {
    port: parseInt(process.env.PORT || "8004", 10),
    host: process.env.HOST || "0.0.0.0"
  };
}
function validateZohoConfig(config) {
  if (!config.clientId) {
    return { valid: false, error: "ZOHO_CLIENT_ID is not configured" };
  }
  if (!config.clientSecret) {
    return { valid: false, error: "ZOHO_CLIENT_SECRET is not configured" };
  }
  if (!config.refreshToken) {
    return { valid: false, error: "ZOHO_REFRESH_TOKEN is not configured" };
  }
  if (!config.apiUrl.startsWith("https://")) {
    return { valid: false, error: "ZOHO_API_URL must use HTTPS" };
  }
  return { valid: true };
}
var sessionOrgId = null;
var orgNameCache = /* @__PURE__ */ new Map();
var autoAliases = [];
var autoAliasesLoaded = false;
function generateAlias(name) {
  const firstWord = name.split(/[\s\-_]+/)[0] || name;
  return firstWord.toLowerCase().replace(/[^a-z0-9]/g, "");
}
async function autoDiscoverOrganizations() {
  if (autoAliasesLoaded) return;
  const config = getZohoConfig();
  const validation = validateZohoConfig(config);
  if (!validation.valid) return;
  try {
    const { getAccessToken: getAccessToken2 } = await import("./oauth-NG7LNOJ6.js");
    const token = await getAccessToken2();
    const response = await fetch(`${config.apiUrl}/organizations`, {
      method: "GET",
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        "Content-Type": "application/json"
      }
    });
    if (!response.ok) return;
    const data = await response.json();
    const orgs = data.organizations || [];
    const usedAliases = /* @__PURE__ */ new Set();
    config.orgAliases.forEach((a) => usedAliases.add(a.alias));
    for (const org of orgs) {
      const orgId = org.organization_id;
      const name = org.name;
      if (!orgId || !name) continue;
      orgNameCache.set(orgId, name);
      let alias = generateAlias(name);
      if (!usedAliases.has(alias)) {
        usedAliases.add(alias);
        autoAliases.push({ alias, orgId });
      }
    }
    autoAliasesLoaded = true;
  } catch {
    autoAliasesLoaded = true;
  }
}
function setSessionOrganization(orgId, orgName) {
  sessionOrgId = orgId;
  if (orgName) {
    orgNameCache.set(orgId, orgName);
  }
}
function getEffectiveOrgId() {
  return sessionOrgId || getZohoConfig().organizationId;
}
function cacheOrgName(orgId, name) {
  orgNameCache.set(orgId, name);
}
function resolveOrgAlias(input) {
  const config = getZohoConfig();
  const lower = input.toLowerCase().trim();
  const manualMatch = config.orgAliases.find((a) => a.alias === lower);
  if (manualMatch) return manualMatch.orgId;
  const autoMatch = autoAliases.find((a) => a.alias === lower);
  if (autoMatch) return autoMatch.orgId;
  return input;
}
function getOrgAliases() {
  const manual = getZohoConfig().orgAliases;
  const manualOrgIds = new Set(manual.map((a) => a.orgId));
  const combined = [...manual, ...autoAliases.filter((a) => !manualOrgIds.has(a.orgId))];
  return combined;
}
function getZohoOAuthUrl(apiUrl) {
  if (apiUrl.includes("zohoapis.eu")) {
    return "https://accounts.zoho.eu/oauth/v2/token";
  }
  if (apiUrl.includes("zohoapis.in")) {
    return "https://accounts.zoho.in/oauth/v2/token";
  }
  if (apiUrl.includes("zohoapis.com.au")) {
    return "https://accounts.zoho.com.au/oauth/v2/token";
  }
  return "https://accounts.zoho.com/oauth/v2/token";
}

// src/auth/oauth.ts
var tokenState = null;
var TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1e3;
var ZohoAuthError = class extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = "ZohoAuthError";
  }
};
async function getAccessToken() {
  const config = getZohoConfig();
  const validation = validateZohoConfig(config);
  if (!validation.valid) {
    throw new ZohoAuthError(
      `Zoho OAuth not configured: ${validation.error}. Set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REFRESH_TOKEN.`,
      "OAUTH_NOT_CONFIGURED"
    );
  }
  if (tokenState && Date.now() < tokenState.expiresAt - TOKEN_EXPIRY_BUFFER_MS) {
    return tokenState.accessToken;
  }
  return refreshAccessToken(config);
}
async function refreshAccessToken(config) {
  const oauthUrl = getZohoOAuthUrl(config.apiUrl);
  try {
    const response = await fetch(oauthUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken
      })
    });
    const data = await response.json();
    if (!response.ok) {
      const errorMessage = data.error_description || data.error || "Unknown error";
      throw new ZohoAuthError(
        `Failed to refresh token: ${errorMessage}`,
        data.error,
        response.status
      );
    }
    if (!data.access_token) {
      throw new ZohoAuthError("No access token in response", "NO_ACCESS_TOKEN");
    }
    const expiresIn = data.expires_in || 3600;
    tokenState = {
      accessToken: data.access_token,
      expiresAt: Date.now() + expiresIn * 1e3
    };
    return tokenState.accessToken;
  } catch (error) {
    if (error instanceof ZohoAuthError) {
      throw error;
    }
    throw new ZohoAuthError(
      `Failed to refresh token: ${error instanceof Error ? error.message : String(error)}`,
      "REFRESH_FAILED"
    );
  }
}
function clearTokenCache() {
  tokenState = null;
}
function isConfigured() {
  const config = getZohoConfig();
  return validateZohoConfig(config).valid;
}

export {
  MAX_FILE_SIZE_BYTES,
  REQUEST_TIMEOUT_MS,
  getZohoConfig,
  getServerConfig,
  autoDiscoverOrganizations,
  setSessionOrganization,
  getEffectiveOrgId,
  cacheOrgName,
  resolveOrgAlias,
  getOrgAliases,
  ZohoAuthError,
  getAccessToken,
  clearTokenCache,
  isConfigured
};
