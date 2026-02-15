import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

const SIGNUPS_DATA = [
  { email: "dyoon1074@gmail.com", createdAt: "2026-01-30T19:47:23.743Z", source: "google_ads_landing" },
  { email: "alexishutchinson25@gmail.com", createdAt: "2026-01-30T14:49:10.220Z", source: "google_ads_landing" },
  { email: "aaron.mcintyre23@gmail.com", createdAt: "2026-01-30T14:10:44.321Z", source: "google_ads_landing" },
  { email: "linomolinar@icloud.com", createdAt: "2026-01-29T16:38:39.410Z", source: "google_ads_landing" },
  { email: "johanmercedes15@gmail.com", createdAt: "2026-01-28T22:03:44.051Z", source: "google_ads_landing" },
  { email: "lukemcallister2552@gmail.com", createdAt: "2026-01-28T17:15:07.667Z", source: "google_ads_landing" },
  { email: "goudien@gmail.com", createdAt: "2026-01-28T16:53:08.944Z", source: "google_ads_landing" },
  { email: "dominicnbrady@gmail.com", createdAt: "2026-01-28T16:21:13.368Z", source: "google_ads_landing" },
  { email: "jlfozo@yahoo.com", createdAt: "2026-01-28T16:17:49.419Z", source: "google_ads_landing" },
  { email: "brent_whitson28@yahoo.com", createdAt: "2026-01-28T15:48:53.730Z", source: "google_ads_landing" },
  { email: "jkn9000@gmail.com", createdAt: "2026-01-28T15:29:32.207Z", source: "google_ads_landing" },
  { email: "tkcentanni@gmail.com", createdAt: "2026-01-27T20:52:20.146Z", source: "google_ads_landing" },
  { email: "ghostrider401467@gmail.com", createdAt: "2026-01-27T20:42:34.813Z", source: "google_ads_landing" },
  { email: "josereyes0114@gmail.com", createdAt: "2026-01-27T06:43:20.924Z", source: "google_ads_landing" },
  { email: "oscm85@gmail.com", createdAt: "2026-01-27T03:05:49.885Z", source: "google_ads_landing" },
  { email: "raun31@gmail.com", createdAt: "2026-01-26T15:42:31.457Z", source: "early_access_page" },
  { email: "synth-herbals.6u@icloud.com", createdAt: "2026-01-26T15:06:50.202Z", source: "direct" },
  { email: "buzzardbro25@gmail.com", createdAt: "2026-01-25T22:23:27.866Z", source: "early_access_page" },
  { email: "thomasklosinski@gmail.com", createdAt: "2026-01-23T17:00:38.318Z", source: "waitlist" },
  { email: "ffbadbunny@icloud.com", createdAt: "2026-01-20T15:58:00.989Z", source: "waitlist" },
  { email: "Robbylee2014@gmail.com", createdAt: "2026-01-13T05:37:50.559Z", source: "waitlist" },
  { email: "ceejay.henson@oracle.com", createdAt: "2026-01-11T19:19:19.296Z", source: "waitlist" },
  { email: "william.argento@yahoo.com", createdAt: "2026-01-09T01:57:33.646Z", source: "waitlist" },
  { email: "ashishverma9683@gmail.com", createdAt: "2026-01-07T13:44:29.777Z", source: "waitlist" },
  { email: "guap_ink@hotmail.com", createdAt: "2026-01-06T23:01:04.688Z", source: "waitlist" },
  { email: "Thekamcast@outlook.com", createdAt: "2026-01-04T15:26:11.582Z", source: "waitlist" },
  { email: "Slrilesonlinenow@gmail.com", createdAt: "2026-01-03T13:30:52.133Z", source: "waitlist" },
  { email: "stan51151@yahoo.com", createdAt: "2026-01-03T02:34:17.767Z", source: "waitlist" },
  { email: "ip@PARRON.LAW", createdAt: "2026-01-02T19:27:33.417Z", source: "waitlist" },
  { email: "satish15385@gmail.com", createdAt: "2026-01-02T17:51:50.155Z", source: "waitlist" },
  { email: "Rachel.l.cacchione83@gmail.com", createdAt: "2026-01-02T11:46:29.412Z", source: "waitlist" },
  { email: "MarkAChecki@gmail.com", createdAt: "2026-01-02T01:29:22.317Z", source: "waitlist" },
  { email: "heerala9098742035@gmail.com", createdAt: "2026-01-01T19:11:14.996Z", source: "waitlist" },
  { email: "mgiusti666@gmail.com", createdAt: "2026-01-01T17:12:57.602Z", source: "waitlist" },
  { email: "nickdow89@gmail.com", createdAt: "2026-01-01T05:09:20.589Z", source: "waitlist" },
  { email: "Brianlivingbaja@gmail.com", createdAt: "2025-12-31T21:17:19.132Z", source: "waitlist" },
  { email: "tylerrdixonn@gmail.com", createdAt: "2025-12-31T19:29:28.586Z", source: "waitlist" },
  { email: "quinnyflanagan@gmail.com", createdAt: "2025-12-31T19:23:34.555Z", source: "waitlist" },
  { email: "mrovente@hotmail.com", createdAt: "2025-12-31T17:00:26.037Z", source: "waitlist" },
  { email: "Zrounsville@gmail.com", createdAt: "2025-12-31T12:14:25.845Z", source: "waitlist" },
  { email: "seanfitzsimmons@gmail.com", createdAt: "2025-12-31T11:58:00.185Z", source: "waitlist" },
  { email: "rcatena23@yahoo.com", createdAt: "2025-12-31T05:51:36.590Z", source: "waitlist" },
  { email: "billstellin@yahoo.com", createdAt: "2025-12-31T05:32:03.063Z", source: "waitlist" },
  { email: "gaberoz@icloud.com", createdAt: "2025-12-31T05:20:27.800Z", source: "waitlist" },
  { email: "Jason.albrecht1010@gmail.com", createdAt: "2025-12-31T04:37:57.737Z", source: "waitlist" },
  { email: "Midura25@gmail.com", createdAt: "2025-12-31T03:58:07.098Z", source: "waitlist" },
  { email: "Hntrday_05@aol.com", createdAt: "2025-12-31T03:55:18.544Z", source: "waitlist" },
  { email: "coreydoyle@outlook.com", createdAt: "2025-12-31T03:17:40.500Z", source: "waitlist" },
  { email: "matthewjdavis85@gmail.com", createdAt: "2025-12-31T02:58:28.351Z", source: "waitlist" },
  { email: "Cedric@propdecks.com", createdAt: "2025-12-31T02:36:53.894Z", source: "waitlist" },
  { email: "mkorman@trukmanns.com", createdAt: "2025-12-31T02:10:08.884Z", source: "waitlist" },
  { email: "trexn611@gmail.com", createdAt: "2025-12-31T00:57:40.487Z", source: "waitlist" },
  { email: "sdquantz@gmail.com", createdAt: "2025-12-30T18:50:16.204Z", source: "waitlist" },
  { email: "klkruse2@gmail.com", createdAt: "2025-12-30T15:25:42.232Z", source: "waitlist" },
  { email: "Teejaylove180@gmail.com", createdAt: "2025-12-30T15:05:13.894Z", source: "waitlist" },
  { email: "Bcj43ff@gmail.com", createdAt: "2025-12-30T06:02:01.710Z", source: "waitlist" },
  { email: "jglasper1120@gmail.com", createdAt: "2025-12-30T05:59:07.748Z", source: "waitlist" },
  { email: "mwpv24@gmail.com", createdAt: "2025-12-29T18:32:20.396Z", source: "waitlist" },
  { email: "skr840948@gmail.com", createdAt: "2025-12-29T06:23:31.911Z", source: "waitlist" },
  { email: "jbalb0825@me.com", createdAt: "2025-12-29T05:52:50.113Z", source: "waitlist" },
  { email: "alfierichardedgeworth@gmail.com", createdAt: "2025-12-29T05:24:53.271Z", source: "waitlist" },
  { email: "goodkingbuffalo@gmail.com", createdAt: "2025-12-27T05:54:29.646Z", source: "waitlist" },
  { email: "jrrbittner@yahoo.com", createdAt: "2025-12-26T18:54:21.178Z", source: "waitlist" },
  { email: "matt.thompson4140@gmail.com", createdAt: "2025-12-26T17:41:57.182Z", source: "waitlist" },
  { email: "disposablehero627@gmail.com", createdAt: "2025-12-26T17:23:18.189Z", source: "waitlist" },
  { email: "chs.chrisg@gmail.com", createdAt: "2025-12-26T17:17:43.533Z", source: "waitlist" },
  { email: "Jsentenofhms0809@gmail.com", createdAt: "2025-12-26T17:08:28.231Z", source: "waitlist" },
  { email: "Mike2626herb@gmail.com", createdAt: "2025-12-26T17:06:43.731Z", source: "waitlist" },
  { email: "jonalanhall@gmail.com", createdAt: "2025-12-24T01:31:13.791Z", source: "waitlist" },
  { email: "Mikeant8585@gmail.com", createdAt: "2025-12-23T16:12:26.217Z", source: "waitlist" },
  { email: "Kelvinromerojr03@gmail.com", createdAt: "2025-12-23T02:45:05.166Z", source: "waitlist" },
  { email: "steve.price37@gmail.com", createdAt: "2025-12-23T01:48:25.420Z", source: "waitlist" },
  { email: "Burtj71@yahoo.com", createdAt: "2025-12-23T01:19:36.484Z", source: "waitlist" },
  { email: "wres2345@gmail.com", createdAt: "2025-12-22T21:45:27.466Z", source: "waitlist" },
  { email: "Shawntx3000@gmail.com", createdAt: "2025-12-22T19:12:24.264Z", source: "waitlist" },
  { email: "mayleenalmeida@gmail.com", createdAt: "2025-12-22T14:12:19.462Z", source: "waitlist" },
  { email: "niceguy.tc@gmail.com", createdAt: "2025-12-22T11:51:04.692Z", source: "waitlist" },
  { email: "Crazyfisher212@gmail.com", createdAt: "2025-12-22T07:10:34.530Z", source: "waitlist" },
  { email: "Shepardmathu@yahoo.com", createdAt: "2025-12-22T05:33:54.041Z", source: "waitlist" },
  { email: "riverjig@gmail.com", createdAt: "2025-12-22T01:08:27.879Z", source: "waitlist" },
  { email: "Behrens43@gmail.com", createdAt: "2025-12-22T00:18:26.882Z", source: "waitlist" },
  { email: "aj_rod@icloud.com", createdAt: "2025-12-22T00:06:30.063Z", source: "waitlist" },
  { email: "jenn_est1988@yahoo.com", createdAt: "2025-12-21T23:30:35.237Z", source: "waitlist" },
  { email: "Dbpeterson320@gmail.com", createdAt: "2025-12-21T21:05:25.976Z", source: "waitlist" },
  { email: "dont_overthink_it@yahoo.com", createdAt: "2025-12-21T20:22:21.123Z", source: "waitlist" },
  { email: "hoovi747@yahoo.com", createdAt: "2025-12-21T20:11:59.585Z", source: "waitlist" },
  { email: "Frankschook941@gmail.com", createdAt: "2025-12-11T02:15:01.710Z", source: "waitlist" },
  { email: "Chrisboehm28@gmail.com", createdAt: "2025-12-05T15:47:16.580Z", source: "waitlist" },
  { email: "jf75313@gmail.com", createdAt: "2025-12-02T17:01:16.273Z", source: "waitlist" },
  { email: "craigt660@ymail.com", createdAt: "2025-12-01T23:30:01.685Z", source: "waitlist" },
  { email: "noah.timmer@oracle.com", createdAt: "2025-12-01T20:03:34.537Z", source: "waitlist" },
  { email: "Dekodacrsler@gmail.com", createdAt: "2025-12-01T00:41:13.137Z", source: "waitlist" },
  { email: "cactusrog@gmail.com", createdAt: "2025-12-01T00:02:48.444Z", source: "waitlist" },
  { email: "jfp.paquin@gmail.com", createdAt: "2025-11-30T18:57:37.549Z", source: "waitlist" },
  { email: "jonmwest123@gmail.com", createdAt: "2025-11-30T16:53:55.560Z", source: "waitlist" },
  { email: "Mikeabrams81@yahoo.com", createdAt: "2025-11-30T14:52:46.407Z", source: "waitlist" },
  { email: "ryandmcfarlane@gmail.com", createdAt: "2025-11-30T13:58:32.188Z", source: "waitlist" },
  { email: "cas1bel99@gmail.com", createdAt: "2025-11-30T13:34:44.408Z", source: "waitlist" },
  { email: "garyerlingworks@gmail.com", createdAt: "2025-11-30T12:55:33.542Z", source: "waitlist" },
  { email: "Rsabes12@gmail.com", createdAt: "2025-11-30T07:44:52.314Z", source: "waitlist" },
  { email: "treytondavis08@icloud.com", createdAt: "2025-11-30T07:43:25.423Z", source: "waitlist" },
  { email: "aaronpastushak@gmail.com", createdAt: "2025-11-30T05:04:55.284Z", source: "waitlist" },
  { email: "jsh606@gmail.com", createdAt: "2025-11-30T03:58:54.496Z", source: "waitlist" },
  { email: "bradkaplan4140@gmail.com", createdAt: "2025-11-30T03:51:06.711Z", source: "waitlist" },
  { email: "angelcolon4@live.com", createdAt: "2025-11-30T03:44:11.118Z", source: "waitlist" },
  { email: "hibboisthebest@gmail.com", createdAt: "2025-11-30T03:43:35.992Z", source: "waitlist" },
  { email: "vincepintono9@gmail.com", createdAt: "2025-11-30T03:42:16.895Z", source: "waitlist" },
  { email: "jgichuru10@gmail.com", createdAt: "2025-11-30T03:41:53.894Z", source: "waitlist" },
  { email: "pusichliam@gmail.com", createdAt: "2025-11-30T03:41:34.012Z", source: "waitlist" },
  { email: "tchritton@gmail.com", createdAt: "2025-11-30T03:41:04.840Z", source: "waitlist" },
  { email: "Alan.majzner@gmail.com", createdAt: "2025-11-30T03:05:52.782Z", source: "waitlist" },
  { email: "kristianlydon@gmail.com", createdAt: "2025-11-30T03:01:34.370Z", source: "waitlist" },
  { email: "dewinternb@outlook.com", createdAt: "2025-11-30T03:00:30.365Z", source: "waitlist" },
  { email: "Josiah.ediger@gmail.com", createdAt: "2025-11-30T02:29:25.221Z", source: "waitlist" },
  { email: "sportstlk365@gmail.com", createdAt: "2025-11-30T02:22:03.748Z", source: "waitlist" },
  { email: "kjspill41@gmail.com", createdAt: "2025-11-30T02:16:54.914Z", source: "waitlist" },
  { email: "Jon.waite0904@gmail.com", createdAt: "2025-11-30T02:08:29.483Z", source: "waitlist" },
  { email: "Morena510832@aol.com", createdAt: "2025-11-30T01:59:22.159Z", source: "waitlist" },
  { email: "Loganmcfadden12@gmail.com", createdAt: "2025-11-30T01:43:47.676Z", source: "waitlist" },
  { email: "Dallasbailey2434@gmail.com", createdAt: "2025-11-30T01:41:56.369Z", source: "waitlist" },
  { email: "mcprph2000@yahoo.com", createdAt: "2025-11-30T01:41:52.959Z", source: "waitlist" },
  { email: "cdowning619@gmail.com", createdAt: "2025-11-30T01:41:10.469Z", source: "waitlist" },
  { email: "tullosd71@gmail.com", createdAt: "2025-11-30T01:39:49.837Z", source: "waitlist" },
  { email: "bekkermitchell@gmail.com", createdAt: "2025-11-30T01:37:45.301Z", source: "waitlist" },
  { email: "Ibis.romero@icloud.com", createdAt: "2025-11-30T01:24:45.317Z", source: "waitlist" },
  { email: "Sburnsowens@gmail.com", createdAt: "2025-11-29T23:30:44.592Z", source: "waitlist" },
  { email: "Wbeltran1@gmail.com", createdAt: "2025-11-29T23:02:45.361Z", source: "waitlist" },
  { email: "victoriavasile1@gmail.com", createdAt: "2025-11-29T23:01:49.653Z", source: "waitlist" },
  { email: "lilvicstevens@aol.com", createdAt: "2025-11-29T23:01:45.105Z", source: "waitlist" },
  { email: "nrchildcare@aol.com", createdAt: "2025-11-29T22:59:08.139Z", source: "waitlist" },
  { email: "Nbragdon89@gmail.com", createdAt: "2025-11-29T22:52:02.183Z", source: "waitlist" },
  { email: "Venushernandez4@gmail.com", createdAt: "2025-11-29T22:51:38.162Z", source: "waitlist" },
  { email: "cubanmami51083@aol.com", createdAt: "2025-11-29T22:44:34.705Z", source: "waitlist" },
  { email: "cjabar.henson@oracle.com", createdAt: "2025-11-29T22:39:47.486Z", source: "waitlist" },
];

export const POST = withApiUsage({ endpoint: "/api/admin/sync-signups", tool: "AdminSyncSignups" })(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  try {
    let inserted = 0;
    let skipped = 0;

    for (const signup of SIGNUPS_DATA) {
      try {
        await prisma.earlyAccessSignup.create({
          data: {
            email: signup.email.toLowerCase().trim(),
            createdAt: new Date(signup.createdAt),
            source: signup.source,
          },
        });
        inserted++;
      } catch (e: any) {
        if (e?.code === "P2002") {
          skipped++;
        } else {
          console.error(`Failed to insert ${signup.email}:`, e);
        }
      }
    }

    return NextResponse.json({ 
      ok: true, 
      inserted, 
      skipped,
      total: SIGNUPS_DATA.length,
    });
  } catch (e) {
    console.error("Sync signups error:", e);
    return NextResponse.json({ error: "Failed to sync signups" }, { status: 500 });
  }
})
