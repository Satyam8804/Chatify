export const SingleTick = ({ size = 16, color = "gray", className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    className={className}
  >
    <polyline
      points="2,8 6,12 14,4"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const DoubleTick = ({
  size = 16,
  color = "#34d399",
  className = "",
}) => (
  <svg
    width={size + 6}
    height={size}
    viewBox="0 0 22 16"
    fill="none"
    className={className}
  >
    <polyline
      points="1,8 5,12 13,4"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <polyline
      points="7,8 11,12 19,4"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
