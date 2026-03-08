export const formatLastSeen = (dateString) => {

  const lastSeen = new Date(dateString);
  const now = new Date();

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const startOfLastSeen = new Date(
    lastSeen.getFullYear(),
    lastSeen.getMonth(),
    lastSeen.getDate()
  );

  const diffDays =
    (startOfToday - startOfLastSeen) / (1000 * 60 * 60 * 24);

  // format time
  const time = lastSeen.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (diffDays === 0) {
    return `Today at ${time}`;
  }

  if (diffDays === 1) {
    return `Yesterday at ${time}`;
  }

  if (diffDays < 7) {
    const day = lastSeen.toLocaleDateString("en-US", {
      weekday: "long",
    });
    return `${day} at ${time}`;
  }

  return lastSeen.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};
