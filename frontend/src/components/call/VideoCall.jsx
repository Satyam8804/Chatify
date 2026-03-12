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

  // ─── Auto-start on mount ─────────────────────────────
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

    // ✅ fix 3: when other user ends the call, close this side too
    socket.on("call-ended", () => {
      cleanup();
      onEndCall();
    });

    return () => {
      socket.off("webrtc-offer");
      socket.off("webrtc-answer");
      socket.off("ice-candidate");
      socket.off("call-ended");
    };
  }, [socket]);

  // ─── Cleanup helper ──────────────────────────────────
  const cleanup = () => {
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
  };

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
    // ✅ fix 3: notify the other user before closing
    socket.emit("call-ended", { to: otherUserId });
    cleanup();
    onEndCall();
  };

  // ─── Button classes ───────────────────────────────────
  const idleBtn =
    "flex items-center justify-center w-12 h-12 rounded-full bg-slate-800/90 border border-white/10 text-slate-300 backdrop-blur-sm transition-all duration-200 active:scale-95";

  const warnBtn =
    "flex items-center justify-center w-12 h-12 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 backdrop-blur-sm transition-all duration-200 active:scale-95";

  return (
    // ✅ fix 1: removed fixed h-[560px], use dynamic height; removed group/hover approach
    <div
      className="relative w-full bg-slate-950 overflow-hidden rounded-b-2xl"
      style={{ height: "min(560px, calc(100dvh - 160px))" }}
    >
      {/* ── Remote video ── */}
      {/* object-contain so portrait mobile video never gets cropped on desktop */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-contain bg-slate-950"
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

      {/* ── Top bar — always visible ── */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-4 pb-8 bg-gradient-to-b from-slate-950/70 to-transparent">
        <div className="flex items-center gap-2 bg-slate-900/70 border border-white/10 rounded-full px-3 py-1.5 backdrop-blur-md">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-semibold tracking-[1.8px] uppercase text-slate-400">
            Live
          </span>
        </div>
        <button className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-900/70 border border-white/10 backdrop-blur-md text-slate-500">
          <Signal size={15} />
        </button>
      </div>

      {/* ── PiP local preview — smaller on mobile ── */}
      {/* ✅ fix 1: responsive sizing with sm: breakpoint */}
      <div className="absolute top-14 right-3 z-20 w-24 h-32 sm:w-32 sm:h-44 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900">
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
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-600">
            <VideoOff size={16} />
            <span className="text-[8px] font-bold uppercase tracking-widest text-slate-700">
              Off
            </span>
          </div>
        )}
        <span className="absolute bottom-1.5 left-0 right-0 text-center text-[9px] text-white/35 font-medium">
          You
        </span>
      </div>

      {/* ── Bottom controls — always visible, not hover-gated ── */}
      {/* ✅ fix 2: removed opacity-0/group-hover, controls always shown */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-3 px-4 pb-6 pt-16 bg-gradient-to-t from-slate-950/90 to-transparent">
        {/* Mic */}
        <button onClick={toggleMute} className={isMuted ? warnBtn : idleBtn}>
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        {/* Camera */}
        <button
          onClick={toggleVideo}
          className={isVideoOff ? warnBtn : idleBtn}
        >
          {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
        </button>

        {/* Divider */}
        <div className="w-px h-7 bg-white/10 mx-1" />

        {/* End call */}
        <button
          onClick={endCall}
          className="flex items-center justify-center w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-95 text-white shadow-[0_8px_24px_rgba(225,29,72,0.4)] transition-all duration-200"
        >
          <PhoneOff size={22} />
        </button>
      </div>
    </div>
  );
};

export default VideoCall;
