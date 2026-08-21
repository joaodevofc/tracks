# W.Tracks Backend Integration

This document explains how to integrate and use the new backend server for W.Tracks.

## Overview

The backend server replaces IndexedDB (local browser storage) with a cloud-based storage solution that:

- Stores audio files on your local HD (configurable path)
- Synchronizes music across devices when users log in with Firebase Auth
- Provides streaming playback without full downloads
- Maintains metadata in a lightweight SQLite database

## Architecture

```
Frontend (Browser)
    ↓ (HTTP API)
Backend Server (Node.js + Express)
    ↓ (File System)
Local HD Storage (E:\wtracks-audio\{userId}\{trackId}.mp3)
    ↓ (LowDB JSON Database)
Metadata (wtracks-db.json)
```

## Quick Start

### 1. Set Up the Backend Server

```bash
cd server
npm install
```

### 2. Configure the Server

Edit `server/.env`:

```env
PORT=3000
STORAGE_PATH=E:\wtracks-audio
MAX_FILE_SIZE=104857600
FIREBASE_SERVICE_ACCOUNT_KEY=./firebase-service-account.json
```

**Important**: Create the storage directory if it doesn't exist:
```bash
mkdir E:\wtracks-audio
```

### 3. (Optional) Set Up Firebase Authentication

For production use, follow the instructions in `server/FIREBASE_SETUP.md` to:

1. Download Firebase service account key
2. Save it as `server/firebase-service-account.json`
3. Configure the `.env` file

For local testing, the server will work without authentication (development mode).

### 4. Start the Server

```bash
cd server
npm start
```

The server will start on `http://localhost:3000`

### 5. Use the Frontend

1. Open the frontend in your browser
2. Log in with Firebase Auth (if configured)
3. Upload audio files as usual
4. Files will now be stored on your HD instead of browser storage

## How It Works

### Storage Mode Selection

The frontend automatically detects if the backend API is available:

- **API Available**: Uses HTTP storage (backend server)
- **API Unavailable**: Falls back to IndexedDB (local browser storage)

This ensures the app works even if the server is offline.

### File Upload Flow

1. User selects audio files in the UI
2. Frontend checks if API is available
3. If available: Uploads to backend via `POST /api/tracks`
4. Backend saves file to HD and metadata to SQLite
5. Frontend stores track ID and streaming URL

### Playback Flow

1. User clicks play on a track
2. Frontend requests streaming URL from API
3. Backend streams file directly from HD
4. Audio player uses progressive streaming for playback

### User Isolation

Each user's files are stored in separate directories:

```
E:\wtracks-audio\
├── user_abc123\
│   ├── track_001.wav
│   ├── track_002.mp3
│   └── ...
├── user_xyz789\
│   ├── track_003.flac
│   └── ...
```

## Configuration

### Server Configuration (`server/.env`)

| Setting | Description | Default |
|---------|-------------|---------|
| `PORT` | Server port | 3000 |
| `STORAGE_PATH` | HD storage path | ./storage |
| `MAX_FILE_SIZE` | Max file size (bytes) | 104857600 (100MB) |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase auth key path | ./firebase-service-account.json |
| `CORS_ORIGIN` | Allowed CORS origins | * |

### Frontend Configuration

The frontend API URL is stored in localStorage:

```javascript
// Set custom API URL (if server is not on localhost:3000)
apiClient.setBaseUrl('http://your-server:3000');
```

## New Frontend Modules

### api-client.js

HTTP client for backend communication:

```javascript
// Upload a track
await apiClient.uploadTrack(file, {
    userId: 'user_123',
    projectName: 'My Project',
    trackName: 'Drums',
    trackId: 'track_001'
});

// Get user tracks
const tracks = await apiClient.getUserTracks('user_123');

// Get streaming URL
const streamUrl = apiClient.getTrackStreamUrl('track_001');

// Delete track
await apiClient.deleteTrack('track_001');
```

### httpstorage.js

Storage manager using backend API:

```javascript
// Set user ID
httpStorage.setUserId('user_123');

// Load projects from API
await httpStorage.load();

// Create project (uploads tracks automatically)
const project = await httpStorage.createProject(projectData);

// Delete project (deletes tracks from API)
await httpStorage.deleteProject(projectId);
```

### httpaudiostorage.js

Audio streaming manager:

```javascript
// Get streaming URL for playback
const streamUrl = await httpAudioStorage.loadTrackForPlayback(trackId);

// Use with HTML5 Audio
audio.src = streamUrl;
audio.play();

// Clean up blob URLs (for fallback mode)
httpAudioStorage.revokeObjectUrl(url);
```

## Migration from IndexedDB

### Existing Data

Existing IndexedDB data is not automatically migrated. To migrate:

1. Export existing projects from the UI (if export feature exists)
2. Start the backend server
3. Import projects (they will be uploaded to the backend)

### Hybrid Mode

The frontend supports hybrid operation:

- **New uploads**: Go to backend if available
- **Existing IndexedDB data**: Remains accessible
- **Fallback**: If backend goes offline, app continues using IndexedDB

## Testing

### Test Backend Server

```bash
# Health check
curl http://localhost:3000/api/health

# Should return:
# {"status":"ok","timestamp":"...","storagePath":"...","firebaseAuth":true/false}
```

### Test File Upload

You can test the API directly with curl:

```bash
curl -X POST http://localhost:3000/api/tracks \
  -F "audioFile=@test.wav" \
  -F "userId=test_user" \
  -F "projectName=Test Project" \
  -F "trackName=Test Track"
```

### Test Streaming

```bash
# Stream audio file
curl http://localhost:3000/api/tracks/{trackId}/file --output test.wav
```

## Troubleshooting

### Server Won't Start

- Check if port 3000 is in use
- Verify Node.js is installed (v14+)
- Run `npm install` in server directory

### Files Not Uploading

- Check server logs for errors
- Verify STORAGE_PATH exists and is writable
- Check file size is under MAX_FILE_SIZE
- Ensure file type is allowed

### Authentication Errors

- Verify Firebase service account key is configured
- Check that Firebase token is valid
- Ensure user ID matches authenticated user

### Frontend Not Using Backend

- Check that server is running
- Verify API URL is correct (default: localhost:3000)
- Check browser console for errors
- Ensure CORS is configured correctly

## Security Notes

1. **Firebase Service Account Key**: Never commit to version control
2. **Environment Variables**: Keep `.env` file private
3. **Authentication**: Enable for production use
4. **HTTPS**: Use HTTPS in production
5. **File Validation**: Server validates file types and sizes
6. **User Isolation**: Files are isolated by user ID

## Performance Considerations

- **Streaming**: Uses progressive streaming for instant playback
- **Database**: SQLite is fast for metadata queries
- **File System**: Direct disk access is faster than cloud storage
- **Caching**: Consider adding CDN or caching for remote access

## Future Enhancements

- [ ] Automatic migration from IndexedDB
- [ ] Batch upload operations
- [ ] File compression
- [ ] Thumbnail generation
- [ ] Advanced search and filtering
- [ ] Sharing capabilities between users
- [ ] Version history for tracks
- [ ] Cloud backup integration

## Support

For issues or questions:

1. Check `server/README.md` for server-specific documentation
2. Check `server/FIREBASE_SETUP.md` for authentication setup
3. Review server logs for error messages
4. Check browser console for frontend errors

## License

This backend integration follows the same license as the main W.Tracks project.
