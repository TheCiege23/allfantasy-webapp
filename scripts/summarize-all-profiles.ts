import { prisma } from '../lib/prisma'
import { summarizeUserTradeProfile } from '../lib/summarizeTradeProfile'

async function summarizeAllProfiles() {
  console.log('[Profile Summarizer] Starting batch summarization...')

  const users = await prisma.appUser.findMany({
    select: { id: true },
    where: {
      tradeFeedback: {
        some: {},
      },
    },
  })

  console.log(`[Profile Summarizer] Found ${users.length} users with feedback`)

  let updated = 0
  let skipped = 0

  for (const user of users) {
    try {
      await summarizeUserTradeProfile(user.id)
      updated++
    } catch (err) {
      console.error(`[Profile Summarizer] Failed for user ${user.id}:`, err)
      skipped++
    }
  }

  console.log(`[Profile Summarizer] Done. Updated: ${updated}, Skipped/Failed: ${skipped}`)
}

summarizeAllProfiles()
  .catch(err => console.error('[Profile Summarizer] Fatal error:', err))
  .finally(() => process.exit(0))
