import type { NextAuthOptions } from "next-auth"
import EmailProvider from "next-auth/providers/email"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

function customPrismaAdapter() {
  return {
    async createUser(data: { email: string; emailVerified: Date | null; name?: string | null; image?: string | null }) {
      const user = await prisma.appUser.create({
        data: {
          email: data.email,
          emailVerified: data.emailVerified,
          displayName: data.name,
          avatarUrl: data.image,
        },
      })
      return { id: user.id, email: user.email, emailVerified: user.emailVerified, name: user.displayName, image: user.avatarUrl }
    },

    async getUser(id: string) {
      const user = await prisma.appUser.findUnique({ where: { id } })
      if (!user) return null
      return { id: user.id, email: user.email, emailVerified: user.emailVerified, name: user.displayName, image: user.avatarUrl }
    },

    async getUserByEmail(email: string) {
      const user = await prisma.appUser.findUnique({ where: { email } })
      if (!user) return null
      return { id: user.id, email: user.email, emailVerified: user.emailVerified, name: user.displayName, image: user.avatarUrl }
    },

    async getUserByAccount({ provider, providerAccountId }: { provider: string; providerAccountId: string }) {
      const account = await prisma.authAccount.findUnique({
        where: { provider_providerAccountId: { provider, providerAccountId } },
        include: { user: true },
      })
      if (!account?.user) return null
      const u = account.user
      return { id: u.id, email: u.email, emailVerified: u.emailVerified, name: u.displayName, image: u.avatarUrl }
    },

    async updateUser(data: { id: string; email?: string; emailVerified?: Date | null; name?: string | null; image?: string | null }) {
      const user = await prisma.appUser.update({
        where: { id: data.id },
        data: {
          ...(data.email !== undefined && { email: data.email }),
          ...(data.emailVerified !== undefined && { emailVerified: data.emailVerified }),
          ...(data.name !== undefined && { displayName: data.name }),
          ...(data.image !== undefined && { avatarUrl: data.image }),
        },
      })
      return { id: user.id, email: user.email, emailVerified: user.emailVerified, name: user.displayName, image: user.avatarUrl }
    },

    async deleteUser(id: string) {
      await prisma.appUser.delete({ where: { id } })
    },

    async linkAccount(data: {
      userId: string
      type: string
      provider: string
      providerAccountId: string
      refresh_token?: string | null
      access_token?: string | null
      expires_at?: number | null
      token_type?: string | null
      scope?: string | null
      id_token?: string | null
      session_state?: string | null
    }) {
      await prisma.authAccount.create({ data })
      return data as any
    },

    async unlinkAccount({ provider, providerAccountId }: { provider: string; providerAccountId: string }) {
      await prisma.authAccount.delete({
        where: { provider_providerAccountId: { provider, providerAccountId } },
      })
    },

    async getSessionAndUser(sessionToken: string) {
      const session = await prisma.authSession.findUnique({
        where: { sessionToken },
        include: { user: true },
      })
      if (!session) return null
      const u = session.user
      return {
        session: { sessionToken: session.sessionToken, userId: session.userId, expires: session.expires },
        user: { id: u.id, email: u.email, emailVerified: u.emailVerified, name: u.displayName, image: u.avatarUrl },
      }
    },

    async createSession(data: { sessionToken: string; userId: string; expires: Date }) {
      const session = await prisma.authSession.create({ data })
      return session
    },

    async updateSession(data: { sessionToken: string; expires?: Date }) {
      const session = await prisma.authSession.update({
        where: { sessionToken: data.sessionToken },
        data: { ...(data.expires && { expires: data.expires }) },
      })
      return session
    },

    async deleteSession(sessionToken: string) {
      await prisma.authSession.delete({ where: { sessionToken } })
    },

    async createVerificationToken(data: { identifier: string; token: string; expires: Date }) {
      const vt = await prisma.authVerificationToken.create({ data })
      return vt
    },

    async useVerificationToken({ identifier, token }: { identifier: string; token: string }) {
      try {
        const vt = await prisma.authVerificationToken.delete({
          where: { identifier_token: { identifier, token } },
        })
        return vt
      } catch {
        return null
      }
    },
  }
}

async function sendMagicLinkEmail({ identifier, url }: { identifier: string; url: string }) {
  const { getResendClient } = await import("@/lib/resend-client")
  const { client, fromEmail } = await getResendClient()

  await client.emails.send({
    from: fromEmail || "AllFantasy.ai <noreply@allfantasy.ai>",
    to: identifier,
    subject: "Sign in to AllFantasy.ai",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; padding: 32px; border: 1px solid #334155; }
    .logo { font-size: 24px; font-weight: 700; background: linear-gradient(90deg, #22d3ee, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .btn { display: inline-block; background: linear-gradient(90deg, #22d3ee, #a855f7); color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; margin-top: 20px; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div style="text-align:center;">
      <div class="logo">AllFantasy.ai</div>
      <h2 style="margin:16px 0 8px;color:#f1f5f9;">Sign In</h2>
      <p style="color:#94a3b8;">Click the button below to sign in to your account.</p>
      <a href="${url}" class="btn">Sign In to AllFantasy</a>
      <p style="color:#64748b;font-size:13px;margin-top:16px;">This link expires in 24 hours.</p>
    </div>
    <div class="footer">
      <p>If you didn't request this email, you can safely ignore it.</p>
    </div>
  </div>
</body>
</html>`,
  })
}

export const authOptions: NextAuthOptions = {
  adapter: customPrismaAdapter() as any,
  providers: [
    EmailProvider({
      sendVerificationRequest: sendMagicLinkEmail,
    }),
  ],
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify-request",
    error: "/auth/error",
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        (session.user as any).id = user.id
      }
      return session
    },
  },
}
