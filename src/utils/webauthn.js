/**
 * Web Authentication API (WebAuthn) helper utilities for BNXmail.
 * Provides conversions between Base64URL and ArrayBuffer/Uint8Array,
 * capability detection, and credential creation/assertion helpers.
 */

export function bufferToBase64url(buffer) {
  if (!buffer) return '';
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function base64urlToBuffer(base64url) {
  if (!base64url) return new Uint8Array(0);
  let base64 = String(base64url).replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Checks whether WebAuthn and a user-verifying platform authenticator
 * (Windows Hello, Touch ID, Face ID, Android Biometrics) are supported.
 */
export async function isBiometricsAvailable() {
  try {
    if (
      typeof window !== 'undefined' &&
      window.PublicKeyCredential &&
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    ) {
      const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return !!available;
    }
  } catch (err) {
    console.warn('WebAuthn platform authenticator check failed:', err);
  }
  return false;
}

/**
 * Prepares registration options received from server for navigator.credentials.create()
 */
export function prepareRegistrationOptions(serverOptions) {
  const options = { ...serverOptions };

  // Convert challenge
  if (typeof options.challenge === 'string') {
    options.challenge = base64urlToBuffer(options.challenge);
  }

  // Convert user.id
  if (options.user && typeof options.user.id === 'string') {
    try {
      options.user.id = base64urlToBuffer(options.user.id);
    } catch {
      options.user.id = new TextEncoder().encode(options.user.id);
    }
  }

  // Explicitly enforce platform authenticator and userVerification: required.
  // Setting residentKey: "discouraged" prevents Chrome from presenting the Google Password Manager passkey dialog
  // and directs the browser directly to the device platform authenticator (Windows Hello, Touch ID, Face ID).
  options.authenticatorSelection = {
    authenticatorAttachment: "platform",
    userVerification: "required",
    residentKey: "discouraged",
    requireResidentKey: false,
    ...(options.authenticatorSelection || {})
  };
  options.authenticatorSelection.authenticatorAttachment = "platform";
  options.authenticatorSelection.userVerification = "required";
  options.authenticatorSelection.residentKey = "discouraged";
  options.authenticatorSelection.requireResidentKey = false;

  // Convert excludeCredentials if present
  if (Array.isArray(options.excludeCredentials)) {
    options.excludeCredentials = options.excludeCredentials.map(cred => ({
      ...cred,
      id: typeof cred.id === 'string' ? base64urlToBuffer(cred.id) : cred.id
    }));
  }

  return options;
}

/**
 * Prepares authentication/login options received from server for navigator.credentials.get()
 */
export function prepareLoginOptions(serverOptions) {
  const options = { ...serverOptions };

  // Convert challenge
  if (typeof options.challenge === 'string') {
    options.challenge = base64urlToBuffer(options.challenge);
  }

  // Enforce required user verification for native fingerprint/biometric prompt
  options.userVerification = "required";

  // Convert allowCredentials if present
  if (Array.isArray(options.allowCredentials)) {
    options.allowCredentials = options.allowCredentials.map(cred => ({
      ...cred,
      id: typeof cred.id === 'string' ? base64urlToBuffer(cred.id) : cred.id
    }));
  }

  return options;
}

/**
 * Serializes the credential created by navigator.credentials.create() into JSON payload
 */
export function serializeRegistrationCredential(credential, deviceName = '') {
  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    deviceName: deviceName || 'Device Authenticator',
    response: {
      clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
      attestationObject: bufferToBase64url(credential.response.attestationObject),
      transports: typeof credential.response.getTransports === 'function'
        ? credential.response.getTransports()
        : []
    }
  };
}

/**
 * Serializes the assertion result from navigator.credentials.get() into JSON payload
 */
export function serializeAuthenticationCredential(credential) {
  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
      authenticatorData: bufferToBase64url(credential.response.authenticatorData),
      signature: bufferToBase64url(credential.response.signature),
      userHandle: credential.response.userHandle ? bufferToBase64url(credential.response.userHandle) : null
    }
  };
}

