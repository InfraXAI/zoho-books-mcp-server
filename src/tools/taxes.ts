/**
 * Tax tools for Zoho Books API
 */

import { z } from "zod"
import type { FastMCP } from "fastmcp"
import { zohoGet, zohoPost } from "../api/client.js"
import type { Tax, TaxGroup } from "../api/types.js"
import { optionalOrganizationIdSchema } from "../utils/validation.js"

/**
 * Register tax tools on the server
 */
export function registerTaxTools(server: FastMCP): void {
  // List Taxes
  server.addTool({
    name: "list_taxes",
    description: `List all taxes configured in the organization.
Returns tax name, percentage, type, and whether it is the default tax.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
    }),
    annotations: {
      title: "List Taxes",
      readOnlyHint: true,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoGet<{ taxes: Tax[] }>("/settings/taxes", args.organization_id)

      if (!result.ok) {
        return result.errorMessage || "Failed to list taxes"
      }

      const taxes = result.data?.taxes || []

      if (taxes.length === 0) {
        return "No taxes found."
      }

      const formatted = taxes
        .map((t, index) => {
          return `${index + 1}. **${t.tax_name}** - ${t.tax_percentage}%
   - Tax ID: \`${t.tax_id}\`
   - Type: ${t.tax_type || "N/A"}
   - Default: ${t.is_default_tax ? "Yes" : "No"}`
        })
        .join("\n\n")

      return `**Taxes** (${taxes.length} items)\n\n${formatted}`
    },
  })

  // Get Tax
  server.addTool({
    name: "get_tax",
    description: `Get detailed information about a specific tax.
Returns the full tax configuration including name, percentage, and type.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      tax_id: z.string().describe("Tax ID"),
    }),
    annotations: {
      title: "Get Tax Details",
      readOnlyHint: true,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoGet<{ tax: Tax }>(`/settings/taxes/${args.tax_id}`, args.organization_id)

      if (!result.ok) {
        return result.errorMessage || "Failed to get tax"
      }

      const tax = result.data?.tax

      if (!tax) {
        return "Tax not found"
      }

      return `**Tax Details**

- **Tax ID**: \`${tax.tax_id}\`
- **Tax Name**: ${tax.tax_name}
- **Percentage**: ${tax.tax_percentage}%
- **Type**: ${tax.tax_type || "N/A"}
- **Default**: ${tax.is_default_tax ? "Yes" : "No"}`
    },
  })

  // Create Tax
  server.addTool({
    name: "create_tax",
    description: `Create a new tax in the organization.
Specify the tax name, percentage, and optionally the type (tax or compound_tax).`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      tax_name: z.string().describe("Name of the tax"),
      tax_percentage: z.number().describe("Tax percentage"),
      tax_type: z.enum(["tax", "compound_tax"]).optional().describe("Tax type"),
    }),
    annotations: {
      title: "Create Tax",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const payload: Record<string, unknown> = {
        tax_name: args.tax_name,
        tax_percentage: args.tax_percentage,
      }

      if (args.tax_type) payload.tax_type = args.tax_type

      const result = await zohoPost<{ tax: Tax }>("/settings/taxes", args.organization_id, payload)

      if (!result.ok) {
        return result.errorMessage || "Failed to create tax"
      }

      const tax = result.data?.tax

      if (!tax) {
        return "Tax created but no details returned"
      }

      return `**Tax Created Successfully**

- **Tax ID**: \`${tax.tax_id}\`
- **Tax Name**: ${tax.tax_name}
- **Percentage**: ${tax.tax_percentage}%
- **Type**: ${tax.tax_type || "N/A"}`
    },
  })

  // List Tax Groups
  server.addTool({
    name: "list_tax_groups",
    description: `List all tax groups configured in the organization.
Returns group name, combined percentage, and constituent taxes.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
    }),
    annotations: {
      title: "List Tax Groups",
      readOnlyHint: true,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoGet<{ tax_groups: TaxGroup[] }>("/settings/taxgroups", args.organization_id)

      if (!result.ok) {
        return result.errorMessage || "Failed to list tax groups"
      }

      const taxGroups = result.data?.tax_groups || []

      if (taxGroups.length === 0) {
        return "No tax groups found."
      }

      const formatted = taxGroups
        .map((g, index) => {
          let entry = `${index + 1}. **${g.tax_group_name}** - ${g.tax_group_percentage}%
   - Tax Group ID: \`${g.tax_group_id}\``

          if (g.taxes && g.taxes.length > 0) {
            const taxNames = g.taxes.map((t) => `${t.tax_name} (${t.tax_percentage}%)`).join(", ")
            entry += `\n   - Taxes: ${taxNames}`
          }

          return entry
        })
        .join("\n\n")

      return `**Tax Groups** (${taxGroups.length} items)\n\n${formatted}`
    },
  })
}
