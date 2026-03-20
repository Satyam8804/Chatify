import { getInitials } from "../../utils/getInitials";
import { getAvatarColor } from "../../utils/getAvatarColor";

const Avatar = ({
  user,
  users = [],
  isGroup = false,
  size = 50,
  isOnline = false,
  IsInside = false,
  isSpeaking = false, // ✅ NEW
}) => {
  const color = getAvatarColor(user?._id || user?.fName);

  return (
    <div
      className={`relative inline-block transition-all duration-200 rounded-full ${
        isSpeaking ? "ring-2 ring-emerald-400 animate-pulse" : ""
      }`}
      style={{ width: size, height: size }}
    >
      {/* Avatar Content */}
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
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{getInitials(u?.fName, u?.lName)}</span>
                )}
              </div>
            );
          })}
        </div>
      ) : user?.avatar ? (
        <img
          src={user.avatar}
          alt={user.fName}
          className="w-full h-full rounded-full object-cover brightness-110"
        />
      ) : (
        <div
          className={`w-full h-full rounded-full flex items-center justify-center text-white font-semibold ${
            IsInside ? "text-[12px]" : "text-sm"
          }`}
          style={{ backgroundColor: color }}
        >
          {getInitials(user?.fName, user?.lName)}
        </div>
      )}

      {/* Online Indicator */}
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
