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

  const str = String(seed); // ✅ ensure string

  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // ✅ force 32-bit int (prevents overflow issues)
  }

  return colors[Math.abs(hash) % colors.length];
};