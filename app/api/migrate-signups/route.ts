import { withApiUsage } from "@/lib/telemetry/usage"
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  { email: "mmphelps88@gmail.com", createdAt: "2025-12-31T04:27:19.779Z", source: "waitlist" },
  { email: "realhealthwithmarty@gmail.com", createdAt: "2025-12-31T04:25:26.227Z", source: "waitlist" },
  { email: "jordanberardini@gmail.com", createdAt: "2025-12-31T04:22:33.411Z", source: "waitlist" },
  { email: "bkeller89@gmail.com", createdAt: "2025-12-31T04:13:59.614Z", source: "waitlist" },
  { email: "Earlmiller11@gmail.com", createdAt: "2025-12-31T04:07:48.149Z", source: "waitlist" },
  { email: "jjmartin03@gmail.com", createdAt: "2025-12-31T03:58:41.247Z", source: "waitlist" },
  { email: "nicholasselee@gmail.com", createdAt: "2025-12-31T03:21:02.689Z", source: "waitlist" },
  { email: "ianconarroe@gmail.com", createdAt: "2025-12-31T03:19:24.667Z", source: "waitlist" },
  { email: "Vincentmarino51@gmail.com", createdAt: "2025-12-31T03:17:05.508Z", source: "waitlist" },
  { email: "Jbulley@gmail.com", createdAt: "2025-12-31T03:13:38.371Z", source: "waitlist" },
  { email: "bshawpolo1@outlook.com", createdAt: "2025-12-31T03:07:01.430Z", source: "waitlist" },
  { email: "dazzmoe10@gmail.com", createdAt: "2025-12-31T03:00:15.648Z", source: "waitlist" },
  { email: "rluke8811@gmail.com", createdAt: "2025-12-31T02:57:39.316Z", source: "waitlist" },
  { email: "joshualeemathis@gmail.com", createdAt: "2025-12-31T02:55:02.168Z", source: "waitlist" },
  { email: "jlee4592@gmail.com", createdAt: "2025-12-31T02:47:47.609Z", source: "waitlist" },
  { email: "tylerc91394@gmail.com", createdAt: "2025-12-31T02:47:13.553Z", source: "waitlist" },
  { email: "brysonmay8@gmail.com", createdAt: "2025-12-31T02:38:06.496Z", source: "waitlist" },
  { email: "tylertb66@gmail.com", createdAt: "2025-12-31T02:37:27.285Z", source: "waitlist" },
  { email: "johnnymccracken3@gmail.com", createdAt: "2025-12-31T02:31:47.698Z", source: "waitlist" },
  { email: "joshuapenny23@gmail.com", createdAt: "2025-12-31T02:31:38.609Z", source: "waitlist" },
  { email: "jacobhite@live.com", createdAt: "2025-12-31T02:23:08.025Z", source: "waitlist" },
  { email: "lannybarnold@gmail.com", createdAt: "2025-12-31T02:18:38.003Z", source: "waitlist" },
  { email: "cadencarr27@gmail.com", createdAt: "2025-12-31T02:15:28.652Z", source: "waitlist" },
  { email: "benbourquin@yahoo.com", createdAt: "2025-12-31T02:12:04.025Z", source: "waitlist" },
  { email: "ericdurbin12@gmail.com", createdAt: "2025-12-31T02:05:37.003Z", source: "waitlist" },
  { email: "markusd25@live.com", createdAt: "2025-12-31T02:03:57.815Z", source: "waitlist" },
  { email: "Willpennington6@gmail.com", createdAt: "2025-12-31T02:03:01.179Z", source: "waitlist" },
  { email: "keeganadams02@gmail.com", createdAt: "2025-12-31T02:00:42.989Z", source: "waitlist" },
  { email: "Elainestutzman36@gmail.com", createdAt: "2025-12-31T01:56:15.252Z", source: "waitlist" },
  { email: "cmbrady95@gmail.com", createdAt: "2025-12-31T01:48:47.377Z", source: "waitlist" },
  { email: "haydenmryan@gmail.com", createdAt: "2025-12-31T01:47:50.025Z", source: "waitlist" },
  { email: "jeffersonburch@gmail.com", createdAt: "2025-12-31T01:41:01.502Z", source: "waitlist" },
  { email: "willv0531@icloud.com", createdAt: "2025-12-31T01:39:14.227Z", source: "waitlist" },
  { email: "jasonwsigman@gmail.com", createdAt: "2025-12-31T01:38:02.087Z", source: "waitlist" },
  { email: "jameyreynolds1989@gmail.com", createdAt: "2025-12-31T01:33:25.277Z", source: "waitlist" },
  { email: "tmk1111@gmail.com", createdAt: "2025-12-31T01:32:23.088Z", source: "waitlist" },
  { email: "peterdivinere@gmail.com", createdAt: "2025-12-31T01:28:14.988Z", source: "waitlist" },
  { email: "tysonmoore58@gmail.com", createdAt: "2025-12-31T01:23:52.715Z", source: "waitlist" },
  { email: "jsrfootball1@gmail.com", createdAt: "2025-12-31T01:21:24.179Z", source: "waitlist" },
  { email: "chrispro58@gmail.com", createdAt: "2025-12-31T01:19:55.103Z", source: "waitlist" },
  { email: "jcimino86@gmail.com", createdAt: "2025-12-31T01:19:28.628Z", source: "waitlist" },
  { email: "Daltonteeter@gmail.com", createdAt: "2025-12-31T01:18:08.479Z", source: "waitlist" },
  { email: "spencercasto3@gmail.com", createdAt: "2025-12-31T01:17:11.877Z", source: "waitlist" },
  { email: "Teeaitch@gmail.com", createdAt: "2025-12-31T01:12:16.202Z", source: "waitlist" },
  { email: "jbuschang@gmail.com", createdAt: "2025-12-31T01:10:05.401Z", source: "waitlist" },
  { email: "alannatoups7@gmail.com", createdAt: "2025-12-31T01:05:03.089Z", source: "waitlist" },
  { email: "mattkinsler@gmail.com", createdAt: "2025-12-31T01:00:19.489Z", source: "waitlist" },
  { email: "kacylynn321@gmail.com", createdAt: "2025-12-31T00:57:59.565Z", source: "waitlist" },
  { email: "rpavelitch@gmail.com", createdAt: "2025-12-31T00:53:24.301Z", source: "waitlist" },
  { email: "kyle_durkin@yahoo.com", createdAt: "2025-12-31T00:51:34.990Z", source: "waitlist" },
  { email: "slipperyelm@icloud.com", createdAt: "2025-12-31T00:50:48.503Z", source: "waitlist" },
  { email: "dking32@gmail.com", createdAt: "2025-12-31T00:49:02.965Z", source: "waitlist" },
  { email: "mhunter7795@gmail.com", createdAt: "2025-12-31T00:41:17.202Z", source: "waitlist" },
  { email: "maxbgross@yahoo.com", createdAt: "2025-12-31T00:32:58.015Z", source: "waitlist" },
  { email: "wdavis1797@gmail.com", createdAt: "2025-12-31T00:31:51.640Z", source: "waitlist" },
  { email: "ethangoodrich13@gmail.com", createdAt: "2025-12-31T00:31:27.139Z", source: "waitlist" },
  { email: "dylanlevine11@gmail.com", createdAt: "2025-12-31T00:27:36.839Z", source: "waitlist" },
  { email: "alex3coy@gmail.com", createdAt: "2025-12-31T00:26:16.127Z", source: "waitlist" },
  { email: "jwagoner94@gmail.com", createdAt: "2025-12-31T00:21:23.677Z", source: "waitlist" },
  { email: "alexross120@yahoo.com", createdAt: "2025-12-31T00:11:48.615Z", source: "waitlist" },
  { email: "connorsteneken10@gmail.com", createdAt: "2025-12-31T00:10:20.915Z", source: "waitlist" },
  { email: "mgamache_00@yahoo.com", createdAt: "2025-12-31T00:08:17.339Z", source: "waitlist" },
  { email: "dustin.m.jansen@gmail.com", createdAt: "2025-12-31T00:04:22.890Z", source: "waitlist" },
  { email: "jacklindsay62@gmail.com", createdAt: "2025-12-31T00:00:34.802Z", source: "waitlist" },
  { email: "nnbillings@gmail.com", createdAt: "2025-12-30T23:59:56.089Z", source: "waitlist" },
  { email: "bradygleason7@gmail.com", createdAt: "2025-12-30T23:58:09.640Z", source: "waitlist" },
  { email: "andrewedegard1@gmail.com", createdAt: "2025-12-30T23:55:06.140Z", source: "waitlist" },
  { email: "peytonkuhl4@gmail.com", createdAt: "2025-12-30T23:53:16.427Z", source: "waitlist" },
  { email: "drewboebinger@gmail.com", createdAt: "2025-12-30T23:49:14.414Z", source: "waitlist" },
  { email: "peytontonn@gmail.com", createdAt: "2025-12-30T23:46:17.127Z", source: "waitlist" },
  { email: "noahmcconnell10@gmail.com", createdAt: "2025-12-30T23:43:20.840Z", source: "waitlist" },
  { email: "Jacobfrench84@gmail.com", createdAt: "2025-12-30T23:42:15.690Z", source: "waitlist" },
  { email: "chadmilton3@yahoo.com", createdAt: "2025-12-30T23:40:09.602Z", source: "waitlist" },
  { email: "masonmanning4@gmail.com", createdAt: "2025-12-30T23:39:57.339Z", source: "waitlist" },
  { email: "wadebeam@gmail.com", createdAt: "2025-12-30T23:37:50.414Z", source: "waitlist" },
  { email: "danielwthies@gmail.com", createdAt: "2025-12-30T23:31:36.015Z", source: "waitlist" },
  { email: "tylerhyde8@gmail.com", createdAt: "2025-12-30T23:30:11.639Z", source: "waitlist" },
  { email: "briankayiii@gmail.com", createdAt: "2025-12-30T23:24:27.240Z", source: "waitlist" },
];

export const GET = withApiUsage({ endpoint: "/api/migrate-signups", tool: "MigrateSignups" })(async () => {
  try {
    const existing = await prisma.earlyAccessSignup.findMany({
      select: { email: true },
    });
    const existingEmails = new Set(existing.map(e => e.email.toLowerCase()));
    
    const toInsert = SIGNUPS_DATA.filter(
      s => !existingEmails.has(s.email.toLowerCase())
    );
    
    if (toInsert.length === 0) {
      return NextResponse.json({ 
        ok: true, 
        message: "All signups already exist",
        existing: existing.length,
        skipped: SIGNUPS_DATA.length
      });
    }
    
    let inserted = 0;
    for (const signup of toInsert) {
      try {
        await prisma.earlyAccessSignup.create({
          data: {
            email: signup.email,
            createdAt: new Date(signup.createdAt),
            source: signup.source,
            confirmedAt: new Date(signup.createdAt),
          },
        });
        inserted++;
      } catch (e) {
        console.log(`Skipped duplicate: ${signup.email}`);
      }
    }
    
    return NextResponse.json({ 
      ok: true, 
      inserted,
      skipped: SIGNUPS_DATA.length - inserted,
      total: existing.length + inserted
    });
  } catch (e) {
    console.error("Migration error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
})
