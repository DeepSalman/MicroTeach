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

const parseDeadlineTime = (value) => {
  if (!value) return { hours: 23, minutes: 59 };
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(value.trim());
  if (!match) return { hours: 23, minutes: 59 };

  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'AM' && hours === 12) hours = 0;
  if (meridiem === 'PM' && hours < 12) hours += 12;
  return { hours, minutes };
};

export const parseDeadline = (value) => {
  if (!value) return null;
  const deadline = String(value).trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(deadline);
  if (isoMatch) {
    return new Date(
      Number(isoMatch[1]),
      Number(isoMatch[2]) - 1,
      Number(isoMatch[3]),
      Number(isoMatch[4] || 23),
      Number(isoMatch[5] || 59)
    );
  }

  const relativeMatch = /^(today|tomorrow)(?:\s+at\s+(.+))?$/i.exec(deadline);
  if (relativeMatch) {
    const date = new Date();
    if (relativeMatch[1].toLowerCase() === 'tomorrow') date.setDate(date.getDate() + 1);
    const { hours, minutes } = parseDeadlineTime(relativeMatch[2]);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
  }

  const weekdayMatch = /^(?:this\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)(?:\s+at\s+(.+))?$/i.exec(deadline);
  if (weekdayMatch) {
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const date = new Date();
    const targetDay = weekdays.indexOf(weekdayMatch[1].toLowerCase());
    date.setDate(date.getDate() + ((targetDay - date.getDay() + 7) % 7));
    const { hours, minutes } = parseDeadlineTime(weekdayMatch[2]);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
  }

  return null;
};

export const formatTimeRemaining = (deadline, now = Date.now()) => {
  const target = parseDeadline(deadline);
  if (!target) return '';

  const remaining = target.getTime() - now;
  if (remaining <= 0) return 'Overdue';

  const totalMinutes = Math.floor(remaining / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
};
