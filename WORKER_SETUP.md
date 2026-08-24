# Cloudflare Worker Setup Guide for W.Tracks

This guide explains how to set up and deploy the Cloudflare Worker for audio storage using R2.

## Prerequisites

1. Node.js and npm installed
2. Wrangler CLI installed: `npm install -g wrangler`
3. Cloudflare account with R2 enabled
4. Firebase project with Firestore database

## Step 1: Configure Wrangler

The `wrangler.toml` file is already configured. You need to set up the following secrets:

### Set Cloudflare Secrets

Run these commands to set your secrets (replace with your actual values):

```bash
# Firebase Configuration
wrangler secret put FIREBASE_PROJECT_ID
# Enter: wtracks-acff8

wrangler secret put FIREBASE_API_KEY
# Enter: AIzaSyDW6P_V4_LRLRg6-FEe2E7QJa9J3oidY5g

# Stream Token Secret (optional - for signing streaming tokens)
# If not set, will use Firebase API key for signing
wrangler secret put STREAM_TOKEN_SECRET
# Enter: a random secret string for signing tokens
```

## Step 3: Create R2 Bucket

If you haven't created the R2 bucket yet:

```bash
wrangler r2 bucket create wtracks-audio
```

Or create it via the Cloudflare Dashboard:
1. Go to R2 > Create Bucket
2. Name it `wtracks-audio`
3. Choose your preferred location

## Step 4: Test Locally

Test the worker locally:

```bash
wrangler dev
```

The worker will be available at `http://localhost:8787`

## Step 5: Deploy to Production

Deploy the worker:

```bash
wrangler deploy
```

Your worker will be deployed to `https://wtracks.workers.dev`

## Step 6: Configure Custom Domain (Optional)

If you want to use a custom domain, update the `wrangler.toml`:

```toml
routes = [
  { pattern = "https://wtracks.workers.dev/*", zone_name = "your-domain.com" }
]
```

## Step 7: Update Firestore User Plan

Make sure your users have the correct plan set in Firestore. The worker checks for `plan` field in the `users` collection:

```javascript
// In Firestore, set user plan to "Studio" or "Pro"
db.collection('users').doc(userId).set({
  plan: 'Studio', // or 'Pro'
  // ... other user data
});
```

## API Endpoints

### POST /upload
Upload an audio file to R2.

**Request:**
- Method: POST
- Headers: `Authorization: Bearer <firebase_token>`
- Body: FormData with:
  - `audioFile`: File object
  - `userId`: User ID (optional, will use token UID)
  - `projectName`: Project name
  - `trackName`: Track name
  - `trackId`: Track ID (optional, will generate if not provided)

**Response:**
```json
{
  "success": true,
  "id": "track_xxx",
  "key": "userId/trackId",
  "size": 1234567,
  "contentType": "audio/mpeg"
}
```

### GET /track/:id/url
Get streaming URL for a track with signed token.

**Request:**
- Method: GET
- Headers: `Authorization: Bearer <firebase_token>`
- URL: `/track/{trackId}/url`

**Response:**
```json
{
  "url": "https://wtracks.workers.dev/track/{trackId}/stream?token=xxx",
  "expiresIn": 3600,
  "trackId": "track_xxx"
}
```

### GET /track/:id/stream
Stream audio file with Range request support using signed token.

**Request:**
- Method: GET
- URL: `/track/{trackId}/stream?token=<signed_token>`
- Headers: `Range: bytes=0-1024` (optional)

**Response:**
- Status: 200 (full content) or 206 (partial content)
- Headers: `Content-Type`, `Content-Length`, `Accept-Ranges`, `Content-Range` (for partial)

### DELETE /track/:id
Delete a track from R2.

**Request:**
- Method: DELETE
- Headers: `Authorization: Bearer <firebase_token>`
- URL: `/track/{trackId}`

**Response:**
```json
{
  "success": true,
  "id": "track_xxx"
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1234567890
}
```

## Features

### CORS Configuration
The worker is configured to allow requests from any origin (`*`). For production, restrict this to your actual domain:

```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://your-domain.com',
  // ... other headers
};
```

### Range Request Support
The streaming endpoint supports HTTP Range requests for:
- Audio seeking/scrubbing
- Progressive loading
- Bandwidth optimization

### Error Handling
All endpoints return proper error responses:
- 401: Missing or invalid authorization token
- 403: User doesn't have Studio/Pro plan
- 404: Track not found
- 500: Server error

### Content Type Detection
The worker automatically detects content type from:
1. File MIME type (from browser)
2. File extension (fallback)

Supported formats: MP3, WAV, OGG, FLAC, M4A, AAC, WMA, AIFF

## Troubleshooting

### Upload fails with 401
- Check that Firebase token is valid
- Ensure token is passed in `Authorization: Bearer <token>` header

### Upload fails with 403
- Check user plan in Firestore
- Ensure plan is set to "Studio" or "Pro"

### Stream URL returns 401
- Check that the streaming token is valid and not expired
- Verify the token was generated recently (tokens expire in 1 hour)
- Check that STREAM_TOKEN_SECRET is set (or using Firebase API key as fallback)

### Stream URL returns 404
- Check that track exists in R2
- Verify track ID is correct
- Check user ID matches the track's owner
- Verify the signed token matches the requested track ID

### Range requests not working
- Ensure audio player supports Range requests
- Check that `Accept-Ranges: bytes` header is present
- Verify Range header format: `bytes=start-end`

## Security Notes

- All secrets are stored as Cloudflare Worker secrets
- Firebase tokens are verified using Firebase Auth REST API
- User plan is checked against Firestore
- R2 credentials are never exposed to the frontend
- CORS should be restricted to your domain in production
- Streaming tokens are short-lived (1 hour) and signed to prevent unauthorized access
- Streaming tokens do not require Firebase auth headers, enabling direct <audio> element playback

## Monitoring

Monitor your worker usage:
```bash
wrangler tail
```

This will show real-time logs from your deployed worker.