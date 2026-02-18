import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

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

export const authOptions: NextAuthOptions = {
  adapter: customPrismaAdapter() as any,
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Password",
      credentials: {
        login: { label: "Email or Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.login || !credentials?.password) return null

        const login = credentials.login.toLowerCase().trim()
        const user = await prisma.appUser.findFirst({
          where: {
            OR: [
              { email: login },
              { username: login },
            ],
          },
        })

        if (!user || !user.passwordHash) return null

        const valid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          image: user.avatarUrl,
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token) {
        (session.user as any).id = token.id as string
        session.user.email = token.email as string
      }
      return session
    },
  },
  events: {
    async signIn({ user }) {
      if (!user?.id) return
      try {
        const db = prisma as any
        await db.userProfile.upsert({
          where: { userId: user.id },
          update: {},
          create: { userId: user.id },
        }).catch(() => null)
      } catch (err) {
        console.error("[auth] signIn event error:", err)
      }
    },
  },
}
