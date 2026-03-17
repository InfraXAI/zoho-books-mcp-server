/**
 * Estimate tools for Zoho Books API
 */

import { z } from "zod"
import type { FastMCP } from "fastmcp"
import { zohoGet, zohoPost, zohoPut } from "../api/client.js"
import type { Estimate, EstimateLineItem } from "../api/types.js"
import { optionalOrganizationIdSchema, dateSchema, entityIdSchema } from "../utils/validation.js"

// Zod schema for estimate line items
const estimateLineItemSchema = z.object({
  item_id: z.string().optional().describe("Item ID from items catalog"),
  name: z.string().optional().describe("Item name"),
  description: z.string().optional().describe("Description"),
  quantity: z.number().positive().default(1).describe("Quantity"),
  rate: z.number().nonnegative().describe("Unit rate"),
  tax_id: z.string().optional().describe("Tax ID"),
  discount: z.number().optional().describe("Discount percentage"),
})

/**
 * Register estimate tools on the server
 */
export function registerEstimateTools(server: FastMCP): void {
  // List Estimates
  server.addTool({
    name: "list_estimates",
    description: `List all estimates (quotes).
Supports filtering by customer, status, date range, and pagination.
Returns estimate details with customer, total, and status.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      customer_id: entityIdSchema.optional().describe("Filter by customer"),
      status: z
        .enum(["draft", "sent", "accepted", "declined", "expired"])
        .optional()
        .describe("Filter by status"),
      date_start: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      date_end: z.string().optional().describe("End date (YYYY-MM-DD)"),
      page: z.number().int().positive().optional(),
      per_page: z.number().int().min(1).max(200).optional(),
    }),
    annotations: {
      title: "List Estimates",
      readOnlyHint: true,
      openWorldHint: true,
    },
    execute: async (args) => {
      const queryParams: Record<string, string> = {}
      if (args.customer_id) queryParams.customer_id = args.customer_id
      if (args.status) queryParams.status = args.status
      if (args.date_start) queryParams.date_start = args.date_start
      if (args.date_end) queryParams.date_end = args.date_end
      if (args.page) queryParams.page = args.page.toString()
      if (args.per_page) queryParams.per_page = args.per_page.toString()

      const result = await zohoGet<{ estimates: Estimate[] }>(
        "/estimates",
        args.organization_id,
        queryParams
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to list estimates"
      }

      const estimates = result.data?.estimates || []

      if (estimates.length === 0) {
        return "No estimates found."
      }

      const formatted = estimates
        .map((e, index) => {
          return `${index + 1}. **${e.estimate_number || "No number"}** - ${e.customer_name || "Unknown customer"}
   - Estimate ID: \`${e.estimate_id}\`
   - Date: ${e.date}
   - Expiry: ${e.expiry_date || "N/A"}
   - Total: ${e.currency_code || ""} ${e.total}
   - Status: ${e.status || "N/A"}`
        })
        .join("\n\n")

      return `**Estimates** (${estimates.length} items)\n\n${formatted}`
    },
  })

  // Get Estimate
  server.addTool({
    name: "get_estimate",
    description: `Get detailed information about a specific estimate.
Returns full estimate details including line items, terms, and notes.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      estimate_id: entityIdSchema.describe("Estimate ID"),
    }),
    annotations: {
      title: "Get Estimate Details",
      readOnlyHint: true,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoGet<{ estimate: Estimate }>(
        `/estimates/${args.estimate_id}`,
        args.organization_id
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to get estimate"
      }

      const estimate = result.data?.estimate

      if (!estimate) {
        return "Estimate not found"
      }

      let details = `**Estimate Details**

- **Estimate ID**: \`${estimate.estimate_id}\`
- **Estimate Number**: ${estimate.estimate_number || "N/A"}
- **Customer**: ${estimate.customer_name || estimate.customer_id}
- **Date**: ${estimate.date}
- **Expiry Date**: ${estimate.expiry_date || "N/A"}
- **Total**: ${estimate.currency_code || ""} ${estimate.total}
- **Status**: ${estimate.status || "N/A"}
- **Reference**: ${estimate.reference_number || "N/A"}
- **Notes**: ${estimate.notes || "N/A"}
- **Terms**: ${estimate.terms || "N/A"}

**Line Items**:`

      if (estimate.line_items && estimate.line_items.length > 0) {
        estimate.line_items.forEach((item: EstimateLineItem, i: number) => {
          details += `\n${i + 1}. ${item.name || item.item_id || "Item"} - Qty: ${item.quantity || 1} x ${estimate.currency_code || ""} ${item.rate || 0} = ${estimate.currency_code || ""} ${item.amount}`
          if (item.description) details += `\n   Description: ${item.description}`
          if (item.discount) details += `\n   Discount: ${item.discount}%`
        })
      }

      return details
    },
  })

  // Create Estimate
  server.addTool({
    name: "create_estimate",
    description: `Create a new estimate (quote).
Use list_contacts to find customer_id values.
Use list_items to find item_id values for line items.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      customer_id: entityIdSchema.describe("Customer ID"),
      date: dateSchema.describe("Estimate date (YYYY-MM-DD)"),
      expiry_date: dateSchema.optional().describe("Expiry date (YYYY-MM-DD)"),
      estimate_number: z.string().max(100).optional().describe("Estimate number"),
      reference_number: z.string().max(100).optional().describe("Reference number"),
      notes: z.string().max(2000).optional().describe("Notes to the customer"),
      terms: z.string().max(2000).optional().describe("Terms and conditions"),
      line_items: z.array(estimateLineItemSchema).min(1).describe("Array of line items"),
    }),
    annotations: {
      title: "Create Estimate",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const payload: Record<string, unknown> = {
        customer_id: args.customer_id,
        date: args.date,
        line_items: args.line_items,
      }

      if (args.expiry_date) payload.expiry_date = args.expiry_date
      if (args.estimate_number) payload.estimate_number = args.estimate_number
      if (args.reference_number) payload.reference_number = args.reference_number
      if (args.notes) payload.notes = args.notes
      if (args.terms) payload.terms = args.terms

      const result = await zohoPost<{ estimate: Estimate }>(
        "/estimates",
        args.organization_id,
        payload
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to create estimate"
      }

      const estimate = result.data?.estimate

      if (!estimate) {
        return "Estimate created but no details returned"
      }

      return `**Estimate Created Successfully**

- **Estimate ID**: \`${estimate.estimate_id}\`
- **Estimate Number**: ${estimate.estimate_number || "N/A"}
- **Date**: ${estimate.date}
- **Total**: ${estimate.currency_code || ""} ${estimate.total}

Use this estimate_id to update, send, or mark as accepted.`
    },
  })

  // Update Estimate
  server.addTool({
    name: "update_estimate",
    description: `Update an existing estimate.
Only provided fields will be updated.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      estimate_id: entityIdSchema.describe("Estimate ID to update"),
      customer_id: entityIdSchema.optional().describe("Customer ID"),
      date: dateSchema.optional().describe("Estimate date (YYYY-MM-DD)"),
      expiry_date: dateSchema.optional().describe("Expiry date (YYYY-MM-DD)"),
      estimate_number: z.string().max(100).optional().describe("Estimate number"),
      reference_number: z.string().max(100).optional().describe("Reference number"),
      notes: z.string().max(2000).optional().describe("Notes to the customer"),
      terms: z.string().max(2000).optional().describe("Terms and conditions"),
      line_items: z.array(estimateLineItemSchema).min(1).optional().describe("Array of line items"),
    }),
    annotations: {
      title: "Update Estimate",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const payload: Record<string, unknown> = {}

      if (args.customer_id) payload.customer_id = args.customer_id
      if (args.date) payload.date = args.date
      if (args.expiry_date) payload.expiry_date = args.expiry_date
      if (args.estimate_number) payload.estimate_number = args.estimate_number
      if (args.reference_number) payload.reference_number = args.reference_number
      if (args.notes) payload.notes = args.notes
      if (args.terms) payload.terms = args.terms
      if (args.line_items) payload.line_items = args.line_items

      const result = await zohoPut<{ estimate: Estimate }>(
        `/estimates/${args.estimate_id}`,
        args.organization_id,
        payload
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to update estimate"
      }

      const estimate = result.data?.estimate

      if (!estimate) {
        return "Estimate updated but no details returned"
      }

      return `**Estimate Updated Successfully**

- **Estimate ID**: \`${estimate.estimate_id}\`
- **Estimate Number**: ${estimate.estimate_number || "N/A"}
- **Total**: ${estimate.currency_code || ""} ${estimate.total}
- **Status**: ${estimate.status || "N/A"}`
    },
  })

  // Mark Estimate as Sent
  server.addTool({
    name: "mark_estimate_sent",
    description: `Mark an estimate as sent.
Changes the estimate status to 'sent'.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      estimate_id: entityIdSchema.describe("Estimate ID to mark as sent"),
    }),
    annotations: {
      title: "Mark Estimate Sent",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoPost<Record<string, unknown>>(
        `/estimates/${args.estimate_id}/status/sent`,
        args.organization_id,
        {}
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to mark estimate as sent"
      }

      return `**Estimate Marked as Sent**

Estimate \`${args.estimate_id}\` status changed to sent.`
    },
  })

  // Mark Estimate as Accepted
  server.addTool({
    name: "mark_estimate_accepted",
    description: `Mark an estimate as accepted.
Changes the estimate status to 'accepted'.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      estimate_id: entityIdSchema.describe("Estimate ID to mark as accepted"),
    }),
    annotations: {
      title: "Mark Estimate Accepted",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoPost<Record<string, unknown>>(
        `/estimates/${args.estimate_id}/status/accepted`,
        args.organization_id,
        {}
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to mark estimate as accepted"
      }

      return `**Estimate Marked as Accepted**

Estimate \`${args.estimate_id}\` status changed to accepted.`
    },
  })
}
