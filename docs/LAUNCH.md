# Ludo Live – Google Play launch checklist

Everything in the repo is ready; these steps need the owner's accounts.

## 1. Merge order
1. PR #34 (security: dependency fixes)
2. PR #32 (play-ready polish + icon, feature graphic, screenshots 1 to 3)
3. PR #31 (signing and Play upload steps in `docs/PLAY-RELEASE.md`)
4. This PR (listing, Nepali listing, Data safety answers, screenshots 4 to 7, QA report)
5. `Sabin78910/privacy-policy` PR #2 (adds the Ludo Live section). Play reviews the policy URL, so merge it before submitting.

## 2. Turn on online play (Cloudflare, about 10 minutes, free plan)
1. Sign in at https://dash.cloudflare.com (create a free account if needed).
2. Copy the **Account ID** from the right side of the Workers & Pages overview.
3. **My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template → Create.** Copy the token.
4. In GitHub, **ludo-live → Settings → Secrets and variables → Actions → New repository secret**:
   - `CLOUDFLARE_API_TOKEN` = the token
   - `CLOUDFLARE_ACCOUNT_ID` = the account ID
5. **Actions → Deploy Worker (online rooms) → Run workflow** on `main`. The run summary prints the Worker URL,
   for example `https://ludo-live.<your-subdomain>.workers.dev`.
6. **Settings → Secrets and variables → Actions → Variables → New repository variable**:
   `VITE_WS_URL` = the same URL with `wss://` instead of `https://`.
7. Re-run **Deploy** (website) and **Android CI** so both builds pick up `VITE_WS_URL`.
8. Check: open the site on two phones, create a room on one, join with the code on the other.

## 3. Build and sign
Follow `docs/PLAY-RELEASE.md` (PR #31): add the upload-key secrets, run Android CI, download `app-release-aab`.

## 4. Play Console
1. Create app: name "Ludo Live", game, free.
2. **Store listing:** paste from `store/listing.md`; add Nepali from `store/listing-ne.md`; upload the icon,
   feature graphic and the 7 screenshots in order.
3. **App content:** answer from `store/data-safety.md` (privacy policy, ads: none, target audience 13+, IARC, Data safety).
4. **Testing → Internal testing:** upload the AAB, add your own Gmail as a tester, install from the Play link and
   run the two unchecked items in `docs/QA-REPORT.md` (real phone pass, live online room).
5. New personal developer accounts must run a **closed test with at least 12 testers for 14 days** before production
   access. Start it as soon as the internal build looks good.
6. **Production:** promote the tested release, countries: all (or start with Nepal and India), submit for review.
