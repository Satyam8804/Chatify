import {
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useSocket } from "../../context/socketContext";
import { useAuth } from "../../context/authContext";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Signal,
  RefreshCcw,
} from "lucide-react";

// ── Remote video tile for each peer ──────────────────
const RemoteVideo = ({ stream, name }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="relative flex-1 min-w-0 min-h-0 bg-slate-900 rounded-2xl overflow-hidden border border-white/5">
      <video
        ref={ref}
        autoPlay
        playsInline
        className="w-full h-full object-contain"
      />
      {name && (
        <span className="absolute bottom-2 left-3 text-[10px] text-white/50 font-medium">
          {name}
        </span>
      )}
    </div>
  );
};

// ── Main VideoCall component ──────────────────────────
const VideoCall = forwardRef(
  (
    {
      participants, // [{ userId, name }] — peers to connect to on mount
      chatId, // socket room id
      isGroup,
      onEndCall,
      onConnected,
    },
    ref
  ) => {
    const { socket } = useSocket();
    const { user } = useAuth();

    const localVideoRef = useRef(null);
    const localStreamRef = useRef(null);
    const switchingRef = useRef(false);

    // Map<userId, { peer: RTCPeerConnection, pendingCandidates: [] }>
    const peersRef = useRef(new Map());

    const [remoteStreams, setRemoteStreams] = useState([]); // [{ userId, stream, name }]
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [facingMode, setFacingMode] = useState("user");

    // ── Local stream ──────────────────────────────────
    const getLocalStream = async (facing = "user") => {
      if (localStreamRef.current) return localStreamRef.current;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    };

    // ── Create RTCPeerConnection for one user ─────────
    const createPeerConnection = (userId, userName) => {
      const peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      peer.onicecandidate = (e) => {
        if (e.candidate)
          socket.emit("ice-candidate", { candidate: e.candidate, to: userId });
      };

      peer.ontrack = (e) => {
        const stream = e.streams[0];
        setRemoteStreams((prev) => {
          if (prev.some((s) => s.userId === userId)) return prev;
          return [...prev, { userId, stream, name: userName }];
        });
        onConnected?.();
      };

      peer.onconnectionstatechange = () => {
        if (
          peer.connectionState === "failed" ||
          peer.connectionState === "closed"
        )
          removePeer(userId);
      };

      peer.oniceconnectionstatechange = () => {
        if (peer.iceConnectionState === "failed") peer.restartIce();
      };

      peersRef.current.set(userId, { peer, pendingCandidates: [] });
      return peer;
    };

    const removePeer = (userId) => {
      peersRef.current.get(userId)?.peer.close();
      peersRef.current.delete(userId);
      setRemoteStreams((prev) => prev.filter((s) => s.userId !== userId));
    };

    // ── Send offer to a participant ───────────────────
    const initiateOffer = async (userId, userName) => {
      const stream = await getLocalStream(facingMode);
      const peer = createPeerConnection(userId, userName);
      stream.getTracks().forEach((t) => peer.addTrack(t, stream));
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit("webrtc-offer", { offer, to: userId, fromName: user?.fName });
    };

    // ── On mount: join room + send offers ────────────
    useEffect(() => {
      if (!socket || !chatId) return;
      socket.emit("join-call-room", { roomId: chatId });

      const init = async () => {
        await getLocalStream(facingMode);
        for (const { userId, name } of participants || []) {
          await initiateOffer(userId, name);
        }
      };
      init();
    }, []);

    // ── Socket listeners ──────────────────────────────
    useEffect(() => {
      if (!socket) return;

      // New user joined → WE initiate offer to them
      const handleUserJoined = async ({ userId, name }) => {
        if (peersRef.current.has(userId)) return; // prevent duplicate offers
        await initiateOffer(userId, name);
      };

      // Incoming offer → answer it
      const handleOffer = async ({ offer, from, fromName }) => {
        const stream = await getLocalStream(facingMode);
        const peer = createPeerConnection(from, fromName);
        stream.getTracks().forEach((t) => peer.addTrack(t, stream));

        await peer.setRemoteDescription(offer);

        const entry = peersRef.current.get(from);
        if (entry) {
          for (const c of entry.pendingCandidates)
            await peer.addIceCandidate(c);
          entry.pendingCandidates = [];
        }

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit("webrtc-answer", { answer, to: from });
      };

      // Incoming answer
      const handleAnswer = async ({ answer, from }) => {
        const entry = peersRef.current.get(from);
        if (!entry) return;
        await entry.peer.setRemoteDescription(answer);
        for (const c of entry.pendingCandidates)
          await entry.peer.addIceCandidate(c);
        entry.pendingCandidates = [];
      };

      // ICE candidate
      const handleIce = async ({ candidate, from }) => {
        const entry = peersRef.current.get(from);
        if (!entry) return;
        if (entry.peer.remoteDescription) {
          await entry.peer.addIceCandidate(candidate);
        } else {
          entry.pendingCandidates.push(candidate);
        }
      };

      // User left
      const handleUserLeft = ({ userId }) => removePeer(userId);

      socket.on("user-joined-call", handleUserJoined);
      socket.on("webrtc-offer", handleOffer);
      socket.on("webrtc-answer", handleAnswer);
      socket.on("ice-candidate", handleIce);
      socket.on("user-left-call", handleUserLeft);

      return () => {
        socket.off("user-joined-call", handleUserJoined);
        socket.off("webrtc-offer", handleOffer);
        socket.off("webrtc-answer", handleAnswer);
        socket.off("ice-candidate", handleIce);
        socket.off("user-left-call", handleUserLeft);
      };
    }, [socket]);

    // ── Cleanup ───────────────────────────────────────
    const cleanup = () => {
      if (chatId) socket.emit("leave-call-room", { roomId: chatId });
      peersRef.current.forEach(({ peer }) => peer.close());
      peersRef.current.clear();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      setRemoteStreams([]);
    };

    useEffect(() => () => cleanup(), []);
    useImperativeHandle(ref, () => ({ cleanup }));

    // ── Controls ──────────────────────────────────────
    const toggleMute = () => {
      if (!localStreamRef.current) return;
      const tracks = localStreamRef.current.getAudioTracks();
      tracks.forEach((t) => {
        t.enabled = !t.enabled;
      });
      setIsMuted(!tracks[0]?.enabled);
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
        const audioTrack = localStreamRef.current?.getAudioTracks()[0];
        localStreamRef.current?.getVideoTracks()[0]?.stop();

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: newFacing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (audioTrack) {
          stream.addTrack(audioTrack);
          if (isMuted) audioTrack.enabled = false;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const newVideoTrack = stream.getVideoTracks()[0];

        // ✅ Replace track in ALL peer connections
        peersRef.current.forEach(({ peer }) => {
          const sender = peer
            .getSenders()
            .find((s) => s.track?.kind === "video");
          if (sender) sender.replaceTrack(newVideoTrack);
        });

        setFacingMode(newFacing);
      } catch (err) {
        console.error("Camera switch error:", err);
      } finally {
        switchingRef.current = false;
      }
    };

    // ── Grid layout based on participant count ────────
    const gridClass =
      remoteStreams.length <= 1
        ? "flex"
        : remoteStreams.length <= 4
        ? "grid grid-cols-2"
        : "grid grid-cols-3";

    const idleBtn =
      "flex items-center justify-center w-12 h-12 rounded-full bg-slate-800/90 border border-white/10 text-slate-300 backdrop-blur-sm transition-all duration-200 active:scale-95";
    const warnBtn =
      "flex items-center justify-center w-12 h-12 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 backdrop-blur-sm transition-all duration-200 active:scale-95";

    return (
      <div className="relative w-full h-full bg-slate-950 overflow-hidden flex flex-col">
        {/* ── Remote video grid ── */}
        <div className={`flex-1 ${gridClass} gap-1 p-1 min-h-0`}>
          {remoteStreams.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-full border-2 border-sky-500/20 border-t-sky-400 animate-spin" />
              <p className="text-sm font-medium text-slate-500 tracking-wide">
                Connecting…
              </p>
            </div>
          ) : (
            remoteStreams.map(({ userId, stream, name }) => (
              <RemoteVideo key={userId} stream={stream} name={name} />
            ))
          )}
        </div>

        {/* ── Top bar ── */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-4 pb-8 bg-gradient-to-b from-slate-950/70 to-transparent">
          <div className="flex items-center gap-2 bg-slate-900/70 border border-white/10 rounded-full px-3 py-1.5 backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-semibold tracking-[1.8px] uppercase text-slate-400">
              Live
            </span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900/70 border border-white/10 rounded-full px-3 py-1.5 backdrop-blur-md">
            <span className="text-[10px] text-slate-400">
              {remoteStreams.length + 1} participants
            </span>
          </div>
        </div>

        {/* ── PiP local preview ── */}
        <div className="absolute top-14 right-3 z-20 w-24 h-32 sm:w-32 sm:h-44 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-contain transition-opacity duration-300 ${
              facingMode === "user" ? "scale-x-[-1]" : ""
            } ${isVideoOff ? "opacity-0" : "opacity-100"}`}
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
            onClick={switchCamera}
            disabled={switchingRef.current}
            className={idleBtn}
          >
            <RefreshCcw size={20} />
          </button>
          <button
            onClick={onEndCall}
            className="flex items-center justify-center w-14 h-14 rounded-full bg-rose-600 text-white active:scale-95 transition-all"
          >
            <PhoneOff size={22} />
          </button>
        </div>
      </div>
    );
  }
);

export default VideoCall;
