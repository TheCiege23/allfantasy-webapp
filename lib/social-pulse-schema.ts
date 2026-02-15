import { z } from "zod"

export const SocialPulseRequestSchema = z.object({
  sport: z.enum(["NFL", "NBA"]),
  format: z.enum(["redraft", "dynasty", "specialty"]),
  idpEnabled: z.boolean().optional().default(false),
  players: z.array(z.string().min(2)).min(1).max(20),
  league_id: z.string().optional(),
})

export const SocialPulseResponseSchema = z.object({
  summary: z.string(),
  bullets: z.array(z.string()).min(3).max(15),
  market: z.array(
    z.object({
      player: z.string(),
      signal: z.enum(["up", "down", "mixed", "injury", "hype", "buy_low", "sell_high", "released", "traded", "idp_scarcity"]),
      reason: z.string().optional(),
    })
  ).max(20).optional(),
  connections: z.array(z.string()).optional(),
  lastUpdated: z.string().optional(),
})

export type SocialPulseRequest = z.infer<typeof SocialPulseRequestSchema>
export type SocialPulseResponse = z.infer<typeof SocialPulseResponseSchema>
