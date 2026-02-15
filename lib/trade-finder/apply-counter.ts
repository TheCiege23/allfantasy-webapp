export type TradeAsset = {
  id: string;
  label: string;
  kind: "PLAYER" | "PICK";
  value?: number;
  tier?: string;
  position?: string;
};

export type TradeCandidate = {
  tradeId: string;
  youSend: TradeAsset[];
  youReceive: TradeAsset[];
  themSend: TradeAsset[];
  themReceive: TradeAsset[];
  finderScore?: number;
  valueDeltaPct?: number;
};

export type CounterTradePatch = {
  youAdd?: string[];
  youRemove?: string[];
  theyAdd?: string[];
  theyRemove?: string[];
  faabAdd?: number;
};

export function applyCounterPatch(args: {
  candidate: TradeCandidate;
  patch: CounterTradePatch;
  assetIndex: Record<string, TradeAsset>;
}): TradeCandidate {
  const { candidate, patch, assetIndex } = args;

  const youSend = new Map(candidate.youSend.map((a) => [a.id, a]));
  const themSend = new Map(candidate.themSend.map((a) => [a.id, a]));

  const addTo = (m: Map<string, TradeAsset>, ids?: string[]) => {
    (ids ?? []).forEach((id) => {
      const a = assetIndex[id];
      if (a) m.set(id, a);
    });
  };
  const removeFrom = (m: Map<string, TradeAsset>, ids?: string[]) => {
    (ids ?? []).forEach((id) => m.delete(id));
  };

  addTo(youSend, patch.youAdd);
  removeFrom(youSend, patch.youRemove);

  addTo(themSend, patch.theyAdd);
  removeFrom(themSend, patch.theyRemove);

  const nextYouSend = Array.from(youSend.values());
  const nextThemSend = Array.from(themSend.values());

  return {
    ...candidate,
    youSend: nextYouSend,
    youReceive: nextThemSend,
    themSend: nextThemSend,
    themReceive: nextYouSend,
  };
}
