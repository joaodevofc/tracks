# R2 Deployment Guide for W.Tracks

## Prerequisites

1. **Cloudflare Account** with R2 access
2. **Wrangler CLI** installed: `npm install -g wrangler`
3. **Existing R2 bucket** for audio storage
4. **Firebase project** with Authentication enabled

## Configuration Steps

### Step 1: Configure wrangler.toml

Edit `wrangler.toml` and replace the placeholder values:

```toml
# Replace with your existing R2 bucket name
bucket_name = "YOUR_R2_BUCKET_NAME"

# Replace with your Firebase project ID
FIREBASE_PROJECT_ID = "YOUR_FIREBASE_PROJECT_ID"
```

**To find your Firebase Project ID:**
- Go to Firebase Console → Project Settings
- Copy the "Project ID" (not the API key)

**To find your R2 bucket name:**
- Go to Cloudflare Dashboard → R2 → Overview
- Copy the bucket name

### Step 2: Login to Cloudflare

```bash
wrangler login
```

This will open a browser window to authenticate with Cloudflare.

### Step 3: Verify Configuration

```bash
wrangler whoami
```

This should show your Cloudflare account information.

### Step 4: Deploy the Worker

```bash
wrangler deploy
```

This will:
- Upload `r2-worker.js` to Cloudflare
- Configure the R2 bucket binding
- Set the environment variables
- Provide the Worker URL (typically: `https://wtracks-worker.YOUR_SUBDOMAIN.workers.dev`)

### Step 5: Configure Frontend URL

After deployment, update the Worker URL in the frontend:

```javascript
// In app.js or r2storage.js
r2Storage.setWorkerUrl('https://wtracks-worker.YOUR_SUBDOMAIN.workers.dev');
```

Or set it via localStorage:

```javascript
localStorage.setItem('wtracks_worker_url', 'https://wtracks-worker.YOUR_SUBDOMAIN.workers.dev');
```

## Security Notes

### What Goes in wrangler.toml (Public)

✅ **Public variables (safe to commit to Git):**
- `FIREBASE_PROJECT_ID` - Firebase project identifier (not a secret)
- R2 bucket name - Public identifier for your bucket

### What Goes in Worker Secrets (NOT in code)

❌ **No secrets required for this implementation:**
- The Worker uses Firebase public keys for JWT verification
- Keys are fetched from: `https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`
- No Firebase API key needed
- No Firebase service account needed
- No R2 credentials needed (handled by binding)

### If You Need Secrets in the Future

To add secrets (not needed for current implementation):

```bash
wrangler secret put SECRET_NAME
```

Secrets are:
- Stored securely in Cloudflare
- Never committed to Git
- Never exposed in the Worker code
- Encrypted at rest

## Testing the Deployment

### Health Check

```bash
curl https://wtracks-worker.YOUR_SUBDOMAIN.workers.dev/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Upload Test (requires valid Firebase token)

```bash
curl -X POST https://wtracks-worker.YOUR_SUBDOMAIN.workers.dev/upload \
  -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN" \
  -F "audioFile=@test.wav" \
  -F "projectId=test-project" \
  -F "trackId=test-track" \
  -F "fileName=test.wav" \
  -F "r2Key=users/YOUR_UID/projects/test-project/tracks/test-track/test.wav"
```

## Firebase Spark Plan Compatibility

✅ **This implementation is 100% compatible with Firebase Spark plan:**

- Firebase Auth: Free (no MAU limits without Identity Platform)
- Firebase Auth REST API: Not used (we use public keys)
- Firestore: Free (within Spark quotas)
- No Cloud Functions required
- No Blaze plan upgrade needed

## Cloudflare Workers Free Tier

✅ **This implementation fits within Cloudflare Workers free tier:**

- 100,000 requests/day free
- 10ms CPU time per request
- 128MB memory
- Sufficient for typical audio upload/download operations

## Cloudflare R2 Free Tier

✅ **This implementation fits within Cloudflare R2 free tier:**

- 10 GB storage free
- 10,000,000 Class A operations/month free
- 1,000,000 Class B operations/month free
- Sufficient for typical audio storage

## Troubleshooting

### Worker Deployment Fails

- Verify `wrangler.toml` syntax
- Ensure you're logged in: `wrangler whoami`
- Check that the R2 bucket exists in your account

### R2 Binding Error

- Verify the bucket name matches exactly (case-sensitive)
- Ensure the bucket is in the same Cloudflare account

### Firebase Token Validation Fails

- Verify `FIREBASE_PROJECT_ID` is correct
- Ensure the token is a valid Firebase ID Token (not just any JWT)
- Check that the token is not expired

### Bucket Access Denied

- Verify the R2 bucket binding is configured correctly
- Check that the Worker has the R2 permission

## Monitoring

### View Worker Logs

```bash
wrangler tail
```

This shows real-time logs from your Worker, including:
- Token validation attempts
- R2 key validation
- Upload/download operations
- Error messages

### View R2 Usage

Go to Cloudflare Dashboard → R2 → Analytics

## Cost Monitoring

### Cloudflare Dashboard

- Workers: Dashboard → Workers & Pages → Analytics
- R2: Dashboard → R2 → Analytics

### Firebase Console

- Authentication: Firebase Console → Authentication → Usage
- Firestore: Firebase Console → Firestore → Usage

## Rollback

If you need to rollback to a previous version:

```bash
wrangler rollback
```

Or deploy a specific version:

```bash
wrangler deploy --name wtracks-worker-v1
```

## Next Steps After Deployment

1. **Test with the actual W.Tracks frontend**
2. **Monitor logs for any errors**
3. **Verify upload/download functionality**
4. **Check versioning works correctly**
5. **Test offline behavior**
6. **Verify costs stay within free tiers**

## Support

For issues:
- Cloudflare Workers: https://developers.cloudflare.com/workers/
- Cloudflare R2: https://developers.cloudflare.com/r2/
- Firebase Auth: https://firebase.google.com/docs/auth
