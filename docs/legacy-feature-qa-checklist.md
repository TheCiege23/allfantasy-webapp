# QA Checklist

## Prerequisites
- [ ] Install dependencies (npm ci).
- [ ] Generate Prisma client (npx prisma generate) if needed.
- [ ] Start app locally (npm run dev).
- [ ] Confirm app is reachable at http://127.0.0.1:5000.
- [ ] Confirm required secrets are set (OPENAI_API_KEY, XAI_API_KEY, auth/session/database env vars as applicable).

## Mock Draft (UI + API)
- [ ] Open /af-legacy and verify page loads with no runtime errors.
- [ ] Change format, rounds, and clock settings; verify they persist in UI state.
- [ ] Start a mock draft and verify first pick initializes correctly.
- [ ] Make a manual pick and ensure duplicate player blocking works.
- [ ] Trigger auto-pick and ensure pick advances to next team.
- [ ] Verify OTC timer updates and expires correctly.
- [ ] Use randomize draft order and confirm new order is reflected.
- [ ] Enable/disable AI trade options and verify UI state updates.
- [ ] Open predict-board flow and verify forecast modal populates or returns safe validation errors.
- [ ] Validate ADP adjustments/movers render when data is available.
- [ ] Disable AI keys and verify user-friendly non-500 behavior.
- [ ] Send invalid settings and confirm server returns validation errors (4xx), not 500.

## Bracket Challenge (UI + API)
- [ ] Create a league and verify capacity / payment labels render correctly.
- [ ] Join a league via invite/join flow and validate membership updates.
- [ ] Confirm entry limits are enforced for paid leagues.
- [ ] Create bracket entry and verify it appears in league page.
- [ ] Verify payment confirmation control appears where expected.
- [ ] Confirm payment action updates status in UI and API response.
- [ ] Open pick-assist UI card and request a recommendation.
- [ ] Confirm structured response renders with confidence/reasoning fields.
- [ ] Verify non-authenticated or bad-input behavior returns 4xx, not 500.

## Legacy AI (Chimmy / Trade / Waiver)
- [ ] Send baseline Chimmy prompt and verify response renders.
- [ ] Verify tool links appear when included.
- [ ] Verify private mode / target username scoping works.
- [ ] Confirm fallback behavior if one provider is unavailable.
- [ ] Submit simple trade package and verify analysis returns.
- [ ] Confirm consensus/fallback output remains structured.
- [ ] Validate invalid payload returns 4xx.
- [ ] Submit roster + free agent payload and verify waiver recommendation output.
- [ ] Confirm evidence/facts fields render in UI.
- [ ] Validate deterministic output shape for downstream components.
