import { NextResponse } from "next/server"

export function withGuard(handler: (req: Request, ctx?: any) => Promise<NextResponse>) {
  return async (req: Request, ctx?: any) => {
    try {
      const result = await handler(req, ctx)
      return result
    } catch (e) {
      console.error("[withGuard] Endpoint crash:", e instanceof Error ? e.message : e)
      return NextResponse.json(
        {
          error: "internal_error",
          message: "An unexpected error occurred.",
        },
        { status: 500 }
      )
    }
  }
}
