import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

function customPrismaAdapter() {
  return {
    async createUser(data: { email: string; emailVerified: Date | null; name?: string | null; image?: string | null }) {
      const user = await prisma.appUser.create({
        data: {
          email: data.email,
          username: data.email.split('@')[0] + '_' + Date.now().toString(36),
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

        if (!user) return null
        if (!user.username) return null

        if (!user.passwordHash) {
          const isSleeperAccount = user.email?.endsWith("@sleeper.allfantasy.ai")
          if (isSleeperAccount) {
            throw new Error("SLEEPER_ONLY_ACCOUNT")
          }
          throw new Error("PASSWORD_NOT_SET")
        }

        const valid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.username,
          image: user.avatarUrl,
        }
      },
    }),
    CredentialsProvider({
      id: "sleeper",
      name: "Sleeper",
      credentials: {
        sleeperUsername: { label: "Sleeper Username", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.sleeperUsername) return null

        const username = credentials.sleeperUsername.trim()
        if (!username) return null

        const sleeperRes = await fetch(`https://api.sleeper.app/v1/user/${username}`)
        if (!sleeperRes.ok) return null
        const sleeperUser = await sleeperRes.json()
        if (!sleeperUser?.user_id) return null

        const sleeperUserId = sleeperUser.user_id
        const displayName = sleeperUser.display_name || username
        const avatarUrl = sleeperUser.avatar
          ? `https://sleepercdn.com/avatars/${sleeperUser.avatar}`
          : null

        let user = await prisma.appUser.findFirst({
          where: {
            OR: [
              { username: `sleeper_${sleeperUserId}` },
              { username: displayName.toLowerCase() },
            ],
          },
        })

        if (!user) {
          user = await prisma.appUser.create({
            data: {
              email: `${sleeperUserId}@sleeper.allfantasy.ai`,
              username: `sleeper_${sleeperUserId}`,
              displayName,
              avatarUrl,
            },
          })
        }

        return {
          id: user.id,
          email: user.email,
          name: user.displayName || user.username,
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
        token.name = user.name
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token) {
        (session.user as any).id = token.id as string
        session.user.email = token.email as string
        session.user.name = (token.name as string) ?? session.user.name
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
