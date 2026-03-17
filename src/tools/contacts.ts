/**
 * Contact tools for Zoho Books API
 */

import { z } from "zod"
import type { FastMCP } from "fastmcp"
import { zohoGet, zohoPost, zohoPut } from "../api/client.js"
import type { Contact } from "../api/types.js"
import { optionalOrganizationIdSchema } from "../utils/validation.js"

/**
 * Register contact tools on the server
 */
export function registerContactTools(server: FastMCP): void {
  // List Contacts
  server.addTool({
    name: "list_contacts",
    description: `List all contacts (customers and vendors).
Supports filtering by contact type (customer or vendor).
Use this to find contact_id values for bills, invoices, and expenses.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      contact_type: z.enum(["customer", "vendor"]).optional().describe("Filter by contact type"),
      status: z.enum(["active", "inactive", "crm", "all"]).optional().describe("Filter by status"),
      search_text: z.string().optional().describe("Search by name or company"),
      sort_column: z.enum(["contact_name", "company_name", "created_time"]).optional(),
      page: z.number().int().positive().optional(),
      per_page: z.number().int().min(1).max(200).optional(),
    }),
    annotations: {
      title: "List Contacts",
      readOnlyHint: true,
      openWorldHint: true,
    },
    execute: async (args) => {
      const queryParams: Record<string, string> = {}
      if (args.contact_type) queryParams.contact_type = args.contact_type
      if (args.status) queryParams.status = args.status
      if (args.search_text) queryParams.search_text = args.search_text
      if (args.sort_column) queryParams.sort_column = args.sort_column
      if (args.page) queryParams.page = args.page.toString()
      if (args.per_page) queryParams.per_page = args.per_page.toString()

      const result = await zohoGet<{ contacts: Contact[] }>(
        "/contacts",
        args.organization_id,
        queryParams
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to list contacts"
      }

      const contacts = result.data?.contacts || []

      if (contacts.length === 0) {
        return "No contacts found."
      }

      const formatted = contacts
        .map((c, index) => {
          return `${index + 1}. **${c.contact_name}** (${c.contact_type})
   - Contact ID: \`${c.contact_id}\`
   - Company: ${c.company_name || "N/A"}
   - Email: ${c.email || "N/A"}
   - Phone: ${c.phone || "N/A"}
   - Status: ${c.status}`
        })
        .join("\n\n")

      return `**Contacts** (${contacts.length} items)\n\n${formatted}`
    },
  })

  // Get Contact
  server.addTool({
    name: "get_contact",
    description: `Get detailed information about a specific contact.
Returns full contact details including payment terms and currency settings.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      contact_id: z.string().describe("Contact ID"),
    }),
    annotations: {
      title: "Get Contact Details",
      readOnlyHint: true,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoGet<{ contact: Contact }>(
        `/contacts/${args.contact_id}`,
        args.organization_id
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to get contact"
      }

      const contact = result.data?.contact

      if (!contact) {
        return "Contact not found"
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
- **Currency**: ${contact.currency_code || "N/A"}`
    },
  })

  // Create Contact
  server.addTool({
    name: "create_contact",
    description: `Create a new contact (customer or vendor).
Provide contact details including name, type, and optional fields like email, phone, GST info.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      contact_name: z.string().describe("Contact name (required)"),
      contact_type: z.enum(["customer", "vendor"]).describe("Contact type: customer or vendor"),
      company_name: z.string().optional().describe("Company name"),
      email: z.string().optional().describe("Email address"),
      phone: z.string().optional().describe("Phone number"),
      gst_no: z.string().optional().describe("GST number"),
      gst_treatment: z
        .enum(["registered", "unregistered", "consumer", "overseas"])
        .optional()
        .describe("GST treatment type"),
      place_of_supply: z.string().optional().describe("Place of supply (state code for GST)"),
      payment_terms: z.number().int().optional().describe("Payment terms in days"),
      notes: z.string().optional().describe("Notes about the contact"),
    }),
    annotations: {
      title: "Create Contact",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const body: Record<string, unknown> = {
        contact_name: args.contact_name,
        contact_type: args.contact_type,
      }
      if (args.company_name) body.company_name = args.company_name
      if (args.email) body.email = args.email
      if (args.phone) body.phone = args.phone
      if (args.gst_no) body.gst_no = args.gst_no
      if (args.gst_treatment) body.gst_treatment = args.gst_treatment
      if (args.place_of_supply) body.place_of_supply = args.place_of_supply
      if (args.payment_terms !== undefined) body.payment_terms = args.payment_terms
      if (args.notes) body.notes = args.notes

      const result = await zohoPost<{ contact: Contact }>(
        "/contacts",
        args.organization_id,
        body
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to create contact"
      }

      const contact = result.data?.contact

      if (!contact) {
        return "Contact created but no details returned"
      }

      return `**Contact Created Successfully**

- **Contact ID**: \`${contact.contact_id}\`
- **Name**: ${contact.contact_name}
- **Type**: ${contact.contact_type}
- **Company**: ${contact.company_name || "N/A"}
- **Email**: ${contact.email || "N/A"}
- **Phone**: ${contact.phone || "N/A"}
- **Status**: ${contact.status}`
    },
  })

  // Update Contact
  server.addTool({
    name: "update_contact",
    description: `Update an existing contact's details.
Only provided fields will be updated; omitted fields remain unchanged.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      contact_id: z.string().describe("Contact ID to update"),
      contact_name: z.string().optional().describe("Updated contact name"),
      company_name: z.string().optional().describe("Updated company name"),
      email: z.string().optional().describe("Updated email address"),
      phone: z.string().optional().describe("Updated phone number"),
      gst_no: z.string().optional().describe("Updated GST number"),
      payment_terms: z.number().int().optional().describe("Updated payment terms in days"),
    }),
    annotations: {
      title: "Update Contact",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const body: Record<string, unknown> = {}
      if (args.contact_name) body.contact_name = args.contact_name
      if (args.company_name) body.company_name = args.company_name
      if (args.email) body.email = args.email
      if (args.phone) body.phone = args.phone
      if (args.gst_no) body.gst_no = args.gst_no
      if (args.payment_terms !== undefined) body.payment_terms = args.payment_terms

      const result = await zohoPut<{ contact: Contact }>(
        `/contacts/${args.contact_id}`,
        args.organization_id,
        body
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to update contact"
      }

      const contact = result.data?.contact

      if (!contact) {
        return "Contact updated but no details returned"
      }

      return `**Contact Updated Successfully**

- **Contact ID**: \`${contact.contact_id}\`
- **Name**: ${contact.contact_name}
- **Type**: ${contact.contact_type}
- **Company**: ${contact.company_name || "N/A"}
- **Email**: ${contact.email || "N/A"}
- **Phone**: ${contact.phone || "N/A"}
- **Status**: ${contact.status}`
    },
  })

  // Mark Contact Active
  server.addTool({
    name: "mark_contact_active",
    description: `Mark a contact as active.
Reactivates an inactive contact so they can be used in transactions.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      contact_id: z.string().describe("Contact ID to mark as active"),
    }),
    annotations: {
      title: "Mark Contact Active",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoPost<Record<string, unknown>>(
        `/contacts/${args.contact_id}/active`,
        args.organization_id
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to mark contact as active"
      }

      return `**Contact Marked Active**

Contact \`${args.contact_id}\` has been marked as active.`
    },
  })

  // Mark Contact Inactive
  server.addTool({
    name: "mark_contact_inactive",
    description: `Mark a contact as inactive.
Deactivates a contact so they cannot be used in new transactions.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      contact_id: z.string().describe("Contact ID to mark as inactive"),
    }),
    annotations: {
      title: "Mark Contact Inactive",
      readOnlyHint: false,
      openWorldHint: true,
    },
    execute: async (args) => {
      const result = await zohoPost<Record<string, unknown>>(
        `/contacts/${args.contact_id}/inactive`,
        args.organization_id
      )

      if (!result.ok) {
        return result.errorMessage || "Failed to mark contact as inactive"
      }

      return `**Contact Marked Inactive**

Contact \`${args.contact_id}\` has been marked as inactive.`
    },
  })
}
