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
import { useCallMedia } from "./useCallMedia";
import { useCallPeers } from "./useCallPeers";
import RemoteVideo from "./RemoteVideo";
import CallControls from "./CallControls";
import AddParticipant from "./AddParticipant";
import LocalVideo from "./LocalVideo";

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
    const localVideoMainRef = useRef(null);
    const localStreamRef = useRef(null);
    const switchingRef = useRef(false);
    const cleanedUpRef = useRef(false);
    const facingModeRef = useRef("user");
    const isMutedRef = useRef(false);
    const pendingPeersRef = useRef(new Set());
    const isVideoOffRef = useRef(false);
    const currentDeviceIdRef = useRef(null);
    const camerasRef = useRef([]);
    const cameraIndexRef = useRef(0);

    const [remoteStreams, setRemoteStreams] = useState([]);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [facingMode, setFacingMode] = useState("user");
    const [showAddParticipant, setShowAddParticipant] = useState(false);
    const [invitedUsers, setInvitedUsers] = useState(new Set());
    const [isSwitching, setIsSwitching] = useState(false);
    const [swapped, setSwapped] = useState(false);
    const [selectedRemoteIndex, setSelectedRemoteIndex] = useState(0);

    useEffect(() => {
      facingModeRef.current = facingMode;
    }, [facingMode]);

    useEffect(() => {
      if (swapped && localVideoMainRef.current && localStreamRef.current) {
        localVideoMainRef.current.srcObject = localStreamRef.current;
        localVideoMainRef.current.play().catch(() => {});
      }
    }, [swapped, isSwitching]);

    useEffect(() => {
      if (selectedRemoteIndex >= remoteStreams.length)
        setSelectedRemoteIndex(0);
      if (remoteStreams.length === 0 && swapped) setSwapped(false);
    }, [remoteStreams, selectedRemoteIndex, swapped]);

    const { getLocalStream, toggleMute, toggleVideo, switchCamera } =
      useCallMedia({
        localVideoRef,
        localVideoMainRef,
        localStreamRef,
        currentDeviceIdRef,
        camerasRef,
        cameraIndexRef,
        facingModeRef,
        isMutedRef,
        isVideoOffRef,
        switchingRef,
        peersRef,
        setIsMuted,
        setIsVideoOff,
        setFacingMode,
        setIsSwitching,
        facingMode,
      });

    const {
      handleRemovePeer,
      addTracksIfNeeded,
      createPeerConnection,
      initiateOffer,
    } = useCallPeers({
      socket,
      user,
      chatId,
      peersRef,
      getOrCreatePeer,
      getPeerEntry,
      setPeerEntry,
      removePeer,
      isMutedRef,
      isVideoOffRef,
      setRemoteStreams,
      onConnected,
    });

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

      const handleDeviceChange = async () => {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const newCameras = devices.filter(
            (d) => d.kind === "videoinput" && d.deviceId
          );
          camerasRef.current = newCameras;
          const idx = newCameras.findIndex(
            (d) => d.deviceId === currentDeviceIdRef.current
          );
          cameraIndexRef.current = idx === -1 ? 0 : idx;
        } catch (err) {
          console.warn("[VideoCall] handleDeviceChange error:", err);
        }
      };

      const init = async () => {
        try {
          await getLocalStream();
          const devices = await navigator.mediaDevices.enumerateDevices();
          camerasRef.current = devices.filter(
            (d) => d.kind === "videoinput" && d.deviceId
          );
          const idx = camerasRef.current.findIndex(
            (d) => d.deviceId === currentDeviceIdRef.current
          );
          cameraIndexRef.current = idx === -1 ? 0 : idx;
          navigator.mediaDevices.addEventListener(
            "devicechange",
            handleDeviceChange
          );
          socket.emit("join-call-room", { roomId: chatId });
        } catch (err) {
          console.error("[VideoCall] init error:", err);
        }
      };

      init();

      return () => {
        navigator.mediaDevices.removeEventListener(
          "devicechange",
          handleDeviceChange
        );
        socket.emit("leave-call-room", { roomId: chatId });
        closeAllPeers();
      };
    }, [socket, chatId]);

    useEffect(() => {
      if (!socket) return;

      const handleExistingParticipants = async ({ participants }) => {
        for (const { userId, name } of participants) {
          if (!userId || String(userId) === String(user?._id)) continue;
          const entry = getPeerEntry(userId);
          if (entry?.peer || entry?.makingOffer) continue;
          await initiateOffer(userId, name, getLocalStream);
        }
      };

      const handleUserJoined = async ({ userId, name }) => {
        if (!userId || String(userId) === String(user?._id)) return;
        if (getPeerEntry(userId)?.peer) return;
        if (pendingPeersRef.current.has(userId)) return;
        pendingPeersRef.current.add(userId);
        try {
          await initiateOffer(userId, name, getLocalStream);
        } finally {
          pendingPeersRef.current.delete(userId);
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
          roomId: chatId,
        });
      };

      const handleAnswer = async ({ answer, from }) => {
        const entry = getPeerEntry(from);
        if (!entry?.peer) return;
        try {
          if (!entry.peer.currentRemoteDescription)
            await entry.peer.setRemoteDescription(answer);
        } catch (err) {
          console.warn("[VideoCall] failed to apply answer from", from, err);
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

      socket.on("existing-participants", handleExistingParticipants);
      socket.on("user-joined-call", handleUserJoined);
      socket.on("webrtc-offer", handleOffer);
      socket.on("webrtc-answer", handleAnswer);
      socket.on("ice-candidate", handleIce);
      socket.on("user-left-call", ({ userId }) => handleRemovePeer(userId));

      return () => {
        socket.off("existing-participants", handleExistingParticipants);
        socket.off("user-joined-call", handleUserJoined);
        socket.off("webrtc-offer", handleOffer);
        socket.off("webrtc-answer", handleAnswer);
        socket.off("ice-candidate", handleIce);
        socket.off("user-left-call", ({ userId }) => handleRemovePeer(userId));
      };
    }, [socket, user?._id, chatId]);

    const cleanupRef = useRef(null);
    const cleanup = () => {
      if (cleanedUpRef.current) return;
      cleanedUpRef.current = true;
      localStreamRef.current?.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      currentDeviceIdRef.current = null;
      camerasRef.current = [];
      cameraIndexRef.current = 0;
      closeAllPeers();
      localStreamRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (localVideoMainRef.current) localVideoMainRef.current.srcObject = null;
      setRemoteStreams([]);
      setSwapped(false);
      setSelectedRemoteIndex(0);
    };

    cleanupRef.current = cleanup;
    useEffect(() => () => cleanupRef.current?.(), []);
    useImperativeHandle(ref, () => ({ cleanup: () => cleanupRef.current?.() }));

    const callChat = useMemo(
      () => chats?.find((c) => String(c._id) === String(chatId)),
      [chats, chatId]
    );

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
      }
      const allUsers = new Map();
      (chats || []).forEach((c) => {
        (c.users || []).forEach((u) => {
          if (!alreadyInCall.has(String(u._id))) allUsers.set(String(u._id), u);
        });
      });
      return Array.from(allUsers.values());
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
    const isFrontCamera = facingMode === "user";

    return (
      <div className="relative w-full h-full bg-slate-950 overflow-hidden flex flex-col">
        <div className="flex-1 relative min-h-0 overflow-hidden">
          {/* Remote streams */}
          <div
            className={`absolute inset-0 flex gap-1 p-1 ${
              swapped ? "hidden" : ""
            }`}
          >
            {remoteStreams.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 rounded-full border-2 border-sky-500/20 border-t-sky-400 animate-spin" />
                <p className="text-sm font-medium text-slate-500 tracking-wide">
                  Connecting…
                </p>
              </div>
            ) : remoteStreams.length === 1 ? (
              <div
                className="flex-1 w-full h-full min-w-0 min-h-0 cursor-pointer"
                onClick={() => {
                  if (selectedRemoteIndex !== 0 || !swapped) {
                    setSelectedRemoteIndex(0);
                    setSwapped(true);
                  }
                }}
              >
                <RemoteVideo
                  stream={remoteStreams[0].stream}
                  name={remoteStreams[0].name}
                />
              </div>
            ) : (
              <div className={`w-full h-full ${gridClass} gap-1`}>
                {remoteStreams.map(({ userId, stream, name }, index) => (
                  <div
                    key={userId}
                    className="relative min-w-0 min-h-0 cursor-pointer"
                    onClick={() => {
                      if (selectedRemoteIndex !== index || !swapped) {
                        setSelectedRemoteIndex(index);
                        setSwapped(true);
                      }
                    }}
                  >
                    <RemoteVideo stream={stream} name={name} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Local video in main */}
          <div
            className={`absolute inset-0 p-1 ${swapped ? "flex" : "hidden"}`}
          >
            <div className="relative flex-1 min-w-0 min-h-0 border border-white/5 rounded-2xl overflow-hidden">
              <LocalVideo
                videoRef={localVideoMainRef}
                isFrontCamera={isFrontCamera}
                isVideoOff={isVideoOff}
              />
              <span className="absolute bottom-2 left-3 text-[10px] text-white/50 font-medium z-10">
                You
              </span>
            </div>
          </div>
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

        {/* PiP */}
        <div
          onClick={() => remoteStreams.length > 0 && setSwapped((p) => !p)}
          className={`absolute top-14 right-3 z-20 w-24 h-32 sm:w-32 sm:h-44 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900 transition-transform ${
            remoteStreams.length > 0 ? "cursor-pointer active:scale-95" : ""
          }`}
        >
          <div className={`absolute inset-0 ${swapped ? "hidden" : "block"}`}>
            <LocalVideo
              videoRef={localVideoRef}
              isFrontCamera={isFrontCamera}
              isVideoOff={isVideoOff}
            />
          </div>

          {swapped && remoteStreams[selectedRemoteIndex] && (
            <div className="absolute inset-0">
              <RemoteVideo
                stream={remoteStreams[selectedRemoteIndex].stream}
                name={remoteStreams[selectedRemoteIndex].name}
              />
            </div>
          )}

          <span className="absolute bottom-1.5 left-0 right-0 text-center text-[9px] text-white/35 font-medium z-10">
            {swapped
              ? remoteStreams[selectedRemoteIndex]?.name || "Remote"
              : "You"}
          </span>
        </div>

        <CallControls
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          isSwitching={isSwitching}
          showAddParticipant={showAddParticipant}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onSwitchCamera={switchCamera}
          onToggleAddParticipant={() => setShowAddParticipant((p) => !p)}
          onEndCall={onEndCall}
        />

        {showAddParticipant && (
          <AddParticipant
            addableUsers={addableUsers}
            onInvite={handleInvite}
            onClose={() => setShowAddParticipant(false)}
          />
        )}
      </div>
    );
  }
);

export default VideoCall;
