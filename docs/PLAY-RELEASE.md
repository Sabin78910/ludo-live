# Play Store release (cloud build, no laptop)

The GitHub Actions workflow `android.yml` builds the Play bundle (.aab). Secrets never go in the repo.

## One-time: add the signing secrets
1. Make an upload keystore (once, keep the file and passwords safe): `keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`
2. GitHub > this repo > Settings > Secrets and variables > Actions > New repository secret. Add:
   - `KEYSTORE_BASE64`: output of `base64 -w0 upload.jks` (on Mac: `base64 -i upload.jks`)
   - `KEYSTORE_PASSWORD`, `KEY_ALIAS` (`upload`), `KEY_PASSWORD`
3. Without these the .aab is unsigned and Play rejects it.

## Build
1. GitHub > Actions > "Android" workflow > Run workflow on `main` (it also runs on every push to `main`).
2. When it is green, open the run and download the artifact (the .aab).

## Upload to Play Console
1. Create the app (Game, Free) with the package name from `capacitor.config`.
2. If your developer account is personal and created after Nov 2023, run a closed test with 12 testers for 14 days before Production.
3. Testing > Internal testing > Create release > upload the .aab > accept Play App Signing > add yourself as tester and install.
4. Fill in Store listing (text is in `store/play-listing.md`), Data safety, Content rating, Target audience, Ads, Privacy policy URL.
5. Promote the same build to Production (or Closed testing) > Send for review.

Each run bumps the version code automatically, so every build can be uploaded.
