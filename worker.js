/**
 * Cloudflare Worker for W.Tracks Audio Storage
 * Handles audio upload/download using Cloudflare R2
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Log Firebase configuration for debugging (first 10 chars of API key for security)
    console.log('[WORKER] Firebase Project ID:', env.FIREBASE_PROJECT_ID);
    console.log('[WORKER] Firebase API Key (first 10 chars):', env.FIREBASE_API_KEY ? env.FIREBASE_API_KEY.substring(0, 10) + '...' : 'NOT SET');
    console.log('[WORKER] Stream token secret available:', !!env.STREAM_TOKEN_SECRET);
    console.log('[WORKER] R2 Bucket binding available:', !!env.wtracks_audio);
    
    // CORS configuration - restrict to your domain in production
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
      'Access-Control-Max-Age': '86400',
    };

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route handling
      if (url.pathname === '/upload' && request.method === 'POST') {
        return handleUpload(request, env, corsHeaders);
      }

      if (url.pathname.match(/^\/track\/[^/]+\/url$/) && request.method === 'GET') {
        const trackId = url.pathname.split('/')[2];
        return handleGetTrackUrl(trackId, request, env, corsHeaders);
      }

      if (url.pathname.match(/^\/track\/[^/]+\/stream$/) && request.method === 'GET') {
        const trackId = url.pathname.split('/')[2];
        return handleStreamTrack(trackId, request, env, corsHeaders);
      }

      if (url.pathname.match(/^\/track\/[^/]+$/) && request.method === 'DELETE') {
        const trackId = url.pathname.split('/')[2];
        return handleDeleteTrack(trackId, request, env, corsHeaders);
      }

      // Health check endpoint
      if (url.pathname === '/health' && request.method === 'GET') {
        return new Response(JSON.stringify({ status: 'ok', timestamp: Date.now() }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 404 for unknown routes
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('[WORKER] Error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};



/**
 * Handle audio upload
 */
async function handleUpload(request, env, corsHeaders) {
  try {
    console.log('[WORKER] Upload request received');
    console.log('[WORKER] Firebase Project ID:', env.FIREBASE_PROJECT_ID);
    console.log('[WORKER] Firebase API Key (first 10 chars):', env.FIREBASE_API_KEY.substring(0, 10) + '...');
    
    // Verify Firebase token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[WORKER] Missing authorization token');
      return new Response(JSON.stringify({ error: 'Missing authorization token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyFirebaseToken(token, env);
    
    if (!decodedToken) {
      console.log('[WORKER] Invalid or expired token');
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[WORKER] Token verified for user:', decodedToken.uid);

    // Check user plan (studio/pro only)
    const userPlan = await getUserPlan(decodedToken.uid, env, token);
    console.log('[WORKER] User plano:', userPlan);
    
    if (userPlan !== 'studio' && userPlan !== 'pro') {
      return new Response(JSON.stringify({ error: 'studio/pro plano required for audio upload' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const audioFile = formData.get('audioFile');
    const trackId = formData.get('trackId') || generateTrackId();
    const userId = formData.get('userId') || decodedToken.uid;
    const projectName = formData.get('projectName') || 'Untitled';
    const trackName = formData.get('trackName') || 'Untitled Track';

    if (!audioFile) {
      console.log('[WORKER] No audio file provided');
      return new Response(JSON.stringify({ error: 'No audio file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Determine content type
    let contentType = audioFile.type;
    if (!contentType || contentType === 'application/octet-stream') {
      contentType = getContentTypeFromFilename(audioFile.name);
    }

    console.log('[WORKER] Uploading file:', audioFile.name, 'Size:', audioFile.size, 'Type:', contentType);

    // Upload to R2 using native binding
    const key = `${userId}/${trackId}`;
    const arrayBuffer = await audioFile.arrayBuffer();
    
    await env.wtracks_audio.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: contentType
      },
      customMetadata: {
        userId: userId,
        trackId: trackId,
        projectName: projectName,
        trackName: trackName,
        originalFilename: audioFile.name,
        uploadedAt: new Date().toISOString()
      }
    });

    console.log('[WORKER] Upload successful:', key, 'Size:', arrayBuffer.byteLength, 'Type:', contentType);

    return new Response(JSON.stringify({
      success: true,
      id: trackId,
      key: key,
      size: arrayBuffer.byteLength,
      contentType: contentType
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[WORKER] Upload error:', error);
    return new Response(JSON.stringify({ error: 'Upload failed: ' + error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle getting track URL (returns streaming endpoint with signed token)
 */
async function handleGetTrackUrl(trackId, request, env, corsHeaders) {
  try {
    // Get the user ID from the token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyFirebaseToken(token, env);
    
    if (!decodedToken) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate signed streaming token
    const streamToken = generateStreamToken(decodedToken.uid, trackId, env);
    
    // Return streaming URL with signed token as query param
    const streamUrl = `${request.url.replace('/url', '/stream')}?token=${streamToken}`;

    return new Response(JSON.stringify({
      url: streamUrl,
      expiresIn: 3600, // 1 hour
      trackId: trackId
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[WORKER] Get track URL error:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate track URL' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle streaming track with Range request support
 */
async function handleStreamTrack(trackId, request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    
    // Get signed token from query params
    const streamToken = url.searchParams.get('token');
    if (!streamToken) {
      console.log('[WORKER] Stream request missing token');
      return new Response(JSON.stringify({ error: 'Missing stream token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify signed token
    const tokenData = verifyStreamToken(streamToken, env);
    if (!tokenData) {
      console.log('[WORKER] Invalid or expired stream token');
      return new Response(JSON.stringify({ error: 'Invalid or expired stream token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify token matches the requested track
    if (tokenData.trackId !== trackId) {
      console.log('[WORKER] Token track ID mismatch:', tokenData.trackId, 'vs', trackId);
      return new Response(JSON.stringify({ error: 'Token does not match track ID' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[WORKER] Stream token valid for user:', tokenData.userId, 'track:', trackId);

    const key = `${tokenData.userId}/${trackId}`;

    // Handle Range requests
    const rangeHeader = request.headers.get('Range');
    let object;
    
    if (rangeHeader) {
      // Parse Range header (format: "bytes=start-end")
      const range = rangeHeader.replace('bytes=', '').split('-');
      const start = parseInt(range[0]) || 0;
      const end = range[1] ? parseInt(range[1]) : null;
      
      // First get object to check size
      const fullObject = await env.wtracks_audio.get(key);
      if (!fullObject) {
        console.log('[WORKER] Track not found in R2:', key);
        return new Response(JSON.stringify({ error: 'Track not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const actualEnd = end !== null ? end : fullObject.size - 1;
      
      // Validate range
      if (start >= fullObject.size || actualEnd >= fullObject.size || start > actualEnd) {
        const headers = new Headers(corsHeaders);
        headers.set('Content-Range', `bytes */${fullObject.size}`);
        return new Response('Requested Range Not Satisfiable', {
          status: 416,
          headers: headers
        });
      }

      const rangeLength = actualEnd - start + 1;
      
      // Get object with range option using native R2 binding
      object = await env.wtracks_audio.get(key, {
        range: { offset: start, length: rangeLength }
      });
      
      const headers = new Headers(corsHeaders);
      const contentType = object.httpMetadata?.contentType || 'audio/mpeg';
      headers.set('Content-Type', contentType);
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Cache-Control', 'public, max-age=3600, must-revalidate'); // Cache for 1 hour
      headers.set('Content-Length', rangeLength.toString());
      headers.set('Content-Range', `bytes ${start}-${actualEnd}/${fullObject.size}`);
      // HTTP/2 friendly headers for connection multiplexing
      headers.set('Connection', 'keep-alive');
      headers.set('Keep-Alive', 'timeout=5, max=100');

      return new Response(object.body, {
        status: 206, // Partial Content
        headers: headers
      });
    }

    // Full content request - get object without range option
    object = await env.wtracks_audio.get(key);
    
    if (!object) {
      console.log('[WORKER] Track not found in R2:', key);
      return new Response(JSON.stringify({ error: 'Track not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const headers = new Headers(corsHeaders);
    const contentType = object.httpMetadata?.contentType || 'audio/mpeg';
    headers.set('Content-Type', contentType);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'public, max-age=3600, must-revalidate'); // Cache for 1 hour
    headers.set('Content-Length', object.size.toString());
    // HTTP/2 friendly headers for connection multiplexing
    headers.set('Connection', 'keep-alive');
    headers.set('Keep-Alive', 'timeout=5, max=100');

    return new Response(object.body, {
      status: 200,
      headers: headers
    });

  } catch (error) {
    console.error('[WORKER] Stream track error:', error);
    
    return new Response(JSON.stringify({ error: 'Failed to stream track' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle track deletion
 */
async function handleDeleteTrack(trackId, request, env, corsHeaders) {
  try {
    // Verify Firebase token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyFirebaseToken(token, env);
    
    if (!decodedToken) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Delete from R2 using native binding
    const key = `${decodedToken.uid}/${trackId}`;
    await env.wtracks_audio.delete(key);

    console.log('[WORKER] Track deleted:', key);

    return new Response(JSON.stringify({
      success: true,
      id: trackId
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[WORKER] Delete track error:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete track' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Verify Firebase token using Firebase Auth REST API
 */
async function verifyFirebaseToken(token, env) {
  try {
    // Log first 20 chars of token for debugging (security)
    const tokenPreview = token.substring(0, 20) + '...';
    console.log('[WORKER] Verifying Firebase token (first 20 chars):', tokenPreview);
    console.log('[WORKER] Token length:', token.length);
    
    // Use Firebase Auth REST API to verify token
    // Correct endpoint: /v1/accounts:lookup (no project ID in path, token contains project info)
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken: token })
      }
    );

    console.log('[WORKER] Firebase Auth API response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unable to parse error response' }));
      console.error('[WORKER] Firebase token verification failed:', response.status);
      console.error('[WORKER] Firebase Auth API error response:', JSON.stringify(errorData, null, 2));
      return null;
    }

    const data = await response.json();
    console.log('[WORKER] Firebase Auth API success response:', JSON.stringify(data, null, 2));
    
    if (data.users && data.users.length > 0) {
      console.log('[WORKER] Token verified successfully for user:', data.users[0].localId);
      return {
        uid: data.users[0].localId,
        email: data.users[0].email,
        emailVerified: data.users[0].emailVerified
      };
    }

    console.warn('[WORKER] Token verification succeeded but no users found in response');
    return null;
  } catch (error) {
    console.error('[WORKER] Firebase token verification error:', error);
    console.error('[WORKER] Error details:', error.message, error.stack);
    return null;
  }
}

/**
 * Get user plan from Firestore via REST API
 */
async function getUserPlan(userId, env, idToken) {
  try {
    console.log('[WORKER] Fetching user plano from Firestore for user:', userId);
    console.log('[WORKER] Using Firebase token for Firestore authorization (first 20 chars):', idToken.substring(0, 20) + '...');
    
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${userId}?key=${env.FIREBASE_API_KEY}`,
      {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }
    );

    console.log('[WORKER] Firestore API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unable to parse error response' }));
      console.error('[WORKER] Failed to get user plano:', response.status);
      console.error('[WORKER] Firestore API error response:', JSON.stringify(errorData, null, 2));
      return 'home'; // Default to home on error
    }

    const data = await response.json();
    console.log('[WORKER] Firestore user data:', JSON.stringify(data, null, 2));
    
    if (data.fields && data.fields.plano) {
      const plano = data.fields.plano.stringValue || 'home';
      console.log('[WORKER] User plano from Firestore:', plano);
      return plano;
    }

    console.log('[WORKER] Plano field not found in Firestore, defaulting to home');
    return 'home'; // Default plano
  } catch (error) {
    console.error('[WORKER] Error getting user plano:', error);
    console.error('[WORKER] Error details:', error.message, error.stack);
    return 'home'; // Default to home on error
  }
}

/**
 * Generate signed streaming token
 * Creates a short-lived token for audio streaming without requiring Firebase auth headers
 */
function generateStreamToken(userId, trackId, env) {
  const timestamp = Date.now();
  const expiresAt = timestamp + 3600000; // 1 hour from now
  
  // Create token payload
  const payload = {
    userId: userId,
    trackId: trackId,
    expiresAt: expiresAt,
    timestamp: timestamp
  };
  
  // Create signature using secret
  const secret = env.STREAM_TOKEN_SECRET || env.FIREBASE_API_KEY;
  const signature = btoa(JSON.stringify(payload) + secret);
  
  // Encode as base64
  const tokenData = btoa(JSON.stringify({
    ...payload,
    sig: signature
  }));
  
  return tokenData;
}

/**
 * Verify signed streaming token
 */
function verifyStreamToken(token, env) {
  try {
    // Decode token
    const tokenData = JSON.parse(atob(token));
    
    // Check expiration
    if (Date.now() > tokenData.expiresAt) {
      console.log('[WORKER] Stream token expired');
      return null;
    }
    
    // Verify signature
    const secret = env.STREAM_TOKEN_SECRET || env.FIREBASE_API_KEY;
    const expectedSignature = btoa(JSON.stringify({
      userId: tokenData.userId,
      trackId: tokenData.trackId,
      expiresAt: tokenData.expiresAt,
      timestamp: tokenData.timestamp
    }) + secret);
    
    if (tokenData.sig !== expectedSignature) {
      console.log('[WORKER] Invalid stream token signature');
      return null;
    }
    
    return {
      userId: tokenData.userId,
      trackId: tokenData.trackId,
      expiresAt: tokenData.expiresAt
    };
  } catch (error) {
    console.error('[WORKER] Error verifying stream token:', error);
    return null;
  }
}

/**
 * Generate track ID
 */
function generateTrackId() {
  return 'track_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Get content type from filename
 */
function getContentTypeFromFilename(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const contentTypes = {
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'flac': 'audio/flac',
    'm4a': 'audio/mp4',
    'aac': 'audio/aac',
    'wma': 'audio/x-ms-wma',
    'aiff': 'audio/aiff'
  };
  return contentTypes[ext] || 'audio/mpeg';
}