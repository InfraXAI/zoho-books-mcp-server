/**
 * Organization tools for Zoho Books API
 */

import { z } from "zod"
import type { FastMCP } from "fastmcp"
import { zohoListOrganizations, zohoGet } from "../api/client.js"
import type { Organization } from "../api/types.js"
import { optionalOrganizationIdSchema } from "../utils/validation.js"
import {
  setSessionOrganization,
  cacheOrgName,
  getOrgName,
  getEffectiveOrgId,
  resolveOrgAlias,
  getOrgAliases,
  autoDiscoverOrganizations,
} from "../config.js"

/**
 * Register organization tools on the server
 */
export function registerOrganizationTools(server: FastMCP): void {
  // List Organizations
  server.addTool({
    name: "list_organizations",
    description: `List all Zoho organizations the user has access to.
Returns organization name, ID, currency, timezone, and configured aliases.
Use switch_organization to change the active organization.`,
    parameters: z.object({}),
    annotations: {
      title: "List Organizations",
      readOnlyHint: true,
      openWorldHint: true,
    },
    execute: async () => {
      // Auto-discover orgs and generate aliases on first call
      await autoDiscoverOrganizations()

      const result = await zohoListOrganizations()

      if (!result.ok) {
        return result.errorMessage || "Failed to list organizations"
      }

      const organizations = (result.data?.organizations || []) as Organization[]

      if (organizations.length === 0) {
        return "No organizations found. Make sure your Zoho credentials have access to at least one organization."
      }

      // Cache org names for later use in responses
      organizations.forEach((org) => {
        cacheOrgName(org.organization_id, org.name)
      })

      const aliases = getOrgAliases()
      const currentOrgId = getEffectiveOrgId()

      const formatted = organizations
        .map((org, index) => {
          const alias = aliases.find((a) => a.orgId === org.organization_id)
          const isActive = org.organization_id === currentOrgId
          const activeMarker = isActive ? " ← **ACTIVE**" : ""
          const aliasStr = alias ? ` (alias: \`${alias.alias}\`)` : ""

          return `${index + 1}. **${org.name}**${activeMarker}
   - Organization ID: \`${org.organization_id}\`${aliasStr}
   - Currency: ${org.currency_code} (${org.currency_symbol})
   - Timezone: ${org.time_zone}
   - Fiscal Year Start: Month ${org.fiscal_year_start_month}`
        })
        .join("\n\n")

      return `**Zoho Organizations**\n\n${formatted}\n\n---\nUse \`switch_organization\` to change the active org, or pass \`organization_id\` (alias or ID) to any tool.`
    },
  })

  // Get Organization
  server.addTool({
    name: "get_organization",
    description: `Get detailed information about a specific organization.
Returns full organization details including address, contact info, and settings.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID or alias (uses active org if not provided)"
      ),
    }),
    annotations: {
      title: "Get Organization Details",
      readOnlyHint: true,
      openWorldHint: true,
    },
    execute: async (args) => {
      const orgId = args.organization_id ? resolveOrgAlias(args.organization_id) : getEffectiveOrgId()

      const result = await zohoGet<{ organization: Organization }>(
        `/organizations/${orgId}`,
        orgId
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to get organization"
      }

      const org = result.data?.organization

      if (!org) {
        return "Organization not found"
      }

      // Cache the name
      cacheOrgName(org.organization_id, org.name)

      return `**Organization Details**

- **Name**: ${org.name}
- **Organization ID**: \`${org.organization_id}\`
- **Default Org**: ${org.is_default_org ? "Yes" : "No"}
- **Currency**: ${org.currency_code} (${org.currency_symbol})
- **Timezone**: ${org.time_zone}
- **Language**: ${org.language_code}
- **Fiscal Year Start**: Month ${org.fiscal_year_start_month}
- **Created**: ${org.account_created_date}`
    },
  })

  // Switch Organization
  server.addTool({
    name: "switch_organization",
    description: `Switch the active organization for this session.
All subsequent tool calls will use this organization by default.
Accepts an organization ID or alias (e.g., "naturnest", "infrax").
Use list_organizations to see available orgs and aliases.`,
    parameters: z.object({
      organization_id: z.string().describe("Organization ID or alias to switch to"),
    }),
    annotations: {
      title: "Switch Organization",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      // Ensure aliases are loaded before resolving
      await autoDiscoverOrganizations()
      const orgId = resolveOrgAlias(args.organization_id)

      // Verify the org exists by fetching it
      const result = await zohoGet<{ organization: Organization }>(
        `/organizations/${orgId}`,
        orgId
      )

      if (!result.ok) {
        return result.errorMessage || `Failed to switch to organization \`${args.organization_id}\`. Check if the ID/alias is correct.`
      }

      const org = result.data?.organization

      if (!org) {
        return `Organization \`${args.organization_id}\` not found.`
      }

      // Set as session default
      setSessionOrganization(orgId, org.name)

      return `**Organization Switched**

Now using: **${org.name}** (\`${org.organization_id}\`)
Currency: ${org.currency_code} | Timezone: ${org.time_zone}

All subsequent tool calls will use this organization by default.`
    },
  })

  // Get Organization Summary
  server.addTool({
    name: "get_organization_summary",
    description: `Get a quick financial snapshot of an organization.
Shows organization info, GST status, plan, and key settings.
Useful for a CFO's daily overview.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID or alias (uses active org if not provided)"
      ),
    }),
    annotations: {
      title: "Organization Summary",
      readOnlyHint: true,
      openWorldHint: true,
    },
    execute: async (args) => {
      const orgId = args.organization_id ? resolveOrgAlias(args.organization_id) : getEffectiveOrgId()

      const result = await zohoListOrganizations()

      if (!result.ok) {
        return result.errorMessage || "Failed to get organization summary"
      }

      const organizations = (result.data?.organizations || []) as Record<string, unknown>[]
      const org = organizations.find((o) => o.organization_id === orgId)

      if (!org) {
        return `Organization \`${orgId}\` not found.`
      }

      // Cache name
      if (typeof org.name === "string") {
        cacheOrgName(orgId, org.name)
      }

      const currentOrgId = getEffectiveOrgId()
      const isActive = orgId === currentOrgId

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
- **Version**: ${org.version_formatted || org.version || "N/A"}`
    },
  })
}
