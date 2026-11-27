const COOKIE_NAME = 'ot_session';
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 天

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) {
        bin += String.fromCharCode(bytes[i]);
    }
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(str) {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
}

export function getAuthSecret(env) {
    return env.AUTH_PASSWORD || env.AUTH_PIN || '';
}

export async function timingSafeVerifyPassword(input, expected) {
    if (typeof input !== 'string' || typeof expected !== 'string' || !expected) {
        return false;
    }
    const [h1, h2] = await Promise.all([
        crypto.subtle.digest('SHA-256', encoder.encode(input)),
        crypto.subtle.digest('SHA-256', encoder.encode(expected)),
    ]);
    const a = new Uint8Array(h1);
    const b = new Uint8Array(h2);
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a[i] ^ b[i];
    }
    return diff === 0;
}

async function getHmacKey(secret) {
    const keyMaterial = await crypto.subtle.digest('SHA-256', encoder.encode(`ot-session-v1:${secret}`));
    return crypto.subtle.importKey(
        'raw',
        keyMaterial,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );
}

export async function createSessionToken(secret, remember) {
    const now = Date.now();
    const payload = {
        iat: now,
        exp: now + SESSION_TTL_SECONDS * 1000,
        rem: Boolean(remember),
    };
    const payloadB64 = toBase64Url(encoder.encode(JSON.stringify(payload)));
    const key = await getHmacKey(secret);
    const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64));
    const sigB64 = toBase64Url(new Uint8Array(sigBuffer));
    return `${payloadB64}.${sigB64}`;
}

export async function verifySessionToken(token, secret) {
    if (!token || !secret || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadB64, sigB64] = parts;
    if (!payloadB64 || !sigB64) return null;

    try {
        const key = await getHmacKey(secret);
        const sigBytes = fromBase64Url(sigB64);
        const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(payloadB64));
        if (!valid) return null;

        const payload = JSON.parse(decoder.decode(fromBase64Url(payloadB64)));
        if (!payload || typeof payload.exp !== 'number' || Date.now() >= payload.exp) {
            return null;
        }
        return {
            iat: payload.iat,
            exp: payload.exp,
            rem: Boolean(payload.rem),
        };
    } catch {
        return null;
    }
}

export function getCookieValue(request, name = COOKIE_NAME) {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) return null;
    const pairs = cookieHeader.split(';');
    for (const pair of pairs) {
        const idx = pair.indexOf('=');
        if (idx === -1) continue;
        const k = pair.slice(0, idx).trim();
        if (k === name) {
            return decodeURIComponent(pair.slice(idx + 1).trim());
        }
    }
    return null;
}

export function buildSessionCookie(request, token, remember) {
    const isHttps = new URL(request.url).protocol === 'https:';
    const attrs = [
        `${COOKIE_NAME}=${encodeURIComponent(token)}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
    ];
    if (isHttps) attrs.push('Secure');
    if (remember) attrs.push(`Max-Age=${SESSION_TTL_SECONDS}`);
    return attrs.join('; ');
}

export function buildClearSessionCookie(request) {
    const isHttps = new URL(request.url).protocol === 'https:';
    const attrs = [
        `${COOKIE_NAME}=`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        'Max-Age=0',
    ];
    if (isHttps) attrs.push('Secure');
    return attrs.join('; ');
}

export function isSameOriginPost(request) {
    const origin = request.headers.get('Origin');
    if (!origin) return true;
    const expectedOrigin = new URL(request.url).origin;
    return origin === expectedOrigin;
}

export async function authenticateRequest(request, env) {
    const secret = getAuthSecret(env);
    if (!secret) return { authenticated: false, session: null, refreshCookie: null };

    const token = getCookieValue(request, COOKIE_NAME);
    const session = await verifySessionToken(token, secret);
    if (!session) return { authenticated: false, session: null, refreshCookie: null };

    let refreshCookie = null;
    if (session.rem) {
        const refreshedToken = await createSessionToken(secret, true);
        refreshCookie = buildSessionCookie(request, refreshedToken, true);
    }

    return { authenticated: true, session, refreshCookie };
}
