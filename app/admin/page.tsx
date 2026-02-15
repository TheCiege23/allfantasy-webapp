import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminLayout, { type AdminTab } from "./components/AdminLayout";
import AdminOverview from "./components/AdminOverview";
import AdminSignups from "./components/AdminSignups";
import AdminQuestionnaire from "./components/AdminQuestionnaire";
import AdminLeagueIdeas from "./components/AdminLeagueIdeas";
import AdminFeedback from "./components/AdminFeedback";
import AdminEmail from "./components/AdminEmail";
import AdminBlog from "./components/AdminBlog";
import AdminTools from "./components/AdminTools";
import AdminAnalytics from "./components/AdminAnalytics";
import AIIssueBacklog from "./components/AIIssueBacklog";
import AdminShareRewards from "./components/AdminShareRewards";
import AdminCalibration from "./components/AdminCalibration";
import AdminModelDrift from "./components/AdminModelDrift";
import { UsageAnalyticsPanel } from "@/components/admin/UsageAnalyticsPanel";
import { verifyAdminSessionCookie } from "@/lib/adminSession";

type MeResponse = {
  user?: {
    id?: string;
    email?: string;
    name?: string;
    role?: string;
  } | null;
};

async function getMe(): Promise<MeResponse | null> {
  const cookieStore = cookies();
  const adminSession = cookieStore.get("admin_session");
  if (!adminSession?.value) return null;
  const payload = verifyAdminSessionCookie(adminSession.value);
  if (!payload) return null;
  return {
    user: {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    },
  };
}

function isAdmin(me: MeResponse | null) {
  const email = me?.user?.email?.toLowerCase();
  const role = me?.user?.role?.toLowerCase();
  if (role === "admin") return true;
  const allow = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (email && allow.includes(email)) return true;
  return false;
}

function parseTab(tab?: string | string[]): AdminTab {
  const t = Array.isArray(tab) ? tab[0] : tab;
  const allowed: AdminTab[] = [
    "overview",
    "signups",
    "questionnaire",
    "ideas",
    "feedback",
    "email",
    "blog",
    "tools",
    "analytics",
    "ai_issues",
    "share_rewards",
    "calibration",
    "model_drift",
  ];
  return allowed.includes(t as AdminTab) ? (t as AdminTab) : "overview";
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const tab = parseTab(searchParams?.tab);
  const me = await getMe();
  if (!me?.user) redirect(`/login?next=/admin?tab=${tab}`);
  if (!isAdmin(me)) redirect("/");

  return (
    <AdminLayout
      user={{
        email: me.user?.email || "",
        name: me.user?.name || "Admin",
      }}
      activeTab={tab}
    >
      {tab === "overview" && <AdminOverview />}
      {tab === "signups" && <AdminSignups />}
      {tab === "questionnaire" && <AdminQuestionnaire />}
      {tab === "ideas" && <AdminLeagueIdeas />}
      {tab === "feedback" && <AdminFeedback />}
      {tab === "email" && <AdminEmail />}
      {tab === "blog" && <AdminBlog />}
      {tab === "tools" && <AdminTools />}
      {tab === "analytics" && (
        <>
          <UsageAnalyticsPanel defaultBucketType="hour" defaultDays={2} />
          <div className="mt-6" />
          <AdminAnalytics />
        </>
      )}
      {tab === "ai_issues" && <AIIssueBacklog />}
      {tab === "share_rewards" && <AdminShareRewards />}
      {tab === "calibration" && <AdminCalibration />}
      {tab === "model_drift" && <AdminModelDrift />}
    </AdminLayout>
  );
}
