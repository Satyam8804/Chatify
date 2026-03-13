import {
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useWebRTC } from "../../hooks/RTCPeerConnection";
import { useSocket } from "../../context/socketContext";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Signal,
  RefreshCcw,
} from "lucide-react";
const VideoCall = forwardRef(({ otherUserId, onEndCall, onConnected }, ref) => {
  const { peerRef, createPeer } = useWebRTC();
  const { socket } = useSocket();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const switchingRef = useRef(false);
  const isCallerRef = useRef(false);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [facingMode, setFacingMode] = useState("user");

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

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  useImperativeHandle(ref, () => ({ cleanup }));

  // ─── Start call (caller side) ────────────────────────
  const startConnection = async () => {
    setIsConnected(false);
    isCallerRef.current = true;
    const peer = createPeer();

    // ⭐ Add ICE state debug here
    peer.oniceconnectionstatechange = () => {
      console.log("ICE state:", peer.iceConnectionState);
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: true,
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      peer.ontrack = (e) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = e.streams[0];
          setIsConnected(true);
          onConnected?.();
        }
      };

      peer.onicecandidate = (e) => {
        if (e.candidate)
          socket.emit("ice-candidate", {
            candidate: e.candidate,
            to: otherUserId,
          });
      };

      peer.onconnectionstatechange = () => {
        if (
          peer.connectionState === "disconnected" ||
          peer.connectionState === "failed" ||
          peer.connectionState === "closed"
        ) {
          onEndCall();
        }
      };
      if (!isCallerRef.current) return;
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit("webrtc-offer", { offer, to: otherUserId });
    } catch (err) {
      console.error("Media error:", err);
    }
  };

  // ─── Auto-start camera on mount ──────────────────────

  useEffect(() => {
    if (!otherUserId) return;
    startConnection();
  }, [otherUserId]);

  // ─── WebRTC socket listeners (receiver side) ─────────
  useEffect(() => {
    if (!socket) return;

    const handleOffer = async ({ offer, from }) => {
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
          onConnected?.();
        }
      };

      peer.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit("ice-candidate", {
            candidate: e.candidate,
            to: from,
          });
        }
      };

      // ✅ FIXED LINE
      await peer.setRemoteDescription(offer);

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      // process queued ICE candidates
      pendingCandidatesRef.current.forEach(async (c) => {
        await peer.addIceCandidate(c);
      });

      pendingCandidatesRef.current = [];

      socket.emit("webrtc-answer", { answer, to: from });
    };

    const handleAnswer = async ({ answer }) => {
      if (!peerRef.current) return;

      await peerRef.current.setRemoteDescription(answer);

      pendingCandidatesRef.current.forEach(async (c) => {
        await peerRef.current.addIceCandidate(c);
      });

      pendingCandidatesRef.current = [];
    };

    const handleIce = async ({ candidate }) => {
      if (!peerRef.current) return;

      if (peerRef.current.remoteDescription) {
        await peerRef.current.addIceCandidate(candidate);
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    };

    socket.on("webrtc-offer", handleOffer);
    socket.on("webrtc-answer", handleAnswer);
    socket.on("ice-candidate", handleIce);

    return () => {
      socket.off("webrtc-offer", handleOffer);
      socket.off("webrtc-answer", handleAnswer);
      socket.off("ice-candidate", handleIce);
    };
  }, [socket]);

  // ─── Controls ────────────────────────────────────────
  const toggleMute = () => {
    if (!localStreamRef.current) return;

    const tracks = localStreamRef.current.getAudioTracks();

    tracks.forEach((track) => {
      track.enabled = !track.enabled;
    });

    setIsMuted(!tracks[0].enabled);
  };

  const toggleVideo = () => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getVideoTracks()[0];
    track.enabled = !track.enabled;
    setIsVideoOff(!track.enabled);
  };

  const switchCamera = async () => {
    if (switchingRef.current) return;
    switchingRef.current = true;

    try {
      const newFacing = facingMode === "user" ? "environment" : "user";
      setFacingMode(newFacing);

      const currentStream = localStreamRef.current;
      const audioTrack = currentStream?.getAudioTracks()[0];

      const oldVideoTrack = currentStream?.getVideoTracks()[0];
      if (oldVideoTrack) oldVideoTrack.stop();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: newFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      // restore microphone track
      if (audioTrack) {
        stream.addTrack(audioTrack);
      }

      if (audioTrack && isMuted) {
        audioTrack.enabled = false;
      }

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const newVideoTrack = stream.getVideoTracks()[0];

      const sender = peerRef.current
        ?.getSenders()
        .find((s) => s.track?.kind === "video");

      if (sender) {
        await sender.replaceTrack(newVideoTrack);
      }
    } catch (err) {
      console.error("Camera switch error:", err);
    } finally {
      switchingRef.current = false;
    }
  };

  const handleEndClick = () => {
    onEndCall();
  };

  // ─── Button classes ───────────────────────────────────
  const idleBtn =
    "flex items-center justify-center w-12 h-12 rounded-full bg-slate-800/90 border border-white/10 text-slate-300 backdrop-blur-sm transition-all duration-200 active:scale-95";

  const warnBtn =
    "flex items-center justify-center w-12 h-12 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 backdrop-blur-sm transition-all duration-200 active:scale-95";

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden">
      {" "}
      {/* ── Remote video ── */}
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
      {/* ── Top bar ── */}
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
      {/* ── PiP local preview ── */}
      <div className="absolute top-14 right-3 z-20 w-24 h-32 sm:w-32 sm:h-44 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className={`w-full h-full object-contain transition-opacity duration-300 ${
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
      {/* ── Controls ── */}
      <div className="absolute bottom-6 left-0 right-0 z-20 flex items-center justify-center gap-4">
        <button onClick={toggleMute} className={isMuted ? warnBtn : idleBtn}>
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        <button
          onClick={toggleVideo}
          className={isVideoOff ? warnBtn : idleBtn}
        >
          {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
        </button>

        <button
          disabled={switchingRef.current}
          onClick={switchCamera}
          className={idleBtn}
        >
          <RefreshCcw size={20} />
        </button>

        <button
          onClick={handleEndClick}
          className="flex items-center justify-center w-14 h-14 rounded-full bg-rose-600 text-white"
        >
          <PhoneOff size={22} />
        </button>
      </div>
    </div>
  );
});

export default VideoCall;
