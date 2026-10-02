const relativeLuminance = (hex) => {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(hex));
  if (!match) return 1;
  const value = parseInt(match[1], 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

// Inline style for a colored avatar circle: background = assigned color,
// text color chosen for contrast. Returns undefined when no color is known
// so the element falls back to its CSS default.
export const avatarStyle = (color) => {
  if (!color) return undefined;
  return {
    background: color,
    color: relativeLuminance(color) > 0.28 ? '#1a1a2e' : '#ffffff'
  };
};

export const formatDeadline = (value) => {
  if (!value) return '';
  const match = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/.exec(String(value));
  if (!match) return value;

  const date = new Date(`${match[1]}T${match[2] || '00:00'}`);
  if (Number.isNaN(date.getTime())) return value;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayDiff = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()) - startOfToday) / 86400000
  );
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  if (dayDiff === 0) return `Today, ${time}`;
  if (dayDiff === 1) return `Tomorrow, ${time}`;
  if (dayDiff === -1) return `Yesterday, ${time}`;
  const day = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  return `${day}, ${time}`;
};

export const isValidEmailDomain = (email) => {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  const parts = trimmed.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;

  const domainParts = domain.split('.');
  if (domainParts.length < 2) return false;

  const mainDomain = domainParts[0];

  // Educational / institutional domains
  const isEduDomain = domain.endsWith('.ac.bd') ||
                      domain.endsWith('.edu.bd') ||
                      domain.endsWith('.edu') ||
                      domain.endsWith('.org.bd');

  if (isEduDomain) {
    return mainDomain.length >= 2;
  }

  // Common legitimate email providers
  const allowedGeneralProviders = [
    'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
    'icloud.com', 'live.com', 'msn.com', 'proton.me', 'protonmail.com',
    'aol.com', 'zoho.com', 'yandex.com', 'mail.com'
  ];

  if (allowedGeneralProviders.includes(domain)) {
    return true;
  }

  // Disallow anomaly/throwaway domains with main domain length < 3 (e.g. g.com, he.com)
  const tld = domainParts[domainParts.length - 1];
  if (mainDomain.length >= 3 && tld.length >= 2) {
    return true;
  }

  return false;
};

