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

// ─────────────────────────────────────────────
// Remote Video Component
// ─────────────────────────────────────────────
const RemoteVideo = ({ stream, name }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !stream) return;

    if (ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
    }

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

// ─────────────────────────────────────────────
// Video Call Component
// ─────────────────────────────────────────────
const VideoCall = forwardRef(
  ({ chatId, onEndCall, onConnected, chats, selectedChat }, ref) => {
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

    const getLocalStream = async (forceNew = false) => {
      if (localStreamRef.current && !forceNew) return localStreamRef.current;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingModeRef.current },
        audio: true,
      });

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      return stream;
    };

    const handleRemovePeer = (userId) => {
      removePeer(userId);

      setRemoteStreams((prev) => prev.filter((s) => s.userId !== userId));
    };

    const createPeerConnection = (userId, userName) => {
      const existing = getPeerEntry(userId);
      if (existing?.peer) return existing.peer;

      const entry = getPeerEntry(userId);
      const peer = getOrCreatePeer(userId);

      peer.onicegatheringstatechange = () => {
        console.log("ICE gathering:", peer.iceGatheringState);
      };

      peer.onicecandidateerror = (e) => {
        console.warn("ICE candidate error:", e);
      };

      
      if (entry?.pendingCandidates?.length) {
        entry.pendingCandidates.forEach(async (candidate) => {
          try {
            await peer.addIceCandidate(candidate);
          } catch (err) {
            console.warn("Failed to add pending ICE", err);
          }
        });

        entry.pendingCandidates = [];
      }

      // ✅ Send ICE candidates to remote peer
      peer.onicecandidate = (e) => {
        if (!e.candidate) return;

        socket.emit("ice-candidate", {
          candidate: e.candidate,
          to: userId,
        });
      };

      // ✅ Receive remote track
      peer.ontrack = (e) => {
        console.log("REMOTE TRACK:", userId, e.track.kind);

        setRemoteStreams((prev) => {
          let entry = prev.find((s) => s.userId === userId);

          if (!entry) {
            entry = {
              userId,
              name: userName,
              stream: new MediaStream(),
            };
            prev = [...prev, entry];
          }

          entry.stream.addTrack(e.track);

          return [...prev];
        });

        onConnected?.();
      };

      // ✅ ICE connection monitoring
      peer.oniceconnectionstatechange = () => {
        console.log("ICE state:", peer.iceConnectionState);

        if (peer.iceConnectionState === "failed") {
          peer.restartIce();
        }
      };

      // ✅ Peer connection monitoring
      peer.onconnectionstatechange = () => {
        console.log("Peer state:", peer.connectionState);

        if (peer.connectionState === "failed") {
          handleRemovePeer(userId);
        }

        // optional: cleanup when call truly ends
        if (peer.connectionState === "closed") {
          handleRemovePeer(userId);
        }
      };

      return peer;
    };

    const addTracksIfNeeded = (peer, stream) => {
      const senders = peer.getSenders();

      stream.getTracks().forEach((track) => {
        const alreadyAdded = senders.some(
          (s) => s.track && s.track.kind === track.kind
        );

        if (!alreadyAdded) peer.addTrack(track, stream);
      });
    };

    const initiateOffer = async (userId, userName) => {
      const stream = await getLocalStream();

      const peer = createPeerConnection(userId, userName);

      const entry = getPeerEntry(userId);
      if (!entry) return;

      if (peer.signalingState !== "stable") return;

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

        entry.makingOffer = false;
      } catch (err) {
        console.warn("[VideoCall] initiateOffer error:", err);
        entry.makingOffer = false;
      }
    };

    useEffect(() => {
      if (!socket || !chatId) return;

      // reset call lifecycle state
      cleanedUpRef.current = false;

      // clear previous call state
      closeAllPeers();
      setRemoteStreams([]);
      setInvitedUsers(new Set());

      // stop any previous local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
        localStreamRef.current = null;
      }

      const init = async () => {
        try {
          const stream = await getLocalStream();
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }

          socket.emit("join-call-room", { roomId: chatId });
        } catch (err) {
          console.error("[VideoCall] init error:", err);
        }
      };

      init();

      return () => {
        socket.emit("leave-call-room", { roomId: chatId });

        // cleanup peers when leaving room
        closeAllPeers();
      };
    }, [socket, chatId]);

    useEffect(() => {
      if (!socket) return;

      const handleExistingParticipants = async ({ participants }) => {
        for (const { userId, name } of participants) {
          if (!userId || String(userId) === String(user?._id)) continue;
          await initiateOffer(userId, name);
        }
      };

      const handleUserJoined = async ({ userId, name }) => {
        // remove from invited list because they joined
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

        let entry = getPeerEntry(from);
        if (!entry) {
          getOrCreatePeer(from);
          entry = getPeerEntry(from);
        }

        const offerCollision =
          entry.makingOffer || peer.signalingState !== "stable";

        const ignoreOffer = !entry.polite && offerCollision;

        if (ignoreOffer) return;

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

        const peer = entry.peer;

        // ✅ Debug log to inspect signaling state when answer arrives
        console.log(
          "Answer received from:",
          from,
          "state:",
          peer.signalingState
        );

        try {
          // apply answer only if remote description not already set
          if (!peer.currentRemoteDescription) {
            await peer.setRemoteDescription(answer);
          }
        } catch (err) {
          console.warn("Failed to apply answer", err);
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

    const cleanup = () => {
      if (cleanedUpRef.current) return;

      cleanedUpRef.current = true;

      if (chatId) socket?.emit("leave-call-room", { roomId: chatId });

      localStreamRef.current?.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });

      closeAllPeers();

      localStreamRef.current = null;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }

      setRemoteStreams([]);
      setInvitedUsers(new Set());
    };

    useEffect(() => () => cleanup(), []);

    useImperativeHandle(ref, () => ({ cleanup }));

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
          audio: false,
        });

        const newVideoTrack = stream.getVideoTracks()[0];

        if (!newVideoTrack) return;

        // replace track in peer connections
        replaceVideoTrack(newVideoTrack);

        // stop old track
        const oldTrack = localStreamRef.current?.getVideoTracks()[0];
        oldTrack?.stop();

        // update local stream
        const newStream = new MediaStream([
          newVideoTrack,
          ...(localStreamRef.current?.getAudioTracks() || []),
        ]);

        localStreamRef.current = newStream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = newStream;
        }

        facingModeRef.current = newFacing;
        setFacingMode(newFacing);
      } catch (err) {
        console.error("Camera switch error:", err);
      } finally {
        switchingRef.current = false;
      }
    };

    const usersWithoutMe = useMemo(() => {
      return Array.from(
        new Map(
          (chats ?? []).flatMap((c) => c?.users ?? []).map((u) => [u._id, u])
        ).values()
      ).filter((u) => String(u._id) !== String(user?._id));
    }, [chats, user]);

    const callChat = useMemo(() => {
      return chats?.find((c) => String(c._id) === String(chatId));
    }, [chats, chatId]);

    const sourceUsers = callChat?.isGroupChat
      ? callChat?.users
      : usersWithoutMe;

    const addableUsers = sourceUsers.filter((u) => {
      const uid = String(u._id);

      return (
        uid !== String(user?._id) &&
        !peersRef.current.has(uid) &&
        !invitedUsers.has(uid)
      );
    });

    const handleInvite = (inviteeId) => {
      socket.emit("invite-to-call", {
        chatId,
        inviteeIds: [inviteeId],
      });

      setInvitedUsers((prev) => new Set(prev).add(inviteeId));

      setShowAddParticipant(false);
    };

    console.log("chat", selectedChat);
    console.log("chat users", selectedChat?.users);
    console.log("addableUsers", addableUsers);

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

    console.log(
      "addableUsers",
      addableUsers,
      "peers:",
      Array.from(peersRef.current.keys())
    );
    return (
      <div className="relative w-full h-full bg-slate-950 overflow-hidden flex flex-col">
        {/* Remote videos */}
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

        {/* Top bar */}
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

        {/* Local preview */}
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

        {/* Controls */}
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

          {/* ADD PARTICIPANT BUTTON */}
          <button
            onClick={() => setShowAddParticipant((p) => !p)}
            className={showAddParticipant ? warnBtn : idleBtn}
          >
            <UserPlus size={20} />
          </button>

          {/* END CALL */}
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

            <div className="max-h-60 overflow-y-auto space-y-1">
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
