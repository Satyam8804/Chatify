const colors = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#22c55e", // green
  "#a855f7", // purple
  "#ec4899", // pink
  "#6366f1", // indigo
  "#eab308", // yellow
  "#14b8a6", // teal
];

export const getAvatarColor = (seed) => {
  if (!seed) return colors[0];

  let hash = 0;

  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
};