/**
 * Mock Zoho API response fixtures for testing
 */

// Organization responses
export const organizationsResponse = {
  code: 0,
  message: "success",
  organizations: [
    {
      organization_id: "1234567890",
      name: "Test Organization",
      is_default_org: true,
      account_created_date: "2024-01-15",
      time_zone: "America/Los_Angeles",
      language_code: "en",
      currency_id: "460000000000097",
      currency_code: "USD",
      currency_symbol: "$",
      fiscal_year_start_month: 1,
    },
    {
      organization_id: "0987654321",
      name: "Secondary Organization",
      is_default_org: false,
      account_created_date: "2024-06-01",
      time_zone: "America/New_York",
      language_code: "en",
      currency_id: "460000000000097",
      currency_code: "USD",
      currency_symbol: "$",
      fiscal_year_start_month: 1,
    },
  ],
}

export const singleOrganizationResponse = {
  code: 0,
  message: "success",
  organization: organizationsResponse.organizations[0],
}

// Chart of Accounts responses
export const chartOfAccountsResponse = {
  code: 0,
  message: "success",
  chartofaccounts: [
    {
      account_id: "460000000000001",
      account_name: "Checking Account",
      account_code: "1000",
      account_type: "bank",
      account_type_formatted: "Bank",
      is_active: true,
      is_user_created: false,
      current_balance: 10000.0,
      currency_code: "USD",
    },
    {
      account_id: "460000000000002",
      account_name: "Office Expenses",
      account_code: "5000",
      account_type: "expense",
      account_type_formatted: "Expense",
      is_active: true,
      is_user_created: true,
      current_balance: 0,
      currency_code: "USD",
    },
    {
      account_id: "460000000000003",
      account_name: "Revenue",
      account_code: "4000",
      account_type: "income",
      account_type_formatted: "Income",
      is_active: true,
      is_user_created: false,
      current_balance: 50000.0,
      currency_code: "USD",
    },
  ],
}

export const singleAccountResponse = {
  code: 0,
  message: "success",
  account: chartOfAccountsResponse.chartofaccounts[0],
}

export const createAccountResponse = {
  code: 0,
  message: "The account has been created.",
  account: {
    account_id: "460000000000099",
    account_name: "New Account",
    account_code: "9999",
    account_type: "expense",
    account_type_formatted: "Expense",
    is_active: true,
    is_user_created: true,
  },
}

// Journal responses
export const journalsResponse = {
  code: 0,
  message: "success",
  journals: [
    {
      journal_id: "460000000000010",
      journal_date: "2024-01-15",
      entry_number: "J-001",
      reference_number: "REF-001",
      currency_code: "USD",
      notes: "Test journal entry",
      total: 1000.0,
      line_items: [
        {
          account_id: "460000000000001",
          account_name: "Checking Account",
          debit_or_credit: "debit",
          amount: 1000.0,
          description: "Debit entry",
        },
        {
          account_id: "460000000000003",
          account_name: "Revenue",
          debit_or_credit: "credit",
          amount: 1000.0,
          description: "Credit entry",
        },
      ],
    },
  ],
}

export const singleJournalResponse = {
  code: 0,
  message: "success",
  journal: journalsResponse.journals[0],
}

export const createJournalResponse = {
  code: 0,
  message: "The journal has been created.",
  journal: {
    journal_id: "460000000000020",
    journal_date: "2024-01-20",
    entry_number: "J-002",
    currency_code: "USD",
    total: 500.0,
  },
}

// Contact responses
export const contactsResponse = {
  code: 0,
  message: "success",
  contacts: [
    {
      contact_id: "460000000000030",
      contact_name: "Acme Corp",
      company_name: "Acme Corporation",
      contact_type: "vendor",
      status: "active",
      payment_terms: 30,
      currency_code: "USD",
      email: "billing@acme.com",
      phone: "555-1234",
    },
    {
      contact_id: "460000000000031",
      contact_name: "John Doe",
      company_name: null,
      contact_type: "customer",
      status: "active",
      payment_terms: 15,
      currency_code: "USD",
      email: "john@example.com",
      phone: "555-5678",
    },
  ],
}

// Expense responses
export const expensesResponse = {
  code: 0,
  message: "success",
  expenses: [
    {
      expense_id: "460000000000040",
      account_id: "460000000000002",
      account_name: "Office Expenses",
      paid_through_account_id: "460000000000001",
      paid_through_account_name: "Checking Account",
      date: "2024-01-10",
      description: "Office supplies",
      currency_code: "USD",
      amount: 150.0,
      is_billable: false,
      status: "unbilled",
      vendor_name: "Office Depot",
    },
  ],
}

// Bill responses
export const billsResponse = {
  code: 0,
  message: "success",
  bills: [
    {
      bill_id: "460000000000050",
      vendor_id: "460000000000030",
      vendor_name: "Acme Corp",
      bill_number: "INV-2024-001",
      date: "2024-01-05",
      due_date: "2024-02-05",
      currency_code: "USD",
      total: 5000.0,
      balance: 5000.0,
      status: "open",
      line_items: [
        {
          account_id: "460000000000002",
          account_name: "Office Expenses",
          description: "Consulting services",
          amount: 5000.0,
        },
      ],
    },
  ],
}

// Invoice responses
export const invoicesResponse = {
  code: 0,
  message: "success",
  invoices: [
    {
      invoice_id: "460000000000060",
      customer_id: "460000000000031",
      customer_name: "John Doe",
      invoice_number: "INV-001",
      date: "2024-01-12",
      due_date: "2024-01-27",
      currency_code: "USD",
      total: 2500.0,
      balance: 2500.0,
      status: "sent",
    },
  ],
}

// Bank account responses
export const bankAccountsResponse = {
  code: 0,
  message: "success",
  bankaccounts: [
    {
      account_id: "460000000000001",
      account_name: "Checking Account",
      account_code: "1000",
      account_type: "bank",
      account_number: "****1234",
      bank_name: "Chase Bank",
      routing_number: "****5678",
      currency_code: "USD",
      balance: 10000.0,
      is_active: true,
    },
  ],
}

// Error responses
export const notFoundErrorResponse = {
  code: 2006,
  message: "The record you are trying to access does not exist.",
}

export const validationErrorResponse = {
  code: 4,
  message: "Invalid value passed for amount",
}

export const authErrorResponse = {
  code: 14,
  message: "Authorization failed",
}

export const rateLimitErrorResponse = {
  code: 36,
  message: "Rate limit exceeded. Please wait before making more requests.",
}

// Attachment responses
export const attachmentResponse = {
  code: 0,
  message: "success",
  documents: [
    {
      document_id: "460000000000070",
      file_name: "receipt.pdf",
      file_size: 102400,
      file_size_formatted: "100 KB",
      file_type: "application/pdf",
    },
  ],
}

export const attachmentUploadResponse = {
  code: 0,
  message: "The attachment has been added.",
}

// OAuth token response
export const oauthTokenResponse = {
  access_token: "1000.mock_access_token_here",
  token_type: "Bearer",
  expires_in: 3600,
}

export const oauthErrorResponse = {
  error: "invalid_grant",
  error_description: "Invalid refresh token",
}
