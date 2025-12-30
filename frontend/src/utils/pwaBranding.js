// Lightweight PWA branding helper.
//
// Goal: when a user taps "Add to Home Screen", the installed app icon/name
// should use the configured branding (logo_data_url) when available.

const getOrCreateManifestLink = () => {
  if (typeof document === 'undefined') return null;
  let link = document.querySelector("link[rel='manifest']");
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'manifest');
    document.head.appendChild(link);
  }
  return link;
};

const mimeFromDataUrl = (dataUrl) => {
  const m = String(dataUrl || '').match(/^data:([^;,]+)[;,]/i);
  return m?.[1] || null;
};

export const applyPwaBranding = ({
  name,
  shortName,
  logoDataUrl,
  fallbackIconUrl = '/favicon.svg',
} = {}) => {
  if (typeof window === 'undefined') return;

  const link = getOrCreateManifestLink();
  if (!link) return;

  const appName = String(name || shortName || 'WrenchOps');
  const appShort = String(shortName || name || 'WrenchOps');

  const hasLogo = Boolean(logoDataUrl);
  const mime = hasLogo ? mimeFromDataUrl(logoDataUrl) : null;

  // Prefer branding logo for install icons; fall back to local SVG.
  const icons = hasLogo
    ? [
        {
          src: logoDataUrl,
          sizes: '192x192',
          type: mime || 'image/png',
        },
        {
          src: logoDataUrl,
          sizes: '512x512',
          type: mime || 'image/png',
        },
      ]
    : [
        {
          src: fallbackIconUrl,
          sizes: 'any',
          type: 'image/svg+xml',
        },
      ];

  const manifest = {
    name: appName,
    short_name: appShort,
    start_url: '.',
    display: 'standalone',
    theme_color: '#000000',
    background_color: '#ffffff',
    icons,
  };

  try {
    const json = JSON.stringify(manifest);
    const blob = new Blob([json], { type: 'application/manifest+json' });
    const url = URL.createObjectURL(blob);

    // Clean up previous object URL to avoid leaks.
    if (window.__pwaManifestObjectUrl) {
      try {
        URL.revokeObjectURL(window.__pwaManifestObjectUrl);
      } catch {
        // ignore
      }
    }

    window.__pwaManifestObjectUrl = url;
    link.setAttribute('href', url);
  } catch {
    // ignore
  }
};

