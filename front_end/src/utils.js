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
