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
    } = useWebRTC();

    const localVideoRef = useRef(null);
    const localStreamRef = useRef(null);
    const switchingRef = useRef(false);
    const cleanedUpRef = useRef(false);
    const facingModeRef = useRef("user");
    const isMutedRef = useRef(false);
    const pendingPeersRef = useRef(new Set());
    const isVideoOffRef = useRef(false);
    const currentDeviceIdRef = useRef(null);
    const camerasRef = useRef([]);

    const [remoteStreams, setRemoteStreams] = useState([]);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [facingMode, setFacingMode] = useState("user");
    const [showAddParticipant, setShowAddParticipant] = useState(false);
    const [invitedUsers, setInvitedUsers] = useState(new Set());
    const [isSwitching, setIsSwitching] = useState(false);

    useEffect(() => {
      facingModeRef.current = facingMode;
    }, [facingMode]);

    const getLocalStream = async (forceNew = false) => {
      if (localStreamRef.current && !forceNew) return localStreamRef.current;

      console.log("[VideoCall] acquiring local stream");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingModeRef.current },
        audio: true,
      });

      const videoTrack = stream.getVideoTracks()[0];

      currentDeviceIdRef.current = videoTrack?.getSettings()?.deviceId ?? null;

      console.log(
        "[VideoCall] local stream acquired, deviceId:",
        currentDeviceIdRef.current
      );

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      return stream;
    };

    const handleRemovePeer = (userId) => {
      console.log("[VideoCall] removing peer", userId);
      removePeer(userId);
      setRemoteStreams((prev) => prev.filter((s) => s.userId !== userId));
    };

    const addTracksIfNeeded = (peer, stream) => {
      const senders = peer.getSenders();
      stream.getTracks().forEach((track) => {
        const alreadyAdded = senders.some((s) => s.track?.kind === track.kind);
        if (!alreadyAdded) {
          const sender = peer.addTrack(track, stream);
          if (track.kind === "audio" && isMutedRef.current) {
            sender.track.enabled = false;
          }
          if (track.kind === "video" && isVideoOffRef.current) {
            sender.track.enabled = false;
          }
        }
      });
    };

    const createPeerConnection = (userId, userName) => {
      const existing = getPeerEntry(userId);
      if (existing?.peer) {
        console.log("[VideoCall] reusing existing peer for", userId);
        return existing.peer;
      }

      console.log("[VideoCall] creating new peer for", userId);
      const polite = String(user._id) > String(userId);
      const peer = getOrCreatePeer(userId, polite);

      if (!peer) {
        console.error("[VideoCall] failed to create peer for", userId);
        return null;
      }

      peer.onicecandidate = (e) => {
        if (e.candidate) {
          console.log("[VideoCall] sending ICE candidate to", userId);
          socket.emit("ice-candidate", {
            candidate: e.candidate,
            to: userId,
            roomId: chatId,
          });
        } else {
          console.log("[VideoCall] ICE gathering complete for", userId);
        }
      };

      peer.ontrack = (e) => {
        const incomingStream = e.streams?.[0];
        console.log(
          "[VideoCall] ontrack fired from",
          userId,
          "stream:",
          !!incomingStream
        );
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
        console.log(
          "[VideoCall] connection state →",
          peer.connectionState,
          "for",
          userId
        );
        if (
          peer.connectionState === "failed" ||
          peer.connectionState === "closed"
        ) {
          handleRemovePeer(userId);
        }
      };

      peer.oniceconnectionstatechange = () => {
        console.log(
          "[VideoCall] ICE connection state →",
          peer.iceConnectionState,
          "for",
          userId
        );
        if (peer.iceConnectionState === "failed") {
          console.warn("[VideoCall] ICE failed, restarting for", userId);
          peer.restartIce();
        }
      };

      peer.onsignalingstatechange = () => {
        console.log(
          "[VideoCall] signaling state →",
          peer.signalingState,
          "for",
          userId
        );
      };

      return peer;
    };

    const initiateOffer = async (userId, userName) => {
      console.log("[VideoCall] initiateOffer →", userId);
      const peer = createPeerConnection(userId, userName);
      if (!peer) return;
      const stream = await getLocalStream();

      const entry = getPeerEntry(userId);
      if (!entry) {
        console.warn("[VideoCall] no entry found for", userId);
        return;
      }
      if (peer.signalingState !== "stable") {
        console.warn(
          "[VideoCall] signalingState not stable for",
          userId,
          "→",
          peer.signalingState
        );
        return;
      }

      addTracksIfNeeded(peer, stream);

      try {
        entry.makingOffer = true;
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        console.log("[VideoCall] offer sent to", userId);
        socket.emit("webrtc-offer", {
          offer: peer.localDescription,
          to: userId,
          fromName: user?.fName,
          roomId: chatId,
        });
      } catch (err) {
        console.warn("[VideoCall] initiateOffer error:", err);
      } finally {
        entry.makingOffer = false;
      }
    };

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

          const devices = await navigator.mediaDevices.enumerateDevices();

          camerasRef.current = devices.filter(
            (d) => d.kind === "videoinput" && d.deviceId
          );

          console.log(
            "[VideoCall] cameras detected:",
            camerasRef.current.map((d) => ({
              label: d.label,
              deviceId: d.deviceId,
            }))
          );

          socket.emit("join-call-room", { roomId: chatId });
        } catch (err) {
          console.error("[VideoCall] init error:", err);
        }
      };

      init();

      navigator.mediaDevices.addEventListener("devicechange", async () => {
        const devices = await navigator.mediaDevices.enumerateDevices();
        camerasRef.current = devices.filter((d) => d.kind === "videoinput");
      });

      return () => {
        socket.emit("leave-call-room", { roomId: chatId });
        closeAllPeers();
      };
    }, [socket, chatId]);

    useEffect(() => {
      if (!socket) return;

      const handleExistingParticipants = async ({ participants }) => {
        console.log("[VideoCall] existing-participants →", participants);
        for (const { userId, name } of participants) {
          if (!userId || String(userId) === String(user?._id)) continue;
          await initiateOffer(userId, name);
        }
      };

      const handleUserJoined = async ({ userId, name }) => {
        console.log("[VideoCall] user-joined-call →", userId);
        if (!userId || String(userId) === String(user?._id)) return;
        if (getPeerEntry(userId)?.peer) {
          console.warn(
            "[VideoCall] peer already exists for",
            userId,
            "— skipping"
          );
          return;
        }
        if (pendingPeersRef.current.has(userId)) {
          console.warn(
            "[VideoCall] offer already pending for",
            userId,
            "— skipping"
          );
          return;
        }
        pendingPeersRef.current.add(userId);
        try {
          await initiateOffer(userId, name);
        } finally {
          pendingPeersRef.current.delete(userId);
        }
      };

      const handleOffer = async ({ offer, from, fromName }) => {
        console.log("[VideoCall] received offer from", from);
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
        console.log(
          "[VideoCall] offerCollision:",
          offerCollision,
          "polite:",
          entry.polite
        );
        if (!entry.polite && offerCollision) {
          console.warn(
            "[VideoCall] impolite peer ignoring colliding offer from",
            from
          );
          return;
        }

        await peer.setRemoteDescription(offer);
        console.log("[VideoCall] remote description set for", from);

        if (entry?.pendingCandidates?.length) {
          console.log(
            "[VideoCall] applying",
            entry.pendingCandidates.length,
            "pending candidates for",
            from
          );
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
        console.log("[VideoCall] answer sent to", from);
        socket.emit("webrtc-answer", {
          answer: peer.localDescription,
          to: from,
          roomId: chatId,
        });
      };

      const handleAnswer = async ({ answer, from }) => {
        console.log("[VideoCall] received answer from", from);
        const entry = getPeerEntry(from);
        if (!entry?.peer) {
          console.warn("[VideoCall] no peer entry for answer from", from);
          return;
        }
        try {
          if (!entry.peer.currentRemoteDescription) {
            await entry.peer.setRemoteDescription(answer);
            console.log("[VideoCall] answer applied from", from);
          } else {
            console.warn(
              "[VideoCall] remote description already set for",
              from
            );
          }
        } catch (err) {
          console.warn("[VideoCall] failed to apply answer from", from, err);
        }
      };

      const handleIce = async ({ candidate, from }) => {
        console.log("[VideoCall] received ICE candidate from", from);
        const entry = getPeerEntry(from);
        if (!entry) {
          console.warn("[VideoCall] no entry for ICE from", from, "— queuing");
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
          } catch (err) {
            console.warn(
              "[VideoCall] failed to add ICE candidate from",
              from,
              err
            );
          }
        } else {
          console.warn(
            "[VideoCall] queuing ICE candidate from",
            from,
            "— no remote description yet"
          );
          setPeerEntry(from, {
            ...entry,
            pendingCandidates: [...(entry.pendingCandidates || []), candidate],
          });
        }
      };

      const handleUserLeft = ({ userId }) => {
        console.log("[VideoCall] user-left-call →", userId);
        handleRemovePeer(userId);
      };

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
    }, [socket, user?._id, chatId]);

    const cleanupRef = useRef(null);

    const cleanup = () => {
      if (cleanedUpRef.current) return;
      cleanedUpRef.current = true;
      console.log("[VideoCall] cleanup");
      localStreamRef.current?.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      currentDeviceIdRef.current = null;
      closeAllPeers();
      localStreamRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      setRemoteStreams([]);
    };

    cleanupRef.current = cleanup;

    useEffect(() => () => cleanupRef.current?.(), []);
    useImperativeHandle(ref, () => ({ cleanup: () => cleanupRef.current?.() }));

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
      isVideoOffRef.current = !track.enabled;
      setIsVideoOff(!track.enabled);
    };

    const switchCamera = async () => {
      if (switchingRef.current) return;

      switchingRef.current = true;
      setIsSwitching(true);

      try {
        const videoDevices = camerasRef.current;

        console.log(
          "[VideoCall] available cameras:",
          videoDevices.map((d) => ({
            label: d.label,
            deviceId: d.deviceId,
          }))
        );

        if (videoDevices.length < 2) {
          console.warn("[VideoCall] only one camera found");
          return;
        }

        const currentIndex = videoDevices.findIndex(
          (d) => d.deviceId === currentDeviceIdRef.current
        );

        console.log("[VideoCall] currentIndex:", currentIndex);

        const nextIndex =
          currentIndex === -1 ? 0 : (currentIndex + 1) % videoDevices.length;

        const nextDevice = videoDevices[nextIndex];

        console.log(
          "[VideoCall] switching to:",
          nextDevice.label,
          nextDevice.deviceId
        );

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: nextDevice.deviceId } },
          audio: false,
        });

        const newVideoTrack = stream.getVideoTracks()[0];

        const oldStream = localStreamRef.current;
        const oldAudioTrack = oldStream?.getAudioTracks()[0];

        oldStream?.getVideoTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });

        const newStream = new MediaStream([
          newVideoTrack,
          ...(oldAudioTrack ? [oldAudioTrack] : []),
        ]);

        currentDeviceIdRef.current = nextDevice.deviceId;

        localStreamRef.current = newStream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = newStream;
        }

        peersRef.current.forEach(({ peer }) => {
          const sender = peer
            .getSenders()
            .find((s) => s.track?.kind === "video");

          if (sender) {
            sender.replaceTrack(newVideoTrack);
          }
        });

        const newFacing =
          facingModeRef.current === "user" ? "environment" : "user";

        facingModeRef.current = newFacing;
        setFacingMode(newFacing);

        console.log("[VideoCall] camera switched");
      } catch (err) {
        console.error("[VideoCall] camera switch error:", err);
      } finally {
        switchingRef.current = false;
        setIsSwitching(false);
      }
    };
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
        return (callChat?.users || []).filter(
          (u) => !alreadyInCall.has(String(u._id))
        );
      } else {
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

    const isFrontCamera = facingModeRef.current === "user";
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
              isFrontCamera ? "scale-x-[-1]" : ""
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
            disabled={isSwitching}
            className={idleBtn}
          >
            <RefreshCcw
              size={20}
              className={isSwitching ? "animate-spin" : ""}
            />
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
