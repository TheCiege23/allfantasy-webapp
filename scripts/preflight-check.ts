const REQUIRED_SECRETS = [
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
  "DATABASE_URL",
  "OPENAI_API_KEY",
]

const OPTIONAL_SECRETS = [
  "GROK_API_KEY",
  "RESEND_API_KEY",
  "SERPER_API_KEY",
  "ROLLING_INSIGHTS_CLIENT_ID",
  "ROLLING_INSIGHTS_CLIENT_SECRET",
  "API_SPORTS_KEY",
  "ADMIN_SESSION_SECRET",
]

const CRITICAL_ENDPOINTS = [
  "/api/health",
]

interface CheckResult {
  name: string
  status: "pass" | "fail" | "warn"
  detail: string
}

const results: CheckResult[] = []

function check(name: string, status: "pass" | "fail" | "warn", detail: string) {
  results.push({ name, status, detail })
}

async function checkEnvVars() {
  for (const key of REQUIRED_SECRETS) {
    const val = process.env[key]
    if (!val || val.trim() === "") {
      check(`ENV: ${key}`, "fail", "Missing or empty")
    } else {
      const masked = val.slice(0, 4) + "..." + val.slice(-4)
      check(`ENV: ${key}`, "pass", `Set (${masked})`)
    }
  }

  for (const key of OPTIONAL_SECRETS) {
    const val = process.env[key]
    if (!val || val.trim() === "") {
      check(`ENV: ${key}`, "warn", "Not set (optional)")
    } else {
      check(`ENV: ${key}`, "pass", "Set")
    }
  }
}

async function checkDatabase() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    check("DB: Connection", "fail", "DATABASE_URL not set")
    return
  }

  try {
    const { PrismaClient } = await import("@prisma/client")
    const prisma = new PrismaClient({ datasourceUrl: dbUrl })
    await prisma.$queryRaw`SELECT 1`
    check("DB: Connection", "pass", "Connected successfully")

    const tableResult: any[] = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `
    const tables = tableResult.map((r: any) => r.tablename)
    check("DB: Tables", "pass", `${tables.length} tables found`)

    const criticalTables = ["User", "Account", "League", "AppUser"]
    for (const t of criticalTables) {
      const found = tables.some(
        (name: string) => name.toLowerCase() === t.toLowerCase()
      )
      check(`DB: Table ${t}`, found ? "pass" : "warn", found ? "Exists" : "Not found")
    }

    await prisma.$disconnect()
  } catch (e: any) {
    check("DB: Connection", "fail", `Error: ${e.message?.slice(0, 100)}`)
  }
}

async function checkMigrationStatus() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) return

  try {
    const { PrismaClient } = await import("@prisma/client")
    const prisma = new PrismaClient({ datasourceUrl: dbUrl })

    const migrations: any[] = await prisma.$queryRaw`
      SELECT migration_name, finished_at 
      FROM _prisma_migrations 
      ORDER BY finished_at DESC 
      LIMIT 5
    `

    if (migrations.length > 0) {
      check("DB: Migrations", "pass", `${migrations.length} recent migrations`)
      const latest = migrations[0]
      check("DB: Latest migration", "pass", `${latest.migration_name} at ${latest.finished_at}`)
    }

    const failed: any[] = await prisma.$queryRaw`
      SELECT migration_name FROM _prisma_migrations 
      WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL
    `
    if (failed.length > 0) {
      check("DB: Failed migrations", "fail", `${failed.length} failed: ${failed.map((m: any) => m.migration_name).join(", ")}`)
    } else {
      check("DB: Failed migrations", "pass", "None")
    }

    await prisma.$disconnect()
  } catch (e: any) {
    check("DB: Migrations", "warn", `Could not check: ${e.message?.slice(0, 80)}`)
  }
}

async function checkNextAuthConfig() {
  const url = process.env.NEXTAUTH_URL
  if (url) {
    try {
      new URL(url)
      check("Auth: NEXTAUTH_URL format", "pass", url)
    } catch {
      check("Auth: NEXTAUTH_URL format", "fail", `Invalid URL: ${url}`)
    }
  }

  const secret = process.env.NEXTAUTH_SECRET
  if (secret && secret.length < 16) {
    check("Auth: NEXTAUTH_SECRET strength", "warn", "Secret is shorter than recommended (16+ chars)")
  } else if (secret) {
    check("Auth: NEXTAUTH_SECRET strength", "pass", `${secret.length} chars`)
  }
}

async function checkEndpoints() {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:5000"

  for (const endpoint of CRITICAL_ENDPOINTS) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(`${baseUrl}${endpoint}`, { signal: controller.signal })
      clearTimeout(timeout)

      if (res.ok) {
        check(`API: ${endpoint}`, "pass", `HTTP ${res.status}`)
      } else {
        check(`API: ${endpoint}`, "warn", `HTTP ${res.status}`)
      }
    } catch (e: any) {
      check(`API: ${endpoint}`, "warn", `Unreachable: ${e.message?.slice(0, 60)}`)
    }
  }
}

async function main() {
  console.log("\n========================================")
  console.log("  AllFantasy Preflight Check")
  console.log("  " + new Date().toISOString())
  console.log("========================================\n")

  await checkEnvVars()
  await checkNextAuthConfig()
  await checkDatabase()
  await checkMigrationStatus()
  await checkEndpoints()

  console.log("")
  let fails = 0
  let warns = 0
  for (const r of results) {
    const icon = r.status === "pass" ? "[PASS]" : r.status === "warn" ? "[WARN]" : "[FAIL]"
    console.log(`  ${icon} ${r.name}: ${r.detail}`)
    if (r.status === "fail") fails++
    if (r.status === "warn") warns++
  }

  console.log("\n========================================")
  console.log(`  Results: ${results.length} checks | ${fails} failures | ${warns} warnings`)
  console.log("========================================\n")

  if (fails > 0) {
    console.error("PREFLIGHT FAILED - fix the above failures before deploying.")
    process.exit(1)
  }

  console.log("Preflight PASSED - ready for deployment.")
}

main().catch((e) => {
  console.error("Preflight script crashed:", e)
  process.exit(1)
})
