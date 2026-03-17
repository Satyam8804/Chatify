import { getInitials } from "../../utils/getInitials";
import { getAvatarColor } from "../../utils/getAvatarColor";

const Avatar = ({
  user,
  users = [],
  isGroup = false,
  size = 40,
  isOnline = false,
  IsInside = false,
}) => {
  const color = getAvatarColor(user?._id || user?.fName);

  return (
    <div
      className="relative inline-block"
      style={{ width: size, height: size }}
    >
      {/* Group Avatar */}
      {isGroup ? (
        <div className="grid grid-cols-2 grid-rows-2 w-full h-full rounded-full overflow-hidden">
          {users.slice(0, 4).map((u) => {
            const bg = getAvatarColor(u?._id || u?.fName);
            return (
              <div
                key={u._id}
                className="flex items-center justify-center text-white text-[10px] font-semibold overflow-hidden"
                style={{ backgroundColor: u?.avatar ? "transparent" : bg }}
              >
                {u?.avatar ? (
                  <img
                    src={u.avatar}
                    alt={u.fName}
                    className="w-full h-full object-cover" // ✅ fill the cell
                  />
                ) : (
                  <span>{getInitials(u?.fName, u?.lName)}</span> // ✅ initials fallback
                )}
              </div>
            );
          })}
        </div>
      ) : user?.avatar ? (
        <img
          src={user.avatar}
          alt={user.fName}
          className="rounded-full object-cover w-full h-full"
        />
      ) : (
        <div
          className={`w-full h-full ${
            IsInside ? "text-[12px]" : ""
          } rounded-full flex items-center justify-center text-white font-semibold`}
          style={{ backgroundColor: color }}
        >
          {getInitials(user?.fName, user?.lName)}
        </div>
      )}

      {/* Online indicator */}
      {!IsInside && !isGroup && (
        <span
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-1 border-white ${
            isOnline ? "bg-green-500" : "bg-gray-400"
          }`}
        />
      )}
    </div>
  );
};

export default Avatar;
