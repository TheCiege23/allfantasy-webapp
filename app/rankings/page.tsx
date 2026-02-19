import { Metadata } from "next";
import RankingsClient from "./RankingsClient";

export const metadata: Metadata = {
  title: "League Power Rankings \u2013 AllFantasy",
  description: "AI-powered power rankings, trends, strengths & risks for your fantasy league.",
};

export default function RankingsPage() {
  return <RankingsClient />;
}
