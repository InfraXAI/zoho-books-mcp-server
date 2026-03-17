/**
 * Credit Note tools for Zoho Books API
 */

import { z } from "zod"
import type { FastMCP } from "fastmcp"
import { zohoGet, zohoPost, zohoDelete } from "../api/client.js"
import type { CreditNote } from "../api/types.js"
import { optionalOrganizationIdSchema, dateSchema, moneySchema } from "../utils/validation.js"

// Zod schema for credit note line items
const creditNoteLineItemSchema = z.object({
  item_id: z.string().optional().describe("Item ID"),
  name: z.string().optional().describe("Item name"),
  description: z.string().optional().describe("Description"),
  quantity: z.number().positive().default(1).describe("Quantity"),
  rate: z.number().nonnegative().describe("Unit rate"),
  tax_id: z.string().optional().describe("Tax ID"),
})

/**
 * Register credit note tools on the server
 */
export function registerCreditNoteTools(server: FastMCP): void {
  // List Credit Notes
  server.addTool({
    name: "list_credit_notes",
    description: `List all credit notes.
Supports filtering by customer, status, and date range.
Returns credit note number, customer, total, balance, and status.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      customer_id: z.string().optional().describe("Filter by customer ID"),
      status: z.enum(["open", "closed", "void"]).optional().describe("Filter by status"),
      date_start: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      date_end: z.string().optional().describe("End date (YYYY-MM-DD)"),
      page: z.number().int().positive().optional(),
      per_page: z.number().int().min(1).max(200).optional(),
    }),
    annotations: {
      title: "List Credit Notes",
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

      const result = await zohoGet<{ creditnotes: CreditNote[] }>("/creditnotes", args.organization_id, queryParams)

      if (!result.ok) {
        return result.errorMessage || "Failed to list credit notes"
      }

      const creditnotes = result.data?.creditnotes || []

      if (creditnotes.length === 0) {
        return "No credit notes found."
      }

      const formatted = creditnotes
        .map((cn, index) => {
          return `${index + 1}. **${cn.creditnote_number || "No number"}** - ${cn.customer_name || "Unknown customer"}
   - Credit Note ID: \`${cn.creditnote_id}\`
   - Date: ${cn.date}
   - Total: ${cn.currency_code || ""} ${cn.total}
   - Balance: ${cn.currency_code || ""} ${cn.balance || 0}
   - Status: ${cn.status || "N/A"}`
        })
        .join("\n\n")

      return `**Credit Notes** (${creditnotes.length} items)\n\n${formatted}`
    },
  })

  // Get Credit Note
  server.addTool({
    name: "get_credit_note",
    description: `Get detailed information about a specific credit note.
Returns full details including line items and remaining balance.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      creditnote_id: z.string().describe("Credit Note ID"),
    }),
    annotations: {
      title: "Get Credit Note Details",
      readOnlyHint: true,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoGet<{ creditnote: CreditNote }>(`/creditnotes/${args.creditnote_id}`, args.organization_id)

      if (!result.ok) {
        return result.errorMessage || "Failed to get credit note"
      }

      const cn = result.data?.creditnote

      if (!cn) {
        return "Credit note not found"
      }

      let details = `**Credit Note Details**

- **Credit Note ID**: \`${cn.creditnote_id}\`
- **Number**: ${cn.creditnote_number || "N/A"}
- **Customer**: ${cn.customer_name || cn.customer_id}
- **Date**: ${cn.date}
- **Total**: ${cn.currency_code || ""} ${cn.total}
- **Balance**: ${cn.currency_code || ""} ${cn.balance || 0}
- **Status**: ${cn.status || "N/A"}
- **Reference**: ${cn.reference_number || "N/A"}
- **Notes**: ${cn.notes || "N/A"}

**Line Items**:`

      if (cn.line_items && cn.line_items.length > 0) {
        cn.line_items.forEach((item, i) => {
          details += `\n${i + 1}. ${item.name || item.item_id || "Item"} - ${cn.currency_code || ""} ${item.amount}`
          if (item.description) details += `\n   Description: ${item.description}`
          if (item.quantity && item.rate) details += `\n   ${item.quantity} x ${item.rate}`
        })
      }

      return details
    },
  })

  // Create Credit Note
  server.addTool({
    name: "create_credit_note",
    description: `Create a new credit note for a customer.
Use list_contacts to find customer_id values.
Credit notes can later be applied to outstanding invoices.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      customer_id: z.string().describe("Customer ID"),
      date: dateSchema.describe("Credit note date (YYYY-MM-DD)"),
      creditnote_number: z.string().optional().describe("Credit note number"),
      reference_number: z.string().optional().describe("Reference number"),
      notes: z.string().optional().describe("Notes"),
      line_items: z.array(creditNoteLineItemSchema).min(1).describe("Array of line items"),
    }),
    annotations: {
      title: "Create Credit Note",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const payload: Record<string, unknown> = {
        customer_id: args.customer_id,
        date: args.date,
        line_items: args.line_items,
      }

      if (args.creditnote_number) payload.creditnote_number = args.creditnote_number
      if (args.reference_number) payload.reference_number = args.reference_number
      if (args.notes) payload.notes = args.notes

      const result = await zohoPost<{ creditnote: CreditNote }>("/creditnotes", args.organization_id, payload)

      if (!result.ok) {
        return result.errorMessage || "Failed to create credit note"
      }

      const cn = result.data?.creditnote

      if (!cn) {
        return "Credit note created but no details returned"
      }

      return `**Credit Note Created Successfully**

- **Credit Note ID**: \`${cn.creditnote_id}\`
- **Number**: ${cn.creditnote_number || "N/A"}
- **Date**: ${cn.date}
- **Total**: ${cn.currency_code || ""} ${cn.total}

Use apply_credit_to_invoice to apply this credit against outstanding invoices.`
    },
  })

  // Apply Credit to Invoice
  server.addTool({
    name: "apply_credit_to_invoice",
    description: `Apply a credit note's balance against one or more outstanding invoices.
Provide the credit note ID and an array of invoices with amounts to apply.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      creditnote_id: z.string().describe("Credit Note ID"),
      invoices: z.array(
        z.object({
          invoice_id: z.string().describe("Invoice ID to apply credit to"),
          amount_applied: z.number().positive().describe("Amount to apply from credit note"),
        })
      ).min(1).describe("Array of invoices with amounts to apply"),
    }),
    annotations: {
      title: "Apply Credit to Invoice",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const payload = {
        invoices: args.invoices,
      }

      const result = await zohoPost<{ apply_to_invoices: { invoices: Array<{ invoice_id: string; amount_applied: number }> } }>(
        `/creditnotes/${args.creditnote_id}/invoices`,
        args.organization_id,
        payload
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to apply credit to invoice"
      }

      const applied = result.data?.apply_to_invoices?.invoices || args.invoices

      const formatted = applied
        .map((inv, i) => `${i + 1}. Invoice \`${inv.invoice_id}\` - Applied: ${inv.amount_applied}`)
        .join("\n")

      return `**Credit Applied Successfully**

- **Credit Note ID**: \`${args.creditnote_id}\`

**Applied to Invoices:**
${formatted}`
    },
  })

  // Void Credit Note
  server.addTool({
    name: "void_credit_note",
    description: `Void a credit note. This marks the credit note as void and prevents further use.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      creditnote_id: z.string().describe("Credit Note ID"),
    }),
    annotations: {
      title: "Void Credit Note",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoPost<Record<string, unknown>>(
        `/creditnotes/${args.creditnote_id}/status/void`,
        args.organization_id,
        {}
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to void credit note"
      }

      return `**Credit Note Voided Successfully**

Credit note \`${args.creditnote_id}\` has been voided.`
    },
  })

  // Delete Credit Note
  server.addTool({
    name: "delete_credit_note",
    description: `Delete a credit note permanently. This action cannot be undone.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      creditnote_id: z.string().describe("Credit Note ID"),
    }),
    annotations: {
      title: "Delete Credit Note",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoDelete<Record<string, unknown>>(
        `/creditnotes/${args.creditnote_id}`,
        args.organization_id
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to delete credit note"
      }

      return `**Credit Note Deleted Successfully**

Credit note \`${args.creditnote_id}\` has been deleted.`
    },
  })
}
