import { FiDownload, FiX } from "react-icons/fi";

const ImagePreview = ({ url, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute cursor-pointer top-6 right-6 text-white text-2xl"
      >
        <FiX />
      </button>

      {/* Download Button — only if real image */}
      {url && (
        <a
          href={`${url}?fl_attachment`}
          download
          target="_blank"
          className="absolute cursor-pointer top-6 right-16 text-white text-2xl"
        >
          <FiDownload />
        </a>
      )}

      {/* Image or No Photo */}
      {url ? (
        <img
          src={url}
          alt="preview"
          className="max-h-[90vh] max-w-[90vw] rounded-lg"
        />
      ) : (
        // ✅ no avatar fallback
        <div className="flex flex-col items-center gap-3 text-white">
          <div className="w-32 h-32 rounded-full bg-slate-700 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-16 h-16 text-slate-400"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
            </svg>
          </div>
          <p className="text-slate-300 text-sm">No profile photo</p>
        </div>
      )}
    </div>
  );
};

export default ImagePreview;
