import ChatItemSkeleton from "./ChatItemSkeleton";

const SidebarSkeleton = () => {
  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700">
      {/* Header */}
      <div className="flex justify-between items-center px-5 py-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded shimmer" />
          <div className="h-4 w-24 rounded shimmer" />
        </div>
        <div className="h-8 w-8 rounded-full shimmer" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden px-3 py-3 space-y-4">
        <SidebarSectionSkeleton />
        <SidebarSectionSkeleton />
      </div>

      {/* Bottom */}
      <div className="border-t border-gray-200 dark:border-slate-700 flex">
        {[1, 2].map((i) => (
          <div key={i} className="flex-1 flex flex-col items-center py-2 gap-1">
            <div className="h-5 w-5 rounded shimmer" />
            <div className="h-2 w-10 rounded shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default SidebarSkeleton;

const SidebarSectionSkeleton = () => {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center px-2">
        <div className="h-3 w-24 rounded shimmer" />
        <div className="h-5 w-5 rounded-full shimmer" />
      </div>

      <div className="space-y-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <ChatItemSkeleton key={i} />
        ))}
      </div>
    </div>
  );
};
