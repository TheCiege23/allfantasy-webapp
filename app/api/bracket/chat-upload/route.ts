import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"

const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Only JPEG, PNG, GIF, WebP allowed" }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 })
    }

    const ext = file.name.split(".").pop() || "png"
    const filename = `${randomUUID()}.${ext}`
    const uploadDir = path.join(process.cwd(), "public", "uploads", "chat")
    await mkdir(uploadDir, { recursive: true })
    const filepath = path.join(uploadDir, filename)

    const bytes = new Uint8Array(await file.arrayBuffer())
    await writeFile(filepath, bytes)

    return NextResponse.json({ url: `/uploads/chat/${filename}` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 })
  }
}
