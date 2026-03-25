
export const getDateLabel = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffDays = (startOfToday - startOfDate) / (1000 * 60 * 60 * 24);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();

  return `${dd}/${mm}/${yyyy}`;
};

/**
 * @param {Array}  items      - Array of objects
 * @param {string} dateField  - The key on each item that holds the date string (e.g. "createdAt")
 */

export const groupByDay = (items = [], dateField = "createdAt") => {
  const groups = { today: [], yesterday: [], earlier: [] };

  for (const item of items) {
    const label = getDateLabel(item[dateField]);
    if (label === "Today") groups.today.push(item);
    else if (label === "Yesterday") groups.yesterday.push(item);
    else groups.earlier.push(item);
  }

  return groups;
};