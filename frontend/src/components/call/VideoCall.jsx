import { useRef, useEffect, useState } from "react";
import { useWebRTC } from "../../hooks/RTCPeerConnection";
import { useSocket } from "../../context/socketContext";
import { Video, VideoOff, Mic, MicOff, PhoneOff, Signal } from "lucide-react";

const VideoCall = ({ otherUserId, onEndCall }) => {
  const { peerRef, createPeer } = useWebRTC();
  const { socket } = useSocket();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // ─── Start call (caller) ─────────────────────────────
  const startConnection = async () => {
    const peer = createPeer();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      peer.ontrack = (e) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = e.streams[0];
          setIsConnected(true);
        }
      };

      peer.onicecandidate = (e) => {
        if (e.candidate)
          socket.emit("ice-candidate", {
            candidate: e.candidate,
            to: otherUserId,
          });
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit("webrtc-offer", { offer, to: otherUserId });
    } catch (err) {
      console.error("Media error:", err);
    }
  };

  // ─── Auto-start camera on mount (caller side) ────────
  useEffect(() => {
    if (otherUserId) startConnection();
  }, []);

  // ─── Socket listeners ────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    socket.on("webrtc-offer", async ({ offer, from }) => {
      const peer = createPeer();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      peer.ontrack = (e) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = e.streams[0];
          setIsConnected(true);
        }
      };

      peer.onicecandidate = (e) => {
        if (e.candidate)
          socket.emit("ice-candidate", { candidate: e.candidate, to: from });
      };

      await peer.setRemoteDescription(offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit("webrtc-answer", { answer, to: from });
    });

    socket.on("webrtc-answer", async ({ answer }) => {
      if (peerRef.current) await peerRef.current.setRemoteDescription(answer);
    });

    socket.on("ice-candidate", async ({ candidate }) => {
      if (peerRef.current) await peerRef.current.addIceCandidate(candidate);
    });

    return () => {
      socket.off("webrtc-offer");
      socket.off("webrtc-answer");
      socket.off("ice-candidate");
    };
  }, [socket]);

  // ─── Controls ────────────────────────────────────────
  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getAudioTracks()[0];
    track.enabled = !track.enabled;
    setIsMuted(!track.enabled);
  };

  const toggleVideo = () => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getVideoTracks()[0];
    track.enabled = !track.enabled;
    setIsVideoOff(!track.enabled);
  };

  const endCall = () => {
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    onEndCall();
  };

  // ─── Reusable button classes ─────────────────────────
  const idleBtn =
    "flex items-center justify-center w-12 h-12 rounded-full bg-slate-800/80 border border-white/10 text-slate-300 backdrop-blur-sm transition-all duration-200 hover:bg-slate-700/90 hover:scale-110 hover:text-white active:scale-95";

  const warnBtn =
    "flex items-center justify-center w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 backdrop-blur-sm transition-all duration-200 hover:bg-red-500/25 hover:scale-110 active:scale-95";

  return (
    <div className="relative w-full h-[560px] bg-slate-950 overflow-hidden rounded-b-2xl group">
      {/* ── Remote video ── */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* ── Connecting overlay ── */}
      {!isConnected && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-slate-950/90 backdrop-blur-xl">
          <div className="w-12 h-12 rounded-full border-2 border-sky-500/20 border-t-sky-400 animate-spin" />
          <p className="text-sm font-medium text-slate-500 tracking-wide">
            Connecting…
          </p>
        </div>
      )}

      {/* ── Top bar (fades in on hover) ── */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 pt-5 pb-10 bg-gradient-to-b from-slate-950/70 to-transparent opacity-0 -translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0">
        {/* Live badge */}
        <div className="flex items-center gap-2 bg-slate-900/70 border border-white/8 rounded-full px-3 py-1.5 backdrop-blur-md">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.2)] animate-pulse" />
          <span className="text-[10px] font-semibold tracking-[1.8px] uppercase text-slate-400">
            Live
          </span>
        </div>

        {/* Signal icon */}
        <button className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-900/70 border border-white/8 backdrop-blur-md text-slate-500 hover:text-slate-300 transition-colors">
          <Signal size={15} />
        </button>
      </div>

      {/* ── PiP local preview ── */}
      <div className="absolute top-5 right-5 z-20 w-[130px] h-[178px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900 transition-transform duration-200 hover:scale-[1.04] cursor-pointer">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isVideoOff ? "opacity-0" : "opacity-100"
          }`}
        />
        {isVideoOff && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-slate-600">
            <VideoOff size={20} />
            <span className="text-[9px] font-bold uppercase tracking-[2px] text-slate-700">
              Off
            </span>
          </div>
        )}
        <span className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-white/35 font-medium">
          You
        </span>
      </div>

      {/* ── Bottom controls (fades in on hover) ── */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-3 px-6 pb-7 pt-16 bg-gradient-to-t from-slate-950/85 to-transparent opacity-0 translate-y-2 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0">
        {/* Mic */}
        <button
          onClick={toggleMute}
          title={isMuted ? "Unmute" : "Mute"}
          className={isMuted ? warnBtn : idleBtn}
        >
          {isMuted ? <MicOff size={19} /> : <Mic size={19} />}
        </button>

        {/* Camera */}
        <button
          onClick={toggleVideo}
          title={isVideoOff ? "Start video" : "Stop video"}
          className={isVideoOff ? warnBtn : idleBtn}
        >
          {isVideoOff ? <VideoOff size={19} /> : <Video size={19} />}
        </button>

        {/* Divider */}
        <div className="w-px h-7 bg-white/8 mx-1" />

        {/* End call */}
        <button
          onClick={endCall}
          title="End call"
          className="flex items-center justify-center w-13 h-13 w-[52px] h-[52px] rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-[0_8px_24px_rgba(225,29,72,0.38)] hover:shadow-[0_12px_32px_rgba(225,29,72,0.55)] hover:scale-110 hover:rotate-12 active:scale-95 transition-all duration-200"
        >
          <PhoneOff size={21} />
        </button>
      </div>
    </div>
  );
};

export default VideoCall;
