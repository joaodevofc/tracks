# R2 Implementation for W.Tracks

## Overview

This implementation adds Cloudflare R2 storage for permanent audio file storage, with IndexedDB as a local cache. The player continues to work with local File objects only, maintaining the existing architecture.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLOUD                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Cloudflare Worker                            │  │
│  │         (wtracks.workers.dev)                              │  │
│  │  - Verifies Firebase Auth token                           │  │
│  │  - Validates user access to project/track                 │  │
│  │  - Secure proxy to R2                                      │  │
│  └──────────────────┬───────────────────────────────────────┘  │
│                     │ HTTPS (auth token)                        │
│  ┌──────────────────▼───────────────────────────────────────┐  │
│  │              Cloudflare R2                                │  │
│  │  users/{userId}/projects/{projectId}/tracks/{trackId}/   │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                      FRONTEND                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              R2Storage (r2storage.js)                    │  │
│  │  - uploadTrack() → Worker                                │  │
│  │  - downloadTrack() → Worker                               │  │
│  │  - deleteTrack() → Worker                                │  │
│  │  - getTrackMetadata() → Worker                           │  │
│  └──────────────────┬───────────────────────────────────────┘  │
│                     │                                            │
│  ┌──────────────────▼───────────────────────────────────────┐  │
│  │              TrackHydrator (trackhydrator.js)             │  │
│  │  - hydrateProject()                                      │  │
│  │  - Version checking                                      │  │
│  │  - Controlled download queue (2 concurrent)               │  │
│  │  - Progress tracking                                     │  │
│  └──────────────────┬───────────────────────────────────────┘  │
│                     │                                            │
│  ┌──────────────────▼───────────────────────────────────────┐  │
│  │              AudioStorage (audiostorage.js)               │  │
│  │  - IndexedDB operations (unchanged)                       │  │
│  │  - Local cache for R2 files                              │  │
│  └──────────────────┬───────────────────────────────────────┘  │
│                     │                                            │
│  ┌──────────────────▼───────────────────────────────────────┐  │
│  │              Track (storage.js)                          │  │
│  │  - r2Key, r2Version, cloud, local, downloading, error    │  │
│  └──────────────────┬───────────────────────────────────────┘  │
│                     │                                            │
│  ┌──────────────────▼───────────────────────────────────────┐  │
│  │              MultitrackPlayer (player.js)                 │  │
│  │  - Receives track.file (unchanged)                       │  │
│  │  - No R2 coupling                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## Files Created

1. **r2storage.js** - R2 communication layer
   - Upload/download tracks via Worker
   - Progress tracking
   - Retry logic with exponential backoff
   - Token management

2. **trackhydrator.js** - Track hydration orchestrator
   - Download queue with concurrency control (2 concurrent)
   - Version checking
   - Progress tracking per track
   - Error handling and retry

3. **r2-worker.js** - Cloudflare Worker code
   - Firebase Auth verification
   - Project/track access validation
   - R2 operations (upload, download, delete, metadata)
   - CORS configuration

## Files Modified

1. **storage.js** - Track model
   - Added R2 properties: r2Key, r2Version, cloud, local, downloading, error, r2Size, r2UploadedAt
   - Updated toJSON/fromJSON to include R2 metadata

2. **app.js** - Main application
   - Initialize R2Storage and TrackHydrator
   - Setup R2 auth with Firebase token
   - Updated hydrateProjectFiles() to use TrackHydrator
   - Added uploadTracksToR2() for uploading tracks to R2
   - Fallback hydration for when R2 is not available

3. **index.html** - HTML entry point
   - Added script tags for r2storage.js and trackhydrator.js

## Track Properties

### New R2 Properties

```javascript
{
    r2Key: string,           // R2 object key (null if local-only)
    r2Version: number,       // Version for change detection (default 1)
    cloud: boolean,          // True if track exists in R2
    local: boolean,          // True if track exists in IndexedDB
    downloading: boolean,    // True if currently downloading
    error: boolean,          // True if download/upload error
    r2Size: number,          // Size in R2
    r2UploadedAt: string     // Upload timestamp
}
```

### Track States

```javascript
// Local-only project (no R2)
{ cloud: false, local: true, downloading: false, error: false }

// Track in R2, not downloaded yet
{ cloud: true, local: false, downloading: false, error: false }

// Track downloading from R2
{ cloud: true, local: false, downloading: true, error: false }

// Track available locally and in R2
{ cloud: true, local: true, downloading: false, error: false }

// Track with download error
{ cloud: true, local: false, downloading: false, error: true }
```

## R2 Key Structure

```
users/{userId}/projects/{projectId}/tracks/{trackId}/{sanitizedFileName}
```

Example:
```
users/abc123/projects/project_xyz/tracks/track_456/drums.wav
```

## Worker Setup

### Prerequisites

1. Cloudflare account with R2 enabled
2. Firebase project with Auth enabled
3. wrangler CLI installed

### Deployment Steps

1. **Create R2 Bucket**
   ```bash
   wrangler r2 bucket create wtracks-audio
   ```

2. **Configure wrangler.toml**
   ```toml
   name = "wtracks-worker"
   main = "r2-worker.js"
   compatibility_date = "2024-01-01"

   [[r2_buckets]]
   binding = "R2"
   bucket_name = "wtracks-audio"

   [vars]
   FIREBASE_PROJECT_ID = "your-firebase-project-id"
   FIREBASE_API_KEY = "your-firebase-api-key"
   ```

3. **Deploy Worker**
   ```bash
   wrangler deploy
   ```

4. **Configure Custom Domain** (optional)
   - Add custom domain: wtracks.workers.dev
   - Configure DNS settings

### Worker Endpoints

- `POST /upload` - Upload track to R2
- `GET /download?key={r2Key}` - Download track from R2
- `DELETE /delete?key={r2Key}` - Delete track from R2
- `GET /metadata?key={r2Key}` - Get track metadata
- `GET /health` - Health check

### Security

The Worker validates:
1. Firebase Auth token in Authorization header
2. User ID matches the userId in r2Key
3. User has access to the project (via Firestore)

## Frontend Configuration

### Worker URL

The Worker URL is stored in localStorage:
```javascript
// Set custom Worker URL (if not using default)
r2Storage.setWorkerUrl('https://your-worker.workers.dev');
```

Default: `https://wtracks.workers.dev`

### Auth Token

The Firebase Auth token is automatically set when user logs in:
```javascript
// Automatically handled in app.js setupR2Auth()
```

## Usage

### Upload Flow

When creating a project with tracks:

1. User selects audio files
2. Tracks are created with IDs
3. If user is authenticated:
   - Tracks are uploaded to R2 via Worker
   - R2 metadata is added to tracks
   - Files are saved to IndexedDB (local cache)
4. Project is saved to localStorage
5. Tracks have: `cloud: true, local: true`

### Download/Hydration Flow

When opening a project:

1. TrackHydrator checks each track:
   - If track has valid file: check version with R2
   - If version outdated: re-download from R2
   - If no file: download from R2
   - If no R2 reference: use local-only
2. Downloads are queued with max 2 concurrent
3. Progress is tracked per track
4. Downloaded files are saved to IndexedDB
5. Player receives File objects (no R2 coupling)

### Offline Usage

Once tracks are downloaded to IndexedDB:
- No internet connection needed for playback
- Player works with local File objects
- Tracks with `local: true` are available offline

## Backward Compatibility

### Existing Local-Only Projects

Projects created before R2 implementation:
- Have `cloud: false`
- Continue working with IndexedDB only
- No R2 operations attempted
- Player functions normally

### Migration Strategy

To migrate existing projects to R2:
1. Open project in UI
2. Click "Upload to Cloud" button (to be implemented)
3. Tracks are uploaded to R2
4. R2 metadata is added
5. Project now has: `cloud: true, local: true`

## Error Handling

### Upload Errors

If R2 upload fails:
- Track is marked as `cloud: false, local: true`
- Project creation continues
- Track works with local IndexedDB only
- Error is logged to console

### Download Errors

If R2 download fails:
- Track is marked as `error: true`
- Track is filtered out before player
- User is warned about missing tracks
- Retry can be attempted

### Worker Unavailable

If Worker is not available:
- R2 operations fail
- System falls back to IndexedDB only
- Player continues with local files
- No error shown to user (graceful degradation)

## Performance Considerations

### Concurrency

- Max 2 concurrent downloads
- Prevents browser overload
- Allows user to continue using app during downloads

### Version Checking

- Only checks version if track exists in R2
- Skips check for local-only tracks
- Reduces unnecessary API calls

### IndexedDB Cache

- Files are cached locally after download
- Subsequent opens use cached files
- Reduces bandwidth usage
- Enables offline playback

## Testing

### Manual Testing

1. **Create Project with R2**
   - Log in with Firebase Auth
   - Create project with audio files
   - Check console for R2 upload logs
   - Verify tracks have `cloud: true`

2. **Download from R2**
   - Clear IndexedDB (DevTools → Application → IndexedDB)
   - Open project
   - Check console for download logs
   - Verify tracks are downloaded and playable

3. **Version Check**
   - Update track in R2 (simulated)
   - Open project
   - Verify re-download occurs
   - Check version increment

4. **Offline Playback**
   - Download tracks to IndexedDB
   - Disconnect internet
   - Open project
   - Verify playback works

5. **Error Handling**
   - Disable Worker
   - Create project
   - Verify fallback to IndexedDB
   - Verify player still works

## Future Enhancements

- [ ] UI for R2 upload status
- [ ] UI for download progress
- [ ] Manual re-download button
- [ ] Delete from R2 option
- [ ] Storage usage statistics
- [ ] Batch upload optimization
- [ ] Conflict resolution
- [ ] Share projects between users

## Troubleshooting

### Uploads Not Working

1. Check Firebase Auth token is set
2. Verify Worker is accessible
3. Check Worker logs for errors
4. Verify R2 bucket exists
5. Check CORS configuration

### Downloads Not Working

1. Check Worker is accessible
2. Verify r2Key is correct
3. Check user has access to project
4. Verify track exists in R2
5. Check IndexedDB quota

### Version Mismatch

1. Check R2 metadata endpoint
2. Verify version increment logic
3. Check version is saved to localStorage
4. Verify version comparison logic

## Security Notes

⚠️ **Important Security Reminders:**

1. Never commit Firebase service account key to version control
2. Never commit Worker secrets to version control
3. Use environment variables for sensitive data
4. Enable Firebase Auth in production
5. Validate all user inputs in Worker
6. Use HTTPS in production
7. Implement rate limiting in Worker
8. Monitor Worker logs for suspicious activity

## License

This R2 implementation follows the same license as the main W.Tracks project.
