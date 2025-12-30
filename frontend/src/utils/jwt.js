// JWT payload decoder that supports base64url (RFC 7515) and UTF-8 payloads.
// Returns the decoded payload object, or null if decoding fails.

export const decodeJwtPayload = (token) => {
  try {
    if (!token) return null;

    const parts = String(token).split('.');
    if (parts.length < 2) return null;

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);

    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(json);
  } catch {
    return null;
  }
};

