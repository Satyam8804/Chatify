const ChatItemSkeleton = () => {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl">
      
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full shimmer shrink-0" />

      {/* Content */}
      <div className="flex-1">
        <div className="flex justify-between mb-2">
          <div className="h-3 w-28 rounded shimmer" />
          <div className="h-3 w-8 rounded shimmer" />
        </div>

        <div className="h-3 w-40 rounded shimmer" />
      </div>
    </div>
  );
};

export default ChatItemSkeleton;