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

      {/* Download Button */}
      <a
        href={`${url}?fl_attachment`}
        download
        target="_blank"
        className="absolute cursor-pointer top-6 right-16 text-white text-2xl"
      >
        <FiDownload />
      </a>

      {/* Image */}
      <img
        src={url}
        alt="preview"
        className="max-h-[90vh] max-w-[90vw] rounded-lg"
      />
    </div>
  );
};

export default ImagePreview;
