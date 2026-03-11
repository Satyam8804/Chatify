import { useRef, useState } from "react";
import { FaPlay, FaPause } from "react-icons/fa";

const AudioPlayer = ({ url }) => {
  const audioRef = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const togglePlay = () => {
    const audio = audioRef.current;

    if (playing) audio.pause();
    else audio.play();

    setPlaying(!playing);
  };

  const updateProgress = () => {
    const audio = audioRef.current;

    const percent = (audio.currentTime / audio.duration) * 100;

    setProgress(percent);
    setCurrentTime(audio.currentTime);
  };

  const handleLoaded = () => {
    setDuration(audioRef.current.duration);
  };

  const seek = (e) => {
    const audio = audioRef.current;

    const percent = e.target.value;

    audio.currentTime = (percent / 100) * audio.duration;
    setProgress(percent);
  };

  const formatTime = (t) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-xl w-full">

      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={updateProgress}
        onLoadedMetadata={handleLoaded}
      />

      {/* Play Button */}
      <button
        onClick={togglePlay}
        className="w-8 h-8 flex items-center justify-center bg-blue-500 text-white rounded-full shrink-0"
      >
        {playing ? <FaPause size={12} /> : <FaPlay size={12} />}
      </button>

      {/* Current Time */}
      <span className="text-xs text-gray-600 w-9 text-center">
        {formatTime(currentTime)}
      </span>

      {/* Progress Bar */}
      <input
        type="range"
        min="0"
        max="100"
        value={progress}
        onChange={seek}
        className="flex-1 appearance-none h-[3px] bg-gray-300 rounded-lg cursor-pointer"
        style={{
          background: `linear-gradient(to right, #3b82f6 ${progress}%, #d1d5db ${progress}%)`,
        }}
      />

      {/* Duration */}
      <span className="text-xs text-gray-600 w-9  text-center">
        {formatTime(duration)}
      </span>
    </div>
  );
};

export default AudioPlayer;