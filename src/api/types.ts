/**
 * TypeScript interfaces for Zoho Books API
 */

// Common response structure
export interface ZohoResponse<T> {
  code: number
  message: string
  data?: T
}

// Organization
export interface Organization {
  organization_id: string
  name: string
  is_default_org: boolean
  account_created_date: string
  time_zone: string
  language_code: string
  currency_id: string
  currency_code: string
  currency_symbol: string
  fiscal_year_start_month: number
}

// Chart of Accounts
export interface Account {
  account_id: string
  account_name: string
  account_code?: string
  account_type: string
  account_type_formatted: string
  is_active: boolean
  is_user_created: boolean
  is_involved_in_transaction?: boolean
  current_balance?: number
  currency_id?: string
  currency_code?: string
  parent_account_id?: string
  parent_account_name?: string
  depth?: number
  description?: string
}

export interface AccountTransaction {
  transaction_id: string
  transaction_date: string
  transaction_type: string
  transaction_type_formatted: string
  description: string
  debit_or_credit: "debit" | "credit"
  offset_account_name?: string
  debit_amount: number
  credit_amount: number
  running_balance?: number
}

// Journal Entry
export interface JournalLineItem {
  account_id: string
  account_name?: string
  debit_or_credit: "debit" | "credit"
  amount: number
  description?: string
  customer_id?: string
  customer_name?: string
}

export interface Journal {
  journal_id: string
  journal_number?: string
  journal_date: string
  entry_number?: string
  reference_number?: string
  currency_id?: string
  currency_code?: string
  notes?: string
  total: number
  is_inclusive_tax?: boolean
  journal_type?: string
  created_time?: string
  last_modified_time?: string
  line_items: JournalLineItem[]
}

export interface CreateJournalRequest {
  journal_date: string
  reference_number?: string
  notes?: string
  currency_id?: string
  line_items: Array<{
    account_id: string
    debit_or_credit: "debit" | "credit"
    amount: number
    description?: string
    customer_id?: string
  }>
}

// Expense
export interface Expense {
  expense_id: string
  expense_item_id?: string
  account_id: string
  account_name?: string
  paid_through_account_id?: string
  paid_through_account_name?: string
  date: string
  description?: string
  currency_id?: string
  currency_code?: string
  amount: number
  tax_amount?: number
  is_billable?: boolean
  is_inclusive_tax?: boolean
  reference_number?: string
  customer_id?: string
  customer_name?: string
  vendor_id?: string
  vendor_name?: string
  status?: string
  created_time?: string
  last_modified_time?: string
}

export interface CreateExpenseRequest {
  account_id: string
  paid_through_account_id: string
  date: string
  amount: number
  description?: string
  reference_number?: string
  customer_id?: string
  vendor_id?: string
  is_billable?: boolean
}

// Bill
export interface BillLineItem {
  line_item_id?: string
  account_id: string
  account_name?: string
  description?: string
  amount: number
  tax_id?: string
  item_order?: number
}

export interface Bill {
  bill_id: string
  vendor_id: string
  vendor_name?: string
  bill_number?: string
  date: string
  due_date?: string
  currency_id?: string
  currency_code?: string
  total: number
  balance?: number
  status?: string
  reference_number?: string
  notes?: string
  created_time?: string
  last_modified_time?: string
  line_items: BillLineItem[]
}

export interface CreateBillRequest {
  vendor_id: string
  bill_number?: string
  date: string
  due_date?: string
  reference_number?: string
  notes?: string
  line_items: Array<{
    account_id: string
    description?: string
    amount: number
    tax_id?: string
  }>
}

// Invoice
export interface InvoiceLineItem {
  line_item_id?: string
  item_id?: string
  name?: string
  description?: string
  quantity?: number
  rate?: number
  amount: number
  tax_id?: string
}

export interface Invoice {
  invoice_id: string
  customer_id: string
  customer_name?: string
  invoice_number: string
  date: string
  due_date?: string
  currency_id?: string
  currency_code?: string
  total: number
  balance?: number
  status?: string
  reference_number?: string
  notes?: string
  created_time?: string
  last_modified_time?: string
  line_items?: InvoiceLineItem[]
}

// Contact (Customer/Vendor)
export interface Contact {
  contact_id: string
  contact_name: string
  company_name?: string
  contact_type: "customer" | "vendor"
  status: string
  payment_terms?: number
  currency_id?: string
  currency_code?: string
  email?: string
  phone?: string
  created_time?: string
  last_modified_time?: string
}

// Bank Account
export interface BankAccount {
  account_id: string
  account_name: string
  account_code?: string
  account_type: string
  account_number?: string
  bank_name?: string
  routing_number?: string
  currency_id?: string
  currency_code?: string
  balance?: number
  is_active: boolean
}

export interface BankTransaction {
  transaction_id: string
  date: string
  amount: number
  transaction_type: string
  status: string
  reference_number?: string
  description?: string
  payee?: string
  currency_id?: string
  currency_code?: string
  debit_or_credit: "debit" | "credit"
}

// Attachment
export interface Attachment {
  document_id?: string
  file_name: string
  file_size?: number
  file_size_formatted?: string
  file_type?: string
}

// Pagination
export interface PageContext {
  page: number
  per_page: number
  has_more_page: boolean
  total: number
  total_pages: number
}

// List response wrapper
export interface ListResponse<T> {
  code: number
  message: string
  [key: string]: T[] | number | string | PageContext | undefined
  page_context?: PageContext
}

// Customer Payment
export interface CustomerPayment {
  payment_id: string
  customer_id: string
  customer_name?: string
  payment_mode?: string
  amount: number
  date: string
  reference_number?: string
  description?: string
  invoice_number?: string
  account_id?: string
  account_name?: string
  currency_code?: string
  status?: string
}

// Vendor Payment
export interface VendorPayment {
  payment_id: string
  vendor_id: string
  vendor_name?: string
  payment_mode?: string
  amount: number
  date: string
  reference_number?: string
  description?: string
  bill_number?: string
  paid_through_account_id?: string
  paid_through_account_name?: string
  currency_code?: string
  status?: string
}

// Estimate
export interface EstimateLineItem {
  line_item_id?: string
  item_id?: string
  name?: string
  description?: string
  quantity?: number
  rate?: number
  amount: number
  tax_id?: string
  discount?: number
}

export interface Estimate {
  estimate_id: string
  customer_id: string
  customer_name?: string
  estimate_number: string
  date: string
  expiry_date?: string
  currency_code?: string
  total: number
  status?: string
  reference_number?: string
  notes?: string
  terms?: string
  line_items?: EstimateLineItem[]
}

// Purchase Order
export interface PurchaseOrderLineItem {
  line_item_id?: string
  item_id?: string
  name?: string
  description?: string
  quantity?: number
  rate?: number
  amount: number
  tax_id?: string
}

export interface PurchaseOrder {
  purchaseorder_id: string
  vendor_id: string
  vendor_name?: string
  purchaseorder_number: string
  date: string
  delivery_date?: string
  currency_code?: string
  total: number
  status?: string
  reference_number?: string
  notes?: string
  line_items?: PurchaseOrderLineItem[]
}

// Item
export interface Item {
  item_id: string
  name: string
  description?: string
  rate: number
  purchase_rate?: number
  sku?: string
  product_type?: string
  tax_id?: string
  tax_name?: string
  hsn_or_sac?: string
  unit?: string
  account_id?: string
  account_name?: string
  purchase_account_id?: string
  status?: string
  currency_code?: string
}

// Tax
export interface Tax {
  tax_id: string
  tax_name: string
  tax_percentage: number
  tax_type?: string
  is_default_tax?: boolean
}

export interface TaxGroup {
  tax_group_id: string
  tax_group_name: string
  tax_group_percentage: number
  taxes?: Tax[]
}

// Credit Note
export interface CreditNoteLineItem {
  line_item_id?: string
  item_id?: string
  name?: string
  description?: string
  quantity?: number
  rate?: number
  amount: number
  tax_id?: string
}

export interface CreditNote {
  creditnote_id: string
  creditnote_number: string
  customer_id: string
  customer_name?: string
  date: string
  currency_code?: string
  total: number
  balance?: number
  status?: string
  reference_number?: string
  notes?: string
  line_items?: CreditNoteLineItem[]
}

// Recurring Invoice
export interface RecurringInvoice {
  recurring_invoice_id: string
  recurrence_name: string
  customer_id: string
  customer_name?: string
  recurrence_frequency?: string
  repeat_every?: number
  start_date?: string
  end_date?: string
  next_invoice_date?: string
  currency_code?: string
  total: number
  status?: string
  line_items?: InvoiceLineItem[]
}

// Contact Person (for contact create)
export interface ContactPerson {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  is_primary_contact?: boolean
}

// Address (for contact create)
export interface Address {
  address?: string
  city?: string
  state?: string
  zip?: string
  country?: string
}
