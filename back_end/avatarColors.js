// Profile avatar colors — drawn from the app palette (front_end/src/global.css).
// Red (primary / danger) is intentionally excluded.
const AVATAR_COLORS = [
  '#86ba90', // secondary green
  '#6ba578', // secondary dark green
  '#3d7a57', // secondary ink green
  '#dfa06e', // accent bronze
  '#c9854f', // accent dark bronze
  '#96602f', // accent ink brown
  '#f0ea8f', // surface strong yellow
  '#1a1a2e'  // ink navy
];

const randomAvatarColor = () =>
  AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

module.exports = { AVATAR_COLORS, randomAvatarColor };
