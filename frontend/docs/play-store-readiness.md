# Google Play Store readiness checklist (Expo / EAS)

This project is configured for Android App Bundle (`.aab`) release builds via EAS.

## 1) App config checks

- Package name is set to `com.seqangler.app`.
- `versionCode` is present in `app.json` and must be incremented for every Play upload.
- Android permissions are minimized to app-required permissions:
  - `ACCESS_COARSE_LOCATION`
  - `ACCESS_FINE_LOCATION`
  - `CAMERA`
- `com.google.android.gms.permission.AD_ID` is blocked to avoid unnecessary Ads Data declarations when ads are not used.

## 2) Play Console policy/data setup

Before submitting:

- Complete **App content** in Play Console:
  - Privacy Policy URL
  - Data safety form (location + camera/photo usage)
  - Ads declaration (`No`, if app does not serve ads)
  - Content rating questionnaire
  - Target audience + news declaration (if applicable)
- Ensure location and camera purpose text in store listing/privacy policy matches in-app use.

## 3) Credentials and secrets

- Do **not** commit service account JSON files.
- Set `GOOGLE_SERVICE_ACCOUNT_KEY` in EAS secrets as a JSON string.
- `eas.json` submit profile is configured to read from:
  - `serviceAccountKeyPath: "./.eas/service-account-key.json"`
- For local submit, write secret to that file path right before submit and remove it afterwards.

Example:

1. `mkdir -p .eas`
2. Write env var to `.eas/service-account-key.json`
3. `eas submit -p android --profile production`
4. Delete `.eas/service-account-key.json`

## 4) Build and submit commands

- Build production Android bundle:
  - `eas build -p android --profile production`
- Submit latest build to internal track:
  - `eas submit -p android --profile production`

## 5) Release hygiene

- Increment `expo.version` for each release series.
- Increment `android.versionCode` for each Play upload.
- Keep changelog/release notes for Play release details.
