/**
 * Cloudflare Worker for W.Tracks R2 Integration
 * Handles secure R2 operations with Firebase Auth validation
 * 
 * Environment variables (secrets):
 * - FIREBASE_PROJECT_ID: Firebase project ID
 * - R2_ACCOUNT_ID: Cloudflare account ID for presigned URLs
 * - R2_ACCESS_KEY_ID: R2 API access key ID for presigned URLs
 * - R2_SECRET_ACCESS_KEY: R2 API secret access key for presigned URLs
 * 
 * Bindings (in wrangler.toml):
 * - R2 bucket binding named "R2"
 */

// Import aws4fetch for presigned URL generation
import { AwsClient } from "aws4fetch";

// Cache for Firebase public keys (global to persist across requests)
let firebasePublicKeys = null;
let firebaseKeysCacheTime = null;
let KEYS_CACHE_TTL = 3600000; // 1 hour default, will respect Cache-Control

/**
 * Fetch Firebase public keys with caching
 * Uses JWK format which is natively supported by Web Crypto API
 * @param {string} kid - Optional: if provided and not in cache, force refresh
 * @param {boolean} forceRefresh - Optional: force cache refresh regardless of TTL
 */
async function getFirebasePublicKeys(kid = null, forceRefresh = false) {
  const now = Date.now();
  
  // Check if we have cached keys that are still valid
  if (firebasePublicKeys && firebaseKeysCacheTime && !forceRefresh) {
    const cacheAge = now - firebaseKeysCacheTime;
    if (cacheAge < KEYS_CACHE_TTL) {
      // If kid is provided, check if it exists in cached keys
      if (kid) {
        const kidExists = firebasePublicKeys.keys && firebasePublicKeys.keys.some(key => key.kid === kid);
        if (kidExists) {
          console.log('[WORKER] Using cached Firebase public keys, age:', cacheAge, 'ms, kid found:', kid);
          return firebasePublicKeys;
        } else {
          console.log('[WORKER] Kid not found in cache, forcing refresh:', kid);
          console.log('[WORKER] Cached kids:', firebasePublicKeys.keys.map(k => k.kid));
          // Force refresh by setting forceRefresh to true
          forceRefresh = true;
        }
      } else {
        console.log('[WORKER] Using cached Firebase public keys, age:', cacheAge, 'ms');
        return firebasePublicKeys;
      }
    }
  }

  console.log('[WORKER] Fetching Firebase public keys from Google (JWK format)');
  
  try {
    // Use Firebase Auth's official JWK endpoint for ID tokens
    // This endpoint returns the public keys used to sign Firebase ID tokens
    // Firebase ID tokens are signed by securetoken@system.gserviceaccount.com
    const response = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Firebase public keys: ${response.status}`);
    }

    const keys = await response.json();
    
    // Respect Cache-Control header from Google
    const cacheControl = response.headers.get('Cache-Control');
    if (cacheControl) {
      const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
      if (maxAgeMatch) {
        const maxAge = parseInt(maxAgeMatch[1]) * 1000; // Convert to milliseconds
        // Update cache TTL based on server's recommendation
        if (maxAge > 0) {
          KEYS_CACHE_TTL = maxAge;
        }
      }
    }

    firebasePublicKeys = keys;
    firebaseKeysCacheTime = now;
    
    console.log('[WORKER] Firebase public keys cached (JWK), TTL:', KEYS_CACHE_TTL, 'ms');
    console.log('[WORKER] Available keys after refresh:', keys.keys.length);
    
    if (kid) {
      const kidExists = keys.keys.some(key => key.kid === kid);
      console.log('[WORKER] Kid found after refresh:', kidExists, 'for kid:', kid);
    }
    
    return keys;
  } catch (error) {
    console.error('[WORKER] Error fetching Firebase public keys:', error);
    throw error;
  }
}

/**
 * Base64 URL decode
 */
function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return atob(str);
}

/**
 * Convert base64url string to Uint8Array
 * Used for JWT signature and other base64url-encoded data
 */
function base64UrlToUint8Array(base64Url) {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

/**
 * Parse JWT without verification (for header and payload)
 */
function parseJWT(token) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const header = JSON.parse(base64UrlDecode(parts[0]));
  const payload = JSON.parse(base64UrlDecode(parts[1]));
  
  return { header, payload, signature: parts[2], parts };
}

/**
 * Verify Firebase ID Token signature using Web Crypto API
 * Uses JWK format which is natively supported
 */
async function verifyJWTSignature(token, jwkKey, header, signature) {
  const parts = token.split('.');
  
  // Reconstruct the signing input
  const signingInput = `${parts[0]}.${parts[1]}`;
  
  console.log('[WORKER] Importing public key from JWK');
  console.log('[WORKER] JWK kid:', jwkKey.kid);
  console.log('[WORKER] JWK alg:', jwkKey.alg);
  
  // Import the JWK key - Web Crypto API natively supports JWK format
  const publicKeyData = await crypto.subtle.importKey(
    'jwk',
    jwkKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  
  console.log('[WORKER] Public key import successful (JWK)');
  
  // Verify the signature
  const signatureBuffer = base64UrlToUint8Array(signature);
  const signingInputBuffer = new TextEncoder().encode(signingInput);
  
  console.log('[WORKER] Signature buffer length:', signatureBuffer.length);
  console.log('[WORKER] Signing input buffer length:', signingInputBuffer.length);
  
  const isValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKeyData,
    signatureBuffer,
    signingInputBuffer
  );
  
  console.log('[WORKER] Signature verification result:', isValid);
  
  return isValid;
}

/**
 * Verify Firebase ID Token
 * Validates signature, issuer, audience, expiration, and all required claims
 */
async function verifyFirebaseToken(token, env) {
  try {
    console.log('[WORKER] Verifying Firebase ID Token');
    console.log('[WORKER] FIREBASE_PROJECT_ID:', env.FIREBASE_PROJECT_ID);
    
    // Parse JWT
    const { header, payload, signature } = parseJWT(token);
    
    console.log('[WORKER] JWT header alg:', header.alg);
    console.log('[WORKER] JWT header kid:', header.kid);
    console.log('[WORKER] JWT signature present:', !!signature);
    
    // Validate header
    if (header.alg !== 'RS256') {
      console.error('[WORKER] Invalid algorithm:', header.alg);
      return null;
    }
    
    if (!header.kid) {
      console.error('[WORKER] Missing kid in header');
      return null;
    }
    
    // Fetch Firebase public keys (JWK format)
    // Pass kid to check if it exists in cache, force refresh if not
    let publicKeys = await getFirebasePublicKeys(header.kid, false);
    
    console.log('[WORKER] Public keys fetched (JWK), available keys:', publicKeys.keys.length);
    
    // Get the public key corresponding to the kid from the JWK array
    let jwkKey = publicKeys.keys.find(key => key.kid === header.kid);
    
    // If kid not found even after refresh, fail
    if (!jwkKey) {
      console.error('[WORKER] Public key not found for kid:', header.kid);
      console.error('[WORKER] Available kids:', publicKeys.keys.map(k => k.kid));
      return null;
    }
    
    console.log('[WORKER] Public key found for kid:', header.kid);
    console.log('[WORKER] JWK key type:', jwkKey.kty);
    console.log('[WORKER] JWK algorithm:', jwkKey.alg);
    
    // Verify signature using JWK
    const isSignatureValid = await verifyJWTSignature(token, jwkKey, header, signature);
    
    if (!isSignatureValid) {
      console.error('[WORKER] Invalid signature');
      return null;
    }
    
    console.log('[WORKER] Signature valid');
    
    // Validate expiration
    const now = Math.floor(Date.now() / 1000);
    console.log('[WORKER] Current time:', now);
    console.log('[WORKER] Token exp:', payload.exp);
    
    if (payload.exp && payload.exp < now) {
      console.error('[WORKER] Token expired:', payload.exp, '<', now);
      return null;
    }
    
    console.log('[WORKER] Token exp valid');
    
    // Validate issued at
    console.log('[WORKER] Token iat:', payload.iat);
    
    if (payload.iat && payload.iat > now) {
      console.error('[WORKER] Token issued in the future:', payload.iat, '>', now);
      return null;
    }
    
    console.log('[WORKER] Token iat valid');
    
    // Validate audience
    console.log('[WORKER] Token aud:', payload.aud);
    console.log('[WORKER] Expected aud:', env.FIREBASE_PROJECT_ID);
    
    if (payload.aud !== env.FIREBASE_PROJECT_ID) {
      console.error('[WORKER] Invalid audience:', payload.aud, '!=', env.FIREBASE_PROJECT_ID);
      return null;
    }
    
    console.log('[WORKER] Token aud valid');
    
    // Validate issuer
    const expectedIssuer = `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`;
    console.log('[WORKER] Token iss:', payload.iss);
    console.log('[WORKER] Expected iss:', expectedIssuer);
    
    if (payload.iss !== expectedIssuer) {
      console.error('[WORKER] Invalid issuer:', payload.iss, '!=', expectedIssuer);
      return null;
    }
    
    console.log('[WORKER] Token iss valid');
    
    // Validate subject (uid)
    console.log('[WORKER] Token sub:', payload.sub);
    
    if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length === 0) {
      console.error('[WORKER] Invalid or missing subject');
      return null;
    }
    
    console.log('[WORKER] Token sub valid');
    
    // All validations passed
    console.log('[WORKER] Token validated successfully for uid:', payload.sub);
    return payload.sub;
  } catch (error) {
    console.error('[WORKER] Token verification error:', error);
    return null;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const origin = request.headers.get('Origin');

    // Define allowed origins
    const allowedOrigins = [
      'http://localhost:3000',
      'https://localhost:3000',
      // Add production domains here when deployed
    ];

    // Determine if origin is allowed
    let allowedOrigin = '*';
    if (origin) {
      if (allowedOrigins.includes(origin)) {
        allowedOrigin = origin;
      } else {
        // In production, you might want to check if origin matches your actual domain
        // For now, allow the origin if it's in the list, otherwise deny
        console.log('[WORKER] Origin not in allowed list:', origin);
      }
    }

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Extract and verify Firebase Auth token
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const token = authHeader.substring(7);
      const userId = await verifyFirebaseToken(token, env);

      if (!userId) {
        return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('[WORKER] Token validated for user:', userId);

      // Route handlers
      if (path === '/upload' && request.method === 'POST') {
        return handleUpload(request, env, userId, corsHeaders);
      } else if (path === '/presigned-url' && request.method === 'POST') {
        return handlePresignedUrl(request, env, userId, corsHeaders);
      } else if (path === '/download' && request.method === 'GET') {
        return handleDownload(request, env, userId, corsHeaders);
      } else if (path === '/delete' && request.method === 'DELETE') {
        return handleDelete(request, env, userId, corsHeaders);
      } else if (path === '/metadata' && request.method === 'GET') {
        return handleMetadata(request, env, userId, corsHeaders);
      } else if (path === '/health' && request.method === 'GET') {
        return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } catch (error) {
      console.error('[WORKER] Error:', error);
      return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * Sanitize filename for R2 key
 * Replaces any character outside a-zA-Z0-9._- with underscore
 * This must match the sanitization done in r2storage.js
 */
function sanitizeFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Build expected R2 key path from authenticated userId and project/track parameters
 * This prevents the client from providing a crafted r2Key with a different userId
 */
function buildR2Key(userId, projectId, trackId, fileName) {
  return `users/${userId}/projects/${projectId}/tracks/${trackId}/${sanitizeFileName(fileName)}`;
}

/**
 * Validate that the provided r2Key matches the expected path
 * The expected path is built from the authenticated userId and provided parameters
 */
function validateR2Key(userId, projectId, trackId, fileName, providedR2Key) {
  try {
    // Build the expected key
    const expectedKey = buildR2Key(userId, projectId, trackId, fileName);
    
    // Compare with the provided key
    if (providedR2Key !== expectedKey) {
      console.error('[WORKER] R2 key mismatch:', providedR2Key, '!=', expectedKey);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[WORKER] Error validating r2Key:', error);
    return false;
  }
}

/**
 * Validate R2 key format and extract userId for comparison
 * This is used for download/delete/metadata where only r2Key is provided
 */
function validateR2KeyForAccess(userId, r2Key) {
  try {
    // Extract userId from r2Key
    // Format: users/{userId}/projects/{projectId}/tracks/{trackId}/{fileName}
    const keyParts = r2Key.split('/');
    
    if (keyParts.length < 4) {
      console.error('[WORKER] Invalid r2Key format:', r2Key);
      return false;
    }

    const keyUserId = keyParts[1]; // users/{userId}
    
    // Verify the userId in the key matches the authenticated userId
    if (keyUserId !== userId) {
      console.error('[WORKER] User ID mismatch in r2Key:', keyUserId, 'vs', userId);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[WORKER] Error validating r2Key access:', error);
    return false;
  }
}

/**
 * Handle presigned URL generation for direct R2 upload
 * Uses aws4fetch to generate AWS Signature Version 4 signed URLs
 */
async function handlePresignedUrl(request, env, userId, corsHeaders) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get('projectId');
    const trackId = url.searchParams.get('trackId');
    const fileName = url.searchParams.get('fileName');
    const contentType = url.searchParams.get('contentType');

    if (!projectId || !trackId || !fileName || !contentType) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Build R2 key
    const r2Key = buildR2Key(userId, projectId, trackId, fileName);

    console.log('[WORKER] Generating presigned URL for:', r2Key);
    console.log('[WORKER] Content-Type:', contentType);

    // Check if R2 credentials are available
    if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
      console.error('[WORKER] Missing R2 credentials for presigned URL generation');
      return new Response(JSON.stringify({ error: 'R2 credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create AWS client for R2
    const client = new AwsClient({
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      service: 's3',
      region: 'auto'
    });

    // Build R2 endpoint URL
    const r2Url = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const objectUrl = `${r2Url}/wtracks-audio/${r2Key}?X-Amz-Expires=3600`;

    console.log('[WORKER] Object URL:', objectUrl);

    // Sign the request for PUT
    const signedRequest = await client.sign(
      new Request(objectUrl, {
        method: 'PUT'
      }),
      {
        aws: { signQuery: true }
      }
    );

    const presignedUrl = signedRequest.url.toString();

    console.log('[WORKER] Presigned URL generated successfully');
    console.log('[WORKER] Presigned URL length:', presignedUrl.length);

    return new Response(JSON.stringify({
      presignedUrl: presignedUrl,
      r2Key: r2Key
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[WORKER] Presigned URL error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle track upload
 */
async function handleUpload(request, env, userId, corsHeaders) {
  try {
    const formData = await request.formData();
    const file = formData.get('audioFile');
    const projectId = formData.get('projectId');
    const trackId = formData.get('trackId');
    const fileName = formData.get('fileName');
    const r2Key = formData.get('r2Key');

    // Validate request
    if (!file || !projectId || !trackId || !fileName || !r2Key) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate R2 key by building expected path and comparing
    if (!validateR2Key(userId, projectId, trackId, fileName, r2Key)) {
      return new Response(JSON.stringify({ error: 'Access denied to R2 object' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if object already exists to increment version
    let newVersion = 1;
    const existingObject = await env.R2.head(r2Key);
    
    if (existingObject) {
      // Extract current version from custom metadata
      const currentVersion = existingObject.customMetadata?.version 
        ? parseInt(existingObject.customMetadata.version) 
        : 1;
      newVersion = currentVersion + 1;
      console.log('[WORKER] Incrementing version:', currentVersion, '->', newVersion);
    }

    // Upload to R2 with custom metadata containing version
    const customMetadata = {
      version: newVersion.toString(),
      uploadedAt: new Date().toISOString(),
      userId: userId,
      projectId: projectId,
      trackId: trackId
    };

    await env.R2.put(r2Key, file, {
      customMetadata: customMetadata
    });

    // Get metadata to confirm
    const object = await env.R2.head(r2Key);

    const result = {
      r2Key: r2Key,
      version: newVersion,
      size: object.size,
      uploadedAt: object.uploaded ? object.uploaded.toISOString() : new Date().toISOString()
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[WORKER] Upload error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle track download
 */
async function handleDownload(request, env, userId, corsHeaders) {
  try {
    const url = new URL(request.url);
    const r2Key = url.searchParams.get('key');

    if (!r2Key) {
      return new Response(JSON.stringify({ error: 'Missing r2Key parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate R2 key access
    if (!validateR2KeyForAccess(userId, r2Key)) {
      return new Response(JSON.stringify({ error: 'Access denied to R2 object' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get object from R2
    const object = await env.R2.get(r2Key);

    if (!object) {
      return new Response(JSON.stringify({ error: 'Track not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Stream the file
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    
    // Add CORS headers to download response
    headers.set('Access-Control-Allow-Origin', corsHeaders['Access-Control-Allow-Origin']);
    headers.set('Access-Control-Allow-Methods', corsHeaders['Access-Control-Allow-Methods']);
    headers.set('Access-Control-Allow-Headers', corsHeaders['Access-Control-Allow-Headers']);

    return new Response(object.body, {
      headers
    });
  } catch (error) {
    console.error('[WORKER] Download error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle track deletion
 */
async function handleDelete(request, env, userId, corsHeaders) {
  try {
    const url = new URL(request.url);
    const r2Key = url.searchParams.get('key');

    if (!r2Key) {
      return new Response(JSON.stringify({ error: 'Missing r2Key parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate R2 key access
    if (!validateR2KeyForAccess(userId, r2Key)) {
      return new Response(JSON.stringify({ error: 'Access denied to R2 object' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Delete from R2
    await env.R2.delete(r2Key);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[WORKER] Delete error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle track metadata
 */
async function handleMetadata(request, env, userId, corsHeaders) {
  try {
    const url = new URL(request.url);
    const r2Key = url.searchParams.get('key');

    if (!r2Key) {
      return new Response(JSON.stringify({ error: 'Missing r2Key parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate R2 key access
    if (!validateR2KeyForAccess(userId, r2Key)) {
      return new Response(JSON.stringify({ error: 'Access denied to R2 object' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get object metadata from R2
    const object = await env.R2.head(r2Key);

    if (!object) {
      return new Response(JSON.stringify({ error: 'Track not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract version from custom metadata
    const version = object.customMetadata?.version 
      ? parseInt(object.customMetadata.version) 
      : 1;

    const metadata = {
      r2Key: r2Key,
      version: version,
      size: object.size,
      uploadedAt: object.uploaded ? object.uploaded.toISOString() : (object.customMetadata?.uploadedAt || new Date().toISOString()),
      contentType: object.httpMetadata?.contentType || 'audio/wav'
    };

    return new Response(JSON.stringify(metadata), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[WORKER] Metadata error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
