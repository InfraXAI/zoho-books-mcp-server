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

      const c = contact as Record<string, unknown>
      const billingAddr = c.billing_address as Record<string, string> | undefined
      const shippingAddr = c.shipping_address as Record<string, string> | undefined

      const formatAddr = (addr: Record<string, string> | undefined): string => {
        if (!addr) return "N/A"
        const parts = [addr.attention, addr.address, addr.street2, addr.city, addr.state, addr.zip, addr.country].filter(Boolean)
        return parts.length > 0 ? parts.join(", ") : "N/A"
      }

      const contactPersons = c.contact_persons as Array<Record<string, unknown>> | undefined
      const personsStr = contactPersons && contactPersons.length > 0
        ? contactPersons.map((p, i) => `  ${i + 1}. ${p.first_name || ""} ${p.last_name || ""} — ${p.designation || "N/A"} — ${p.email || "N/A"} — ${p.phone || p.mobile || "N/A"}`).join("\n")
        : "N/A"

      return `**Contact Details**

- **Contact ID**: \`${contact.contact_id}\`
- **Name**: ${contact.contact_name}
- **Type**: ${contact.contact_type}
- **Company**: ${contact.company_name || "N/A"}
- **Email**: ${contact.email || "N/A"}
- **Phone**: ${contact.phone || "N/A"}
- **Website**: ${c.website || "N/A"}
- **Status**: ${contact.status}
- **Payment Terms**: ${contact.payment_terms ? `${contact.payment_terms} days` : "N/A"}
- **Currency**: ${contact.currency_code || "N/A"}
- **GST Treatment**: ${c.gst_treatment || "N/A"}
- **GST No**: ${c.gst_no || "N/A"}
- **Place of Contact**: ${c.place_of_contact || "N/A"}
- **Billing Address**: ${formatAddr(billingAddr)}
- **Shipping Address**: ${formatAddr(shippingAddr)}
- **Contact Persons**:
${personsStr}`
    },
  })

  // Address schema for billing and shipping
  const addressSchema = z.object({
    attention: z.string().optional().describe("Attention / recipient name"),
    address: z.string().optional().describe("Street address line 1"),
    street2: z.string().optional().describe("Street address line 2"),
    city: z.string().optional().describe("City"),
    state: z.string().optional().describe("State name"),
    state_code: z.string().optional().describe("State code (e.g., KA, MH, JH)"),
    zip: z.string().optional().describe("PIN / ZIP code"),
    country: z.string().optional().describe("Country (e.g., India)"),
    phone: z.string().optional().describe("Phone at this address"),
    fax: z.string().optional().describe("Fax number"),
  }).describe("Address object")

  // Contact person schema
  const contactPersonSchema = z.object({
    first_name: z.string().optional().describe("First name"),
    last_name: z.string().optional().describe("Last name"),
    email: z.string().optional().describe("Email address"),
    phone: z.string().optional().describe("Phone number"),
    mobile: z.string().optional().describe("Mobile number"),
    designation: z.string().optional().describe("Designation / title"),
    department: z.string().optional().describe("Department"),
    is_primary_contact: z.boolean().optional().describe("Set as primary contact"),
  }).describe("Contact person details")

  // Create Contact
  server.addTool({
    name: "create_contact",
    description: `Create a new contact (customer or vendor).
Provide contact details including name, type, and optional fields like email, phone, GST info.
For Indian customers/vendors, always provide gst_treatment, gst_no (if registered), and place_of_contact.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      contact_name: z.string().describe("Contact name (required)"),
      contact_type: z.enum(["customer", "vendor"]).describe("Contact type: customer or vendor"),
      company_name: z.string().optional().describe("Company name"),
      email: z.string().optional().describe("Email address"),
      phone: z.string().optional().describe("Phone number"),
      website: z.string().optional().describe("Website URL"),
      gst_no: z.string().optional().describe("15-digit GSTIN (e.g., 20AANFA0219Q2ZI)"),
      gst_treatment: z
        .enum(["business_gst", "business_none", "consumer", "overseas"])
        .optional()
        .describe("GST treatment: business_gst (registered), business_none (unregistered), consumer, overseas"),
      place_of_contact: z.string().optional().describe("Place of supply/contact — Indian state name (e.g., Jharkhand, Haryana, Karnataka). Determines IGST vs CGST+SGST."),
      billing_address: addressSchema.optional().describe("Billing address"),
      shipping_address: addressSchema.optional().describe("Shipping / dispatch address"),
      contact_persons: z.array(contactPersonSchema).optional().describe("Contact persons (array)"),
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
      if (args.website) body.website = args.website
      if (args.gst_no) body.gst_no = args.gst_no
      if (args.gst_treatment) body.gst_treatment = args.gst_treatment
      if (args.place_of_contact) body.place_of_contact = args.place_of_contact
      if (args.billing_address) body.billing_address = args.billing_address
      if (args.shipping_address) body.shipping_address = args.shipping_address
      if (args.contact_persons) body.contact_persons = args.contact_persons
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
Only provided fields will be updated; omitted fields remain unchanged.
For Indian customers/vendors, use this to set gst_treatment, gst_no, place_of_contact, and addresses.`,
    parameters: z.object({
      organization_id: optionalOrganizationIdSchema.describe(
        "Zoho org ID (uses ZOHO_ORGANIZATION_ID env var if not provided)"
      ),
      contact_id: z.string().describe("Contact ID to update"),
      contact_name: z.string().optional().describe("Updated contact name"),
      company_name: z.string().optional().describe("Updated company name"),
      email: z.string().optional().describe("Updated email address"),
      phone: z.string().optional().describe("Updated phone number"),
      website: z.string().optional().describe("Updated website URL"),
      gst_no: z.string().optional().describe("Updated 15-digit GSTIN"),
      gst_treatment: z
        .enum(["business_gst", "business_none", "consumer", "overseas"])
        .optional()
        .describe("GST treatment: business_gst (registered), business_none (unregistered), consumer, overseas"),
      place_of_contact: z.string().optional().describe("Place of supply/contact — Indian state name (e.g., Jharkhand, Haryana). Determines IGST vs CGST+SGST."),
      billing_address: addressSchema.optional().describe("Billing address"),
      shipping_address: addressSchema.optional().describe("Shipping / dispatch address"),
      contact_persons: z.array(contactPersonSchema).optional().describe("Contact persons (array)"),
      payment_terms: z.number().int().optional().describe("Updated payment terms in days"),
      notes: z.string().optional().describe("Updated notes"),
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
      if (args.website) body.website = args.website
      if (args.gst_no) body.gst_no = args.gst_no
      if (args.gst_treatment) body.gst_treatment = args.gst_treatment
      if (args.place_of_contact) body.place_of_contact = args.place_of_contact
      if (args.billing_address) body.billing_address = args.billing_address
      if (args.shipping_address) body.shipping_address = args.shipping_address
      if (args.contact_persons) body.contact_persons = args.contact_persons
      if (args.payment_terms !== undefined) body.payment_terms = args.payment_terms
      if (args.notes) body.notes = args.notes

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
- **GST No**: ${(contact as Record<string, unknown>).gst_no || "N/A"}
- **GST Treatment**: ${(contact as Record<string, unknown>).gst_treatment || "N/A"}
- **Place of Contact**: ${(contact as Record<string, unknown>).place_of_contact || "N/A"}
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
