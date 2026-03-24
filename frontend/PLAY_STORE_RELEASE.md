# Google Play release checklist (Expo app)

This project ships an Expo-managed Android app from `frontend`.

## 1) One-time setup

1. Install Expo/EAS tooling (if needed):
   - `npm install`
   - `npx expo --version`
   - `npx eas-cli --version`
2. Sign in to Expo:
   - `npx eas login`
3. Create your Play Console app using the package name:
   - `com.seqangler.app`

## 2) Service account for Play uploads

1. In Google Play Console, create a service account with release upload permissions.
2. Download the JSON key and save it as:
   - `frontend/play-service-account.json`
3. This file is ignored by git and used by EAS submit.

## 3) Validate app config before release

From `frontend/` run:

- `npx expo config --type public`

Confirm:
- `android.package` is `com.seqangler.app`
- `android.versionCode` exists
- Only required runtime permissions are declared

## 4) Build Android App Bundle (AAB)

From `frontend/` run:

- `npx eas build --platform android --profile production`

Notes:
- Production profile uses app bundles (`.aab`) and auto-increments build numbers.
- If prompted, let EAS manage your Android keystore.

## 5) Submit to Play internal track

From `frontend/` run:

- `npx eas submit --platform android --profile production`

This uploads the latest production Android build to the internal testing track.

## 6) Play Console compliance (manual)

Complete these in Play Console before production rollout:

1. App content:
   - Privacy policy URL
   - Data safety form
   - Sensitive permissions declarations (if requested)
2. Store listing:
   - Short description / full description
   - Phone screenshots (required) and optional tablet assets
   - Feature graphic and app icon
3. Testing and release:
   - Internal test verification
   - Production rollout percentage strategy

## 7) Versioning rules

- Keep semantic app version in `frontend/app.json` (`expo.version`) for user-visible versions.
- Keep/increment Android build number via `android.versionCode` (or EAS `autoIncrement` in production profile).
- Never reuse a previously uploaded `versionCode`.

## 8) Fast preflight commands

From `frontend/`:

- `npm run lint`
- `npx expo config --type public`
- `npx eas build --platform android --profile production --non-interactive`

If the non-interactive build fails due to missing credentials/session, run the interactive command first.
