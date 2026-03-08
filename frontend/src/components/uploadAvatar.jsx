import { useRef, useState } from "react";

const AvatarUpload = ({ onChange }) => {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    onChange(e);
  };

  return (
    <div className="flex flex-col items-center gap-2 mt-4">
      {/* Avatar circle */}
      <div
        onClick={() => fileRef.current.click()}
        className="w-28 h-28 rounded-full bg-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-300 transition relative overflow-hidden"
      >
        {preview ? (
          <img
            src={preview}
            alt="Avatar preview"
            className="w-full h-full object-cover"
          />
        ) : (
          <AvatarIcon />
        )}
      </div>

      {/* Hidden input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        name="avatar"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Label */}
      <p className="text-sm text-gray-600 text-center">
        Upload avatar <span className="text-gray-400">(optional)</span>
      </p>
    </div>
  );
};

const AvatarIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="w-10 h-10 text-gray-500"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      d="M3 7h3l2-3h8l2 3h3v11a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
    />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);


export default AvatarUpload;
