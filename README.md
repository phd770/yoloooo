<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/c0d82b2c-8c22-4bb8-9dc3-2bfc1b51854d

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deployment and security

- Vercel builds the app with `npm run build` and serves the `dist` directory.
- Firebase rules are stored in `firestore.rules` and `storage.rules` and can be deployed with `npx firebase-tools deploy --only firestore:rules,storage`.
- Anonymous Firebase Authentication must be enabled for the Firebase project before deploying these rules.
- Do not put Gemini or other private API keys in Vite client code or `VITE_*` variables. Use a server-side function for provider API calls.
- The current two-profile PIN screen is a client-side convenience gate, not a replacement for server-side identity verification.
