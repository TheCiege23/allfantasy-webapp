import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = "public/uploads/feedback";
const MAX_SIZE = 5 * 1024 * 1024;

export const POST = withApiUsage({ endpoint: "/api/legacy/feedback/upload", tool: "LegacyFeedbackUpload" })(async (request: NextRequest) => {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File must be less than 5MB" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "png";
    const fileName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
    const uploadPath = path.join(process.cwd(), UPLOAD_DIR);

    if (!existsSync(uploadPath)) {
      await mkdir(uploadPath, { recursive: true });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(uploadPath, fileName);
    await writeFile(filePath, buffer);

    const url = `/uploads/feedback/${fileName}`;

    return NextResponse.json({ url, fileName });
  } catch (err) {
    console.error("Screenshot upload error:", err);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
})
