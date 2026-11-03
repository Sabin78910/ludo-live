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

Each run bumps the version code automatically, so every build can be uploaded. Once the setup below is done, steps 2 and 3 of "Build" happen by themselves.

## Automatic upload to internal testing
Every push to `main` builds the signed .aab and uploads it to the **Internal testing** track through the
Google Play Developer API. Nobody has to download or drag the file. The upload is skipped, with a notice in
the run, until both the upload key secrets above and `PLAY_SERVICE_ACCOUNT_JSON` exist.

### One-time setup (about 15 minutes, done once for all apps)
1. **Create a service account.** Open https://console.cloud.google.com, pick or create a project
   (for example "play-publishing"), then go to IAM and Admin > Service accounts > Create service account.
   Name it `play-publisher`. Skip the optional role and user steps and click Done.
2. **Make its key.** Click the new service account > Keys > Add key > Create new key > JSON. A .json file
   downloads. Treat it like a password: never commit it, never paste it in chat.
3. **Turn on the API.** In the same Cloud project open APIs and Services > Library, search for
   "Google Play Android Developer API" and click Enable.
4. **Invite it to Play Console.** Open https://play.google.com/console (developer account 8316920426282440744)
   > Users and permissions > Invite new users. Paste the service account's email (it ends in
   `.iam.gserviceaccount.com`). Under App permissions add Prism Pop, Ludo Live and Private PDF, and tick
   "Release apps to testing tracks" (plus "View app information"). Send the invite. It is accepted
   automatically. New service accounts can take up to a day before the API accepts them.
5. **Add the GitHub secret.** In each repo (prism-pop-game, ludo-live, document_management_system) open
   Settings > Secrets and variables > Actions > New repository secret. Name it `PLAY_SERVICE_ACCOUNT_JSON`
   and paste the whole contents of the .json file. Then delete the .json from your Downloads folder.

### Things to know
- **The app must exist in Play Console, and the first bundle must be uploaded by hand.** The API cannot
  create an app or make its very first upload. If the app has no bundle yet, upload one .aab from a run's
  artifact in Testing > Internal testing > Create release once; every later build goes through CI.
- **Draft apps.** Until a release has been rolled out once, Play only accepts draft releases. The workflow
  then retries as a draft, so the bundle still lands; open Internal testing and press Roll out once.
- **Version codes** come from the workflow run number. If Play says the version code is already used,
  the bundle you uploaded by hand had a higher code; re-run the workflow until the number passes it.
- **Not automatable:** the IARC content rating questionnaire and its terms, the Data safety form, the
  target audience and ads declarations, accepting Play App Signing the first time, and Send for review
  to Production all stay in Play Console.
