export function selectTopTradeCandidate(trades: any[]) {
  if (!Array.isArray(trades) || trades.length === 0) return null;

  const rankAcceptance = (lbl?: string) => {
    if (lbl === "Strong") return 4;
    if (lbl === "Aggressive") return 3;
    if (lbl === "Speculative") return 2;
    if (lbl === "Long Shot") return 1;
    return 0;
  };

  return [...trades].sort((a, b) => {
    const ar = rankAcceptance(a?.acceptanceLabel);
    const br = rankAcceptance(b?.acceptanceLabel);
    if (br !== ar) return br - ar;

    const af = Number(a?.fairnessScore ?? 0);
    const bf = Number(b?.fairnessScore ?? 0);
    return bf - af;
  })[0];
}

export function formatTradeHeadline(t: any) {
  if (!t) return "—";

  const giveNames = (t.give || []).map((x: any) => x?.name || x?.displayName).filter(Boolean);
  const recvNames = (t.receive || []).map((x: any) => x?.name || x?.displayName).filter(Boolean);

  const give = giveNames.slice(0, 2).join(", ") || "assets";
  const recv = recvNames.slice(0, 2).join(", ") || "assets";

  return `Send: ${give} → Get: ${recv}`;
}
