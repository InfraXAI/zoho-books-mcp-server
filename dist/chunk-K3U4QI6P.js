import {
  MAX_FILE_SIZE_BYTES,
  REQUEST_TIMEOUT_MS,
  ZohoAuthError,
  autoDiscoverOrganizations,
  cacheOrgName,
  getAccessToken,
  getEffectiveOrgId,
  getOrgAliases,
  getZohoConfig,
  resolveOrgAlias,
  setSessionOrganization
} from "./chunk-56R5MHE5.js";

// src/index.ts
import { FastMCP } from "fastmcp";

// src/tools/organizations.ts
import { z as z2 } from "zod";

// src/api/client.ts
import * as fs from "fs";
import * as path2 from "path";

// src/utils/mime-types.ts
import * as path from "path";
var MIME_TYPES = {
  // Documents
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".rtf": "application/rtf",
  // Images
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".tiff": "image/tiff",
  ".tif": "image/tiff",
  // Archives
  ".zip": "application/zip",
  ".rar": "application/vnd.rar",
  ".7z": "application/x-7z-compressed",
  ".tar": "application/x-tar",
  ".gz": "application/gzip"
};
var ZOHO_SUPPORTED_EXTENSIONS = /* @__PURE__ */ new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx"
]);
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}
function isSupportedExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ZOHO_SUPPORTED_EXTENSIONS.has(ext);
}
function getSupportedExtensions() {
  return Array.from(ZOHO_SUPPORTED_EXTENSIONS);
}
function validateAttachment(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!ext) {
    return { valid: false, error: "File has no extension" };
  }
  if (!isSupportedExtension(filePath)) {
    return {
      valid: false,
      error: `Unsupported file type: ${ext}. Supported types: ${getSupportedExtensions().join(", ")}`
    };
  }
  return { valid: true };
}

// src/utils/errors.ts
var ZOHO_ERROR_CODES = {
  0: { message: "Success", action: "No action needed", category: "validation" },
  1: {
    message: "Internal error",
    action: "Try again later or contact support",
    category: "server"
  },
  2: { message: "Invalid URL", action: "Check the API endpoint URL", category: "validation" },
  4: {
    message: "Invalid value",
    action: "Check the parameter values match expected types",
    category: "validation"
  },
  5: {
    message: "Invalid parameter",
    action: "Review required and optional parameters",
    category: "validation"
  },
  9: {
    message: "Record not found",
    action: "Verify the ID exists - use list endpoints to find valid IDs",
    category: "not_found"
  },
  10: {
    message: "Missing mandatory parameter",
    action: "Add the required parameter to your request",
    category: "validation"
  },
  14: {
    message: "Authorization failed",
    action: "Check your access token and permissions",
    category: "auth"
  },
  36: {
    message: "Rate limit exceeded",
    action: "Wait 1 minute before retrying",
    category: "rate_limit"
  },
  57: {
    message: "OAuth token expired",
    action: "Token will be auto-refreshed on next request",
    category: "auth"
  },
  2006: {
    message: "Record not found",
    action: "The specified resource does not exist. Use list endpoints to find valid IDs.",
    category: "not_found"
  },
  6e3: {
    message: "Invalid OAuth token",
    action: "Token will be auto-refreshed on next request",
    category: "auth"
  }
};
function parseZohoError(code, apiMessage, endpoint, _rawResponse) {
  const knownError = ZOHO_ERROR_CODES[code];
  if (knownError) {
    return {
      code,
      message: apiMessage || knownError.message,
      category: knownError.category,
      suggestedAction: knownError.action,
      endpoint
    };
  }
  return {
    code,
    message: apiMessage || "Unknown error",
    category: "unknown",
    suggestedAction: "Check the Zoho Books API documentation for this error code",
    endpoint
  };
}
function formatErrorForAI(error) {
  let result = `**Zoho Error ${error.code}**: ${error.message}`;
  if (error.suggestedAction) {
    result += `
**Suggested Action**: ${error.suggestedAction}`;
  }
  if (error.endpoint) {
    result += `
**Endpoint**: ${error.endpoint}`;
  }
  return result;
}

// src/utils/response-parser.ts
async function parseZohoResponse(response, endpoint) {
  const responseText = await response.text();
  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    if (!response.ok) {
      return {
        ok: false,
        error: {
          code: response.status,
          message: response.statusText,
          category: response.status >= 500 ? "server" : "unknown",
          suggestedAction: "Check the API endpoint and try again",
          endpoint
          // Note: rawResponse intentionally omitted to prevent leaking sensitive data
        },
        errorMessage: `HTTP ${response.status}: ${response.statusText}`
      };
    }
    return {
      ok: false,
      errorMessage: "Unexpected non-JSON response from Zoho API"
    };
  }
  const code = data.code;
  if (code !== void 0 && code !== 0) {
    const error = parseZohoError(code, data.message, endpoint, responseText);
    return {
      ok: false,
      error,
      errorMessage: formatErrorForAI(error)
    };
  }
  if (!response.ok) {
    const error = parseZohoError(
      response.status,
      data.message || response.statusText,
      endpoint,
      responseText
    );
    return {
      ok: false,
      error,
      errorMessage: formatErrorForAI(error)
    };
  }
  return {
    ok: true,
    data
  };
}

// src/api/client.ts
var ALLOWED_UPLOAD_DIRECTORIES = [
  "/app/documents",
  // Docker container path
  "/tmp/zoho-bookkeeper-uploads",
  // App-specific temp directory (narrower than /tmp)
  process.env.HOME ? path2.join(process.env.HOME, "Documents") : void 0,
  // User documents
  process.env.ZOHO_ALLOWED_UPLOAD_DIR
  // Optional override/additional safe directory
].filter((d) => Boolean(d));
function normalizeForCompare(p) {
  const normalized = path2.normalize(p);
  return process.platform === "win32" || process.platform === "darwin" ? normalized.toLowerCase() : normalized;
}
function sanitizeFilename(filename) {
  return filename.replace(/[\r\n]/g, "").replace(/[/\\]/g, "_");
}
function validateFilePath(filePath) {
  const resolvedInput = path2.resolve(filePath);
  let realPath = resolvedInput;
  try {
    if (fs.existsSync(filePath)) {
      realPath = fs.realpathSync(filePath);
    }
  } catch {
    realPath = resolvedInput;
  }
  const normalizedRealPath = normalizeForCompare(realPath);
  const isAllowed = ALLOWED_UPLOAD_DIRECTORIES.some((allowedDir) => {
    const resolvedAllowed = path2.resolve(allowedDir);
    let allowedReal = resolvedAllowed;
    try {
      if (fs.existsSync(allowedDir)) {
        allowedReal = fs.realpathSync(allowedDir);
      }
    } catch {
      allowedReal = resolvedAllowed;
    }
    const normalizedAllowed = normalizeForCompare(allowedReal);
    return normalizedRealPath === normalizedAllowed || normalizedRealPath.startsWith(normalizedAllowed + path2.sep);
  });
  if (!isAllowed) {
    return {
      valid: false,
      error: "File path not in allowed upload directories"
    };
  }
  return { valid: true, resolvedPath: realPath };
}
function createTimeoutController(timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  if (typeof timeoutId === "object" && "unref" in timeoutId) {
    timeoutId.unref();
  }
  return { controller, timeoutId, timeoutMs };
}
function resolveOrganizationId(organizationId) {
  let orgId;
  if (organizationId) {
    orgId = resolveOrgAlias(organizationId);
  } else {
    orgId = getEffectiveOrgId();
  }
  if (!orgId) {
    return {
      error: "Organization ID required. Set ZOHO_ORGANIZATION_ID environment variable, use switch_organization, or pass organization_id parameter (aliases supported)."
    };
  }
  return { orgId };
}
async function zohoRequest(method, endpoint, organizationId, body, queryParams) {
  const config = getZohoConfig();
  await autoDiscoverOrganizations();
  const orgIdResult = resolveOrganizationId(organizationId);
  if ("error" in orgIdResult) {
    return {
      ok: false,
      errorMessage: orgIdResult.error
    };
  }
  let token;
  try {
    token = await getAccessToken();
  } catch (error) {
    if (error instanceof ZohoAuthError) {
      return {
        ok: false,
        errorMessage: error.message
      };
    }
    return {
      ok: false,
      errorMessage: `Authentication error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
  const url = new URL(`${config.apiUrl}${endpoint}`);
  url.searchParams.set("organization_id", orgIdResult.orgId);
  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  const { controller, timeoutId, timeoutMs } = createTimeoutController();
  const options = {
    method,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json"
    },
    signal: controller.signal
  };
  if (body && method !== "GET" && method !== "HEAD") {
    options.body = JSON.stringify(body);
  }
  try {
    const response = await fetch(url.toString(), options);
    return parseZohoResponse(response, endpoint);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        errorMessage: `Request timeout after ${timeoutMs / 1e3} seconds`
      };
    }
    return {
      ok: false,
      errorMessage: `Request failed: ${error instanceof Error ? error.message : String(error)}`
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
async function zohoGet(endpoint, organizationId, queryParams) {
  return zohoRequest("GET", endpoint, organizationId, void 0, queryParams);
}
async function zohoPost(endpoint, organizationId, body) {
  return zohoRequest("POST", endpoint, organizationId, body);
}
async function zohoPut(endpoint, organizationId, body) {
  return zohoRequest("PUT", endpoint, organizationId, body);
}
async function zohoDelete(endpoint, organizationId) {
  return zohoRequest("DELETE", endpoint, organizationId);
}
async function zohoUploadAttachment(endpoint, organizationId, filePath) {
  const config = getZohoConfig();
  const orgIdResult = resolveOrganizationId(organizationId);
  if ("error" in orgIdResult) {
    return {
      ok: false,
      errorMessage: orgIdResult.error
    };
  }
  let token;
  const pathValidation = validateFilePath(filePath);
  if (!pathValidation.valid || !pathValidation.resolvedPath) {
    return {
      ok: false,
      errorMessage: pathValidation.error || "Invalid file path"
    };
  }
  const resolvedPath = pathValidation.resolvedPath;
  const validation = validateAttachment(resolvedPath);
  if (!validation.valid) {
    return {
      ok: false,
      errorMessage: validation.error
    };
  }
  let fileBuffer;
  let fileName;
  let mimeType;
  let fh;
  try {
    const flags = typeof fs.constants.O_NOFOLLOW === "number" ? fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW : fs.constants.O_RDONLY;
    fh = await fs.promises.open(resolvedPath, flags);
    const stats = await fh.stat();
    if (!stats.isFile()) {
      return {
        ok: false,
        errorMessage: "Upload path must be a regular file"
      };
    }
    if (stats.size > MAX_FILE_SIZE_BYTES) {
      return {
        ok: false,
        errorMessage: `File too large: ${(stats.size / 1024 / 1024).toFixed(2)}MB (max ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB)`
      };
    }
    fileBuffer = await fh.readFile();
    fileName = sanitizeFilename(path2.basename(resolvedPath));
    mimeType = getMimeType(resolvedPath);
  } catch (e) {
    const err = e;
    if (err?.code === "ELOOP") {
      return {
        ok: false,
        errorMessage: "Symlinks are not allowed for uploads"
      };
    }
    return {
      ok: false,
      errorMessage: "File not found or inaccessible"
    };
  } finally {
    await fh?.close().catch(() => void 0);
  }
  try {
    token = await getAccessToken();
  } catch (error) {
    if (error instanceof ZohoAuthError) {
      return {
        ok: false,
        errorMessage: error.message
      };
    }
    return {
      ok: false,
      errorMessage: `Authentication error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
  const url = new URL(`${config.apiUrl}${endpoint}`);
  url.searchParams.set("organization_id", orgIdResult.orgId);
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append("attachment", blob, fileName);
  const { controller, timeoutId, timeoutMs } = createTimeoutController();
  try {
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`
        // DO NOT set Content-Type header - let fetch set it with the correct multipart boundary
      },
      body: formData,
      signal: controller.signal
    });
    return parseZohoResponse(response, endpoint);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        errorMessage: `Upload timeout after ${timeoutMs / 1e3} seconds`
      };
    }
    return {
      ok: false,
      errorMessage: `Upload failed: ${error instanceof Error ? error.message : String(error)}`
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
async function zohoDeleteAttachment(endpoint, organizationId) {
  return zohoDelete(endpoint, organizationId);
}
async function zohoListOrganizations() {
  const config = getZohoConfig();
  let token;
  try {
    token = await getAccessToken();
  } catch (error) {
    if (error instanceof ZohoAuthError) {
      return {
        ok: false,
        errorMessage: error.message
      };
    }
    return {
      ok: false,
      errorMessage: `Authentication error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
  const { controller, timeoutId, timeoutMs } = createTimeoutController();
  try {
    const response = await fetch(`${config.apiUrl}/organizations`, {
      method: "GET",
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal
    });
    return parseZohoResponse(response, "/organizations");
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        errorMessage: `Request timeout after ${timeoutMs / 1e3} seconds`
      };
    }
    return {
      ok: false,
      errorMessage: `Request failed: ${error instanceof Error ? error.message : String(error)}`
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// src/utils/validation.ts
import { z } from "zod";
var DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
var dateSchema = z.string().regex(DATE_REGEX, "Date must be in YYYY-MM-DD format").refine(
  (date) => {
    const [yStr, mStr, dStr] = date.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toISOString().slice(0, 10) === date;
  },
  { message: "Invalid date value" }
);
var optionalDateSchema = dateSchema.optional();
var moneySchema = z.number().positive("Amount must be positive").max(99999999999e-2, "Amount exceeds maximum allowed value").refine((val) => Number.isFinite(val), { message: "Amount must be a finite number" }).refine((val) => Math.round(val * 100) / 100 === val, {
  message: "Amount must have at most 2 decimal places"
});
var moneyOrZeroSchema = z.number().min(0, "Amount cannot be negative").max(99999999999e-2, "Amount exceeds maximum allowed value").refine((val) => Number.isFinite(val), { message: "Amount must be a finite number" }).refine((val) => Math.round(val * 100) / 100 === val, {
  message: "Amount must have at most 2 decimal places"
});
var organizationIdSchema = z.string().regex(/^[a-zA-Z0-9_-]+$/, "Invalid organization ID format").max(50, "Organization ID too long");
var optionalOrganizationIdSchema = organizationIdSchema.optional();
var entityIdSchema = z.string().regex(/^[a-zA-Z0-9_-]+$/, "Invalid ID format").max(50, "ID too long");

// src/tools/organizations.ts
function registerOrganizationTools(server2) {
  server2.addTool({
    name: "list_organizations",
    description: `List all Zoho organizations the user has access to.
Returns organization name, ID, currency, timezone, and configured aliases.
Use switch_organization to change the active organization.`,
    parameters: z2.object({}),
    annotations: {
      title: "List Organizations",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async () => {
      await autoDiscoverOrganizations();
      const result = await zohoListOrganizations();
      if (!result.ok) {
        return result.errorMessage || "Failed to list organizations";
      }
      const organizations = result.data?.organizations || [];
      if (organizations.length === 0) {
        return "No organizations found. Make sure your Zoho credentials have access to at least one organization.";
      }
      organizations.forEach((org) => {
        cacheOrgName(org.organization_id, org.name);
      });
      const aliases = getOrgAliases();
      const currentOrgId = getEffectiveOrgId();
      const formatted = organizations.map((org, index) => {
        const alias = aliases.find((a) => a.orgId === org.organization_id);
        const isActive = org.organization_id === currentOrgId;
        const activeMarker = isActive ? " \u2190 **ACTIVE**" : "";
        const aliasStr = alias ? ` (alias: \`${alias.alias}\`)` : "";
        return `${index + 1}. **${org.name}**${activeMarker}
   - Organization ID: \`${org.organization_id}\`${aliasStr}
   - Currency: ${org.currency_code} (${org.currency_symbol})
   - Timezone: ${org.time_zone}
   - Fiscal Year Start: Month ${org.fiscal_year_start_month}`;
      }).join("\n\n");
      return `**Zoho Organizations**

${formatted}

---
Use \`switch_organization\` to change the active org, or pass \`organization_id\` (alias or ID) to any tool.`;
    }
  });
  server2.addTool({
    name: "get_organization",
    description: `Get detailed information about a specific organization.
Returns full organization details including address, contact info, and settings.`,
    parameters: z2.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID or alias (uses active org if not provided)"
      )
    }),
    annotations: {
      title: "Get Organization Details",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const orgId = args.organization_id ? resolveOrgAlias(args.organization_id) : getEffectiveOrgId();
      const result = await zohoGet(
        `/organizations/${orgId}`,
        orgId
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to get organization";
      }
      const org = result.data?.organization;
      if (!org) {
        return "Organization not found";
      }
      cacheOrgName(org.organization_id, org.name);
      return `**Organization Details**

- **Name**: ${org.name}
- **Organization ID**: \`${org.organization_id}\`
- **Default Org**: ${org.is_default_org ? "Yes" : "No"}
- **Currency**: ${org.currency_code} (${org.currency_symbol})
- **Timezone**: ${org.time_zone}
- **Language**: ${org.language_code}
- **Fiscal Year Start**: Month ${org.fiscal_year_start_month}
- **Created**: ${org.account_created_date}`;
    }
  });
  server2.addTool({
    name: "switch_organization",
    description: `Switch the active organization for this session.
All subsequent tool calls will use this organization by default.
Accepts an organization ID or alias (e.g., "naturnest", "infrax").
Use list_organizations to see available orgs and aliases.`,
    parameters: z2.object({
      organization_id: z2.string().describe("Organization ID or alias to switch to")
    }),
    annotations: {
      title: "Switch Organization",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      await autoDiscoverOrganizations();
      const orgId = resolveOrgAlias(args.organization_id);
      const result = await zohoGet(
        `/organizations/${orgId}`,
        orgId
      );
      if (!result.ok) {
        return result.errorMessage || `Failed to switch to organization \`${args.organization_id}\`. Check if the ID/alias is correct.`;
      }
      const org = result.data?.organization;
      if (!org) {
        return `Organization \`${args.organization_id}\` not found.`;
      }
      setSessionOrganization(orgId, org.name);
      return `**Organization Switched**

Now using: **${org.name}** (\`${org.organization_id}\`)
Currency: ${org.currency_code} | Timezone: ${org.time_zone}

All subsequent tool calls will use this organization by default.`;
    }
  });
  server2.addTool({
    name: "get_organization_summary",
    description: `Get a quick financial snapshot of an organization.
Shows organization info, GST status, plan, and key settings.
Useful for a CFO's daily overview.`,
    parameters: z2.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID or alias (uses active org if not provided)"
      )
    }),
    annotations: {
      title: "Organization Summary",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const orgId = args.organization_id ? resolveOrgAlias(args.organization_id) : getEffectiveOrgId();
      const result = await zohoListOrganizations();
      if (!result.ok) {
        return result.errorMessage || "Failed to get organization summary";
      }
      const organizations = result.data?.organizations || [];
      const org = organizations.find((o) => o.organization_id === orgId);
      if (!org) {
        return `Organization \`${orgId}\` not found.`;
      }
      if (typeof org.name === "string") {
        cacheOrgName(orgId, org.name);
      }
      const currentOrgId = getEffectiveOrgId();
      const isActive = orgId === currentOrgId;
      return `**Organization Summary${isActive ? " (Active)" : ""}**

**General**
- **Name**: ${org.name}
- **Organization ID**: \`${org.organization_id}\`
- **Country**: ${org.country || "N/A"}
- **State**: ${org.state || "N/A"}
- **Currency**: ${org.currency_code} (${org.currency_symbol})
- **Timezone**: ${org.time_zone}

**Compliance**
- **GST Registered**: ${org.is_registered_for_gst ? "Yes" : "No"}
- **Tax Registered**: ${org.is_tax_registered ? "Yes" : "No"}
- **HSN/SAC Enabled**: ${org.is_hsn_or_sac_enabled ? "Yes" : "No"}
- **Tax Type**: ${org.sales_tax_type || "N/A"}

**Plan**
- **Plan**: ${org.plan_name || "N/A"} (${org.plan_period || "N/A"})
- **Mode**: ${org.mode || "N/A"}
- **Created**: ${org.account_created_date_formatted || org.account_created_date || "N/A"}

**Fiscal**
- **Fiscal Year Start**: Month ${org.fiscal_year_start_month}
- **Version**: ${org.version_formatted || org.version || "N/A"}`;
    }
  });
}

// src/tools/chart-of-accounts.ts
import { z as z3 } from "zod";
function registerChartOfAccountsTools(server2) {
  server2.addTool({
    name: "list_accounts",
    description: `List all accounts in the chart of accounts.
Supports filtering by account type (e.g., income, expense, asset, liability, equity).
Use this to find account_id values for journal entries and transactions.`,
    parameters: z3.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      filter_by: z3.enum([
        "AccountType.All",
        "AccountType.Active",
        "AccountType.Inactive",
        "AccountType.Asset",
        "AccountType.Liability",
        "AccountType.Equity",
        "AccountType.Income",
        "AccountType.Expense"
      ]).optional().describe("Filter accounts by type"),
      sort_column: z3.enum(["account_name", "account_type", "account_code"]).optional().describe("Column to sort by")
    }),
    annotations: {
      title: "List Chart of Accounts",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const queryParams = {};
      if (args.filter_by) queryParams.filter_by = args.filter_by;
      if (args.sort_column) queryParams.sort_column = args.sort_column;
      const result = await zohoGet(
        "/chartofaccounts",
        args.organization_id,
        queryParams
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to list accounts";
      }
      const accounts = result.data?.chartofaccounts || [];
      if (accounts.length === 0) {
        return "No accounts found.";
      }
      const formatted = accounts.map((acc, index) => {
        const balance = acc.current_balance !== void 0 ? ` | Balance: ${acc.current_balance}` : "";
        return `${index + 1}. **${acc.account_name}** (${acc.account_type_formatted})
   - Account ID: \`${acc.account_id}\`
   - Code: ${acc.account_code || "N/A"}
   - Active: ${acc.is_active ? "Yes" : "No"}${balance}`;
      }).join("\n\n");
      return `**Chart of Accounts** (${accounts.length} accounts)

${formatted}`;
    }
  });
  server2.addTool({
    name: "get_account",
    description: `Get detailed information about a specific account.
Returns account details including balance, currency, and parent account info.`,
    parameters: z3.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      account_id: z3.string().describe("Account ID")
    }),
    annotations: {
      title: "Get Account Details",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoGet(
        `/chartofaccounts/${args.account_id}`,
        args.organization_id
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to get account";
      }
      const account = result.data?.account;
      if (!account) {
        return "Account not found";
      }
      let details = `**Account Details**

- **Name**: ${account.account_name}
- **Account ID**: \`${account.account_id}\`
- **Code**: ${account.account_code || "N/A"}
- **Type**: ${account.account_type_formatted}
- **Active**: ${account.is_active ? "Yes" : "No"}
- **User Created**: ${account.is_user_created ? "Yes" : "No (system account)"}`;
      if (account.current_balance !== void 0) {
        details += `
- **Current Balance**: ${account.currency_code || "INR"} ${account.current_balance}`;
      }
      if (account.parent_account_name) {
        details += `
- **Parent Account**: ${account.parent_account_name}`;
      }
      if (account.description) {
        details += `
- **Description**: ${account.description}`;
      }
      return details;
    }
  });
  server2.addTool({
    name: "create_account",
    description: `Create a new account in the chart of accounts.
Account types: income, expense, cost_of_goods_sold, other_income, other_expense,
asset (bank, other_current_asset, fixed_asset, other_asset, cash, accounts_receivable),
liability (other_current_liability, credit_card, long_term_liability, other_liability, accounts_payable),
equity (equity, retained_earnings).`,
    parameters: z3.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      account_name: z3.string().describe("Name for the new account"),
      account_type: z3.string().describe("Account type (e.g., expense, income, bank, accounts_receivable)"),
      account_code: z3.string().optional().describe("Optional account code for reference"),
      description: z3.string().optional().describe("Description of the account"),
      currency_id: z3.string().optional().describe("Currency ID for the account"),
      parent_account_id: z3.string().optional().describe("Parent account ID for sub-accounts")
    }),
    annotations: {
      title: "Create Account",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const payload = {
        account_name: args.account_name,
        account_type: args.account_type
      };
      if (args.account_code) payload.account_code = args.account_code;
      if (args.description) payload.description = args.description;
      if (args.currency_id) payload.currency_id = args.currency_id;
      if (args.parent_account_id) payload.parent_account_id = args.parent_account_id;
      const result = await zohoPost(
        "/chartofaccounts",
        args.organization_id,
        payload
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to create account";
      }
      const account = result.data?.account;
      if (!account) {
        return "Account created but no details returned";
      }
      return `**Account Created Successfully**

- **Name**: ${account.account_name}
- **Account ID**: \`${account.account_id}\`
- **Code**: ${account.account_code || "N/A"}
- **Type**: ${account.account_type_formatted}`;
    }
  });
  server2.addTool({
    name: "list_account_transactions",
    description: `List transactions for a specific account.
Returns all transactions (journals, invoices, bills, etc.) affecting this account.
Useful for account reconciliation and analysis.`,
    parameters: z3.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      account_id: z3.string().describe("Account ID to get transactions for"),
      date_start: z3.string().optional().describe("Start date (YYYY-MM-DD)"),
      date_end: z3.string().optional().describe("End date (YYYY-MM-DD)"),
      sort_column: z3.enum(["transaction_date", "amount"]).optional().describe("Column to sort by")
    }),
    annotations: {
      title: "List Account Transactions",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const queryParams = {
        account_id: args.account_id
      };
      if (args.date_start) queryParams.date_start = args.date_start;
      if (args.date_end) queryParams.date_end = args.date_end;
      if (args.sort_column) queryParams.sort_column = args.sort_column;
      const result = await zohoGet(
        "/chartofaccounts/transactions",
        args.organization_id,
        queryParams
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to list transactions";
      }
      const transactions = result.data?.transactions || [];
      if (transactions.length === 0) {
        return "No transactions found for this account.";
      }
      const formatted = transactions.map((tx, index) => {
        const amount = tx.debit_or_credit === "debit" ? `Debit: ${tx.debit_amount}` : `Credit: ${tx.credit_amount}`;
        return `${index + 1}. **${tx.transaction_date}** - ${tx.transaction_type_formatted}
   - ${amount}
   - Description: ${tx.description || "N/A"}
   - Offset Account: ${tx.offset_account_name || "N/A"}`;
      }).join("\n\n");
      return `**Account Transactions** (${transactions.length} transactions)

${formatted}`;
    }
  });
}

// src/tools/journals.ts
import { z as z4 } from "zod";
var lineItemSchema = z4.object({
  account_id: entityIdSchema.describe("Account ID from chart of accounts"),
  debit_or_credit: z4.enum(["debit", "credit"]).describe("Whether this line is a debit or credit"),
  amount: moneySchema.describe("Amount for this line item (max 999,999,999.99, 2 decimal places)"),
  description: z4.string().max(500).optional().describe("Description for this line item"),
  customer_id: entityIdSchema.optional().describe("Customer ID if applicable")
});
function registerJournalTools(server2) {
  server2.addTool({
    name: "list_journals",
    description: `List all manual journal entries.
Returns journal entries with date, reference number, and total.
Use date filters to narrow down results.`,
    parameters: z4.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      date_start: optionalDateSchema.describe("Start date (YYYY-MM-DD)"),
      date_end: optionalDateSchema.describe("End date (YYYY-MM-DD)"),
      sort_column: z4.enum(["journal_date", "total", "created_time"]).optional(),
      page: z4.number().int().positive().optional().describe("Page number"),
      per_page: z4.number().int().min(1).max(200).optional().describe("Items per page (max 200)")
    }),
    annotations: {
      title: "List Journals",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const queryParams = {};
      if (args.date_start) queryParams.date_start = args.date_start;
      if (args.date_end) queryParams.date_end = args.date_end;
      if (args.sort_column) queryParams.sort_column = args.sort_column;
      if (args.page) queryParams.page = args.page.toString();
      if (args.per_page) queryParams.per_page = args.per_page.toString();
      const result = await zohoGet(
        "/journals",
        args.organization_id,
        queryParams
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to list journals";
      }
      const journals = result.data?.journals || [];
      if (journals.length === 0) {
        return "No journal entries found.";
      }
      const formatted = journals.map((j, index) => {
        return `${index + 1}. **${j.journal_date}** - ${j.reference_number || j.entry_number || "No ref"}
   - Journal ID: \`${j.journal_id}\`
   - Total: ${j.currency_code || "INR"} ${j.total}
   - Notes: ${j.notes || "N/A"}`;
      }).join("\n\n");
      return `**Journal Entries** (${journals.length} entries)

${formatted}`;
    }
  });
  server2.addTool({
    name: "get_journal",
    description: `Get detailed information about a specific journal entry.
Returns full journal details including all line items.`,
    parameters: z4.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      journal_id: entityIdSchema.describe("Journal ID")
    }),
    annotations: {
      title: "Get Journal Details",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoGet(
        `/journals/${args.journal_id}`,
        args.organization_id
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to get journal";
      }
      const journal = result.data?.journal;
      if (!journal) {
        return "Journal not found";
      }
      let details = `**Journal Entry Details**

- **Journal ID**: \`${journal.journal_id}\`
- **Date**: ${journal.journal_date}
- **Entry Number**: ${journal.entry_number || "N/A"}
- **Reference**: ${journal.reference_number || "N/A"}
- **Total**: ${journal.currency_code || "INR"} ${journal.total}
- **Notes**: ${journal.notes || "N/A"}

**Line Items**:`;
      if (journal.line_items && journal.line_items.length > 0) {
        journal.line_items.forEach((item, i) => {
          const amount = item.debit_or_credit === "debit" ? `Debit: ${item.amount}` : `Credit: ${item.amount}`;
          details += `
${i + 1}. ${item.account_name || item.account_id} - ${amount}`;
          if (item.description) details += `
   Description: ${item.description}`;
        });
      }
      return details;
    }
  });
  server2.addTool({
    name: "create_journal",
    description: `Create a new manual journal entry.
Line items must balance (total debits = total credits).
Use list_accounts to find valid account_id values.`,
    parameters: z4.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      journal_date: dateSchema.describe("Journal date (YYYY-MM-DD)"),
      reference_number: z4.string().max(100).optional().describe("Reference number for the journal"),
      notes: z4.string().max(2e3).optional().describe("Notes or memo for the journal"),
      line_items: z4.array(lineItemSchema).min(2).describe("Array of line items (min 2, must balance)")
    }),
    annotations: {
      title: "Create Journal",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      let totalDebits = 0;
      let totalCredits = 0;
      args.line_items.forEach((item) => {
        if (item.debit_or_credit === "debit") {
          totalDebits += item.amount;
        } else {
          totalCredits += item.amount;
        }
      });
      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        return `**Validation Error**: Journal does not balance.
- Total Debits: ${totalDebits.toFixed(2)}
- Total Credits: ${totalCredits.toFixed(2)}
- Difference: ${Math.abs(totalDebits - totalCredits).toFixed(2)}

Debits must equal credits for a valid journal entry.`;
      }
      const payload = {
        journal_date: args.journal_date,
        line_items: args.line_items
      };
      if (args.reference_number) payload.reference_number = args.reference_number;
      if (args.notes) payload.notes = args.notes;
      const result = await zohoPost(
        "/journals",
        args.organization_id,
        payload
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to create journal";
      }
      const journal = result.data?.journal;
      if (!journal) {
        return "Journal created but no details returned";
      }
      return `**Journal Created Successfully**

- **Journal ID**: \`${journal.journal_id}\`
- **Date**: ${journal.journal_date}
- **Entry Number**: ${journal.entry_number || "N/A"}
- **Total**: ${journal.currency_code || "INR"} ${journal.total}

Use this journal_id to add attachments or update the journal.`;
    }
  });
  server2.addTool({
    name: "update_journal",
    description: `Update an existing journal entry.
Can update date, reference, notes, and line items.
Line items must still balance after update.`,
    parameters: z4.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      journal_id: entityIdSchema.describe("Journal ID to update"),
      journal_date: optionalDateSchema.describe("New journal date (YYYY-MM-DD)"),
      reference_number: z4.string().max(100).optional().describe("New reference number"),
      notes: z4.string().max(2e3).optional().describe("New notes"),
      line_items: z4.array(lineItemSchema).min(2).optional().describe("New line items (replaces existing)")
    }),
    annotations: {
      title: "Update Journal",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const payload = {};
      if (args.journal_date) payload.journal_date = args.journal_date;
      if (args.reference_number) payload.reference_number = args.reference_number;
      if (args.notes) payload.notes = args.notes;
      if (args.line_items) {
        let totalDebits = 0;
        let totalCredits = 0;
        args.line_items.forEach((item) => {
          if (item.debit_or_credit === "debit") {
            totalDebits += item.amount;
          } else {
            totalCredits += item.amount;
          }
        });
        if (Math.abs(totalDebits - totalCredits) > 0.01) {
          return `**Validation Error**: Line items do not balance.
- Total Debits: ${totalDebits.toFixed(2)}
- Total Credits: ${totalCredits.toFixed(2)}`;
        }
        payload.line_items = args.line_items;
      }
      const result = await zohoPut(
        `/journals/${args.journal_id}`,
        args.organization_id,
        payload
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to update journal";
      }
      return `**Journal Updated Successfully**

Journal ID: \`${args.journal_id}\``;
    }
  });
  server2.addTool({
    name: "delete_journal",
    description: `Delete a journal entry.
This action cannot be undone. The journal will be permanently removed.`,
    parameters: z4.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      journal_id: entityIdSchema.describe("Journal ID to delete")
    }),
    annotations: {
      title: "Delete Journal",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoDelete(`/journals/${args.journal_id}`, args.organization_id);
      if (!result.ok) {
        return result.errorMessage || "Failed to delete journal";
      }
      return `**Journal Deleted Successfully**

Journal ID \`${args.journal_id}\` has been deleted.`;
    }
  });
  server2.addTool({
    name: "publish_journal",
    description: `Publish (mark as posted) a draft journal entry.
Published journals are finalized and affect account balances.`,
    parameters: z4.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      journal_id: entityIdSchema.describe("Journal ID to publish")
    }),
    annotations: {
      title: "Publish Journal",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoPost(
        `/journals/${args.journal_id}/status/publish`,
        args.organization_id,
        {}
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to publish journal";
      }
      return `**Journal Published Successfully**

Journal ID \`${args.journal_id}\` has been marked as published.`;
    }
  });
  server2.addTool({
    name: "add_journal_attachment",
    description: `Upload a file attachment to a journal entry.
Supported file types: PDF, PNG, JPG, JPEG, GIF, DOC, DOCX, XLS, XLSX.
Use this to attach invoices, receipts, or supporting documents to journal entries.
Files must be in allowed directories and under 10MB.`,
    parameters: z4.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      journal_id: entityIdSchema.describe("Journal ID to attach file to"),
      file_path: z4.string().max(500).describe("Full local file path to the attachment")
    }),
    annotations: {
      title: "Add Journal Attachment",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoUploadAttachment(
        `/journals/${args.journal_id}/attachment`,
        args.organization_id,
        args.file_path
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to upload attachment";
      }
      return `**Attachment Added Successfully**

- **Journal ID**: \`${args.journal_id}\`
- **File**: ${args.file_path.split("/").pop()}

The attachment is now associated with this journal entry.`;
    }
  });
  server2.addTool({
    name: "get_journal_attachment",
    description: `Get attachment information for a journal entry.
Returns details about any files attached to the journal.`,
    parameters: z4.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      journal_id: entityIdSchema.describe("Journal ID")
    }),
    annotations: {
      title: "Get Journal Attachment",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoGet(
        `/journals/${args.journal_id}/attachment`,
        args.organization_id
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to get attachment";
      }
      const attachment = result.data?.attachment;
      const documents = result.data?.documents || [];
      if (!attachment && documents.length === 0) {
        return `No attachments found for journal \`${args.journal_id}\`.`;
      }
      let details = `**Journal Attachments**

- **Journal ID**: \`${args.journal_id}\`
`;
      if (attachment) {
        details += `
**Attachment**:
- File: ${attachment.file_name}
- Size: ${attachment.file_size_formatted || "Unknown"}`;
      }
      if (documents.length > 0) {
        details += `

**Documents** (${documents.length}):`;
        documents.forEach((doc, i) => {
          details += `
${i + 1}. ${doc.file_name} (${doc.file_size_formatted || "Unknown"})`;
        });
      }
      return details;
    }
  });
  server2.addTool({
    name: "delete_journal_attachment",
    description: `Delete attachment from a journal entry.
Removes the file association from the journal.`,
    parameters: z4.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      journal_id: entityIdSchema.describe("Journal ID")
    }),
    annotations: {
      title: "Delete Journal Attachment",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoDeleteAttachment(
        `/journals/${args.journal_id}/attachment`,
        args.organization_id
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to delete attachment";
      }
      return `**Attachment Deleted Successfully**

Attachment removed from journal \`${args.journal_id}\`.`;
    }
  });
}

// src/tools/expenses.ts
import { z as z5 } from "zod";
function registerExpenseTools(server2) {
  server2.addTool({
    name: "list_expenses",
    description: `List all expenses.
Supports filtering by date, status, and customer.
Returns expense details with account, amount, and vendor info.`,
    parameters: z5.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      date_start: optionalDateSchema.describe("Start date (YYYY-MM-DD)"),
      date_end: optionalDateSchema.describe("End date (YYYY-MM-DD)"),
      status: z5.enum(["unbilled", "invoiced", "reimbursed", "non-billable"]).optional().describe("Filter by status"),
      customer_id: entityIdSchema.optional().describe("Filter by customer"),
      vendor_id: entityIdSchema.optional().describe("Filter by vendor"),
      sort_column: z5.enum(["date", "amount", "created_time"]).optional(),
      page: z5.number().int().positive().optional(),
      per_page: z5.number().int().min(1).max(200).optional()
    }),
    annotations: {
      title: "List Expenses",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const queryParams = {};
      if (args.date_start) queryParams.date_start = args.date_start;
      if (args.date_end) queryParams.date_end = args.date_end;
      if (args.status) queryParams.status = args.status;
      if (args.customer_id) queryParams.customer_id = args.customer_id;
      if (args.vendor_id) queryParams.vendor_id = args.vendor_id;
      if (args.sort_column) queryParams.sort_column = args.sort_column;
      if (args.page) queryParams.page = args.page.toString();
      if (args.per_page) queryParams.per_page = args.per_page.toString();
      const result = await zohoGet(
        "/expenses",
        args.organization_id,
        queryParams
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to list expenses";
      }
      const expenses = result.data?.expenses || [];
      if (expenses.length === 0) {
        return "No expenses found.";
      }
      const formatted = expenses.map((e, index) => {
        const amt = e.amount ?? e.total ?? "N/A";
        return `${index + 1}. **${e.date}** - ${e.currency_code || "INR"} ${amt}
   - Expense ID: \`${e.expense_id}\`
   - Account: ${e.account_name || e.account_id}
   - Vendor: ${e.vendor_name || "N/A"}
   - Status: ${e.status || "N/A"}
   - Description: ${e.description || "N/A"}`;
      }).join("\n\n");
      return `**Expenses** (${expenses.length} items)

${formatted}`;
    }
  });
  server2.addTool({
    name: "get_expense",
    description: `Get detailed information about a specific expense.
Returns full expense details including account, vendor, and billable status.`,
    parameters: z5.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      expense_id: entityIdSchema.describe("Expense ID")
    }),
    annotations: {
      title: "Get Expense Details",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoGet(
        `/expenses/${args.expense_id}`,
        args.organization_id
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to get expense";
      }
      const expense = result.data?.expense;
      if (!expense) {
        return "Expense not found";
      }
      return `**Expense Details**

- **Expense ID**: \`${expense.expense_id}\`
- **Date**: ${expense.date}
- **Amount**: ${expense.currency_code || "INR"} ${expense.amount}
- **Account**: ${expense.account_name || expense.account_id}
- **Paid Through**: ${expense.paid_through_account_name || expense.paid_through_account_id || "N/A"}
- **Vendor**: ${expense.vendor_name || "N/A"}
- **Customer**: ${expense.customer_name || "N/A"}
- **Billable**: ${expense.is_billable ? "Yes" : "No"}
- **Status**: ${expense.status || "N/A"}
- **Reference**: ${expense.reference_number || "N/A"}
- **Description**: ${expense.description || "N/A"}`;
    }
  });
  server2.addTool({
    name: "create_expense",
    description: `Create a new expense record.
Requires account_id (expense account) and paid_through_account_id (payment account).
Use list_accounts to find valid account IDs.`,
    parameters: z5.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      account_id: entityIdSchema.describe("Expense account ID"),
      paid_through_account_id: entityIdSchema.describe(
        "Payment account ID (bank/cash/credit card)"
      ),
      date: dateSchema.describe("Expense date (YYYY-MM-DD)"),
      amount: moneySchema.describe("Expense amount (max 999,999,999.99, 2 decimal places)"),
      description: z5.string().max(500).optional().describe("Description of the expense"),
      reference_number: z5.string().max(100).optional().describe("Reference number"),
      customer_id: entityIdSchema.optional().describe("Customer ID if billable"),
      vendor_id: entityIdSchema.optional().describe("Vendor ID"),
      is_billable: z5.boolean().optional().describe("Whether expense is billable to a customer")
    }),
    annotations: {
      title: "Create Expense",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const payload = {
        account_id: args.account_id,
        paid_through_account_id: args.paid_through_account_id,
        date: args.date,
        amount: args.amount
      };
      if (args.description) payload.description = args.description;
      if (args.reference_number) payload.reference_number = args.reference_number;
      if (args.customer_id) payload.customer_id = args.customer_id;
      if (args.vendor_id) payload.vendor_id = args.vendor_id;
      if (args.is_billable !== void 0) payload.is_billable = args.is_billable;
      const result = await zohoPost(
        "/expenses",
        args.organization_id,
        payload
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to create expense";
      }
      const expense = result.data?.expense;
      if (!expense) {
        return "Expense created but no details returned";
      }
      return `**Expense Created Successfully**

- **Expense ID**: \`${expense.expense_id}\`
- **Date**: ${expense.date}
- **Amount**: ${expense.currency_code || "INR"} ${expense.amount}

Use this expense_id to add receipts.`;
    }
  });
  server2.addTool({
    name: "add_expense_receipt",
    description: `Upload a receipt attachment to an expense.
Supported file types: PDF, PNG, JPG, JPEG, GIF, DOC, DOCX, XLS, XLSX.
Use this to attach scanned receipts or invoice images.
Files must be in allowed directories and under 10MB.`,
    parameters: z5.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      expense_id: entityIdSchema.describe("Expense ID to attach receipt to"),
      file_path: z5.string().max(500).describe("Full local file path to the receipt")
    }),
    annotations: {
      title: "Add Expense Receipt",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoUploadAttachment(
        `/expenses/${args.expense_id}/attachment`,
        args.organization_id,
        args.file_path
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to upload receipt";
      }
      return `**Receipt Added Successfully**

- **Expense ID**: \`${args.expense_id}\`
- **File**: ${args.file_path.split("/").pop()}`;
    }
  });
  server2.addTool({
    name: "get_expense_receipt",
    description: `Get receipt/attachment information for an expense.
Returns details about any files attached to the expense.`,
    parameters: z5.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      expense_id: entityIdSchema.describe("Expense ID")
    }),
    annotations: {
      title: "Get Expense Receipt",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoGet(
        `/expenses/${args.expense_id}/attachment`,
        args.organization_id
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to get receipt";
      }
      const documents = result.data?.documents || [];
      if (documents.length === 0) {
        return `No receipts found for expense \`${args.expense_id}\`.`;
      }
      let details = `**Expense Receipts**

- **Expense ID**: \`${args.expense_id}\`

**Documents** (${documents.length}):`;
      documents.forEach((doc, i) => {
        details += `
${i + 1}. ${doc.file_name} (${doc.file_size_formatted || "Unknown"})`;
      });
      return details;
    }
  });
  server2.addTool({
    name: "delete_expense_receipt",
    description: `Delete receipt/attachment from an expense.
Removes the file association from the expense.`,
    parameters: z5.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      expense_id: entityIdSchema.describe("Expense ID")
    }),
    annotations: {
      title: "Delete Expense Receipt",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoDeleteAttachment(
        `/expenses/${args.expense_id}/attachment`,
        args.organization_id
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to delete receipt";
      }
      return `**Receipt Deleted Successfully**

Receipt removed from expense \`${args.expense_id}\`.`;
    }
  });
}

// src/tools/bills.ts
import { z as z6 } from "zod";
var billLineItemSchema = z6.object({
  account_id: z6.string().describe("Account ID from chart of accounts"),
  description: z6.string().optional().describe("Description for this line item"),
  rate: z6.number().positive().describe("Rate/amount for this line item"),
  quantity: z6.number().positive().default(1).describe("Quantity (default 1)"),
  tax_id: z6.string().optional().describe("Tax ID if applicable")
});
function registerBillTools(server2) {
  server2.addTool({
    name: "list_bills",
    description: `List all bills (accounts payable).
Supports filtering by date, vendor, and status.
Returns bill details with vendor, amount, and due date.`,
    parameters: z6.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      date_start: z6.string().optional().describe("Start date (YYYY-MM-DD)"),
      date_end: z6.string().optional().describe("End date (YYYY-MM-DD)"),
      vendor_id: z6.string().optional().describe("Filter by vendor"),
      status: z6.enum(["draft", "open", "overdue", "paid", "void", "partially_paid"]).optional().describe("Filter by status"),
      sort_column: z6.enum(["date", "due_date", "total", "created_time"]).optional(),
      page: z6.number().int().positive().optional(),
      per_page: z6.number().int().min(1).max(200).optional()
    }),
    annotations: {
      title: "List Bills",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const queryParams = {};
      if (args.date_start) queryParams.date_start = args.date_start;
      if (args.date_end) queryParams.date_end = args.date_end;
      if (args.vendor_id) queryParams.vendor_id = args.vendor_id;
      if (args.status) queryParams.status = args.status;
      if (args.sort_column) queryParams.sort_column = args.sort_column;
      if (args.page) queryParams.page = args.page.toString();
      if (args.per_page) queryParams.per_page = args.per_page.toString();
      const result = await zohoGet("/bills", args.organization_id, queryParams);
      if (!result.ok) {
        return result.errorMessage || "Failed to list bills";
      }
      const bills = result.data?.bills || [];
      if (bills.length === 0) {
        return "No bills found.";
      }
      const formatted = bills.map((b, index) => {
        return `${index + 1}. **${b.bill_number || "No number"}** - ${b.vendor_name || "Unknown vendor"}
   - Bill ID: \`${b.bill_id}\`
   - Date: ${b.date}
   - Due: ${b.due_date || "N/A"}
   - Total: ${b.currency_code || "INR"} ${b.total}
   - Balance: ${b.currency_code || "INR"} ${b.balance || 0}
   - Status: ${b.status || "N/A"}`;
      }).join("\n\n");
      return `**Bills** (${bills.length} items)

${formatted}`;
    }
  });
  server2.addTool({
    name: "get_bill",
    description: `Get detailed information about a specific bill.
Returns full bill details including line items and vendor info.`,
    parameters: z6.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      bill_id: z6.string().describe("Bill ID")
    }),
    annotations: {
      title: "Get Bill Details",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoGet(`/bills/${args.bill_id}`, args.organization_id);
      if (!result.ok) {
        return result.errorMessage || "Failed to get bill";
      }
      const bill = result.data?.bill;
      if (!bill) {
        return "Bill not found";
      }
      let details = `**Bill Details**

- **Bill ID**: \`${bill.bill_id}\`
- **Bill Number**: ${bill.bill_number || "N/A"}
- **Vendor**: ${bill.vendor_name || bill.vendor_id}
- **Date**: ${bill.date}
- **Due Date**: ${bill.due_date || "N/A"}
- **Total**: ${bill.currency_code || "INR"} ${bill.total}
- **Balance**: ${bill.currency_code || "INR"} ${bill.balance || 0}
- **Status**: ${bill.status || "N/A"}
- **Reference**: ${bill.reference_number || "N/A"}
- **Notes**: ${bill.notes || "N/A"}

**Line Items**:`;
      if (bill.line_items && bill.line_items.length > 0) {
        bill.line_items.forEach((item, i) => {
          const lineTotal = item.item_total ?? item.amount ?? "N/A";
          details += `
${i + 1}. ${item.account_name || item.account_id} - ${bill.currency_code || "INR"} ${lineTotal}`;
          if (item.description) details += `
   Description: ${item.description}`;
        });
      }
      return details;
    }
  });
  server2.addTool({
    name: "create_bill",
    description: `Create a new bill (accounts payable).
Use list_contacts to find vendor_id values.
Use list_accounts to find account_id values for line items.`,
    parameters: z6.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      vendor_id: z6.string().describe("Vendor ID"),
      bill_number: z6.string().optional().describe("Bill/Invoice number from vendor"),
      date: z6.string().describe("Bill date (YYYY-MM-DD)"),
      due_date: z6.string().optional().describe("Payment due date (YYYY-MM-DD)"),
      reference_number: z6.string().optional().describe("Reference number"),
      notes: z6.string().optional().describe("Notes"),
      line_items: z6.array(billLineItemSchema).min(1).describe("Array of line items")
    }),
    annotations: {
      title: "Create Bill",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const payload = {
        vendor_id: args.vendor_id,
        date: args.date,
        line_items: args.line_items
      };
      if (args.bill_number) payload.bill_number = args.bill_number;
      if (args.due_date) payload.due_date = args.due_date;
      if (args.reference_number) payload.reference_number = args.reference_number;
      if (args.notes) payload.notes = args.notes;
      const result = await zohoPost("/bills", args.organization_id, payload);
      if (!result.ok) {
        return result.errorMessage || "Failed to create bill";
      }
      const bill = result.data?.bill;
      if (!bill) {
        return "Bill created but no details returned";
      }
      return `**Bill Created Successfully**

- **Bill ID**: \`${bill.bill_id}\`
- **Bill Number**: ${bill.bill_number || "N/A"}
- **Date**: ${bill.date}
- **Total**: ${bill.currency_code || "INR"} ${bill.total}

Use this bill_id to add attachments.`;
    }
  });
  server2.addTool({
    name: "add_bill_attachment",
    description: `Upload a file attachment to a bill.
Supported file types: PDF, PNG, JPG, JPEG, GIF, DOC, DOCX, XLS, XLSX.
Use this to attach vendor invoices or supporting documents.`,
    parameters: z6.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      bill_id: z6.string().describe("Bill ID to attach file to"),
      file_path: z6.string().describe("Full local file path to the attachment")
    }),
    annotations: {
      title: "Add Bill Attachment",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoUploadAttachment(
        `/bills/${args.bill_id}/attachment`,
        args.organization_id,
        args.file_path
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to upload attachment";
      }
      return `**Attachment Added Successfully**

- **Bill ID**: \`${args.bill_id}\`
- **File**: ${args.file_path.split("/").pop()}`;
    }
  });
  server2.addTool({
    name: "get_bill_attachment",
    description: `Get attachment information for a bill.
Returns details about any files attached to the bill.`,
    parameters: z6.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      bill_id: z6.string().describe("Bill ID")
    }),
    annotations: {
      title: "Get Bill Attachment",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoGet(
        `/bills/${args.bill_id}/attachment`,
        args.organization_id
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to get attachment";
      }
      const documents = result.data?.documents || [];
      if (documents.length === 0) {
        return `No attachments found for bill \`${args.bill_id}\`.`;
      }
      let details = `**Bill Attachments**

- **Bill ID**: \`${args.bill_id}\`

**Documents** (${documents.length}):`;
      documents.forEach((doc, i) => {
        details += `
${i + 1}. ${doc.file_name} (${doc.file_size_formatted || "Unknown"})`;
      });
      return details;
    }
  });
  server2.addTool({
    name: "delete_bill_attachment",
    description: `Delete attachment from a bill.
Removes the file association from the bill.`,
    parameters: z6.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      bill_id: z6.string().describe("Bill ID")
    }),
    annotations: {
      title: "Delete Bill Attachment",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoDeleteAttachment(
        `/bills/${args.bill_id}/attachment`,
        args.organization_id
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to delete attachment";
      }
      return `**Attachment Deleted Successfully**

Attachment removed from bill \`${args.bill_id}\`.`;
    }
  });
}

// src/tools/invoices.ts
import { z as z7 } from "zod";
var invoiceLineItemSchema = z7.object({
  item_id: z7.string().optional().describe("Item ID from items catalog"),
  name: z7.string().optional().describe("Item name (if not using item_id)"),
  description: z7.string().optional().describe("Line item description"),
  quantity: z7.number().positive().default(1).describe("Quantity"),
  rate: z7.number().nonnegative().describe("Unit rate/price"),
  tax_id: z7.string().optional().describe("Tax ID"),
  discount: z7.number().optional().describe("Discount percentage")
});
function registerInvoiceTools(server2) {
  server2.addTool({
    name: "list_invoices",
    description: `List all customer invoices (accounts receivable).
Supports filtering by date, customer, and status.
Returns invoice details with customer, amount, and due date.`,
    parameters: z7.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      date_start: z7.string().optional().describe("Start date (YYYY-MM-DD)"),
      date_end: z7.string().optional().describe("End date (YYYY-MM-DD)"),
      customer_id: z7.string().optional().describe("Filter by customer"),
      status: z7.enum(["draft", "sent", "overdue", "paid", "void", "partially_paid"]).optional().describe("Filter by status"),
      sort_column: z7.enum(["date", "due_date", "total", "created_time"]).optional(),
      page: z7.number().int().positive().optional(),
      per_page: z7.number().int().min(1).max(200).optional()
    }),
    annotations: {
      title: "List Invoices",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const queryParams = {};
      if (args.date_start) queryParams.date_start = args.date_start;
      if (args.date_end) queryParams.date_end = args.date_end;
      if (args.customer_id) queryParams.customer_id = args.customer_id;
      if (args.status) queryParams.status = args.status;
      if (args.sort_column) queryParams.sort_column = args.sort_column;
      if (args.page) queryParams.page = args.page.toString();
      if (args.per_page) queryParams.per_page = args.per_page.toString();
      const result = await zohoGet(
        "/invoices",
        args.organization_id,
        queryParams
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to list invoices";
      }
      const invoices = result.data?.invoices || [];
      if (invoices.length === 0) {
        return "No invoices found.";
      }
      const formatted = invoices.map((inv, index) => {
        return `${index + 1}. **${inv.invoice_number}** - ${inv.customer_name || "Unknown customer"}
   - Invoice ID: \`${inv.invoice_id}\`
   - Date: ${inv.date}
   - Due: ${inv.due_date || "N/A"}
   - Total: ${inv.currency_code || "INR"} ${inv.total}
   - Balance: ${inv.currency_code || "INR"} ${inv.balance || 0}
   - Status: ${inv.status || "N/A"}`;
      }).join("\n\n");
      return `**Invoices** (${invoices.length} items)

${formatted}`;
    }
  });
  server2.addTool({
    name: "get_invoice",
    description: `Get detailed information about a specific invoice.
Returns full invoice details including line items and customer info.`,
    parameters: z7.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      invoice_id: z7.string().describe("Invoice ID")
    }),
    annotations: {
      title: "Get Invoice Details",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoGet(
        `/invoices/${args.invoice_id}`,
        args.organization_id
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to get invoice";
      }
      const invoice = result.data?.invoice;
      if (!invoice) {
        return "Invoice not found";
      }
      let details = `**Invoice Details**

- **Invoice ID**: \`${invoice.invoice_id}\`
- **Invoice Number**: ${invoice.invoice_number}
- **Customer**: ${invoice.customer_name || invoice.customer_id}
- **Date**: ${invoice.date}
- **Due Date**: ${invoice.due_date || "N/A"}
- **Total**: ${invoice.currency_code || "INR"} ${invoice.total}
- **Balance**: ${invoice.currency_code || "INR"} ${invoice.balance || 0}
- **Status**: ${invoice.status || "N/A"}
- **Reference**: ${invoice.reference_number || "N/A"}
- **Notes**: ${invoice.notes || "N/A"}`;
      if (invoice.line_items && invoice.line_items.length > 0) {
        details += `

**Line Items**:`;
        invoice.line_items.forEach((item, i) => {
          const lineTotal = item.item_total ?? item.amount ?? "N/A";
          details += `
${i + 1}. ${item.name || item.description || "Item"} - ${invoice.currency_code || "INR"} ${lineTotal}`;
          if (item.quantity && item.rate) {
            details += ` (${item.quantity} x ${item.rate})`;
          }
        });
      }
      return details;
    }
  });
  server2.addTool({
    name: "add_invoice_attachment",
    description: `Upload a file attachment to an invoice.
Supported file types: PDF, PNG, JPG, JPEG, GIF, DOC, DOCX, XLS, XLSX.
Use this to attach supporting documents to invoices.`,
    parameters: z7.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      invoice_id: z7.string().describe("Invoice ID to attach file to"),
      file_path: z7.string().describe("Full local file path to the attachment")
    }),
    annotations: {
      title: "Add Invoice Attachment",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoUploadAttachment(
        `/invoices/${args.invoice_id}/attachment`,
        args.organization_id,
        args.file_path
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to upload attachment";
      }
      return `**Attachment Added Successfully**

- **Invoice ID**: \`${args.invoice_id}\`
- **File**: ${args.file_path.split("/").pop()}`;
    }
  });
  server2.addTool({
    name: "get_invoice_attachment",
    description: `Get attachment information for an invoice.
Returns details about any files attached to the invoice.`,
    parameters: z7.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      invoice_id: z7.string().describe("Invoice ID")
    }),
    annotations: {
      title: "Get Invoice Attachment",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoGet(
        `/invoices/${args.invoice_id}/attachment`,
        args.organization_id
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to get attachment";
      }
      const documents = result.data?.documents || [];
      if (documents.length === 0) {
        return `No attachments found for invoice \`${args.invoice_id}\`.`;
      }
      let details = `**Invoice Attachments**

- **Invoice ID**: \`${args.invoice_id}\`

**Documents** (${documents.length}):`;
      documents.forEach((doc, i) => {
        details += `
${i + 1}. ${doc.file_name} (${doc.file_size_formatted || "Unknown"})`;
      });
      return details;
    }
  });
  server2.addTool({
    name: "delete_invoice_attachment",
    description: `Delete attachment from an invoice.
Removes the file association from the invoice.`,
    parameters: z7.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      invoice_id: z7.string().describe("Invoice ID")
    }),
    annotations: {
      title: "Delete Invoice Attachment",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoDeleteAttachment(
        `/invoices/${args.invoice_id}/attachment`,
        args.organization_id
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to delete attachment";
      }
      return `**Attachment Deleted Successfully**

Attachment removed from invoice \`${args.invoice_id}\`.`;
    }
  });
  server2.addTool({
    name: "create_invoice",
    description: `Create a new customer invoice.
Requires customer ID, date, and at least one line item.
Optionally provide estimate_id to convert an estimate into an invoice.`,
    parameters: z7.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      customer_id: z7.string().describe("Customer ID (required)"),
      date: z7.string().describe("Invoice date (YYYY-MM-DD)"),
      due_date: z7.string().optional().describe("Due date (YYYY-MM-DD)"),
      invoice_number: z7.string().optional().describe("Custom invoice number"),
      payment_terms: z7.number().int().optional().describe("Payment terms in days"),
      reference_number: z7.string().optional().describe("Reference number"),
      notes: z7.string().optional().describe("Notes to the customer"),
      terms: z7.string().optional().describe("Terms and conditions"),
      line_items: z7.array(invoiceLineItemSchema).min(1).describe("Invoice line items (at least one required)"),
      estimate_id: z7.string().optional().describe("Estimate ID to convert into this invoice")
    }),
    annotations: {
      title: "Create Invoice",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const body = {
        customer_id: args.customer_id,
        date: args.date,
        line_items: args.line_items
      };
      if (args.due_date) body.due_date = args.due_date;
      if (args.invoice_number) body.invoice_number = args.invoice_number;
      if (args.payment_terms !== void 0) body.payment_terms = args.payment_terms;
      if (args.reference_number) body.reference_number = args.reference_number;
      if (args.notes) body.notes = args.notes;
      if (args.terms) body.terms = args.terms;
      if (args.estimate_id) body.estimate_id = args.estimate_id;
      const result = await zohoPost(
        "/invoices",
        args.organization_id,
        body
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to create invoice";
      }
      const invoice = result.data?.invoice;
      if (!invoice) {
        return "Invoice created but no details returned";
      }
      return `**Invoice Created Successfully**

- **Invoice ID**: \`${invoice.invoice_id}\`
- **Invoice Number**: ${invoice.invoice_number}
- **Customer**: ${invoice.customer_name || invoice.customer_id}
- **Date**: ${invoice.date}
- **Due Date**: ${invoice.due_date || "N/A"}
- **Total**: ${invoice.currency_code || "INR"} ${invoice.total}
- **Status**: ${invoice.status || "draft"}`;
    }
  });
  server2.addTool({
    name: "update_invoice",
    description: `Update an existing invoice.
Only provided fields will be updated; omitted fields remain unchanged.
Invoice must be in draft or sent status to be updated.`,
    parameters: z7.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      invoice_id: z7.string().describe("Invoice ID to update"),
      date: z7.string().optional().describe("Updated invoice date (YYYY-MM-DD)"),
      due_date: z7.string().optional().describe("Updated due date (YYYY-MM-DD)"),
      reference_number: z7.string().optional().describe("Updated reference number"),
      notes: z7.string().optional().describe("Updated notes"),
      terms: z7.string().optional().describe("Updated terms and conditions"),
      line_items: z7.array(invoiceLineItemSchema).optional().describe("Updated line items (replaces all existing)")
    }),
    annotations: {
      title: "Update Invoice",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const body = {};
      if (args.date) body.date = args.date;
      if (args.due_date) body.due_date = args.due_date;
      if (args.reference_number) body.reference_number = args.reference_number;
      if (args.notes) body.notes = args.notes;
      if (args.terms) body.terms = args.terms;
      if (args.line_items) body.line_items = args.line_items;
      const result = await zohoPut(
        `/invoices/${args.invoice_id}`,
        args.organization_id,
        body
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to update invoice";
      }
      const invoice = result.data?.invoice;
      if (!invoice) {
        return "Invoice updated but no details returned";
      }
      return `**Invoice Updated Successfully**

- **Invoice ID**: \`${invoice.invoice_id}\`
- **Invoice Number**: ${invoice.invoice_number}
- **Customer**: ${invoice.customer_name || invoice.customer_id}
- **Date**: ${invoice.date}
- **Due Date**: ${invoice.due_date || "N/A"}
- **Total**: ${invoice.currency_code || "INR"} ${invoice.total}
- **Status**: ${invoice.status || "N/A"}`;
    }
  });
  server2.addTool({
    name: "send_invoice",
    description: `Mark an invoice as sent.
Changes the invoice status from draft to sent.`,
    parameters: z7.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      invoice_id: z7.string().describe("Invoice ID to mark as sent")
    }),
    annotations: {
      title: "Send Invoice",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoPost(
        `/invoices/${args.invoice_id}/status/sent`,
        args.organization_id
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to mark invoice as sent";
      }
      return `**Invoice Marked as Sent**

Invoice \`${args.invoice_id}\` has been marked as sent.`;
    }
  });
  server2.addTool({
    name: "void_invoice",
    description: `Void an invoice.
Marks the invoice as void. This action cannot be undone.`,
    parameters: z7.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      invoice_id: z7.string().describe("Invoice ID to void")
    }),
    annotations: {
      title: "Void Invoice",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoPost(
        `/invoices/${args.invoice_id}/status/void`,
        args.organization_id
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to void invoice";
      }
      return `**Invoice Voided**

Invoice \`${args.invoice_id}\` has been voided.`;
    }
  });
  server2.addTool({
    name: "email_invoice",
    description: `Email an invoice to specified recipients.
Sends the invoice PDF to the provided email addresses.`,
    parameters: z7.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      invoice_id: z7.string().describe("Invoice ID to email"),
      to_mail_ids: z7.array(z7.string()).min(1).describe("Recipient email addresses"),
      subject: z7.string().optional().describe("Email subject line"),
      body: z7.string().optional().describe("Email body text")
    }),
    annotations: {
      title: "Email Invoice",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const emailBody = {
        to_mail_ids: args.to_mail_ids
      };
      if (args.subject) emailBody.subject = args.subject;
      if (args.body) emailBody.body = args.body;
      const result = await zohoPost(
        `/invoices/${args.invoice_id}/email`,
        args.organization_id,
        emailBody
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to email invoice";
      }
      return `**Invoice Emailed Successfully**

- **Invoice ID**: \`${args.invoice_id}\`
- **Sent to**: ${args.to_mail_ids.join(", ")}`;
    }
  });
}

// src/tools/contacts.ts
import { z as z8 } from "zod";
function registerContactTools(server2) {
  server2.addTool({
    name: "list_contacts",
    description: `List all contacts (customers and vendors).
Supports filtering by contact type (customer or vendor).
Use this to find contact_id values for bills, invoices, and expenses.`,
    parameters: z8.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      contact_type: z8.enum(["customer", "vendor"]).optional().describe("Filter by contact type"),
      status: z8.enum(["active", "inactive", "crm", "all"]).optional().describe("Filter by status"),
      search_text: z8.string().optional().describe("Search by name or company"),
      sort_column: z8.enum(["contact_name", "company_name", "created_time"]).optional(),
      page: z8.number().int().positive().optional(),
      per_page: z8.number().int().min(1).max(200).optional()
    }),
    annotations: {
      title: "List Contacts",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const queryParams = {};
      if (args.contact_type) queryParams.contact_type = args.contact_type;
      if (args.status) queryParams.status = args.status;
      if (args.search_text) queryParams.search_text = args.search_text;
      if (args.sort_column) queryParams.sort_column = args.sort_column;
      if (args.page) queryParams.page = args.page.toString();
      if (args.per_page) queryParams.per_page = args.per_page.toString();
      const result = await zohoGet(
        "/contacts",
        args.organization_id,
        queryParams
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to list contacts";
      }
      const contacts = result.data?.contacts || [];
      if (contacts.length === 0) {
        return "No contacts found.";
      }
      const formatted = contacts.map((c, index) => {
        return `${index + 1}. **${c.contact_name}** (${c.contact_type})
   - Contact ID: \`${c.contact_id}\`
   - Company: ${c.company_name || "N/A"}
   - Email: ${c.email || "N/A"}
   - Phone: ${c.phone || "N/A"}
   - Status: ${c.status}`;
      }).join("\n\n");
      return `**Contacts** (${contacts.length} items)

${formatted}`;
    }
  });
  server2.addTool({
    name: "get_contact",
    description: `Get detailed information about a specific contact.
Returns full contact details including payment terms and currency settings.`,
    parameters: z8.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      contact_id: z8.string().describe("Contact ID")
    }),
    annotations: {
      title: "Get Contact Details",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoGet(
        `/contacts/${args.contact_id}`,
        args.organization_id
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to get contact";
      }
      const contact = result.data?.contact;
      if (!contact) {
        return "Contact not found";
      }
      return `**Contact Details**

- **Contact ID**: \`${contact.contact_id}\`
- **Name**: ${contact.contact_name}
- **Type**: ${contact.contact_type}
- **Company**: ${contact.company_name || "N/A"}
- **Email**: ${contact.email || "N/A"}
- **Phone**: ${contact.phone || "N/A"}
- **Status**: ${contact.status}
- **Payment Terms**: ${contact.payment_terms ? `${contact.payment_terms} days` : "N/A"}
- **Currency**: ${contact.currency_code || "N/A"}`;
    }
  });
  server2.addTool({
    name: "create_contact",
    description: `Create a new contact (customer or vendor).
Provide contact details including name, type, and optional fields like email, phone, GST info.`,
    parameters: z8.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      contact_name: z8.string().describe("Contact name (required)"),
      contact_type: z8.enum(["customer", "vendor"]).describe("Contact type: customer or vendor"),
      company_name: z8.string().optional().describe("Company name"),
      email: z8.string().optional().describe("Email address"),
      phone: z8.string().optional().describe("Phone number"),
      gst_no: z8.string().optional().describe("GST number"),
      gst_treatment: z8.enum(["registered", "unregistered", "consumer", "overseas"]).optional().describe("GST treatment type"),
      place_of_supply: z8.string().optional().describe("Place of supply (state code for GST)"),
      payment_terms: z8.number().int().optional().describe("Payment terms in days"),
      notes: z8.string().optional().describe("Notes about the contact")
    }),
    annotations: {
      title: "Create Contact",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const body = {
        contact_name: args.contact_name,
        contact_type: args.contact_type
      };
      if (args.company_name) body.company_name = args.company_name;
      if (args.email) body.email = args.email;
      if (args.phone) body.phone = args.phone;
      if (args.gst_no) body.gst_no = args.gst_no;
      if (args.gst_treatment) body.gst_treatment = args.gst_treatment;
      if (args.place_of_supply) body.place_of_supply = args.place_of_supply;
      if (args.payment_terms !== void 0) body.payment_terms = args.payment_terms;
      if (args.notes) body.notes = args.notes;
      const result = await zohoPost(
        "/contacts",
        args.organization_id,
        body
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to create contact";
      }
      const contact = result.data?.contact;
      if (!contact) {
        return "Contact created but no details returned";
      }
      return `**Contact Created Successfully**

- **Contact ID**: \`${contact.contact_id}\`
- **Name**: ${contact.contact_name}
- **Type**: ${contact.contact_type}
- **Company**: ${contact.company_name || "N/A"}
- **Email**: ${contact.email || "N/A"}
- **Phone**: ${contact.phone || "N/A"}
- **Status**: ${contact.status}`;
    }
  });
  server2.addTool({
    name: "update_contact",
    description: `Update an existing contact's details.
Only provided fields will be updated; omitted fields remain unchanged.`,
    parameters: z8.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      contact_id: z8.string().describe("Contact ID to update"),
      contact_name: z8.string().optional().describe("Updated contact name"),
      company_name: z8.string().optional().describe("Updated company name"),
      email: z8.string().optional().describe("Updated email address"),
      phone: z8.string().optional().describe("Updated phone number"),
      gst_no: z8.string().optional().describe("Updated GST number"),
      payment_terms: z8.number().int().optional().describe("Updated payment terms in days")
    }),
    annotations: {
      title: "Update Contact",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const body = {};
      if (args.contact_name) body.contact_name = args.contact_name;
      if (args.company_name) body.company_name = args.company_name;
      if (args.email) body.email = args.email;
      if (args.phone) body.phone = args.phone;
      if (args.gst_no) body.gst_no = args.gst_no;
      if (args.payment_terms !== void 0) body.payment_terms = args.payment_terms;
      const result = await zohoPut(
        `/contacts/${args.contact_id}`,
        args.organization_id,
        body
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to update contact";
      }
      const contact = result.data?.contact;
      if (!contact) {
        return "Contact updated but no details returned";
      }
      return `**Contact Updated Successfully**

- **Contact ID**: \`${contact.contact_id}\`
- **Name**: ${contact.contact_name}
- **Type**: ${contact.contact_type}
- **Company**: ${contact.company_name || "N/A"}
- **Email**: ${contact.email || "N/A"}
- **Phone**: ${contact.phone || "N/A"}
- **Status**: ${contact.status}`;
    }
  });
  server2.addTool({
    name: "mark_contact_active",
    description: `Mark a contact as active.
Reactivates an inactive contact so they can be used in transactions.`,
    parameters: z8.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      contact_id: z8.string().describe("Contact ID to mark as active")
    }),
    annotations: {
      title: "Mark Contact Active",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoPost(
        `/contacts/${args.contact_id}/active`,
        args.organization_id
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to mark contact as active";
      }
      return `**Contact Marked Active**

Contact \`${args.contact_id}\` has been marked as active.`;
    }
  });
  server2.addTool({
    name: "mark_contact_inactive",
    description: `Mark a contact as inactive.
Deactivates a contact so they cannot be used in new transactions.`,
    parameters: z8.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      contact_id: z8.string().describe("Contact ID to mark as inactive")
    }),
    annotations: {
      title: "Mark Contact Inactive",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoPost(
        `/contacts/${args.contact_id}/inactive`,
        args.organization_id
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to mark contact as inactive";
      }
      return `**Contact Marked Inactive**

Contact \`${args.contact_id}\` has been marked as inactive.`;
    }
  });
}

// src/tools/bank-accounts.ts
import { z as z9 } from "zod";
function registerBankAccountTools(server2) {
  server2.addTool({
    name: "list_bank_accounts",
    description: `List all bank accounts in Zoho Books.
Returns bank account details with name, type, and balance.
These are the accounts linked in Zoho Books, not live bank data.`,
    parameters: z9.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      filter_by: z9.enum(["Status.All", "Status.Active", "Status.Inactive"]).optional().describe("Filter by status"),
      sort_column: z9.enum(["account_name", "account_type"]).optional()
    }),
    annotations: {
      title: "List Bank Accounts",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const queryParams = {};
      if (args.filter_by) queryParams.filter_by = args.filter_by;
      if (args.sort_column) queryParams.sort_column = args.sort_column;
      const result = await zohoGet(
        "/bankaccounts",
        args.organization_id,
        queryParams
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to list bank accounts";
      }
      const accounts = result.data?.bankaccounts || [];
      if (accounts.length === 0) {
        return "No bank accounts found.";
      }
      const formatted = accounts.map((acc, index) => {
        const balance = acc.balance !== void 0 ? ` | Balance: ${acc.currency_code || "INR"} ${acc.balance}` : "";
        const digitsOnly = acc.account_number?.replace(/\D/g, "");
        const maskedAccount = digitsOnly && digitsOnly.length >= 4 ? `****${digitsOnly.slice(-4)}` : "N/A";
        return `${index + 1}. **${acc.account_name}** (${acc.account_type})
   - Account ID: \`${acc.account_id}\`
   - Bank: ${acc.bank_name || "N/A"}
   - Account Number: ${maskedAccount}
   - Active: ${acc.is_active ? "Yes" : "No"}${balance}`;
      }).join("\n\n");
      return `**Bank Accounts** (${accounts.length} accounts)

${formatted}`;
    }
  });
  server2.addTool({
    name: "get_bank_account",
    description: `Get detailed information about a specific bank account.
Returns full bank account details including routing number and balance.`,
    parameters: z9.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      account_id: entityIdSchema.describe("Bank account ID")
    }),
    annotations: {
      title: "Get Bank Account Details",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoGet(
        `/bankaccounts/${args.account_id}`,
        args.organization_id
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to get bank account";
      }
      const account = result.data?.bankaccount;
      if (!account) {
        return "Bank account not found";
      }
      const accountDigits = account.account_number?.replace(/\D/g, "");
      const maskedAccount = accountDigits && accountDigits.length >= 4 ? `****${accountDigits.slice(-4)}` : "N/A";
      const routingDigits = account.routing_number?.replace(/\D/g, "");
      const maskedRouting = routingDigits && routingDigits.length >= 4 ? `****${routingDigits.slice(-4)}` : "N/A";
      return `**Bank Account Details**

- **Account ID**: \`${account.account_id}\`
- **Name**: ${account.account_name}
- **Type**: ${account.account_type}
- **Code**: ${account.account_code || "N/A"}
- **Bank Name**: ${account.bank_name || "N/A"}
- **Account Number**: ${maskedAccount}
- **Routing Number**: ${maskedRouting}
- **Currency**: ${account.currency_code || "N/A"}
- **Balance**: ${account.currency_code || "INR"} ${account.balance || 0}
- **Active**: ${account.is_active ? "Yes" : "No"}`;
    }
  });
  server2.addTool({
    name: "list_bank_transactions",
    description: `List bank transactions in Zoho Books.
Returns transactions recorded in Zoho Books for bank reconciliation.
These are transactions imported/entered in Zoho, not live bank feeds.`,
    parameters: z9.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      account_id: entityIdSchema.describe("Bank account ID"),
      date_start: optionalDateSchema.describe("Start date (YYYY-MM-DD)"),
      date_end: optionalDateSchema.describe("End date (YYYY-MM-DD)"),
      status: z9.enum(["All", "uncategorized", "categorized", "excluded"]).optional(),
      sort_column: z9.enum(["date", "amount"]).optional(),
      page: z9.number().int().positive().optional(),
      per_page: z9.number().int().min(1).max(200).optional()
    }),
    annotations: {
      title: "List Bank Transactions",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const queryParams = {
        account_id: args.account_id
      };
      if (args.date_start) queryParams.date_start = args.date_start;
      if (args.date_end) queryParams.date_end = args.date_end;
      if (args.status) queryParams.status = args.status;
      if (args.sort_column) queryParams.sort_column = args.sort_column;
      if (args.page) queryParams.page = args.page.toString();
      if (args.per_page) queryParams.per_page = args.per_page.toString();
      const result = await zohoGet(
        "/banktransactions",
        args.organization_id,
        queryParams
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to list bank transactions";
      }
      const transactions = result.data?.banktransactions || [];
      if (transactions.length === 0) {
        return "No bank transactions found.";
      }
      const formatted = transactions.map((tx, index) => {
        const amount = tx.debit_or_credit === "debit" ? `-${tx.amount}` : `+${tx.amount}`;
        return `${index + 1}. **${tx.date}** - ${tx.currency_code || "INR"} ${amount}
   - Transaction ID: \`${tx.transaction_id}\`
   - Type: ${tx.transaction_type}
   - Status: ${tx.status}
   - Payee: ${tx.payee || "N/A"}
   - Reference: ${tx.reference_number || "N/A"}
   - Description: ${tx.description || "N/A"}`;
      }).join("\n\n");
      return `**Bank Transactions** (${transactions.length} transactions)

${formatted}`;
    }
  });
}

// src/tools/customer-payments.ts
import { z as z10 } from "zod";
function registerCustomerPaymentTools(server2) {
  server2.addTool({
    name: "list_customer_payments",
    description: `List all customer payments (receipts).
Supports filtering by customer, date range, and pagination.
Returns payment details with customer, amount, and date.`,
    parameters: z10.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      customer_id: entityIdSchema.optional().describe("Filter by customer"),
      date_start: z10.string().optional().describe("Start date (YYYY-MM-DD)"),
      date_end: z10.string().optional().describe("End date (YYYY-MM-DD)"),
      page: z10.number().int().positive().optional(),
      per_page: z10.number().int().min(1).max(200).optional()
    }),
    annotations: {
      title: "List Customer Payments",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const queryParams = {};
      if (args.customer_id) queryParams.customer_id = args.customer_id;
      if (args.date_start) queryParams.date_start = args.date_start;
      if (args.date_end) queryParams.date_end = args.date_end;
      if (args.page) queryParams.page = args.page.toString();
      if (args.per_page) queryParams.per_page = args.per_page.toString();
      const result = await zohoGet(
        "/customerpayments",
        args.organization_id,
        queryParams
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to list customer payments";
      }
      const payments = result.data?.customerpayments || [];
      if (payments.length === 0) {
        return "No customer payments found.";
      }
      const formatted = payments.map((p, index) => {
        return `${index + 1}. **${p.date}** - ${p.currency_code || "INR"} ${p.amount}
   - Payment ID: \`${p.payment_id}\`
   - Customer: ${p.customer_name || p.customer_id}
   - Mode: ${p.payment_mode || "N/A"}
   - Reference: ${p.reference_number || "N/A"}
   - Status: ${p.status || "N/A"}`;
      }).join("\n\n");
      return `**Customer Payments** (${payments.length} items)

${formatted}`;
    }
  });
  server2.addTool({
    name: "get_customer_payment",
    description: `Get detailed information about a specific customer payment.
Returns full payment details including customer, amount, and applied invoices.`,
    parameters: z10.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      payment_id: entityIdSchema.describe("Customer Payment ID")
    }),
    annotations: {
      title: "Get Customer Payment Details",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoGet(
        `/customerpayments/${args.payment_id}`,
        args.organization_id
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to get customer payment";
      }
      const payment = result.data?.payment;
      if (!payment) {
        return "Customer payment not found";
      }
      return `**Customer Payment Details**

- **Payment ID**: \`${payment.payment_id}\`
- **Customer**: ${payment.customer_name || payment.customer_id}
- **Date**: ${payment.date}
- **Amount**: ${payment.currency_code || "INR"} ${payment.amount}
- **Payment Mode**: ${payment.payment_mode || "N/A"}
- **Account**: ${payment.account_name || payment.account_id || "N/A"}
- **Reference**: ${payment.reference_number || "N/A"}
- **Description**: ${payment.description || "N/A"}
- **Status**: ${payment.status || "N/A"}`;
    }
  });
  server2.addTool({
    name: "create_customer_payment",
    description: `Create a new customer payment (receipt).
Use list_contacts to find customer_id values.
Use list_accounts to find account_id (deposit-to account) values.
Optionally apply to specific invoices.`,
    parameters: z10.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      customer_id: entityIdSchema.describe("Customer ID"),
      amount: moneySchema.describe("Payment amount (max 999,999,999.99, 2 decimal places)"),
      date: dateSchema.describe("Payment date (YYYY-MM-DD)"),
      payment_mode: z10.enum(["cash", "check", "bankremittance", "banktransfer", "creditcard", "upi"]).optional().describe("Payment mode"),
      account_id: entityIdSchema.describe("Deposit-to account ID"),
      reference_number: z10.string().max(100).optional().describe("Reference number"),
      description: z10.string().max(500).optional().describe("Payment description"),
      invoices: z10.array(
        z10.object({
          invoice_id: z10.string().describe("Invoice ID to apply payment to"),
          amount_applied: z10.number().positive().describe("Amount to apply to this invoice")
        })
      ).optional().describe("Invoices to apply payment against")
    }),
    annotations: {
      title: "Create Customer Payment",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const payload = {
        customer_id: args.customer_id,
        amount: args.amount,
        date: args.date,
        account_id: args.account_id
      };
      if (args.payment_mode) payload.payment_mode = args.payment_mode;
      if (args.reference_number) payload.reference_number = args.reference_number;
      if (args.description) payload.description = args.description;
      if (args.invoices) payload.invoices = args.invoices;
      const result = await zohoPost(
        "/customerpayments",
        args.organization_id,
        payload
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to create customer payment";
      }
      const payment = result.data?.payment;
      if (!payment) {
        return "Customer payment created but no details returned";
      }
      return `**Customer Payment Created Successfully**

- **Payment ID**: \`${payment.payment_id}\`
- **Customer**: ${payment.customer_name || payment.customer_id}
- **Date**: ${payment.date}
- **Amount**: ${payment.currency_code || "INR"} ${payment.amount}

Use this payment_id to reference this payment.`;
    }
  });
  server2.addTool({
    name: "delete_customer_payment",
    description: `Delete a customer payment.
This will remove the payment record and unapply it from any invoices.`,
    parameters: z10.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      payment_id: entityIdSchema.describe("Customer Payment ID to delete")
    }),
    annotations: {
      title: "Delete Customer Payment",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoDelete(
        `/customerpayments/${args.payment_id}`,
        args.organization_id
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to delete customer payment";
      }
      return `**Customer Payment Deleted Successfully**

Payment \`${args.payment_id}\` has been deleted.`;
    }
  });
}

// src/tools/vendor-payments.ts
import { z as z11 } from "zod";
function registerVendorPaymentTools(server2) {
  server2.addTool({
    name: "list_vendor_payments",
    description: `List all vendor payments (bill payments).
Supports filtering by vendor and date range.
Returns payment details with vendor, amount, and date.`,
    parameters: z11.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      vendor_id: entityIdSchema.optional().describe("Filter by vendor"),
      date_start: z11.string().optional().describe("Start date (YYYY-MM-DD)"),
      date_end: z11.string().optional().describe("End date (YYYY-MM-DD)"),
      page: z11.number().int().positive().optional(),
      per_page: z11.number().int().min(1).max(200).optional()
    }),
    annotations: {
      title: "List Vendor Payments",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const queryParams = {};
      if (args.vendor_id) queryParams.vendor_id = args.vendor_id;
      if (args.date_start) queryParams.date_start = args.date_start;
      if (args.date_end) queryParams.date_end = args.date_end;
      if (args.page) queryParams.page = args.page.toString();
      if (args.per_page) queryParams.per_page = args.per_page.toString();
      const result = await zohoGet(
        "/vendorpayments",
        args.organization_id,
        queryParams
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to list vendor payments";
      }
      const payments = result.data?.vendorpayments || [];
      if (payments.length === 0) {
        return "No vendor payments found.";
      }
      const formatted = payments.map((p, index) => {
        return `${index + 1}. **${p.date}** - ${p.currency_code || "INR"} ${p.amount}
   - Payment ID: \`${p.payment_id}\`
   - Vendor: ${p.vendor_name || p.vendor_id}
   - Mode: ${p.payment_mode || "N/A"}
   - Paid Through: ${p.paid_through_account_name || p.paid_through_account_id || "N/A"}
   - Reference: ${p.reference_number || "N/A"}
   - Status: ${p.status || "N/A"}`;
      }).join("\n\n");
      return `**Vendor Payments** (${payments.length} items)

${formatted}`;
    }
  });
  server2.addTool({
    name: "get_vendor_payment",
    description: `Get detailed information about a specific vendor payment.
Returns full payment details including vendor, amount, and applied bills.`,
    parameters: z11.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      payment_id: entityIdSchema.describe("Vendor Payment ID")
    }),
    annotations: {
      title: "Get Vendor Payment Details",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoGet(
        `/vendorpayments/${args.payment_id}`,
        args.organization_id
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to get vendor payment";
      }
      const payment = result.data?.vendorpayment;
      if (!payment) {
        return "Vendor payment not found";
      }
      return `**Vendor Payment Details**

- **Payment ID**: \`${payment.payment_id}\`
- **Vendor**: ${payment.vendor_name || payment.vendor_id}
- **Date**: ${payment.date}
- **Amount**: ${payment.currency_code || "INR"} ${payment.amount}
- **Payment Mode**: ${payment.payment_mode || "N/A"}
- **Paid Through**: ${payment.paid_through_account_name || payment.paid_through_account_id || "N/A"}
- **Reference**: ${payment.reference_number || "N/A"}
- **Description**: ${payment.description || "N/A"}
- **Status**: ${payment.status || "N/A"}`;
    }
  });
  server2.addTool({
    name: "create_vendor_payment",
    description: `Create a new vendor payment (bill payment).
Use list_contacts to find vendor_id values.
Use list_accounts to find paid_through_account_id values.
Optionally apply to specific bills.`,
    parameters: z11.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      vendor_id: entityIdSchema.describe("Vendor ID"),
      amount: moneySchema.describe("Payment amount (max 999,999,999.99, 2 decimal places)"),
      date: dateSchema.describe("Payment date (YYYY-MM-DD)"),
      paid_through_account_id: entityIdSchema.describe("Payment account ID (bank/cash/credit card)"),
      payment_mode: z11.enum(["cash", "check", "bankremittance", "banktransfer", "creditcard", "upi"]).optional().describe("Payment mode"),
      reference_number: z11.string().max(100).optional().describe("Reference number"),
      description: z11.string().max(500).optional().describe("Payment description"),
      bills: z11.array(
        z11.object({
          bill_id: z11.string().describe("Bill ID to apply payment to"),
          amount_applied: z11.number().positive().describe("Amount to apply to this bill")
        })
      ).optional().describe("Bills to apply payment against")
    }),
    annotations: {
      title: "Create Vendor Payment",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const payload = {
        vendor_id: args.vendor_id,
        amount: args.amount,
        date: args.date,
        paid_through_account_id: args.paid_through_account_id
      };
      if (args.payment_mode) payload.payment_mode = args.payment_mode;
      if (args.reference_number) payload.reference_number = args.reference_number;
      if (args.description) payload.description = args.description;
      if (args.bills) payload.bills = args.bills;
      const result = await zohoPost(
        "/vendorpayments",
        args.organization_id,
        payload
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to create vendor payment";
      }
      const payment = result.data?.vendorpayment;
      if (!payment) {
        return "Vendor payment created but no details returned";
      }
      return `**Vendor Payment Created Successfully**

- **Payment ID**: \`${payment.payment_id}\`
- **Vendor**: ${payment.vendor_name || payment.vendor_id}
- **Date**: ${payment.date}
- **Amount**: ${payment.currency_code || "INR"} ${payment.amount}

Use this payment_id to reference this payment.`;
    }
  });
  server2.addTool({
    name: "delete_vendor_payment",
    description: `Delete a vendor payment.
This will remove the payment record and unapply it from any bills.`,
    parameters: z11.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      payment_id: entityIdSchema.describe("Vendor Payment ID to delete")
    }),
    annotations: {
      title: "Delete Vendor Payment",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoDelete(
        `/vendorpayments/${args.payment_id}`,
        args.organization_id
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to delete vendor payment";
      }
      return `**Vendor Payment Deleted Successfully**

Payment \`${args.payment_id}\` has been deleted.`;
    }
  });
}

// src/tools/items.ts
import { z as z12 } from "zod";
function registerItemTools(server2) {
  server2.addTool({
    name: "list_items",
    description: `List all items (products and services).
Supports filtering by name search and pagination.
Returns item details with name, rate, and type.`,
    parameters: z12.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      name: z12.string().optional().describe("Search items by name"),
      page: z12.number().int().positive().optional(),
      per_page: z12.number().int().min(1).max(200).optional()
    }),
    annotations: {
      title: "List Items",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const queryParams = {};
      if (args.name) queryParams.name = args.name;
      if (args.page) queryParams.page = args.page.toString();
      if (args.per_page) queryParams.per_page = args.per_page.toString();
      const result = await zohoGet(
        "/items",
        args.organization_id,
        queryParams
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to list items";
      }
      const items = result.data?.items || [];
      if (items.length === 0) {
        return "No items found.";
      }
      const formatted = items.map((item, index) => {
        return `${index + 1}. **${item.name}** - ${item.currency_code || "INR"} ${item.rate}
   - Item ID: \`${item.item_id}\`
   - SKU: ${item.sku || "N/A"}
   - Type: ${item.product_type || "N/A"}
   - HSN/SAC: ${item.hsn_or_sac || "N/A"}
   - Status: ${item.status || "N/A"}`;
      }).join("\n\n");
      return `**Items** (${items.length} items)

${formatted}`;
    }
  });
  server2.addTool({
    name: "get_item",
    description: `Get detailed information about a specific item.
Returns full item details including rate, accounts, and tax info.`,
    parameters: z12.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      item_id: entityIdSchema.describe("Item ID")
    }),
    annotations: {
      title: "Get Item Details",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoGet(
        `/items/${args.item_id}`,
        args.organization_id
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to get item";
      }
      const item = result.data?.item;
      if (!item) {
        return "Item not found";
      }
      return `**Item Details**

- **Item ID**: \`${item.item_id}\`
- **Name**: ${item.name}
- **Rate**: ${item.currency_code || "INR"} ${item.rate}
- **Purchase Rate**: ${item.purchase_rate !== void 0 ? `${item.currency_code || "INR"} ${item.purchase_rate}` : "N/A"}
- **SKU**: ${item.sku || "N/A"}
- **Type**: ${item.product_type || "N/A"}
- **HSN/SAC**: ${item.hsn_or_sac || "N/A"}
- **Unit**: ${item.unit || "N/A"}
- **Tax**: ${item.tax_name || "N/A"}
- **Income Account**: ${item.account_name || item.account_id || "N/A"}
- **Purchase Account**: ${item.purchase_account_id || "N/A"}
- **Description**: ${item.description || "N/A"}
- **Status**: ${item.status || "N/A"}`;
    }
  });
  server2.addTool({
    name: "create_item",
    description: `Create a new item (product or service).
Use list_accounts to find account_id (income account) and purchase_account_id values.
Use list_taxes to find tax_id values.`,
    parameters: z12.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      name: z12.string().max(200).describe("Item name"),
      rate: moneySchema.describe("Selling rate (max 999,999,999.99, 2 decimal places)"),
      description: z12.string().max(500).optional().describe("Item description"),
      sku: z12.string().max(100).optional().describe("Stock Keeping Unit"),
      product_type: z12.enum(["goods", "service"]).optional().describe("Product type"),
      hsn_or_sac: z12.string().max(20).optional().describe("HSN or SAC code (India GST)"),
      tax_id: entityIdSchema.optional().describe("Tax ID"),
      account_id: entityIdSchema.optional().describe("Income account ID"),
      purchase_rate: moneySchema.optional().describe("Purchase rate"),
      purchase_account_id: entityIdSchema.optional().describe("Purchase account ID"),
      unit: z12.string().max(50).optional().describe("Unit of measurement")
    }),
    annotations: {
      title: "Create Item",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const payload = {
        name: args.name,
        rate: args.rate
      };
      if (args.description) payload.description = args.description;
      if (args.sku) payload.sku = args.sku;
      if (args.product_type) payload.product_type = args.product_type;
      if (args.hsn_or_sac) payload.hsn_or_sac = args.hsn_or_sac;
      if (args.tax_id) payload.tax_id = args.tax_id;
      if (args.account_id) payload.account_id = args.account_id;
      if (args.purchase_rate !== void 0 || args.purchase_account_id) {
        payload.item_type = "sales_and_purchases";
        if (args.purchase_rate !== void 0) payload.purchase_rate = args.purchase_rate;
        if (args.purchase_account_id) payload.purchase_account_id = args.purchase_account_id;
      }
      if (args.unit) payload.unit = args.unit;
      const result = await zohoPost(
        "/items",
        args.organization_id,
        payload
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to create item";
      }
      const item = result.data?.item;
      if (!item) {
        return "Item created but no details returned";
      }
      return `**Item Created Successfully**

- **Item ID**: \`${item.item_id}\`
- **Name**: ${item.name}
- **Rate**: ${item.currency_code || "INR"} ${item.rate}
- **Type**: ${item.product_type || "N/A"}

Use this item_id to reference this item in invoices, estimates, and purchase orders.`;
    }
  });
  server2.addTool({
    name: "update_item",
    description: `Update an existing item.
Only provided fields will be updated.`,
    parameters: z12.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      item_id: entityIdSchema.describe("Item ID to update"),
      name: z12.string().max(200).optional().describe("Item name"),
      rate: moneySchema.optional().describe("Selling rate"),
      description: z12.string().max(500).optional().describe("Item description"),
      sku: z12.string().max(100).optional().describe("Stock Keeping Unit"),
      product_type: z12.enum(["goods", "service"]).optional().describe("Product type"),
      hsn_or_sac: z12.string().max(20).optional().describe("HSN or SAC code (India GST)"),
      tax_id: entityIdSchema.optional().describe("Tax ID"),
      account_id: entityIdSchema.optional().describe("Income account ID"),
      purchase_rate: moneySchema.optional().describe("Purchase rate"),
      purchase_account_id: entityIdSchema.optional().describe("Purchase account ID"),
      unit: z12.string().max(50).optional().describe("Unit of measurement")
    }),
    annotations: {
      title: "Update Item",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const payload = {};
      if (args.name) payload.name = args.name;
      if (args.rate) payload.rate = args.rate;
      if (args.description) payload.description = args.description;
      if (args.sku) payload.sku = args.sku;
      if (args.product_type) payload.product_type = args.product_type;
      if (args.hsn_or_sac) payload.hsn_or_sac = args.hsn_or_sac;
      if (args.tax_id) payload.tax_id = args.tax_id;
      if (args.account_id) payload.account_id = args.account_id;
      if (args.purchase_rate !== void 0 || args.purchase_account_id) {
        payload.item_type = "sales_and_purchases";
        if (args.purchase_rate !== void 0) payload.purchase_rate = args.purchase_rate;
        if (args.purchase_account_id) payload.purchase_account_id = args.purchase_account_id;
      }
      if (args.unit) payload.unit = args.unit;
      const result = await zohoPut(
        `/items/${args.item_id}`,
        args.organization_id,
        payload
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to update item";
      }
      const item = result.data?.item;
      if (!item) {
        return "Item updated but no details returned";
      }
      return `**Item Updated Successfully**

- **Item ID**: \`${item.item_id}\`
- **Name**: ${item.name}
- **Rate**: ${item.currency_code || "INR"} ${item.rate}
- **Status**: ${item.status || "N/A"}`;
    }
  });
  server2.addTool({
    name: "mark_item_active",
    description: `Mark an inactive item as active.
Reactivates the item so it can be used in transactions.`,
    parameters: z12.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      item_id: entityIdSchema.describe("Item ID to activate")
    }),
    annotations: {
      title: "Mark Item Active",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoPost(
        `/items/${args.item_id}/active`,
        args.organization_id,
        {}
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to mark item as active";
      }
      return `**Item Activated Successfully**

Item \`${args.item_id}\` has been marked as active.`;
    }
  });
}

// src/tools/estimates.ts
import { z as z13 } from "zod";
var estimateLineItemSchema = z13.object({
  item_id: z13.string().optional().describe("Item ID from items catalog"),
  name: z13.string().optional().describe("Item name"),
  description: z13.string().optional().describe("Description"),
  quantity: z13.number().positive().default(1).describe("Quantity"),
  rate: z13.number().nonnegative().describe("Unit rate"),
  tax_id: z13.string().optional().describe("Tax ID"),
  discount: z13.number().optional().describe("Discount percentage")
});
function registerEstimateTools(server2) {
  server2.addTool({
    name: "list_estimates",
    description: `List all estimates (quotes).
Supports filtering by customer, status, date range, and pagination.
Returns estimate details with customer, total, and status.`,
    parameters: z13.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      customer_id: entityIdSchema.optional().describe("Filter by customer"),
      status: z13.enum(["draft", "sent", "accepted", "declined", "expired"]).optional().describe("Filter by status"),
      date_start: z13.string().optional().describe("Start date (YYYY-MM-DD)"),
      date_end: z13.string().optional().describe("End date (YYYY-MM-DD)"),
      page: z13.number().int().positive().optional(),
      per_page: z13.number().int().min(1).max(200).optional()
    }),
    annotations: {
      title: "List Estimates",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const queryParams = {};
      if (args.customer_id) queryParams.customer_id = args.customer_id;
      if (args.status) queryParams.status = args.status;
      if (args.date_start) queryParams.date_start = args.date_start;
      if (args.date_end) queryParams.date_end = args.date_end;
      if (args.page) queryParams.page = args.page.toString();
      if (args.per_page) queryParams.per_page = args.per_page.toString();
      const result = await zohoGet(
        "/estimates",
        args.organization_id,
        queryParams
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to list estimates";
      }
      const estimates = result.data?.estimates || [];
      if (estimates.length === 0) {
        return "No estimates found.";
      }
      const formatted = estimates.map((e, index) => {
        return `${index + 1}. **${e.estimate_number || "No number"}** - ${e.customer_name || "Unknown customer"}
   - Estimate ID: \`${e.estimate_id}\`
   - Date: ${e.date}
   - Expiry: ${e.expiry_date || "N/A"}
   - Total: ${e.currency_code || "INR"} ${e.total}
   - Status: ${e.status || "N/A"}`;
      }).join("\n\n");
      return `**Estimates** (${estimates.length} items)

${formatted}`;
    }
  });
  server2.addTool({
    name: "get_estimate",
    description: `Get detailed information about a specific estimate.
Returns full estimate details including line items, terms, and notes.`,
    parameters: z13.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      estimate_id: entityIdSchema.describe("Estimate ID")
    }),
    annotations: {
      title: "Get Estimate Details",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoGet(
        `/estimates/${args.estimate_id}`,
        args.organization_id
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to get estimate";
      }
      const estimate = result.data?.estimate;
      if (!estimate) {
        return "Estimate not found";
      }
      let details = `**Estimate Details**

- **Estimate ID**: \`${estimate.estimate_id}\`
- **Estimate Number**: ${estimate.estimate_number || "N/A"}
- **Customer**: ${estimate.customer_name || estimate.customer_id}
- **Date**: ${estimate.date}
- **Expiry Date**: ${estimate.expiry_date || "N/A"}
- **Total**: ${estimate.currency_code || "INR"} ${estimate.total}
- **Status**: ${estimate.status || "N/A"}
- **Reference**: ${estimate.reference_number || "N/A"}
- **Notes**: ${estimate.notes || "N/A"}
- **Terms**: ${estimate.terms || "N/A"}

**Line Items**:`;
      if (estimate.line_items && estimate.line_items.length > 0) {
        estimate.line_items.forEach((item, i) => {
          details += `
${i + 1}. ${item.name || item.item_id || "Item"} - Qty: ${item.quantity || 1} x ${estimate.currency_code || "INR"} ${item.rate || 0} = ${estimate.currency_code || "INR"} ${item.item_total ?? item.amount ?? "N/A"}`;
          if (item.description) details += `
   Description: ${item.description}`;
          if (item.discount) details += `
   Discount: ${item.discount}%`;
        });
      }
      return details;
    }
  });
  server2.addTool({
    name: "create_estimate",
    description: `Create a new estimate (quote).
Use list_contacts to find customer_id values.
Use list_items to find item_id values for line items.`,
    parameters: z13.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      customer_id: entityIdSchema.describe("Customer ID"),
      date: dateSchema.describe("Estimate date (YYYY-MM-DD)"),
      expiry_date: dateSchema.optional().describe("Expiry date (YYYY-MM-DD)"),
      estimate_number: z13.string().max(100).optional().describe("Estimate number"),
      reference_number: z13.string().max(100).optional().describe("Reference number"),
      notes: z13.string().max(2e3).optional().describe("Notes to the customer"),
      terms: z13.string().max(2e3).optional().describe("Terms and conditions"),
      line_items: z13.array(estimateLineItemSchema).min(1).describe("Array of line items")
    }),
    annotations: {
      title: "Create Estimate",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const payload = {
        customer_id: args.customer_id,
        date: args.date,
        line_items: args.line_items
      };
      if (args.expiry_date) payload.expiry_date = args.expiry_date;
      if (args.estimate_number) payload.estimate_number = args.estimate_number;
      if (args.reference_number) payload.reference_number = args.reference_number;
      if (args.notes) payload.notes = args.notes;
      if (args.terms) payload.terms = args.terms;
      const result = await zohoPost(
        "/estimates",
        args.organization_id,
        payload
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to create estimate";
      }
      const estimate = result.data?.estimate;
      if (!estimate) {
        return "Estimate created but no details returned";
      }
      return `**Estimate Created Successfully**

- **Estimate ID**: \`${estimate.estimate_id}\`
- **Estimate Number**: ${estimate.estimate_number || "N/A"}
- **Date**: ${estimate.date}
- **Total**: ${estimate.currency_code || "INR"} ${estimate.total}

Use this estimate_id to update, send, or mark as accepted.`;
    }
  });
  server2.addTool({
    name: "update_estimate",
    description: `Update an existing estimate.
Only provided fields will be updated.`,
    parameters: z13.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      estimate_id: entityIdSchema.describe("Estimate ID to update"),
      customer_id: entityIdSchema.optional().describe("Customer ID"),
      date: dateSchema.optional().describe("Estimate date (YYYY-MM-DD)"),
      expiry_date: dateSchema.optional().describe("Expiry date (YYYY-MM-DD)"),
      estimate_number: z13.string().max(100).optional().describe("Estimate number"),
      reference_number: z13.string().max(100).optional().describe("Reference number"),
      notes: z13.string().max(2e3).optional().describe("Notes to the customer"),
      terms: z13.string().max(2e3).optional().describe("Terms and conditions"),
      line_items: z13.array(estimateLineItemSchema).min(1).optional().describe("Array of line items")
    }),
    annotations: {
      title: "Update Estimate",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const payload = {};
      if (args.customer_id) payload.customer_id = args.customer_id;
      if (args.date) payload.date = args.date;
      if (args.expiry_date) payload.expiry_date = args.expiry_date;
      if (args.estimate_number) payload.estimate_number = args.estimate_number;
      if (args.reference_number) payload.reference_number = args.reference_number;
      if (args.notes) payload.notes = args.notes;
      if (args.terms) payload.terms = args.terms;
      if (args.line_items) payload.line_items = args.line_items;
      const result = await zohoPut(
        `/estimates/${args.estimate_id}`,
        args.organization_id,
        payload
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to update estimate";
      }
      const estimate = result.data?.estimate;
      if (!estimate) {
        return "Estimate updated but no details returned";
      }
      return `**Estimate Updated Successfully**

- **Estimate ID**: \`${estimate.estimate_id}\`
- **Estimate Number**: ${estimate.estimate_number || "N/A"}
- **Total**: ${estimate.currency_code || "INR"} ${estimate.total}
- **Status**: ${estimate.status || "N/A"}`;
    }
  });
  server2.addTool({
    name: "mark_estimate_sent",
    description: `Mark an estimate as sent.
Changes the estimate status to 'sent'.`,
    parameters: z13.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      estimate_id: entityIdSchema.describe("Estimate ID to mark as sent")
    }),
    annotations: {
      title: "Mark Estimate Sent",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoPost(
        `/estimates/${args.estimate_id}/status/sent`,
        args.organization_id,
        {}
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to mark estimate as sent";
      }
      return `**Estimate Marked as Sent**

Estimate \`${args.estimate_id}\` status changed to sent.`;
    }
  });
  server2.addTool({
    name: "mark_estimate_accepted",
    description: `Mark an estimate as accepted.
Changes the estimate status to 'accepted'.`,
    parameters: z13.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      estimate_id: entityIdSchema.describe("Estimate ID to mark as accepted")
    }),
    annotations: {
      title: "Mark Estimate Accepted",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoPost(
        `/estimates/${args.estimate_id}/status/accepted`,
        args.organization_id,
        {}
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to mark estimate as accepted";
      }
      return `**Estimate Marked as Accepted**

Estimate \`${args.estimate_id}\` status changed to accepted.`;
    }
  });
}

// src/tools/purchase-orders.ts
import { z as z14 } from "zod";
var poLineItemSchema = z14.object({
  item_id: z14.string().optional().describe("Item ID"),
  name: z14.string().optional().describe("Item name"),
  description: z14.string().optional().describe("Description"),
  quantity: z14.number().positive().default(1).describe("Quantity"),
  rate: z14.number().nonnegative().describe("Unit rate"),
  tax_id: z14.string().optional().describe("Tax ID")
});
function registerPurchaseOrderTools(server2) {
  server2.addTool({
    name: "list_purchase_orders",
    description: `List all purchase orders.
Supports filtering by vendor, status, and date range.
Returns purchase order details with vendor, total, and status.`,
    parameters: z14.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      vendor_id: entityIdSchema.optional().describe("Filter by vendor"),
      status: z14.enum(["draft", "open", "billed", "cancelled"]).optional().describe("Filter by status"),
      date_start: z14.string().optional().describe("Start date (YYYY-MM-DD)"),
      date_end: z14.string().optional().describe("End date (YYYY-MM-DD)"),
      page: z14.number().int().positive().optional(),
      per_page: z14.number().int().min(1).max(200).optional()
    }),
    annotations: {
      title: "List Purchase Orders",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const queryParams = {};
      if (args.vendor_id) queryParams.vendor_id = args.vendor_id;
      if (args.status) queryParams.status = args.status;
      if (args.date_start) queryParams.date_start = args.date_start;
      if (args.date_end) queryParams.date_end = args.date_end;
      if (args.page) queryParams.page = args.page.toString();
      if (args.per_page) queryParams.per_page = args.per_page.toString();
      const result = await zohoGet(
        "/purchaseorders",
        args.organization_id,
        queryParams
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to list purchase orders";
      }
      const orders = result.data?.purchaseorders || [];
      if (orders.length === 0) {
        return "No purchase orders found.";
      }
      const formatted = orders.map((po, index) => {
        return `${index + 1}. **${po.purchaseorder_number || "No number"}** - ${po.vendor_name || "Unknown vendor"}
   - PO ID: \`${po.purchaseorder_id}\`
   - Date: ${po.date}
   - Delivery Date: ${po.delivery_date || "N/A"}
   - Total: ${po.currency_code || "INR"} ${po.total}
   - Status: ${po.status || "N/A"}`;
      }).join("\n\n");
      return `**Purchase Orders** (${orders.length} items)

${formatted}`;
    }
  });
  server2.addTool({
    name: "get_purchase_order",
    description: `Get detailed information about a specific purchase order.
Returns full purchase order details including line items and vendor info.`,
    parameters: z14.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      purchaseorder_id: entityIdSchema.describe("Purchase Order ID")
    }),
    annotations: {
      title: "Get Purchase Order Details",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoGet(
        `/purchaseorders/${args.purchaseorder_id}`,
        args.organization_id
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to get purchase order";
      }
      const po = result.data?.purchaseorder;
      if (!po) {
        return "Purchase order not found";
      }
      let details = `**Purchase Order Details**

- **PO ID**: \`${po.purchaseorder_id}\`
- **PO Number**: ${po.purchaseorder_number || "N/A"}
- **Vendor**: ${po.vendor_name || po.vendor_id}
- **Date**: ${po.date}
- **Delivery Date**: ${po.delivery_date || "N/A"}
- **Total**: ${po.currency_code || "INR"} ${po.total}
- **Status**: ${po.status || "N/A"}
- **Reference**: ${po.reference_number || "N/A"}
- **Notes**: ${po.notes || "N/A"}

**Line Items**:`;
      if (po.line_items && po.line_items.length > 0) {
        po.line_items.forEach((item, i) => {
          details += `
${i + 1}. ${item.name || item.item_id || "Item"} - Qty: ${item.quantity || 1} x ${po.currency_code || "INR"} ${item.rate || 0} = ${po.currency_code || "INR"} ${item.item_total ?? item.amount ?? "N/A"}`;
          if (item.description) details += `
   Description: ${item.description}`;
        });
      }
      return details;
    }
  });
  server2.addTool({
    name: "create_purchase_order",
    description: `Create a new purchase order.
Use list_contacts to find vendor_id values.
Use list_items to find item_id values for line items.`,
    parameters: z14.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      vendor_id: entityIdSchema.describe("Vendor ID"),
      date: dateSchema.describe("Purchase order date (YYYY-MM-DD)"),
      delivery_date: dateSchema.optional().describe("Expected delivery date (YYYY-MM-DD)"),
      purchaseorder_number: z14.string().max(100).optional().describe("Purchase order number"),
      reference_number: z14.string().max(100).optional().describe("Reference number"),
      notes: z14.string().max(2e3).optional().describe("Notes"),
      line_items: z14.array(poLineItemSchema).min(1).describe("Array of line items")
    }),
    annotations: {
      title: "Create Purchase Order",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const payload = {
        vendor_id: args.vendor_id,
        date: args.date,
        line_items: args.line_items
      };
      if (args.delivery_date) payload.delivery_date = args.delivery_date;
      if (args.purchaseorder_number) payload.purchaseorder_number = args.purchaseorder_number;
      if (args.reference_number) payload.reference_number = args.reference_number;
      if (args.notes) payload.notes = args.notes;
      const result = await zohoPost(
        "/purchaseorders",
        args.organization_id,
        payload
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to create purchase order";
      }
      const po = result.data?.purchaseorder;
      if (!po) {
        return "Purchase order created but no details returned";
      }
      return `**Purchase Order Created Successfully**

- **PO ID**: \`${po.purchaseorder_id}\`
- **PO Number**: ${po.purchaseorder_number || "N/A"}
- **Date**: ${po.date}
- **Total**: ${po.currency_code || "INR"} ${po.total}

Use this purchaseorder_id to update, open, or cancel this purchase order.`;
    }
  });
  server2.addTool({
    name: "update_purchase_order",
    description: `Update an existing purchase order.
Only provided fields will be updated.`,
    parameters: z14.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      purchaseorder_id: entityIdSchema.describe("Purchase Order ID to update"),
      vendor_id: entityIdSchema.optional().describe("Vendor ID"),
      date: dateSchema.optional().describe("Purchase order date (YYYY-MM-DD)"),
      delivery_date: dateSchema.optional().describe("Expected delivery date (YYYY-MM-DD)"),
      purchaseorder_number: z14.string().max(100).optional().describe("Purchase order number"),
      reference_number: z14.string().max(100).optional().describe("Reference number"),
      notes: z14.string().max(2e3).optional().describe("Notes"),
      line_items: z14.array(poLineItemSchema).min(1).optional().describe("Array of line items")
    }),
    annotations: {
      title: "Update Purchase Order",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const payload = {};
      if (args.vendor_id) payload.vendor_id = args.vendor_id;
      if (args.date) payload.date = args.date;
      if (args.delivery_date) payload.delivery_date = args.delivery_date;
      if (args.purchaseorder_number) payload.purchaseorder_number = args.purchaseorder_number;
      if (args.reference_number) payload.reference_number = args.reference_number;
      if (args.notes) payload.notes = args.notes;
      if (args.line_items) payload.line_items = args.line_items;
      const result = await zohoPut(
        `/purchaseorders/${args.purchaseorder_id}`,
        args.organization_id,
        payload
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to update purchase order";
      }
      const po = result.data?.purchaseorder;
      if (!po) {
        return "Purchase order updated but no details returned";
      }
      return `**Purchase Order Updated Successfully**

- **PO ID**: \`${po.purchaseorder_id}\`
- **PO Number**: ${po.purchaseorder_number || "N/A"}
- **Total**: ${po.currency_code || "INR"} ${po.total}
- **Status**: ${po.status || "N/A"}`;
    }
  });
  server2.addTool({
    name: "mark_purchase_order_open",
    description: `Mark a purchase order as open.
Changes the purchase order status to 'open'.`,
    parameters: z14.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      purchaseorder_id: entityIdSchema.describe("Purchase Order ID to mark as open")
    }),
    annotations: {
      title: "Mark Purchase Order Open",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoPost(
        `/purchaseorders/${args.purchaseorder_id}/status/open`,
        args.organization_id,
        {}
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to mark purchase order as open";
      }
      return `**Purchase Order Marked as Open**

Purchase order \`${args.purchaseorder_id}\` status changed to open.`;
    }
  });
  server2.addTool({
    name: "cancel_purchase_order",
    description: `Cancel a purchase order.
Changes the purchase order status to 'cancelled'.`,
    parameters: z14.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      purchaseorder_id: entityIdSchema.describe("Purchase Order ID to cancel")
    }),
    annotations: {
      title: "Cancel Purchase Order",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoPost(
        `/purchaseorders/${args.purchaseorder_id}/status/cancelled`,
        args.organization_id,
        {}
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to cancel purchase order";
      }
      return `**Purchase Order Cancelled**

Purchase order \`${args.purchaseorder_id}\` status changed to cancelled.`;
    }
  });
}

// src/tools/taxes.ts
import { z as z15 } from "zod";
function registerTaxTools(server2) {
  server2.addTool({
    name: "list_taxes",
    description: `List all taxes configured in the organization.
Returns tax name, percentage, type, and whether it is the default tax.`,
    parameters: z15.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      )
    }),
    annotations: {
      title: "List Taxes",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoGet("/settings/taxes", args.organization_id);
      if (!result.ok) {
        return result.errorMessage || "Failed to list taxes";
      }
      const taxes = result.data?.taxes || [];
      if (taxes.length === 0) {
        return "No taxes found.";
      }
      const formatted = taxes.map((t, index) => {
        return `${index + 1}. **${t.tax_name}** - ${t.tax_percentage}%
   - Tax ID: \`${t.tax_id}\`
   - Type: ${t.tax_type || "N/A"}
   - Default: ${t.is_default_tax ? "Yes" : "No"}`;
      }).join("\n\n");
      return `**Taxes** (${taxes.length} items)

${formatted}`;
    }
  });
  server2.addTool({
    name: "get_tax",
    description: `Get detailed information about a specific tax.
Returns the full tax configuration including name, percentage, and type.`,
    parameters: z15.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      tax_id: z15.string().describe("Tax ID")
    }),
    annotations: {
      title: "Get Tax Details",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoGet(`/settings/taxes/${args.tax_id}`, args.organization_id);
      if (!result.ok) {
        return result.errorMessage || "Failed to get tax";
      }
      const tax = result.data?.tax;
      if (!tax) {
        return "Tax not found";
      }
      return `**Tax Details**

- **Tax ID**: \`${tax.tax_id}\`
- **Tax Name**: ${tax.tax_name}
- **Percentage**: ${tax.tax_percentage}%
- **Type**: ${tax.tax_type || "N/A"}
- **Default**: ${tax.is_default_tax ? "Yes" : "No"}`;
    }
  });
  server2.addTool({
    name: "create_tax",
    description: `Create a new tax in the organization.
Specify the tax name, percentage, and optionally the type (tax or compound_tax).`,
    parameters: z15.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      tax_name: z15.string().describe("Name of the tax"),
      tax_percentage: z15.number().describe("Tax percentage"),
      tax_type: z15.enum(["tax", "compound_tax"]).optional().describe("Tax type")
    }),
    annotations: {
      title: "Create Tax",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const payload = {
        tax_name: args.tax_name,
        tax_percentage: args.tax_percentage
      };
      if (args.tax_type) payload.tax_type = args.tax_type;
      const result = await zohoPost("/settings/taxes", args.organization_id, payload);
      if (!result.ok) {
        return result.errorMessage || "Failed to create tax";
      }
      const tax = result.data?.tax;
      if (!tax) {
        return "Tax created but no details returned";
      }
      return `**Tax Created Successfully**

- **Tax ID**: \`${tax.tax_id}\`
- **Tax Name**: ${tax.tax_name}
- **Percentage**: ${tax.tax_percentage}%
- **Type**: ${tax.tax_type || "N/A"}`;
    }
  });
  server2.addTool({
    name: "list_tax_groups",
    description: `List all tax groups configured in the organization.
Returns group name, combined percentage, and constituent taxes.`,
    parameters: z15.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      )
    }),
    annotations: {
      title: "List Tax Groups",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoGet("/settings/taxgroups", args.organization_id);
      if (!result.ok) {
        return result.errorMessage || "Failed to list tax groups";
      }
      const taxGroups = result.data?.tax_groups || [];
      if (taxGroups.length === 0) {
        return "No tax groups found.";
      }
      const formatted = taxGroups.map((g, index) => {
        let entry = `${index + 1}. **${g.tax_group_name}** - ${g.tax_group_percentage}%
   - Tax Group ID: \`${g.tax_group_id}\``;
        if (g.taxes && g.taxes.length > 0) {
          const taxNames = g.taxes.map((t) => `${t.tax_name} (${t.tax_percentage}%)`).join(", ");
          entry += `
   - Taxes: ${taxNames}`;
        }
        return entry;
      }).join("\n\n");
      return `**Tax Groups** (${taxGroups.length} items)

${formatted}`;
    }
  });
}

// src/tools/credit-notes.ts
import { z as z16 } from "zod";
var creditNoteLineItemSchema = z16.object({
  item_id: z16.string().optional().describe("Item ID"),
  name: z16.string().optional().describe("Item name"),
  description: z16.string().optional().describe("Description"),
  quantity: z16.number().positive().default(1).describe("Quantity"),
  rate: z16.number().nonnegative().describe("Unit rate"),
  tax_id: z16.string().optional().describe("Tax ID")
});
function registerCreditNoteTools(server2) {
  server2.addTool({
    name: "list_credit_notes",
    description: `List all credit notes.
Supports filtering by customer, status, and date range.
Returns credit note number, customer, total, balance, and status.`,
    parameters: z16.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      customer_id: z16.string().optional().describe("Filter by customer ID"),
      status: z16.enum(["open", "closed", "void"]).optional().describe("Filter by status"),
      date_start: z16.string().optional().describe("Start date (YYYY-MM-DD)"),
      date_end: z16.string().optional().describe("End date (YYYY-MM-DD)"),
      page: z16.number().int().positive().optional(),
      per_page: z16.number().int().min(1).max(200).optional()
    }),
    annotations: {
      title: "List Credit Notes",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const queryParams = {};
      if (args.customer_id) queryParams.customer_id = args.customer_id;
      if (args.status) queryParams.status = args.status;
      if (args.date_start) queryParams.date_start = args.date_start;
      if (args.date_end) queryParams.date_end = args.date_end;
      if (args.page) queryParams.page = args.page.toString();
      if (args.per_page) queryParams.per_page = args.per_page.toString();
      const result = await zohoGet("/creditnotes", args.organization_id, queryParams);
      if (!result.ok) {
        return result.errorMessage || "Failed to list credit notes";
      }
      const creditnotes = result.data?.creditnotes || [];
      if (creditnotes.length === 0) {
        return "No credit notes found.";
      }
      const formatted = creditnotes.map((cn, index) => {
        return `${index + 1}. **${cn.creditnote_number || "No number"}** - ${cn.customer_name || "Unknown customer"}
   - Credit Note ID: \`${cn.creditnote_id}\`
   - Date: ${cn.date}
   - Total: ${cn.currency_code || "INR"} ${cn.total}
   - Balance: ${cn.currency_code || "INR"} ${cn.balance || 0}
   - Status: ${cn.status || "N/A"}`;
      }).join("\n\n");
      return `**Credit Notes** (${creditnotes.length} items)

${formatted}`;
    }
  });
  server2.addTool({
    name: "get_credit_note",
    description: `Get detailed information about a specific credit note.
Returns full details including line items and remaining balance.`,
    parameters: z16.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      creditnote_id: z16.string().describe("Credit Note ID")
    }),
    annotations: {
      title: "Get Credit Note Details",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoGet(`/creditnotes/${args.creditnote_id}`, args.organization_id);
      if (!result.ok) {
        return result.errorMessage || "Failed to get credit note";
      }
      const cn = result.data?.creditnote;
      if (!cn) {
        return "Credit note not found";
      }
      let details = `**Credit Note Details**

- **Credit Note ID**: \`${cn.creditnote_id}\`
- **Number**: ${cn.creditnote_number || "N/A"}
- **Customer**: ${cn.customer_name || cn.customer_id}
- **Date**: ${cn.date}
- **Total**: ${cn.currency_code || "INR"} ${cn.total}
- **Balance**: ${cn.currency_code || "INR"} ${cn.balance || 0}
- **Status**: ${cn.status || "N/A"}
- **Reference**: ${cn.reference_number || "N/A"}
- **Notes**: ${cn.notes || "N/A"}

**Line Items**:`;
      if (cn.line_items && cn.line_items.length > 0) {
        cn.line_items.forEach((item, i) => {
          details += `
${i + 1}. ${item.name || item.item_id || "Item"} - ${cn.currency_code || "INR"} ${item.item_total ?? item.amount ?? "N/A"}`;
          if (item.description) details += `
   Description: ${item.description}`;
          if (item.quantity && item.rate) details += `
   ${item.quantity} x ${item.rate}`;
        });
      }
      return details;
    }
  });
  server2.addTool({
    name: "create_credit_note",
    description: `Create a new credit note for a customer.
Use list_contacts to find customer_id values.
Credit notes can later be applied to outstanding invoices.`,
    parameters: z16.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      customer_id: z16.string().describe("Customer ID"),
      date: dateSchema.describe("Credit note date (YYYY-MM-DD)"),
      creditnote_number: z16.string().optional().describe("Credit note number"),
      reference_number: z16.string().optional().describe("Reference number"),
      notes: z16.string().optional().describe("Notes"),
      line_items: z16.array(creditNoteLineItemSchema).min(1).describe("Array of line items")
    }),
    annotations: {
      title: "Create Credit Note",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const payload = {
        customer_id: args.customer_id,
        date: args.date,
        line_items: args.line_items
      };
      if (args.creditnote_number) payload.creditnote_number = args.creditnote_number;
      if (args.reference_number) payload.reference_number = args.reference_number;
      if (args.notes) payload.notes = args.notes;
      const result = await zohoPost("/creditnotes", args.organization_id, payload);
      if (!result.ok) {
        return result.errorMessage || "Failed to create credit note";
      }
      const cn = result.data?.creditnote;
      if (!cn) {
        return "Credit note created but no details returned";
      }
      return `**Credit Note Created Successfully**

- **Credit Note ID**: \`${cn.creditnote_id}\`
- **Number**: ${cn.creditnote_number || "N/A"}
- **Date**: ${cn.date}
- **Total**: ${cn.currency_code || "INR"} ${cn.total}

Use apply_credit_to_invoice to apply this credit against outstanding invoices.`;
    }
  });
  server2.addTool({
    name: "apply_credit_to_invoice",
    description: `Apply a credit note's balance against one or more outstanding invoices.
Provide the credit note ID and an array of invoices with amounts to apply.`,
    parameters: z16.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      creditnote_id: z16.string().describe("Credit Note ID"),
      invoices: z16.array(
        z16.object({
          invoice_id: z16.string().describe("Invoice ID to apply credit to"),
          amount_applied: z16.number().positive().describe("Amount to apply from credit note")
        })
      ).min(1).describe("Array of invoices with amounts to apply")
    }),
    annotations: {
      title: "Apply Credit to Invoice",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const payload = {
        invoices: args.invoices
      };
      const result = await zohoPost(
        `/creditnotes/${args.creditnote_id}/invoices`,
        args.organization_id,
        payload
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to apply credit to invoice";
      }
      const applied = result.data?.apply_to_invoices?.invoices || args.invoices;
      const formatted = applied.map((inv, i) => `${i + 1}. Invoice \`${inv.invoice_id}\` - Applied: ${inv.amount_applied}`).join("\n");
      return `**Credit Applied Successfully**

- **Credit Note ID**: \`${args.creditnote_id}\`

**Applied to Invoices:**
${formatted}`;
    }
  });
  server2.addTool({
    name: "void_credit_note",
    description: `Void a credit note. This marks the credit note as void and prevents further use.`,
    parameters: z16.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      creditnote_id: z16.string().describe("Credit Note ID")
    }),
    annotations: {
      title: "Void Credit Note",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoPost(
        `/creditnotes/${args.creditnote_id}/status/void`,
        args.organization_id,
        {}
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to void credit note";
      }
      return `**Credit Note Voided Successfully**

Credit note \`${args.creditnote_id}\` has been voided.`;
    }
  });
  server2.addTool({
    name: "delete_credit_note",
    description: `Delete a credit note permanently. This action cannot be undone.`,
    parameters: z16.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      creditnote_id: z16.string().describe("Credit Note ID")
    }),
    annotations: {
      title: "Delete Credit Note",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoDelete(
        `/creditnotes/${args.creditnote_id}`,
        args.organization_id
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to delete credit note";
      }
      return `**Credit Note Deleted Successfully**

Credit note \`${args.creditnote_id}\` has been deleted.`;
    }
  });
}

// src/tools/recurring-invoices.ts
import { z as z17 } from "zod";
var recurringLineItemSchema = z17.object({
  item_id: z17.string().optional().describe("Item ID"),
  name: z17.string().optional().describe("Item name"),
  description: z17.string().optional().describe("Description"),
  quantity: z17.number().positive().default(1).describe("Quantity"),
  rate: z17.number().nonnegative().describe("Unit rate"),
  tax_id: z17.string().optional().describe("Tax ID")
});
function registerRecurringInvoiceTools(server2) {
  server2.addTool({
    name: "list_recurring_invoices",
    description: `List all recurring invoices.
Supports filtering by customer and status.
Returns recurrence name, customer, total, frequency, and status.`,
    parameters: z17.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      customer_id: z17.string().optional().describe("Filter by customer ID"),
      status: z17.enum(["active", "stopped", "expired"]).optional().describe("Filter by status"),
      page: z17.number().int().positive().optional(),
      per_page: z17.number().int().min(1).max(200).optional()
    }),
    annotations: {
      title: "List Recurring Invoices",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const queryParams = {};
      if (args.customer_id) queryParams.customer_id = args.customer_id;
      if (args.status) queryParams.status = args.status;
      if (args.page) queryParams.page = args.page.toString();
      if (args.per_page) queryParams.per_page = args.per_page.toString();
      const result = await zohoGet(
        "/recurringinvoices",
        args.organization_id,
        queryParams
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to list recurring invoices";
      }
      const invoices = result.data?.recurring_invoices || [];
      if (invoices.length === 0) {
        return "No recurring invoices found.";
      }
      const formatted = invoices.map((ri, index) => {
        return `${index + 1}. **${ri.recurrence_name}** - ${ri.customer_name || "Unknown customer"}
   - Recurring Invoice ID: \`${ri.recurring_invoice_id}\`
   - Frequency: Every ${ri.repeat_every || 1} ${ri.recurrence_frequency || "N/A"}
   - Next Invoice: ${ri.next_invoice_date || "N/A"}
   - Total: ${ri.currency_code || "INR"} ${ri.total}
   - Status: ${ri.status || "N/A"}`;
      }).join("\n\n");
      return `**Recurring Invoices** (${invoices.length} items)

${formatted}`;
    }
  });
  server2.addTool({
    name: "get_recurring_invoice",
    description: `Get detailed information about a specific recurring invoice.
Returns recurrence name, frequency, next invoice date, customer, total, and status.`,
    parameters: z17.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      recurring_invoice_id: z17.string().describe("Recurring Invoice ID")
    }),
    annotations: {
      title: "Get Recurring Invoice Details",
      readOnlyHint: true,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoGet(
        `/recurringinvoices/${args.recurring_invoice_id}`,
        args.organization_id
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to get recurring invoice";
      }
      const ri = result.data?.recurring_invoice;
      if (!ri) {
        return "Recurring invoice not found";
      }
      let details = `**Recurring Invoice Details**

- **Recurring Invoice ID**: \`${ri.recurring_invoice_id}\`
- **Recurrence Name**: ${ri.recurrence_name}
- **Customer**: ${ri.customer_name || ri.customer_id}
- **Frequency**: Every ${ri.repeat_every || 1} ${ri.recurrence_frequency || "N/A"}
- **Start Date**: ${ri.start_date || "N/A"}
- **End Date**: ${ri.end_date || "N/A"}
- **Next Invoice Date**: ${ri.next_invoice_date || "N/A"}
- **Total**: ${ri.currency_code || "INR"} ${ri.total}
- **Status**: ${ri.status || "N/A"}

**Line Items**:`;
      if (ri.line_items && ri.line_items.length > 0) {
        ri.line_items.forEach((item, i) => {
          details += `
${i + 1}. ${item.name || item.item_id || "Item"} - ${ri.currency_code || "INR"} ${item.item_total ?? item.amount ?? "N/A"}`;
          if (item.description) details += `
   Description: ${item.description}`;
          if (item.quantity && item.rate) details += `
   ${item.quantity} x ${item.rate}`;
        });
      }
      return details;
    }
  });
  server2.addTool({
    name: "create_recurring_invoice",
    description: `Create a new recurring invoice.
Use list_contacts to find customer_id values.
Specify the recurrence frequency and interval to control how often invoices are generated.`,
    parameters: z17.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      customer_id: z17.string().describe("Customer ID"),
      recurrence_name: z17.string().describe("Name for this recurring invoice"),
      recurrence_frequency: z17.enum(["days", "weeks", "months", "years"]).describe("Recurrence frequency unit"),
      repeat_every: z17.number().int().positive().describe("Repeat interval (e.g., 1 for every month, 2 for every 2 months)"),
      start_date: dateSchema.describe("Start date (YYYY-MM-DD)"),
      end_date: dateSchema.optional().describe("End date (YYYY-MM-DD)"),
      payment_terms: z17.number().int().nonnegative().optional().describe("Payment terms in days"),
      line_items: z17.array(recurringLineItemSchema).min(1).describe("Array of line items")
    }),
    annotations: {
      title: "Create Recurring Invoice",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const payload = {
        customer_id: args.customer_id,
        recurrence_name: args.recurrence_name,
        recurrence_frequency: args.recurrence_frequency,
        repeat_every: args.repeat_every,
        start_date: args.start_date,
        line_items: args.line_items
      };
      if (args.end_date) payload.end_date = args.end_date;
      if (args.payment_terms !== void 0) payload.payment_terms = args.payment_terms;
      const result = await zohoPost(
        "/recurringinvoices",
        args.organization_id,
        payload
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to create recurring invoice";
      }
      const ri = result.data?.recurring_invoice;
      if (!ri) {
        return "Recurring invoice created but no details returned";
      }
      return `**Recurring Invoice Created Successfully**

- **Recurring Invoice ID**: \`${ri.recurring_invoice_id}\`
- **Recurrence Name**: ${ri.recurrence_name}
- **Frequency**: Every ${ri.repeat_every || 1} ${ri.recurrence_frequency || "N/A"}
- **Start Date**: ${ri.start_date || "N/A"}
- **Total**: ${ri.currency_code || "INR"} ${ri.total}
- **Status**: ${ri.status || "N/A"}`;
    }
  });
  server2.addTool({
    name: "stop_recurring_invoice",
    description: `Stop a recurring invoice. No further invoices will be generated until resumed.`,
    parameters: z17.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      recurring_invoice_id: z17.string().describe("Recurring Invoice ID")
    }),
    annotations: {
      title: "Stop Recurring Invoice",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoPost(
        `/recurringinvoices/${args.recurring_invoice_id}/status/stop`,
        args.organization_id,
        {}
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to stop recurring invoice";
      }
      return `**Recurring Invoice Stopped Successfully**

Recurring invoice \`${args.recurring_invoice_id}\` has been stopped. No further invoices will be generated.
Use resume_recurring_invoice to reactivate.`;
    }
  });
  server2.addTool({
    name: "resume_recurring_invoice",
    description: `Resume a previously stopped recurring invoice. Invoices will start generating again on the next scheduled date.`,
    parameters: z17.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      recurring_invoice_id: z17.string().describe("Recurring Invoice ID")
    }),
    annotations: {
      title: "Resume Recurring Invoice",
      readOnlyHint: false,
      openWorldHint: true
    },
    execute: async (args) => {
      const result = await zohoPost(
        `/recurringinvoices/${args.recurring_invoice_id}/status/resume`,
        args.organization_id,
        {}
      );
      if (!result.ok) {
        return result.errorMessage || "Failed to resume recurring invoice";
      }
      return `**Recurring Invoice Resumed Successfully**

Recurring invoice \`${args.recurring_invoice_id}\` has been resumed. Invoices will generate on the next scheduled date.`;
    }
  });
}

// src/index.ts
var server = new FastMCP({
  name: "zoho-books-mcp",
  version: "2.0.0",
  instructions: `
Zoho Books MCP server \u2014 AI CFO toolkit for complete financial management.

## Multi-Organization Support
- Default org is pre-configured via ZOHO_ORGANIZATION_ID environment variable.
- You can pass organization_id to any tool to target a specific org.
- Org aliases are supported (e.g., "naturnest" instead of "60026116971") \u2014 configured via ZOHO_ORG_ALIASES env var.
- Use switch_organization to change the active org for the entire session.
- Use list_organizations to see all available orgs with aliases and active status.
- Use get_organization_summary for a quick financial snapshot of any org.

## Available Tools (88)

### Chart of Accounts
- list_accounts, get_account, create_account, list_account_transactions

### Journals
- list_journals, get_journal, create_journal, update_journal, delete_journal, publish_journal
- add_journal_attachment, get_journal_attachment, delete_journal_attachment

### Contacts (Customers & Vendors)
- list_contacts, get_contact, create_contact, update_contact
- mark_contact_active, mark_contact_inactive

### Items (Products & Services)
- list_items, get_item, create_item, update_item, mark_item_active

### Invoices (Accounts Receivable)
- list_invoices, get_invoice, create_invoice, update_invoice
- send_invoice, void_invoice, email_invoice
- add_invoice_attachment, get_invoice_attachment, delete_invoice_attachment

### Bills (Accounts Payable)
- list_bills, get_bill, create_bill
- add_bill_attachment, get_bill_attachment, delete_bill_attachment

### Expenses
- list_expenses, get_expense, create_expense
- add_expense_receipt, get_expense_receipt, delete_expense_receipt

### Customer Payments
- list_customer_payments, get_customer_payment, create_customer_payment, delete_customer_payment

### Vendor Payments
- list_vendor_payments, get_vendor_payment, create_vendor_payment, delete_vendor_payment

### Estimates / Quotes
- list_estimates, get_estimate, create_estimate, update_estimate
- mark_estimate_sent, mark_estimate_accepted

### Purchase Orders
- list_purchase_orders, get_purchase_order, create_purchase_order, update_purchase_order
- mark_purchase_order_open, cancel_purchase_order

### Credit Notes
- list_credit_notes, get_credit_note, create_credit_note
- apply_credit_to_invoice, void_credit_note, delete_credit_note

### Taxes
- list_taxes, get_tax, create_tax, list_tax_groups

### Recurring Invoices
- list_recurring_invoices, get_recurring_invoice, create_recurring_invoice
- stop_recurring_invoice, resume_recurring_invoice

### Bank Accounts
- list_bank_accounts, get_bank_account, list_bank_transactions

### Organizations
- list_organizations, get_organization, switch_organization, get_organization_summary
`,
  health: {
    enabled: true,
    message: JSON.stringify({
      status: "healthy",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      version: "2.0.0",
      service: "zoho-books-mcp"
    }),
    path: "/health",
    status: 200
  }
});
registerOrganizationTools(server);
registerChartOfAccountsTools(server);
registerJournalTools(server);
registerExpenseTools(server);
registerBillTools(server);
registerInvoiceTools(server);
registerContactTools(server);
registerBankAccountTools(server);
registerCustomerPaymentTools(server);
registerVendorPaymentTools(server);
registerItemTools(server);
registerEstimateTools(server);
registerPurchaseOrderTools(server);
registerTaxTools(server);
registerCreditNoteTools(server);
registerRecurringInvoiceTools(server);
var src_default = server;

export {
  src_default
};
