import {
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useSocket } from "../../context/socketContext";
import { useAuth } from "../../context/authContext";
import { useWebRTC } from "../../hooks/useWebRTC";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  RefreshCcw,
} from "lucide-react";

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

const VideoCall = forwardRef(({ chatId, onEndCall, onConnected }, ref) => {
  const { socket } = useSocket();
  const { user } = useAuth();

  const {
    getOrCreatePeer,
    getPeerEntry,
    setPeerEntry,
    removePeer,
    closeAllPeers,
    replaceVideoTrack,
  } = useWebRTC();

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const switchingRef = useRef(false);
  const cleanedUpRef = useRef(false); // ✅ prevent double cleanup
  const facingModeRef = useRef("user"); // ✅ always fresh in async handlers

  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [facingMode, setFacingMode] = useState("user");

  // keep facingModeRef in sync
  useEffect(() => {
    facingModeRef.current = facingMode;
  }, [facingMode]);

  const getLocalStream = async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facingModeRef.current }, // ✅ always fresh
      audio: true,
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
  };

  const handleRemovePeer = (userId) => {
    removePeer(userId);
    setRemoteStreams((prev) => prev.filter((s) => s.userId !== userId));
  };

  const createPeerConnection = (userId, userName) => {
    const existing = getPeerEntry(userId);
    if (existing?.peer) return existing.peer;

    const peer = getOrCreatePeer(userId);

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
      if (["failed", "closed", "disconnected"].includes(peer.connectionState)) {
        handleRemovePeer(userId);
      }
    };

    return peer;
  };

  const initiateOffer = async (userId, userName) => {
    if (getPeerEntry(userId)?.peer) return;

    const stream = await getLocalStream();
    const peer = createPeerConnection(userId, userName);

    stream.getTracks().forEach((t) => peer.addTrack(t, stream));

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("webrtc-offer", { offer, to: userId, fromName: user?.fName });
  };

  // init — get local stream + join room
  useEffect(() => {
    if (!socket || !chatId) return;
    socket.emit("join-call-room", { roomId: chatId });
    getLocalStream().catch((err) =>
      console.error("[VideoCall] init error:", err)
    );
  }, [socket, chatId]);

  // socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleExistingParticipants = async ({ participants }) => {
      for (const { userId, name } of participants) {
        if (!userId || String(userId) === String(user?._id)) continue;
        await initiateOffer(userId, name);
      }
    };

    const handleUserJoined = async ({ userId, name }) => {
      try {
        if (!userId || String(userId) === String(user?._id)) return;
        if (getPeerEntry(userId)?.peer) return;
        await initiateOffer(userId, name);
      } catch (err) {
        console.error("[VideoCall] handleUserJoined error:", err);
      }
    };

    const handleOffer = async ({ offer, from, fromName }) => {
      const stream = await getLocalStream();
      const peer = createPeerConnection(from, fromName);

      stream.getTracks().forEach((t) => peer.addTrack(t, stream));
      await peer.setRemoteDescription(offer);

      const entry = getPeerEntry(from);
      if (entry?.pendingCandidates?.length) {
        for (const c of entry.pendingCandidates) {
          try {
            await peer.addIceCandidate(c);
          } catch {}
        }
        setPeerEntry(from, { ...entry, pendingCandidates: [] });
      }

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit("webrtc-answer", { answer, to: from });
    };

    const handleAnswer = async ({ answer, from }) => {
      const entry = getPeerEntry(from);
      if (!entry?.peer) return;

      await entry.peer.setRemoteDescription(answer);

      for (const c of entry.pendingCandidates) {
        try {
          await entry.peer.addIceCandidate(c);
        } catch {}
      }
      setPeerEntry(from, { ...entry, pendingCandidates: [] });
    };

    const handleIce = async ({ candidate, from }) => {
      const entry = getPeerEntry(from);

      if (!entry) {
        setPeerEntry(from, { peer: null, pendingCandidates: [candidate] });
        return;
      }

      if (entry.peer?.remoteDescription) {
        try {
          await entry.peer.addIceCandidate(candidate);
        } catch {}
      } else {
        setPeerEntry(from, {
          ...entry,
          pendingCandidates: [...(entry.pendingCandidates || []), candidate],
        });
      }
    };

    const handleUserLeft = ({ userId }) => handleRemovePeer(userId);

    socket.on("existing-participants", handleExistingParticipants);
    socket.on("user-joined-call", handleUserJoined);
    socket.on("webrtc-offer", handleOffer);
    socket.on("webrtc-answer", handleAnswer);
    socket.on("ice-candidate", handleIce);
    socket.on("user-left-call", handleUserLeft);

    return () => {
      socket.off("existing-participants", handleExistingParticipants);
      socket.off("user-joined-call", handleUserJoined);
      socket.off("webrtc-offer", handleOffer);
      socket.off("webrtc-answer", handleAnswer);
      socket.off("ice-candidate", handleIce);
      socket.off("user-left-call", handleUserLeft);
    };
  }, [socket]);

  // cleanup
  const cleanup = () => {
    if (cleanedUpRef.current) return; // ✅ prevent double cleanup
    cleanedUpRef.current = true;

    if (chatId) socket?.emit("leave-call-room", { roomId: chatId });
    localStreamRef.current?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {}
    });
    closeAllPeers();
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    setRemoteStreams([]);
  };

  useEffect(() => () => cleanup(), []);
  useImperativeHandle(ref, () => ({ cleanup }));

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
      const newFacing =
        facingModeRef.current === "user" ? "environment" : "user";
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

      replaceVideoTrack(stream.getVideoTracks()[0]);
      setFacingMode(newFacing);
    } catch (err) {
      console.error("Camera switch error:", err);
    } finally {
      switchingRef.current = false;
    }
  };

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
});

export default VideoCall;
