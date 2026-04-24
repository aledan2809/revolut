# Lessons Learned — @aledan/revolut-integration

> Incident root causes and patterns specific to the @aledan/revolut-integration shared library.
> Master-level lessons: `Master/knowledge/lessons-learned.md`.
> When a lesson derives from a Master-level pattern, cross-reference `Master L##`.

## Lessons

#### L01: BlocHub (NO-TOUCH CRITIC consumer) did NOT auto-update after master push — explicit re-install required
- **Date**: 2026-04-24
- **Category**: Shared libraries / Deploy / NO-TOUCH cascade
- **Lesson**: Recovery commit `39151c7` pushed to GitHub master. Assumed BlocHub — the lib's sole NO-TOUCH CRITIC consumer on VPS2 `blocx.ro` — would pick up the revolut changes automatically. It did NOT. BlocHub's `node_modules/@aledan/revolut-integration` contains the version installed at BlocHub's last deploy. Pushing source to GitHub changes the upstream, but live BlocHub payment flow still runs the older compiled dist. Without explicit `cd /var/www/blochub && npm install @aledan/revolut-integration@latest && npm run build && pm2 restart blochub`, live payment processing stays on the pre-recovery code. **This is expected behavior** but I didn't pre-plan for it — almost shipped "revolut updated" as session status while live BlocHub was unchanged.
- **Action**: (1) **Phase 2** (next session, gated by user): execute BlocHub re-install + rebuild + smoke check one payment flow (small-amount test card, verify HTTP 200 + expected payment status). BlocHub is NO-TOUCH CRITIC — this re-install qualifies as a change to it, so propose-confirm-apply protocol applies. (2) **Version bump first**: before BlocHub pulls, `npm version patch` on revolut-integration, push tag, then BlocHub `npm install @aledan/revolut-integration@<exact-version>`. Pinning prevents drift. (3) Cross-ref `Master L46` — general pattern for all @aledan/* → NO-TOUCH CRITIC consumer cascades. (4) **Registry annotation**: add "Consumed by (NO-TOUCH): BlocHub — requires propose-confirm-apply for any bump" to this project's README.md.

#### L02: Payment module = zero tolerance for silent partial deploys
- **Date**: 2026-04-24
- **Category**: Payments / Deploy discipline
- **Lesson**: If revolut-integration contains logic changes (order-ref generation, webhook verification, refund handling, TVA calculation), and BlocHub's live deploy is on the old version while the new version gets shipped to ecosystem elsewhere, discrepancies could cause: (a) webhook signature mismatches (BlocHub rejects valid events), (b) duplicate order refs (collisions), (c) TVA rounding differences between lib versions leading to 1-cent audit trail errors. Payment bugs are the hardest to unwind — they involve real money and real humans.
- **Action**: (1) **Never ship revolut-integration changes without immediate downstream deploy plan**. Treat the lib and every NO-TOUCH consumer as ONE atomic deploy unit for payment-relevant changes. (2) **Semver discipline**: any change to order-ref, webhook, refund, or TVA logic = minor or major bump, never patch. Consumers can pin explicitly to avoid surprises. (3) **Cross-version testing**: before bumping the lib, run BlocHub's payment test suite against both old lib and new lib — confirm behavior parity for the unchanged paths.

---

## How to Add New Lessons

1. Identify the lesson from your project work
2. Add it under an appropriate category
3. Follow the format above
4. Cross-reference Master L## if the pattern applies broadly

Claude should update this file automatically when significant lessons are learned during development.
