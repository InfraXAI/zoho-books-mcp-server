/**
 * Invoice tools for Zoho Books API
 */

import { z } from "zod"
import type { FastMCP } from "fastmcp"
import { zohoGet, zohoPost, zohoPut, zohoUploadAttachment, zohoDeleteAttachment } from "../api/client.js"
import type { Invoice, Attachment } from "../api/types.js"
import { optionalOrganizationIdSchema } from "../utils/validation.js"

const invoiceLineItemSchema = z.object({
  item_id: z.string().optional().describe("Item ID from items catalog"),
  name: z.string().optional().describe("Item name (if not using item_id)"),
  description: z.string().optional().describe("Line item description"),
  quantity: z.number().positive().default(1).describe("Quantity"),
  rate: z.number().nonnegative().describe("Unit rate/price"),
  tax_id: z.string().optional().describe("Tax ID"),
  discount: z.number().optional().describe("Discount percentage"),
})

/**
 * Register invoice tools on the server
 */
export function registerInvoiceTools(server: FastMCP): void {
  // List Invoices
  server.addTool({
    name: "list_invoices",
    description: `List all customer invoices (accounts receivable).
Supports filtering by date, customer, and status.
Returns invoice details with customer, amount, and due date.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      date_start: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      date_end: z.string().optional().describe("End date (YYYY-MM-DD)"),
      customer_id: z.string().optional().describe("Filter by customer"),
      status: z
        .enum(["draft", "sent", "overdue", "paid", "void", "partially_paid"])
        .optional()
        .describe("Filter by status"),
      sort_column: z.enum(["date", "due_date", "total", "created_time"]).optional(),
      page: z.number().int().positive().optional(),
      per_page: z.number().int().min(1).max(200).optional(),
    }),
    annotations: {
      title: "List Invoices",
      readOnlyHint: true,
      openWorldHint: true,
    },
    execute: async (args) => {
      const queryParams: Record<string, string> = {}
      if (args.date_start) queryParams.date_start = args.date_start
      if (args.date_end) queryParams.date_end = args.date_end
      if (args.customer_id) queryParams.customer_id = args.customer_id
      if (args.status) queryParams.status = args.status
      if (args.sort_column) queryParams.sort_column = args.sort_column
      if (args.page) queryParams.page = args.page.toString()
      if (args.per_page) queryParams.per_page = args.per_page.toString()

      const result = await zohoGet<{ invoices: Invoice[] }>(
        "/invoices",
        args.organization_id,
        queryParams
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to list invoices"
      }

      const invoices = result.data?.invoices || []

      if (invoices.length === 0) {
        return "No invoices found."
      }

      const formatted = invoices
        .map((inv, index) => {
          return `${index + 1}. **${inv.invoice_number}** - ${inv.customer_name || "Unknown customer"}
   - Invoice ID: \`${inv.invoice_id}\`
   - Date: ${inv.date}
   - Due: ${inv.due_date || "N/A"}
   - Total: ${inv.currency_code || ""} ${inv.total}
   - Balance: ${inv.currency_code || ""} ${inv.balance || 0}
   - Status: ${inv.status || "N/A"}`
        })
        .join("\n\n")

      return `**Invoices** (${invoices.length} items)\n\n${formatted}`
    },
  })

  // Get Invoice
  server.addTool({
    name: "get_invoice",
    description: `Get detailed information about a specific invoice.
Returns full invoice details including line items and customer info.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      invoice_id: z.string().describe("Invoice ID"),
    }),
    annotations: {
      title: "Get Invoice Details",
      readOnlyHint: true,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoGet<{ invoice: Invoice }>(
        `/invoices/${args.invoice_id}`,
        args.organization_id
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to get invoice"
      }

      const invoice = result.data?.invoice

      if (!invoice) {
        return "Invoice not found"
      }

      let details = `**Invoice Details**

- **Invoice ID**: \`${invoice.invoice_id}\`
- **Invoice Number**: ${invoice.invoice_number}
- **Customer**: ${invoice.customer_name || invoice.customer_id}
- **Date**: ${invoice.date}
- **Due Date**: ${invoice.due_date || "N/A"}
- **Total**: ${invoice.currency_code || ""} ${invoice.total}
- **Balance**: ${invoice.currency_code || ""} ${invoice.balance || 0}
- **Status**: ${invoice.status || "N/A"}
- **Reference**: ${invoice.reference_number || "N/A"}
- **Notes**: ${invoice.notes || "N/A"}`

      if (invoice.line_items && invoice.line_items.length > 0) {
        details += `\n\n**Line Items**:`
        invoice.line_items.forEach((item, i) => {
          details += `\n${i + 1}. ${item.name || item.description || "Item"} - ${invoice.currency_code || ""} ${item.amount}`
          if (item.quantity && item.rate) {
            details += ` (${item.quantity} x ${item.rate})`
          }
        })
      }

      return details
    },
  })

  // Add Invoice Attachment
  server.addTool({
    name: "add_invoice_attachment",
    description: `Upload a file attachment to an invoice.
Supported file types: PDF, PNG, JPG, JPEG, GIF, DOC, DOCX, XLS, XLSX.
Use this to attach supporting documents to invoices.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      invoice_id: z.string().describe("Invoice ID to attach file to"),
      file_path: z.string().describe("Full local file path to the attachment"),
    }),
    annotations: {
      title: "Add Invoice Attachment",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoUploadAttachment(
        `/invoices/${args.invoice_id}/attachment`,
        args.organization_id,
        args.file_path
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to upload attachment"
      }

      return `**Attachment Added Successfully**

- **Invoice ID**: \`${args.invoice_id}\`
- **File**: ${args.file_path.split("/").pop()}`
    },
  })

  // Get Invoice Attachment
  server.addTool({
    name: "get_invoice_attachment",
    description: `Get attachment information for an invoice.
Returns details about any files attached to the invoice.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      invoice_id: z.string().describe("Invoice ID"),
    }),
    annotations: {
      title: "Get Invoice Attachment",
      readOnlyHint: true,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoGet<{ documents: Attachment[] }>(
        `/invoices/${args.invoice_id}/attachment`,
        args.organization_id
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to get attachment"
      }

      const documents = result.data?.documents || []

      if (documents.length === 0) {
        return `No attachments found for invoice \`${args.invoice_id}\`.`
      }

      let details = `**Invoice Attachments**\n\n- **Invoice ID**: \`${args.invoice_id}\`\n\n**Documents** (${documents.length}):`
      documents.forEach((doc, i) => {
        details += `\n${i + 1}. ${doc.file_name} (${doc.file_size_formatted || "Unknown"})`
      })

      return details
    },
  })

  // Delete Invoice Attachment
  server.addTool({
    name: "delete_invoice_attachment",
    description: `Delete attachment from an invoice.
Removes the file association from the invoice.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      invoice_id: z.string().describe("Invoice ID"),
    }),
    annotations: {
      title: "Delete Invoice Attachment",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoDeleteAttachment(
        `/invoices/${args.invoice_id}/attachment`,
        args.organization_id
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to delete attachment"
      }

      return `**Attachment Deleted Successfully**

Attachment removed from invoice \`${args.invoice_id}\`.`
    },
  })

  // Create Invoice
  server.addTool({
    name: "create_invoice",
    description: `Create a new customer invoice.
Requires customer ID, date, and at least one line item.
Optionally provide estimate_id to convert an estimate into an invoice.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      customer_id: z.string().describe("Customer ID (required)"),
      date: z.string().describe("Invoice date (YYYY-MM-DD)"),
      due_date: z.string().optional().describe("Due date (YYYY-MM-DD)"),
      invoice_number: z.string().optional().describe("Custom invoice number"),
      payment_terms: z.number().int().optional().describe("Payment terms in days"),
      reference_number: z.string().optional().describe("Reference number"),
      notes: z.string().optional().describe("Notes to the customer"),
      terms: z.string().optional().describe("Terms and conditions"),
      line_items: z.array(invoiceLineItemSchema).min(1).describe("Invoice line items (at least one required)"),
      estimate_id: z.string().optional().describe("Estimate ID to convert into this invoice"),
    }),
    annotations: {
      title: "Create Invoice",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const body: Record<string, unknown> = {
        customer_id: args.customer_id,
        date: args.date,
        line_items: args.line_items,
      }
      if (args.due_date) body.due_date = args.due_date
      if (args.invoice_number) body.invoice_number = args.invoice_number
      if (args.payment_terms !== undefined) body.payment_terms = args.payment_terms
      if (args.reference_number) body.reference_number = args.reference_number
      if (args.notes) body.notes = args.notes
      if (args.terms) body.terms = args.terms
      if (args.estimate_id) body.estimate_id = args.estimate_id

      const result = await zohoPost<{ invoice: Invoice }>(
        "/invoices",
        args.organization_id,
        body
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to create invoice"
      }

      const invoice = result.data?.invoice

      if (!invoice) {
        return "Invoice created but no details returned"
      }

      return `**Invoice Created Successfully**

- **Invoice ID**: \`${invoice.invoice_id}\`
- **Invoice Number**: ${invoice.invoice_number}
- **Customer**: ${invoice.customer_name || invoice.customer_id}
- **Date**: ${invoice.date}
- **Due Date**: ${invoice.due_date || "N/A"}
- **Total**: ${invoice.currency_code || ""} ${invoice.total}
- **Status**: ${invoice.status || "draft"}`
    },
  })

  // Update Invoice
  server.addTool({
    name: "update_invoice",
    description: `Update an existing invoice.
Only provided fields will be updated; omitted fields remain unchanged.
Invoice must be in draft or sent status to be updated.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      invoice_id: z.string().describe("Invoice ID to update"),
      date: z.string().optional().describe("Updated invoice date (YYYY-MM-DD)"),
      due_date: z.string().optional().describe("Updated due date (YYYY-MM-DD)"),
      reference_number: z.string().optional().describe("Updated reference number"),
      notes: z.string().optional().describe("Updated notes"),
      terms: z.string().optional().describe("Updated terms and conditions"),
      line_items: z.array(invoiceLineItemSchema).optional().describe("Updated line items (replaces all existing)"),
    }),
    annotations: {
      title: "Update Invoice",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const body: Record<string, unknown> = {}
      if (args.date) body.date = args.date
      if (args.due_date) body.due_date = args.due_date
      if (args.reference_number) body.reference_number = args.reference_number
      if (args.notes) body.notes = args.notes
      if (args.terms) body.terms = args.terms
      if (args.line_items) body.line_items = args.line_items

      const result = await zohoPut<{ invoice: Invoice }>(
        `/invoices/${args.invoice_id}`,
        args.organization_id,
        body
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to update invoice"
      }

      const invoice = result.data?.invoice

      if (!invoice) {
        return "Invoice updated but no details returned"
      }

      return `**Invoice Updated Successfully**

- **Invoice ID**: \`${invoice.invoice_id}\`
- **Invoice Number**: ${invoice.invoice_number}
- **Customer**: ${invoice.customer_name || invoice.customer_id}
- **Date**: ${invoice.date}
- **Due Date**: ${invoice.due_date || "N/A"}
- **Total**: ${invoice.currency_code || ""} ${invoice.total}
- **Status**: ${invoice.status || "N/A"}`
    },
  })

  // Send Invoice
  server.addTool({
    name: "send_invoice",
    description: `Mark an invoice as sent.
Changes the invoice status from draft to sent.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      invoice_id: z.string().describe("Invoice ID to mark as sent"),
    }),
    annotations: {
      title: "Send Invoice",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoPost<Record<string, unknown>>(
        `/invoices/${args.invoice_id}/status/sent`,
        args.organization_id
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to mark invoice as sent"
      }

      return `**Invoice Marked as Sent**

Invoice \`${args.invoice_id}\` has been marked as sent.`
    },
  })

  // Void Invoice
  server.addTool({
    name: "void_invoice",
    description: `Void an invoice.
Marks the invoice as void. This action cannot be undone.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      invoice_id: z.string().describe("Invoice ID to void"),
    }),
    annotations: {
      title: "Void Invoice",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoPost<Record<string, unknown>>(
        `/invoices/${args.invoice_id}/status/void`,
        args.organization_id
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to void invoice"
      }

      return `**Invoice Voided**

Invoice \`${args.invoice_id}\` has been voided.`
    },
  })

  // Email Invoice
  server.addTool({
    name: "email_invoice",
    description: `Email an invoice to specified recipients.
Sends the invoice PDF to the provided email addresses.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      invoice_id: z.string().describe("Invoice ID to email"),
      to_mail_ids: z.array(z.string()).min(1).describe("Recipient email addresses"),
      subject: z.string().optional().describe("Email subject line"),
      body: z.string().optional().describe("Email body text"),
    }),
    annotations: {
      title: "Email Invoice",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const emailBody: Record<string, unknown> = {
        to_mail_ids: args.to_mail_ids,
      }
      if (args.subject) emailBody.subject = args.subject
      if (args.body) emailBody.body = args.body

      const result = await zohoPost<Record<string, unknown>>(
        `/invoices/${args.invoice_id}/email`,
        args.organization_id,
        emailBody
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to email invoice"
      }

      return `**Invoice Emailed Successfully**

- **Invoice ID**: \`${args.invoice_id}\`
- **Sent to**: ${args.to_mail_ids.join(", ")}`
    },
  })
}
