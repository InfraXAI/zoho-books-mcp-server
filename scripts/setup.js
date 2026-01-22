#!/usr/bin/env node

/**
 * Interactive setup script for Zoho Bookkeeper MCP Server
 * Guides users through OAuth configuration step by step
 */

import * as fs from "fs"
import * as path from "path"
import * as readline from "readline"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, "..")
const ENV_FILE = path.join(ROOT_DIR, ".env")
const ENV_EXAMPLE = path.join(ROOT_DIR, ".env.example")

// ANSI color codes
const RESET = "\x1b[0m"
const BOLD = "\x1b[1m"
const DIM = "\x1b[2m"
const GREEN = "\x1b[32m"
const YELLOW = "\x1b[33m"
const BLUE = "\x1b[34m"
const CYAN = "\x1b[36m"
const RED = "\x1b[31m"

function print(text = "") {
  console.log(text)
}

function printHeader() {
  print()
  print(`${CYAN}${BOLD}┌─────────────────────────────────────────────────────────────┐${RESET}`)
  print(`${CYAN}${BOLD}│  Zoho Bookkeeper MCP - Setup                                │${RESET}`)
  print(`${CYAN}${BOLD}└─────────────────────────────────────────────────────────────┘${RESET}`)
  print()
}

function printStep(number, title) {
  print(`${BLUE}${BOLD}Step ${number}: ${title}${RESET}`)
  print()
}

function printSuccess(message) {
  print(`${GREEN}✓ ${message}${RESET}`)
}

function printError(message) {
  print(`${RED}✗ ${message}${RESET}`)
}

function printWarning(message) {
  print(`${YELLOW}! ${message}${RESET}`)
}

function printInstructions(lines) {
  for (const line of lines) {
    print(`  ${DIM}${line}${RESET}`)
  }
}

/**
 * Create readline interface for user input
 */
function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
}

/**
 * Prompt user for input
 */
async function prompt(rl, question) {
  return new Promise((resolve) => {
    rl.question(`  ${CYAN}${question}${RESET} `, (answer) => {
      resolve(answer.trim())
    })
  })
}

/**
 * Wait for user to press Enter
 */
async function waitForEnter(rl) {
  return new Promise((resolve) => {
    rl.question(`  ${DIM}Press Enter when ready...${RESET}`, () => {
      resolve()
    })
  })
}

/**
 * Validate Client ID format
 */
function validateClientId(clientId) {
  if (!clientId) {
    return { valid: false, error: "Client ID cannot be empty" }
  }
  if (!clientId.startsWith("1000.")) {
    return { valid: false, error: 'Client ID should start with "1000."' }
  }
  if (clientId.length < 30) {
    return { valid: false, error: "Client ID seems too short" }
  }
  return { valid: true }
}

/**
 * Validate Client Secret format
 */
function validateClientSecret(clientSecret) {
  if (!clientSecret) {
    return { valid: false, error: "Client Secret cannot be empty" }
  }
  if (clientSecret.length < 20) {
    return { valid: false, error: "Client Secret seems too short" }
  }
  return { valid: true }
}

/**
 * Validate Authorization Code format
 */
function validateAuthCode(code) {
  if (!code) {
    return { valid: false, error: "Authorization code cannot be empty" }
  }
  if (!code.startsWith("1000.")) {
    return { valid: false, error: 'Authorization code should start with "1000."' }
  }
  return { valid: true }
}

/**
 * Exchange authorization code for refresh token
 */
async function exchangeCodeForToken(clientId, clientSecret, authCode) {
  const response = await fetch("https://accounts.zoho.com/oauth/v2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code: authCode,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
    }),
  })

  const data = await response.json()

  if (data.error) {
    return {
      success: false,
      error: `${data.error}: ${data.error_description || "Unknown error"}`,
    }
  }

  if (!data.refresh_token) {
    return {
      success: false,
      error: "No refresh token in response. The authorization code may have expired.",
    }
  }

  return {
    success: true,
    refreshToken: data.refresh_token,
    accessToken: data.access_token,
  }
}

/**
 * Read existing .env file or create from template
 */
function readEnvFile() {
  if (fs.existsSync(ENV_FILE)) {
    return fs.readFileSync(ENV_FILE, "utf-8")
  }
  if (fs.existsSync(ENV_EXAMPLE)) {
    return fs.readFileSync(ENV_EXAMPLE, "utf-8")
  }
  // Default template
  return `# Zoho OAuth Configuration (Required)
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REFRESH_TOKEN=

# Zoho API URL (Optional - defaults to US datacenter)
ZOHO_API_URL=https://www.zohoapis.com/books/v3

# Server Configuration (Optional)
PORT=8004
HOST=0.0.0.0
`
}

/**
 * Update a value in .env content
 */
function updateEnvValue(content, key, value) {
  const regex = new RegExp(`^${key}=.*$`, "m")
  if (regex.test(content)) {
    return content.replace(regex, `${key}=${value}`)
  }
  // Add the key if it doesn't exist
  return `${content}\n${key}=${value}`
}

/**
 * Write credentials to .env file
 */
function writeEnvFile(clientId, clientSecret, refreshToken) {
  let content = readEnvFile()

  content = updateEnvValue(content, "ZOHO_CLIENT_ID", clientId)
  content = updateEnvValue(content, "ZOHO_CLIENT_SECRET", clientSecret)
  content = updateEnvValue(content, "ZOHO_REFRESH_TOKEN", refreshToken)

  fs.writeFileSync(ENV_FILE, content)
}

/**
 * Main setup flow
 */
async function main() {
  const rl = createReadline()

  try {
    printHeader()

    // Check if .env already exists with credentials
    if (fs.existsSync(ENV_FILE)) {
      const existingContent = fs.readFileSync(ENV_FILE, "utf-8")
      const hasRefreshToken = /^ZOHO_REFRESH_TOKEN=1000\..+$/m.test(existingContent)

      if (hasRefreshToken) {
        printWarning("Existing .env file found with credentials.")
        const overwrite = await prompt(rl, "Overwrite existing credentials? (y/N):")
        if (overwrite.toLowerCase() !== "y") {
          print()
          print("Setup cancelled. Existing credentials preserved.")
          rl.close()
          process.exit(0)
        }
        print()
      }
    }

    // Step 1: Create Zoho Self-Client
    printStep(1, "Create a Zoho Self-Client Application")
    printInstructions([
      "1. Open https://api-console.zoho.com/",
      "2. Click \"Add Client\" → \"Self Client\"",
      "3. Click \"Create\" to confirm",
    ])
    print()
    await waitForEnter(rl)
    print()

    // Step 2: Get Client Credentials
    printStep(2, "Get your Client Credentials")
    printInstructions([
      "1. Select your Self Client",
      "2. Go to the \"Client Secret\" tab",
      "3. Copy the Client ID and Client Secret",
    ])
    print()

    let clientId = ""
    while (true) {
      clientId = await prompt(rl, "Enter Client ID:")
      const validation = validateClientId(clientId)
      if (validation.valid) break
      printError(validation.error)
    }

    let clientSecret = ""
    while (true) {
      clientSecret = await prompt(rl, "Enter Client Secret:")
      const validation = validateClientSecret(clientSecret)
      if (validation.valid) break
      printError(validation.error)
    }

    print()

    // Step 3: Generate Authorization Code
    printStep(3, "Generate Authorization Code")
    printInstructions([
      "1. Go to the \"Generate Code\" tab",
      "2. Enter scope: ZohoBooks.fullaccess.all",
      "3. Set duration to maximum (10 minutes)",
      "4. Enter a description (e.g., \"Bookkeeper MCP\")",
      "5. Click \"Create\"",
    ])
    print()

    let authCode = ""
    while (true) {
      authCode = await prompt(rl, "Enter the generated code:")
      const validation = validateAuthCode(authCode)
      if (validation.valid) break
      printError(validation.error)
    }

    print()
    print(`${DIM}Exchanging code for refresh token...${RESET}`)

    const result = await exchangeCodeForToken(clientId, clientSecret, authCode)

    if (!result.success) {
      print()
      printError(`Token exchange failed: ${result.error}`)
      print()
      print("Common issues:")
      printInstructions([
        "- Authorization code expired (valid for 10 minutes)",
        "- Invalid Client ID or Client Secret",
        "- Code was already used (generate a new one)",
      ])
      rl.close()
      process.exit(1)
    }

    // Save credentials
    writeEnvFile(clientId, clientSecret, result.refreshToken)

    print()
    printSuccess("Success! Credentials saved to .env")
    print()
    print(`${DIM}You can now run the server with:${RESET}`)
    print()
    print(`  ${CYAN}pnpm serve${RESET}      ${DIM}# HTTP server on port 8004${RESET}`)
    print(`  ${CYAN}pnpm start${RESET}      ${DIM}# stdio transport for desktop agents${RESET}`)
    print()

    rl.close()
  } catch (error) {
    rl.close()
    print()
    printError(`Setup failed: ${error.message}`)
    process.exit(1)
  }
}

main()
