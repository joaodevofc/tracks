@echo off
echo Setting up Cloudflare Worker secrets for W.Tracks...
echo.

echo Setting FIREBASE_PROJECT_ID...
wrangler secret put FIREBASE_PROJECT_ID
echo.

echo Setting FIREBASE_API_KEY...
wrangler secret put FIREBASE_API_KEY
echo.

echo Setting STREAM_TOKEN_SECRET (optional - if not set, will use Firebase API key for signing)...
echo Press Enter to skip this step if you want to use the default (Firebase API key)
wrangler secret put STREAM_TOKEN_SECRET
echo.

echo All secrets configured successfully!
echo You can now deploy the worker with: wrangler deploy