/**
 * Recurring Invoice tools for Zoho Books API
 */

import { z } from "zod"
import type { FastMCP } from "fastmcp"
import { zohoGet, zohoPost } from "../api/client.js"
import type { RecurringInvoice } from "../api/types.js"
import { optionalOrganizationIdSchema, dateSchema, moneySchema } from "../utils/validation.js"

// Zod schema for recurring invoice line items
const recurringLineItemSchema = z.object({
  item_id: z.string().optional().describe("Item ID"),
  name: z.string().optional().describe("Item name"),
  description: z.string().optional().describe("Description"),
  quantity: z.number().positive().default(1).describe("Quantity"),
  rate: z.number().nonnegative().describe("Unit rate"),
  tax_id: z.string().optional().describe("Tax ID"),
})

/**
 * Register recurring invoice tools on the server
 */
export function registerRecurringInvoiceTools(server: FastMCP): void {
  // List Recurring Invoices
  server.addTool({
    name: "list_recurring_invoices",
    description: `List all recurring invoices.
Supports filtering by customer and status.
Returns recurrence name, customer, total, frequency, and status.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      customer_id: z.string().optional().describe("Filter by customer ID"),
      status: z.enum(["active", "stopped", "expired"]).optional().describe("Filter by status"),
      page: z.number().int().positive().optional(),
      per_page: z.number().int().min(1).max(200).optional(),
    }),
    annotations: {
      title: "List Recurring Invoices",
      readOnlyHint: true,
      openWorldHint: true,
    },
    execute: async (args) => {
      const queryParams: Record<string, string> = {}
      if (args.customer_id) queryParams.customer_id = args.customer_id
      if (args.status) queryParams.status = args.status
      if (args.page) queryParams.page = args.page.toString()
      if (args.per_page) queryParams.per_page = args.per_page.toString()

      const result = await zohoGet<{ recurring_invoices: RecurringInvoice[] }>(
        "/recurringinvoices",
        args.organization_id,
        queryParams
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to list recurring invoices"
      }

      const invoices = result.data?.recurring_invoices || []

      if (invoices.length === 0) {
        return "No recurring invoices found."
      }

      const formatted = invoices
        .map((ri, index) => {
          return `${index + 1}. **${ri.recurrence_name}** - ${ri.customer_name || "Unknown customer"}
   - Recurring Invoice ID: \`${ri.recurring_invoice_id}\`
   - Frequency: Every ${ri.repeat_every || 1} ${ri.recurrence_frequency || "N/A"}
   - Next Invoice: ${ri.next_invoice_date || "N/A"}
   - Total: ${ri.currency_code || ""} ${ri.total}
   - Status: ${ri.status || "N/A"}`
        })
        .join("\n\n")

      return `**Recurring Invoices** (${invoices.length} items)\n\n${formatted}`
    },
  })

  // Get Recurring Invoice
  server.addTool({
    name: "get_recurring_invoice",
    description: `Get detailed information about a specific recurring invoice.
Returns recurrence name, frequency, next invoice date, customer, total, and status.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      recurring_invoice_id: z.string().describe("Recurring Invoice ID"),
    }),
    annotations: {
      title: "Get Recurring Invoice Details",
      readOnlyHint: true,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoGet<{ recurring_invoice: RecurringInvoice }>(
        `/recurringinvoices/${args.recurring_invoice_id}`,
        args.organization_id
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to get recurring invoice"
      }

      const ri = result.data?.recurring_invoice

      if (!ri) {
        return "Recurring invoice not found"
      }

      let details = `**Recurring Invoice Details**

- **Recurring Invoice ID**: \`${ri.recurring_invoice_id}\`
- **Recurrence Name**: ${ri.recurrence_name}
- **Customer**: ${ri.customer_name || ri.customer_id}
- **Frequency**: Every ${ri.repeat_every || 1} ${ri.recurrence_frequency || "N/A"}
- **Start Date**: ${ri.start_date || "N/A"}
- **End Date**: ${ri.end_date || "N/A"}
- **Next Invoice Date**: ${ri.next_invoice_date || "N/A"}
- **Total**: ${ri.currency_code || ""} ${ri.total}
- **Status**: ${ri.status || "N/A"}

**Line Items**:`

      if (ri.line_items && ri.line_items.length > 0) {
        ri.line_items.forEach((item, i) => {
          details += `\n${i + 1}. ${item.name || item.item_id || "Item"} - ${ri.currency_code || ""} ${item.amount}`
          if (item.description) details += `\n   Description: ${item.description}`
          if (item.quantity && item.rate) details += `\n   ${item.quantity} x ${item.rate}`
        })
      }

      return details
    },
  })

  // Create Recurring Invoice
  server.addTool({
    name: "create_recurring_invoice",
    description: `Create a new recurring invoice.
Use list_contacts to find customer_id values.
Specify the recurrence frequency and interval to control how often invoices are generated.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      customer_id: z.string().describe("Customer ID"),
      recurrence_name: z.string().describe("Name for this recurring invoice"),
      recurrence_frequency: z.enum(["days", "weeks", "months", "years"]).describe("Recurrence frequency unit"),
      repeat_every: z.number().int().positive().describe("Repeat interval (e.g., 1 for every month, 2 for every 2 months)"),
      start_date: dateSchema.describe("Start date (YYYY-MM-DD)"),
      end_date: dateSchema.optional().describe("End date (YYYY-MM-DD)"),
      payment_terms: z.number().int().nonnegative().optional().describe("Payment terms in days"),
      line_items: z.array(recurringLineItemSchema).min(1).describe("Array of line items"),
    }),
    annotations: {
      title: "Create Recurring Invoice",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const payload: Record<string, unknown> = {
        customer_id: args.customer_id,
        recurrence_name: args.recurrence_name,
        recurrence_frequency: args.recurrence_frequency,
        repeat_every: args.repeat_every,
        start_date: args.start_date,
        line_items: args.line_items,
      }

      if (args.end_date) payload.end_date = args.end_date
      if (args.payment_terms !== undefined) payload.payment_terms = args.payment_terms

      const result = await zohoPost<{ recurring_invoice: RecurringInvoice }>(
        "/recurringinvoices",
        args.organization_id,
        payload
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to create recurring invoice"
      }

      const ri = result.data?.recurring_invoice

      if (!ri) {
        return "Recurring invoice created but no details returned"
      }

      return `**Recurring Invoice Created Successfully**

- **Recurring Invoice ID**: \`${ri.recurring_invoice_id}\`
- **Recurrence Name**: ${ri.recurrence_name}
- **Frequency**: Every ${ri.repeat_every || 1} ${ri.recurrence_frequency || "N/A"}
- **Start Date**: ${ri.start_date || "N/A"}
- **Total**: ${ri.currency_code || ""} ${ri.total}
- **Status**: ${ri.status || "N/A"}`
    },
  })

  // Stop Recurring Invoice
  server.addTool({
    name: "stop_recurring_invoice",
    description: `Stop a recurring invoice. No further invoices will be generated until resumed.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      recurring_invoice_id: z.string().describe("Recurring Invoice ID"),
    }),
    annotations: {
      title: "Stop Recurring Invoice",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoPost<Record<string, unknown>>(
        `/recurringinvoices/${args.recurring_invoice_id}/status/stop`,
        args.organization_id,
        {}
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to stop recurring invoice"
      }

      return `**Recurring Invoice Stopped Successfully**

Recurring invoice \`${args.recurring_invoice_id}\` has been stopped. No further invoices will be generated.
Use resume_recurring_invoice to reactivate.`
    },
  })

  // Resume Recurring Invoice
  server.addTool({
    name: "resume_recurring_invoice",
    description: `Resume a previously stopped recurring invoice. Invoices will start generating again on the next scheduled date.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      recurring_invoice_id: z.string().describe("Recurring Invoice ID"),
    }),
    annotations: {
      title: "Resume Recurring Invoice",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoPost<Record<string, unknown>>(
        `/recurringinvoices/${args.recurring_invoice_id}/status/resume`,
        args.organization_id,
        {}
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to resume recurring invoice"
      }

      return `**Recurring Invoice Resumed Successfully**

Recurring invoice \`${args.recurring_invoice_id}\` has been resumed. Invoices will generate on the next scheduled date.`
    },
  })
}
