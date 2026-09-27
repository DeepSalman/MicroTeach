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
