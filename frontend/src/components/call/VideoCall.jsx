import {
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
  useMemo,
} from "react";
import { useSocket } from "../../context/socketContext";
import { useAuth } from "../../context/authContext";
import { useWebRTC } from "../../hooks/RTCPeerConnection";
import Avatar from "../common/Avatar";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  RefreshCcw,
  UserPlus,
  X,
} from "lucide-react";

const RemoteVideo = ({ stream, name }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !stream) return;
    if (ref.current.srcObject !== stream) ref.current.srcObject = stream;
    ref.current.play().catch(() => {});
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

const VideoCall = forwardRef(
  ({ chatId, onEndCall, onConnected, chats }, ref) => {
    const { socket } = useSocket();
    const { user } = useAuth();

    const {
      peersRef,
      getOrCreatePeer,
      getPeerEntry,
      setPeerEntry,
      removePeer,
      closeAllPeers,
      replaceVideoTrack,
      replaceAudioTrack,
    } = useWebRTC();

    const localVideoRef = useRef(null);
    const localStreamRef = useRef(null);
    const switchingRef = useRef(false);
    const cleanedUpRef = useRef(false);
    const facingModeRef = useRef("user");
    const isMutedRef = useRef(false);

    const [remoteStreams, setRemoteStreams] = useState([]);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [facingMode, setFacingMode] = useState("user");
    const [showAddParticipant, setShowAddParticipant] = useState(false);
    const [invitedUsers, setInvitedUsers] = useState(new Set());

    useEffect(() => {
      facingModeRef.current = facingMode;
    }, [facingMode]);

    // ─── Local stream ──────────────────────────────────────────────────────────
    const getLocalStream = async (forceNew = false) => {
      if (localStreamRef.current && !forceNew) return localStreamRef.current;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingModeRef.current },
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

    // ─── Add tracks safely ─────────────────────────────────────────────────────
    const addTracksIfNeeded = (peer, stream) => {
      const senders = peer.getSenders();
      stream.getTracks().forEach((track) => {
        const alreadyAdded = senders.some((s) => s.track?.kind === track.kind);
        if (!alreadyAdded) peer.addTrack(track, stream);
      });
    };

    const createPeerConnection = (userId, userName) => {
      const existing = getPeerEntry(userId);
      if (existing?.peer) return existing.peer;

      const polite = String(user._id) > String(userId);
      const peer = getOrCreatePeer(userId, polite);

      if (!peer) {
        console.error("[VideoCall] Failed to create peer for:", userId);
        return null;
      }

      peer.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit("ice-candidate", { candidate: e.candidate, to: userId });
        }
      };

      peer.ontrack = (e) => {
        const incomingStream = e.streams?.[0];
        if (!incomingStream) return;

        setRemoteStreams((prev) => {
          const exists = prev.find((s) => s.userId === userId);

          if (exists) {
            if (exists.stream === incomingStream) return prev;
            return prev.map((s) =>
              s.userId === userId ? { ...s, stream: incomingStream } : s
            );
          }

          return [...prev, { userId, stream: incomingStream, name: userName }];
        });

        onConnected?.();
      };

      peer.onconnectionstatechange = () => {
        if (
          peer.connectionState === "failed" ||
          peer.connectionState === "closed"
        ) {
          handleRemovePeer(userId);
        }
      };

      peer.oniceconnectionstatechange = () => {
        if (peer.iceConnectionState === "failed") {
          peer.restartIce();
        }
      };

      return peer;
    };

    const initiateOffer = async (userId, userName) => {
      const peer = createPeerConnection(userId, userName);
      if (!peer) return; // ✅ guard
      const stream = await getLocalStream();

      const entry = getPeerEntry(userId);
      if (!entry || peer.signalingState !== "stable") return;

      addTracksIfNeeded(peer, stream);

      try {
        entry.makingOffer = true;

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);

        socket.emit("webrtc-offer", {
          offer: peer.localDescription,
          to: userId,
          fromName: user?.fName,
        });
      } catch (err) {
        console.warn("[VideoCall] initiateOffer error:", err);
      } finally {
        entry.makingOffer = false;
      }
    };

    // ─── Init ──────────────────────────────────────────────────────────────────
    useEffect(() => {
      if (!socket || !chatId) return;

      cleanedUpRef.current = false;
      closeAllPeers();
      setRemoteStreams([]);
      setInvitedUsers(new Set());

      localStreamRef.current?.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      localStreamRef.current = null;

      const init = async () => {
        try {
          await getLocalStream();
          socket.emit("join-call-room", { roomId: chatId });
        } catch (err) {
          console.error("[VideoCall] init error:", err);
        }
      };

      init();

      return () => {
        closeAllPeers();
      };
    }, [socket, chatId]);

    // ─── Socket listeners ──────────────────────────────────────────────────────
    useEffect(() => {
      if (!socket) return;

      const handleExistingParticipants = async ({ participants }) => {
        for (const { userId, name } of participants) {
          if (!userId || String(userId) === String(user?._id)) continue;
          await initiateOffer(userId, name);
        }
      };

      const handleUserJoined = async ({ userId, name }) => {
        setInvitedUsers((prev) => {
          const updated = new Set(prev);
          updated.delete(userId);
          return updated;
        });
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
        if (!peer) return;

        let entry = getPeerEntry(from);
        if (!entry) {
          getOrCreatePeer(from);
          entry = getPeerEntry(from);
        }

        const offerCollision =
          entry.makingOffer || peer.signalingState !== "stable";
        if (!entry.polite && offerCollision) return;

        await peer.setRemoteDescription(offer);

        if (entry?.pendingCandidates?.length) {
          for (const candidate of entry.pendingCandidates) {
            try {
              await peer.addIceCandidate(candidate);
            } catch {}
          }
          setPeerEntry(from, { ...entry, pendingCandidates: [] });
        }

        addTracksIfNeeded(peer, stream);

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit("webrtc-answer", {
          answer: peer.localDescription,
          to: from,
        });
      };

      const handleAnswer = async ({ answer, from }) => {
        const entry = getPeerEntry(from);
        if (!entry?.peer) return;
        try {
          if (!entry.peer.currentRemoteDescription) {
            await entry.peer.setRemoteDescription(answer);
          }
        } catch (err) {
          console.warn("Failed to apply answer:", err);
        }
      };

      const handleIce = async ({ candidate, from }) => {
        const entry = getPeerEntry(from);
        if (!entry) {
          setPeerEntry(from, {
            peer: null,
            pendingCandidates: [candidate],
            makingOffer: false,
            polite: true,
          });
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
    }, [socket, user?._id]);

    // ─── Cleanup ───────────────────────────────────────────────────────────────
    const cleanup = () => {
      if (cleanedUpRef.current) return;
      cleanedUpRef.current = true;
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

    // ─── Controls ──────────────────────────────────────────────────────────────
    const toggleMute = () => {
      if (!localStreamRef.current) return;
      const tracks = localStreamRef.current.getAudioTracks();
      tracks.forEach((t) => {
        t.enabled = !t.enabled;
      });
      const muted = !tracks[0]?.enabled;
      isMutedRef.current = muted;
      setIsMuted(muted);
      peersRef.current.forEach(({ peer }) => {
        const sender = peer.getSenders().find((s) => s.track?.kind === "audio");
        if (sender?.track) sender.track.enabled = !muted;
      });
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

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: newFacing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: true,
        });

        const newVideoTrack = stream.getVideoTracks()[0];
        const newAudioTrack = stream.getAudioTracks()[0];
        if (newAudioTrack) newAudioTrack.enabled = !isMutedRef.current;

        localStreamRef.current?.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        replaceVideoTrack(newVideoTrack); // ✅ replace in all peers
        replaceAudioTrack(newAudioTrack); // ✅ replace in all peers

        facingModeRef.current = newFacing;
        setFacingMode(newFacing);
      } catch (err) {
        console.error("Camera switch error:", err);
      } finally {
        switchingRef.current = false;
      }
    };

    // ─── Add participant ───────────────────────────────────────────────────────
    const callChat = useMemo(() => {
      return chats?.find((c) => String(c._id) === String(chatId));
    }, [chats, chatId]);

    const addableUsers = useMemo(() => {
      const alreadyInCall = new Set([
        String(user?._id),
        ...remoteStreams.map((s) => String(s.userId)),
        ...Array.from(invitedUsers),
      ]);

      if (callChat?.isGroupChat) {
        // group — only members of this group not already in call
        return (callChat?.users || []).filter(
          (u) => !alreadyInCall.has(String(u._id))
        );
      } else {
        // 1-to-1 — all unique users across all chats
        const allUsers = new Map();
        (chats || []).forEach((c) => {
          (c.users || []).forEach((u) => {
            if (!alreadyInCall.has(String(u._id)))
              allUsers.set(String(u._id), u);
          });
        });
        return Array.from(allUsers.values());
      }
    }, [callChat, chats, remoteStreams, invitedUsers, user?._id]);

    const handleInvite = (inviteeId) => {
      socket.emit("invite-to-call", { chatId, inviteeIds: [inviteeId] });
      setInvitedUsers((prev) => new Set(prev).add(inviteeId));
      setShowAddParticipant(false);
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
            onClick={() => setShowAddParticipant((p) => !p)}
            className={showAddParticipant ? warnBtn : idleBtn}
          >
            <UserPlus size={20} />
          </button>
          <button
            onClick={onEndCall}
            className="flex items-center justify-center w-14 h-14 rounded-full bg-rose-600 text-white active:scale-95 transition-all"
          >
            <PhoneOff size={22} />
          </button>
        </div>

        {showAddParticipant && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 bg-slate-800 border border-white/10 rounded-2xl p-3 w-56 shadow-2xl">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Add to call
              </span>
              <button
                onClick={() => setShowAddParticipant(false)}
                className="text-slate-500 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto hide-scrollbar space-y-1">
              {addableUsers.length > 0 ? (
                addableUsers.map((u) => (
                  <button
                    key={u._id}
                    onClick={() => handleInvite(u._id)}
                    className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-700 rounded-xl text-sm text-white transition-colors"
                  >
                    <Avatar user={u} size={28} IsInside />
                    <span className="truncate">
                      {u.fName} {u.lName}
                    </span>
                  </button>
                ))
              ) : (
                <div className="text-xs text-slate-400 text-center py-2">
                  No users available
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

export default VideoCall;
