# Google Play Store Readiness (SEQ Angler)

This repository currently contains two Android app paths:

- `android/` (native Kotlin app)
- `frontend/` (Expo app with EAS build config)

Use one release path for production, then complete the checklist below before submitting to Google Play.

## 1) Build artifacts

- Native app (`android/`): generate a release build and upload AAB to Play Console.
- Expo app (`frontend/`): use EAS production profile to generate an Android App Bundle.

## 2) Versioning

- Increment Android `versionCode` for every Play upload.
- Keep `versionName` aligned with your public release version.

## 3) Secrets and signing

- Do not commit production secrets into source control.
- Provide keys via local/CI environment:
  - Native: `MAPS_API_KEY`, `BACKEND_BASE_URL` (Gradle properties or CI secrets)
  - Expo submit: `play-service-account.json` file path in `frontend/eas.json`
- Keep upload keystore and Play service account key in secure secret storage.

## 4) Permissions and policy declarations

- Only request permissions that are used in app flows (location, camera, media images).
- `READ_EXTERNAL_STORAGE` is blocked in Expo config; keep it blocked for modern Android.
- Complete Play Console Data safety form to match actual runtime data collection.
- Provide a production privacy policy URL in Play Console listing.

## 5) Target API requirement

- Keep `targetSdk`/`compileSdk` current with Google Play requirements.
- Re-check policy before each release cycle in case deadlines change.

## 6) Release verification checklist

- Build succeeds in release mode.
- App launches and core flows work (auth, map, catches, profile).
- No placeholder keys remain in shipping manifest/config.
- Data safety + privacy policy + app content questionnaires are complete in Play Console.
