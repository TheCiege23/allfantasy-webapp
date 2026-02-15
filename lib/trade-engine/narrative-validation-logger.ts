import { prisma } from '@/lib/prisma'

export async function logNarrativeValidation(input: {
  offerEventId?: string | null
  mode: string
  contractType: 'narrative' | 'negotiation'
  valid: boolean
  violations: string[]
}): Promise<string | null> {
  try {
    const record = await prisma.narrativeValidationLog.create({
      data: {
        offerEventId: input.offerEventId ?? null,
        mode: input.mode,
        contractType: input.contractType,
        valid: input.valid,
        violations: input.violations,
      },
    })
    return record.id
  } catch (err) {
    console.error('[NarrativeValidationLogger] Error:', err)
    return null
  }
}
