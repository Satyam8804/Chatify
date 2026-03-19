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
import { logger } from "../../utils/logger";

import { MicOff } from "lucide-react";
import ParticipantCard from "./ParticipantCard";

const VideoCall = forwardRef(
  (
    { chatId, onEndCall, onConnected, chats, initiator, callType = "video" },
    ref
  ) => {
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
    const cleanupRef = useRef(null);

    const [remoteStreams, setRemoteStreams] = useState([]);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [facingMode, setFacingMode] = useState("user");
    const [showAddParticipant, setShowAddParticipant] = useState(false);
    const [invitedUsers, setInvitedUsers] = useState(new Set());
    const [isSwitching, setIsSwitching] = useState(false);
    const [swapped, setSwapped] = useState(false);
    const [selectedRemoteIndex, setSelectedRemoteIndex] = useState(0);
    const [activeSpeakerId, setActiveSpeakerId] = useState(null);

    const canSwap = remoteStreams.length === 1;

    useEffect(() => {
      facingModeRef.current = facingMode;
    }, [facingMode]);

    useEffect(() => {
      const unlockAudio = () => {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        ctx.resume();
      };

      window.addEventListener("click", unlockAudio, { once: true });

      return () => window.removeEventListener("click", unlockAudio);
    }, []);

    useEffect(() => {
      if (!remoteStreams.length) {
        setActiveSpeakerId(null); // ✅ reset if no users
        return;
      }

      const speakingUser = remoteStreams.find((u) => u.isSpeaking);

      if (speakingUser) {
        setActiveSpeakerId(speakingUser.userId);
      } else {
        setActiveSpeakerId(null); // ✅ IMPORTANT FIX
      }
    }, [remoteStreams]);

    useEffect(() => {
      if (swapped) {
        if (localVideoMainRef.current && localStreamRef.current) {
          localVideoMainRef.current.srcObject = localStreamRef.current;
          localVideoMainRef.current.play().catch(() => {});
        }
      } else {
        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
          localVideoRef.current.play().catch(() => {});
        }
      }
    }, [swapped, isSwitching]);

    useEffect(() => {
      if (selectedRemoteIndex >= remoteStreams.length)
        setSelectedRemoteIndex(0);
      if (remoteStreams.length === 0 && swapped) setSwapped(false);
      if (remoteStreams.length > 1 && swapped) setSwapped(false);
    }, [remoteStreams.length, selectedRemoteIndex]);

    const {
      getLocalStream,
      toggleMute,
      toggleVideo,
      switchCamera,
      getVideoConstraints,
    } = useCallMedia({
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
      callType,
      socket,
      chatId,
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
      getOrCreatePeer,
      getPeerEntry,
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
          logger("[VideoCall] handleDeviceChange error:", err);
        }
      };

      const handleConnectionChange = (() => {
        let timeout;
        return () => {
          clearTimeout(timeout);
          timeout = setTimeout(() => {
            if (peersRef.current.size === 0) return;
            const track = localStreamRef.current?.getVideoTracks()[0];
            if (!track) return;
            const constraints = getVideoConstraints();
            track
              .applyConstraints({
                width: constraints.width,
                height: constraints.height,
                frameRate: constraints.frameRate,
              })
              .catch(() => {});
          }, 2000); // ✅ debounce 2 seconds — ignores immediate fire
        };
      })();

      const connection =
        navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection;

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
          if (connection)
            connection.addEventListener("change", handleConnectionChange);

          socket.emit("join-call-room", { roomId: chatId });

          // ✅ caller notifies receivers AFTER joining room
          if (initiator?.isInitiator && initiator?.receiverIds?.length) {
            socket.emit("video-call-user", {
              chatId,
              receiverIds: initiator.receiverIds,
              isGroup: !!initiator.isGroup,
              callType,
            });
          }

          socket.on("reconnect", () => {
            socket.emit("join-call-room", { roomId: chatId });
          });
        } catch (err) {
          logger("[VideoCall] init error:", err);
        }
      };

      init();

      return () => {
        socket.off("reconnect"); // ✅ add here
        navigator.mediaDevices.removeEventListener(
          "devicechange",
          handleDeviceChange
        );
        if (connection)
          connection.removeEventListener("change", handleConnectionChange);
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

      const handleUserMuted = ({ userId, isMuted }) => {
        setRemoteStreams((prev) =>
          prev.map((u) => (u.userId === userId ? { ...u, isMuted } : u))
        );
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

        // reset makingOffer safely
        if (entry?.makingOffer) {
          setPeerEntry(from, { ...entry, makingOffer: false });
        }

        try {
          if (!entry.peer.currentRemoteDescription) {
            await entry.peer.setRemoteDescription(answer);
          }
        } catch (err) {
          logger("[VideoCall] failed to apply answer from", from, err);
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
      socket.on("user-muted", handleUserMuted);

      return () => {
        socket.off("existing-participants", handleExistingParticipants);
        socket.off("user-joined-call", handleUserJoined);
        socket.off("webrtc-offer", handleOffer);
        socket.off("webrtc-answer", handleAnswer);
        socket.off("ice-candidate", handleIce);
        socket.off("user-left-call", handleUserLeft);
        socket.off("user-muted", handleUserMuted);
      };
    }, [socket, user?._id]);

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

    const isFrontCamera = facingMode === "user";

    console.log("remoteStreams -->",remoteStreams)

    return (
      <div className="relative w-full h-full bg-slate-950 overflow-hidden flex flex-col">
        {callType === "video" && (
          <div className="flex-1 relative min-h-0 overflow-hidden">
            <div className={`absolute inset-0 ${swapped ? "hidden" : "flex"}`}>
              {remoteStreams.length === 0 ? (
                <div className="relative w-full h-full">
                  <LocalVideo
                    videoRef={localVideoRef}
                    isFrontCamera={isFrontCamera}
                    isVideoOff={isVideoOff}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/60">
                    <div className="w-10 h-10 rounded-full border-2 border-sky-500/20 border-t-sky-400 animate-spin" />
                    <p className="text-xs font-medium text-slate-400 tracking-wide">
                      Connecting…
                    </p>
                  </div>
                </div>
              ) : remoteStreams.length === 1 ? (
                <div
                  className="relative w-full h-full cursor-pointer"
                  onClick={() => canSwap && setSwapped(true)}
                >
                  <RemoteVideo stream={remoteStreams[0].stream} />
                  <span className="absolute bottom-2 left-3 text-[10px] text-white/40 font-medium z-10">
                    {remoteStreams[0].name}
                  </span>
                  {remoteStreams[0].isMuted && (
                    <span className="absolute bottom-3 right-3 z-10 bg-black/70 backdrop-blur-md p-1.5 rounded-full border border-white/10">
                      <MicOff size={14} className="text-white" />
                    </span>
                  )}
                </div>
              ) : (
                <div
                  className={`w-full h-full p-1 grid gap-1 ${
                    remoteStreams.length === 2
                      ? "grid-cols-2"
                      : remoteStreams.length === 3
                      ? "grid-cols-2 grid-rows-2"
                      : remoteStreams.length === 4
                      ? "grid-cols-2 grid-rows-2"
                      : remoteStreams.length <= 6
                      ? "grid-cols-3 grid-rows-2"
                      : "grid-cols-3 grid-rows-3"
                  }`}
                >
                  {remoteStreams.map(({ userId, stream, name, isMuted }, i) => (
                    <div
                      key={userId}
                      className={`relative overflow-hidden rounded-xl ${
                        remoteStreams.length === 3 && i === 0
                          ? "col-span-2"
                          : ""
                      }`}
                    >
                      <RemoteVideo stream={stream} />
                      <span className="absolute bottom-2 left-3 text-[10px] text-white/40 font-medium z-10">
                        {name}
                      </span>
                      {isMuted && (
                        <span className="absolute bottom-2 right-2 z-10 bg-black/70 backdrop-blur-md p-1.5 rounded-full border border-white/10">
                          <MicOff size={12} className="text-white" />
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={`absolute inset-0 ${swapped ? "block" : "hidden"}`}>
              <LocalVideo
                videoRef={localVideoMainRef}
                isFrontCamera={isFrontCamera}
                isVideoOff={isVideoOff}
              />
              <span className="absolute bottom-2 left-3 text-[10px] text-white/40 font-medium z-10">
                You
              </span>
              {isMuted && (
                <span className="absolute bottom-3 right-3 z-10 bg-black/70 backdrop-blur-md p-1.5 rounded-full border border-white/10">
                  <MicOff size={14} className="text-white" />
                </span>
              )}
            </div>
          </div>
        )}

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

        {callType === "video" && (
          <div
            onClick={() => canSwap && setSwapped((p) => !p)}
            className={`absolute top-14 right-3 z-20 w-24 h-32 sm:w-28 sm:h-40 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900 ${
              canSwap
                ? "cursor-pointer active:scale-95 transition-transform"
                : ""
            }`}
          >
            {swapped ? (
              remoteStreams[selectedRemoteIndex] && (
                <RemoteVideo
                  stream={remoteStreams[selectedRemoteIndex].stream}
                />
              )
            ) : (
              <LocalVideo
                videoRef={localVideoRef}
                isFrontCamera={isFrontCamera}
                isVideoOff={isVideoOff}
              />
            )}

            {swapped
              ? remoteStreams[selectedRemoteIndex]?.isMuted && (
                  <span className="absolute bottom-2 right-2 z-10 bg-black/70 backdrop-blur-md p-1 rounded-full border border-white/10">
                    <MicOff size={10} className="text-white" />
                  </span>
                )
              : isMuted && (
                  <span className="absolute bottom-2 right-2 z-10 bg-black/70 backdrop-blur-md p-1 rounded-full border border-white/10">
                    <MicOff size={10} className="text-white" />
                  </span>
                )}

            <span className="absolute bottom-1.5 left-0 right-0 text-center text-[9px] text-white/30 font-medium z-10">
              {swapped ? remoteStreams[selectedRemoteIndex]?.name : "You"}
            </span>
          </div>
        )}

        {callType === "audio" && (
          <div className="flex-1 flex flex-col items-center justify-center px-4 py-6">
            <div className="hidden">
              {remoteStreams.map((u) => (
                <audio
                  key={u.userId}
                  autoPlay
                  playsInline
                  ref={(el) => {
                    if (el && u.stream) {
                      el.srcObject = u.stream;
                      el.muted = false;
                      el.volume = 1;
                    }
                  }}
                />
              ))}
            </div>

            <div
              className={`grid w-full gap-3 ${
                remoteStreams.length === 0
                  ? "grid-cols-1 max-w-[160px]"
                  : remoteStreams.length + 1 <= 2
                  ? "grid-cols-2 max-w-xs"
                  : remoteStreams.length + 1 <= 4
                  ? "grid-cols-2 max-w-sm"
                  : "grid-cols-3 max-w-md"
              }`}
            >
              <ParticipantCard
                isSelf
                isMuted={isMuted}
                isSpeaking={activeSpeakerId === user?._id}
              />
              {remoteStreams.map((u) => (
                <ParticipantCard
                  key={u.userId}
                  name={u.name}
                  avatar={u.avatar}
                  isMuted={u.isMuted}
                  isSpeaking={activeSpeakerId === u.userId}
                />
              ))}
            </div>

            <p className="text-xs mt-6 text-slate-500 tracking-wide">
              {remoteStreams.length === 0 ? "Ringing…" : "Connected"}
            </p>
          </div>
        )}

        <CallControls
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          isSwitching={isSwitching}
          showAddParticipant={showAddParticipant}
          callType={callType}
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
