import {
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useCallback,
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
import NetworkBar from "../common/NetworkBar";
import { logger } from "../../utils/logger";
import { MicOff } from "lucide-react";
import ParticipantCard from "./ParticipantCard";
import { getAvatarColor } from "../../utils/getAvatarColor";

const log = (...args) => console.log("[VideoCall]", ...args);

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
    const hadConnectionRef = useRef(false);
    const knownPeerIdsRef = useRef(new Set());

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
    const [connectionFailed, setConnectionFailed] = useState(false);
    const [networkStatus, setNetworkStatus] = useState("connected");
    const [networkLabel, setNetworkLabel] = useState("");
    const canSwap = remoteStreams.length === 1;

    const wrappedOnConnected = useCallback(() => {
      hadConnectionRef.current = true;
      onConnected?.();
    }, [onConnected]);

    useEffect(() => {
      facingModeRef.current = facingMode;
    }, [facingMode]);

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
      const resumeAudio = () => {
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) return;
          const ctx = new AudioCtx();
          if (ctx.state === "suspended") ctx.resume();
        } catch {}
      };
      document.addEventListener("click", resumeAudio, { once: true });
      document.addEventListener("touchstart", resumeAudio, { once: true });
      return () => {
        document.removeEventListener("click", resumeAudio);
        document.removeEventListener("touchstart", resumeAudio);
      };
    }, []);

    useEffect(() => {
      const handleVisibility = async () => {
        if (document.visibilityState === "visible") {
          document.querySelectorAll("audio").forEach((el) => {
            el.play().catch(() => {});
          });

          // re-acquire camera if track ended while screen was off
          const videoTrack = localStreamRef.current?.getVideoTracks()[0];
          if (
            videoTrack &&
            (videoTrack.readyState === "ended" || !videoTrack.enabled)
          ) {
            log("Camera track ended after screen wake — re-acquiring stream");
            try {
              const newStream = await getLocalStream(true);

              peersRef.current.forEach(({ peer }) => {
                if (!peer || peer.connectionState === "closed") return;
                const sender = peer
                  .getSenders()
                  .find((s) => s.track?.kind === "video");
                const newTrack = newStream?.getVideoTracks()[0];
                if (sender && newTrack) {
                  sender.replaceTrack(newTrack).catch(() => {});
                }
              });
            } catch (e) {
              log("Failed to re-acquire stream after wake:", e);
            }
          }
        }
      };

      document.addEventListener("visibilitychange", handleVisibility);
      return () =>
        document.removeEventListener("visibilitychange", handleVisibility);
    }, []);

    useEffect(() => {
      setSelectedRemoteIndex((prev) =>
        remoteStreams.length === 0
          ? 0
          : Math.min(prev, remoteStreams.length - 1)
      );
    }, [remoteStreams.length]);

    useEffect(() => {
      if (remoteStreams.length === 0 && swapped) setSwapped(false);
      if (remoteStreams.length > 1 && swapped) setSwapped(false);
    }, [remoteStreams.length]);

    useEffect(() => {
      if (remoteStreams.length > 0) setConnectionFailed(false);
    }, [remoteStreams.length]);

    useEffect(() => {
      if (!remoteStreams.length) {
        setActiveSpeakerId(null);
        return;
      }
      const speakingUser = remoteStreams.find((u) => u.isSpeaking);
      setActiveSpeakerId(speakingUser ? speakingUser.userId : null);
    }, [remoteStreams]);

    const {
      getLocalStream,
      toggleMute,
      toggleVideo,
      switchCamera,
      getVideoConstraints,
      adaptBitrateToNetwork,
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
      chats,
      getOrCreatePeer,
      getPeerEntry,
      removePeer,
      setPeerEntry,
      isMutedRef,
      isVideoOffRef,
      setRemoteStreams,
      wrappedOnConnected,
    });

    useEffect(() => {
      if (!socket || !chatId) return;

      log("useEffect init — chatId:", chatId);
      cleanedUpRef.current = false;

      closeAllPeers();
      setRemoteStreams([]);
      setInvitedUsers(new Set());
      setConnectionFailed(false);

      localStreamRef.current?.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      localStreamRef.current = null;

      const handleDeviceChange = async () => {
        log("Device change detected");
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const newCameras = devices.filter(
            (d) => d.kind === "videoinput" && d.deviceId
          );
          camerasRef.current = newCameras;
          log("Cameras updated:", newCameras.length);
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
        let retryCount = 0;
        const MAX_RETRIES = 3;

        const attempt = () => {
          const connection =
            navigator.connection ||
            navigator.mozConnection ||
            navigator.webkitConnection;

          log(
            `Reconnect attempt #${retryCount + 1}`,
            `online: ${navigator.onLine}`,
            `effectiveType: ${connection?.effectiveType}`,
            `downlink: ${connection?.downlink}`
          );

          if (!navigator.onLine) {
            setNetworkStatus("offline");
            setNetworkLabel("Offline");
            if (retryCount < MAX_RETRIES) {
              retryCount++;
              log(`Device offline — retry ${retryCount}/${MAX_RETRIES} in 3s`);
              timeout = setTimeout(attempt, 3000);
            } else {
              log("Max retries reached while offline");
            }
            return;
          }

          retryCount = 0;

          const effectiveType = connection?.effectiveType;
          const downlink = connection?.downlink;
          log(
            `Network stable — effectiveType: ${effectiveType}, downlink: ${downlink}`
          );

          if (
            effectiveType === "slow-2g" ||
            effectiveType === "2g" ||
            downlink < 1
          ) {
            setNetworkStatus("poor");
            setNetworkLabel("Poor connection");
          } else if (effectiveType === "3g" || downlink < 5) {
            setNetworkStatus("poor");
            setNetworkLabel("Weak connection");
          } else {
            setNetworkStatus("reconnecting");
            setNetworkLabel("Reconnecting…");
          }

          log("Peer map size:", peersRef.current.size);

          if (peersRef.current.size > 0) {
            const track = localStreamRef.current?.getVideoTracks()[0];
            if (track) {
              const constraints = getVideoConstraints();
              log("Applying video constraints:", constraints);
              track
                .applyConstraints({
                  width: constraints.width,
                  height: constraints.height,
                  frameRate: constraints.frameRate,
                })
                .catch((e) => log("applyConstraints failed:", e));
            }

            adaptBitrateToNetwork();

            peersRef.current.forEach(({ peer }, uid) => {
              if (!peer) return;
              log(
                `Peer ${uid} — iceState: ${peer.iceConnectionState}, connState: ${peer.connectionState}`
              );
              if (
                peer.iceConnectionState === "disconnected" ||
                peer.iceConnectionState === "failed" ||
                peer.connectionState === "failed"
              ) {
                log(`Calling restartIce() for peer: ${uid}`);
                try {
                  peer.restartIce();
                } catch (e) {
                  log("restartIce failed:", e);
                }
              }
            });
          }

          const allGone = [...peersRef.current.values()].every(
            ({ peer }) =>
              !peer ||
              peer.connectionState === "closed" ||
              peer.connectionState === "failed"
          );

          log("allGone:", allGone, "— total peers:", peersRef.current.size);

          if (allGone && socket && chatId) {
            log("All peers gone — emitting join-call-room");
            socket.emit("join-call-room", { roomId: chatId });
          }
        };

        return () => {
          clearTimeout(timeout);
          retryCount = 0;
          log("Network change event — waiting 3s");
          timeout = setTimeout(attempt, 3000);
        };
      })();

      const handleOnline = () => {
        log("window online event fired");
        setNetworkStatus("reconnecting");
        setNetworkLabel("Reconnecting…");
        handleConnectionChange();
      };

      const handleOffline = () => {
        log("window offline event fired");
        setNetworkStatus("offline");
        setNetworkLabel("Offline");
      };

      const connection =
        navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection;

      const handleReconnect = () => {
        log("Socket reconnected — emitting join-call-room");
        socket.emit("join-call-room", { roomId: chatId });
      };

      const handleUserJoinedEarly = async ({ userId }) => {
        if (cleanedUpRef.current) return;
        log("user-joined-call (early handler):", userId);
        if (!userId || String(userId) === String(user?._id)) return;
        const existingEntry = getPeerEntry(userId);
        if (existingEntry?.peer) return;
        if (pendingPeersRef.current.has(userId)) return;
        pendingPeersRef.current.add(userId);
        try {
          await initiateOffer(userId, getLocalStream);
        } finally {
          pendingPeersRef.current.delete(userId);
        }
      };

      socket.on("user-joined-call", handleUserJoinedEarly);

      const handlePingRejoin = ({ from, chatId: pingChatId }) => {
        if (cleanedUpRef.current) return;
        if (pingChatId !== chatId) return;
        log("ping-rejoin received from:", from, "— rejoining call room");
        socket.emit("join-call-room", { roomId: chatId });
      };

      socket.on("ping-rejoin", handlePingRejoin);

      const init = async () => {
        try {
          log("init() start");
          await getLocalStream();
          log("Local stream acquired");

          const devices = await navigator.mediaDevices.enumerateDevices();
          camerasRef.current = devices.filter(
            (d) => d.kind === "videoinput" && d.deviceId
          );
          log("Cameras found:", camerasRef.current.length);

          const idx = camerasRef.current.findIndex(
            (d) => d.deviceId === currentDeviceIdRef.current
          );
          cameraIndexRef.current = idx === -1 ? 0 : idx;

          navigator.mediaDevices.addEventListener(
            "devicechange",
            handleDeviceChange
          );

          if (connection) {
            connection.addEventListener("change", handleConnectionChange);
            log("navigator.connection change listener added");
          } else {
            log("navigator.connection not supported on this browser");
          }

          window.addEventListener("online", handleOnline);
          window.addEventListener("offline", handleOffline);

          log("Emitting join-call-room — chatId:", chatId);
          socket.emit("join-call-room", { roomId: chatId });

          socket.on("reconnect", handleReconnect);

          if (initiator?.isInitiator && initiator?.receiverIds?.length) {
            log("Caller — emitting video-call-user to:", initiator.receiverIds);
            socket.emit("video-call-user", {
              chatId,
              receiverIds: initiator.receiverIds,
              isGroup: !!initiator.isGroup,
              callType,
            });
          }

          let watchdogAttempt = 0;
          const MAX_WATCHDOG_RETRIES = 5;

          const watchdog = setInterval(() => {
            if (cleanedUpRef.current) {
              clearInterval(watchdog);
              return;
            }

            const hasRemote =
              peersRef.current.size > 0 &&
              [...peersRef.current.values()].some(
                ({ peer }) => peer && peer.connectionState === "connected" // ✅ was: !== "failed" && !== "closed"
              );

            if (hasRemote) {
              log("Watchdog — peer connected, clearing watchdog");
              clearInterval(watchdog);
              return;
            }

            watchdogAttempt++;
            log(
              `Watchdog — no peer connected after 8s, retry ${watchdogAttempt}/${MAX_WATCHDOG_RETRIES}`
            );

            if (watchdogAttempt >= MAX_WATCHDOG_RETRIES) {
              log("Watchdog — max retries reached, stopping");
              setConnectionFailed(true);
              clearInterval(watchdog);
              return;
            }

            socket.emit("join-call-room", { roomId: chatId });
          }, 8000);

          cleanupRef.watchdog = watchdog;

          log("init() complete");
        } catch (err) {
          logger("[VideoCall] init error:", err);
        }
      };

      init();

      return () => {
        clearInterval(cleanupRef.watchdog);
        socket.off("ping-rejoin", handlePingRejoin);
        socket.off("reconnect", handleReconnect);
        socket.off("user-joined-call", handleUserJoinedEarly);
        navigator.mediaDevices.removeEventListener(
          "devicechange",
          handleDeviceChange
        );
        if (connection)
          connection.removeEventListener("change", handleConnectionChange);
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
        socket.emit("leave-call-room", { roomId: chatId });
        closeAllPeers();
      };
    }, [socket, chatId]);

    useEffect(() => {
      if (!socket) return;

      const handleExistingParticipants = async ({ participants }) => {
        if (cleanedUpRef.current) return;
        log("existing-participants received:", participants);

        const others = participants.filter(
          ({ userId }) => userId && String(userId) !== String(user?._id)
        );

        if (others.length === 0) {
          log("existing-participants empty — scheduling retry in 3s");
          setTimeout(() => {
            if (!cleanedUpRef.current && socket) {
              if (
                hadConnectionRef.current &&
                knownPeerIdsRef.current.size > 0
              ) {
                knownPeerIdsRef.current.forEach((userId) => {
                  log("Pinging user to rejoin:", userId);
                  socket.emit("ping-rejoin", { to: userId, chatId });
                });
              }
              log("Retrying join-call-room after empty participants");
              socket.emit("join-call-room", { roomId: chatId });
            }
          }, 3000);
          return;
        }

        for (const { userId } of others) {
          knownPeerIdsRef.current.add(userId);
          const entry = getPeerEntry(userId);

          const isHealthy =
            entry?.peer && entry.peer.connectionState === "connected"; // ✅ was: !== "failed" && !== "closed"

          log(
            `Participant ${userId} — healthy: ${isHealthy}, makingOffer: ${
              entry?.makingOffer
            }, pendingCandidates: ${entry?.pendingCandidates?.length ?? 0}`
          );

          if (isHealthy || entry?.makingOffer) continue;

          if (entry?.pendingCandidates?.length && !entry?.peer) {
            log(
              `Pre-creating peer for ${userId} — has ${entry.pendingCandidates.length} pending candidates`
            );
            createPeerConnection(userId);
          }

          log("Initiating offer to existing participant:", userId);
          await initiateOffer(userId, getLocalStream);
        }

        setConnectionFailed(false);
        setNetworkStatus("connected");
        setNetworkLabel("");
      };

      const handleUserMuted = ({ userId, isMuted }) => {
        log("user-muted:", userId, isMuted);
        setRemoteStreams((prev) =>
          prev.map((u) => (u.userId === userId ? { ...u, isMuted } : u))
        );
      };

      const handleOffer = async ({ offer, from, fromName }) => {
        if (cleanedUpRef.current) return;
        if (pendingPeersRef.current.has(from)) return;

        log("webrtc-offer from:", from, "| fromName:", fromName);

        const stream = await getLocalStream();
        if (cleanedUpRef.current) return;

        const peer = createPeerConnection(from, fromName);
        if (!peer) {
          log("createPeerConnection returned null for:", from);
          return;
        }

        let entry = getPeerEntry(from);
        if (!entry) {
          getOrCreatePeer(from);
          entry = getPeerEntry(from);
        }

        const offerCollision =
          entry.makingOffer || peer.signalingState !== "stable";
        log(
          `Offer collision check — makingOffer: ${entry.makingOffer}, signalingState: ${peer.signalingState}, polite: ${entry.polite}, collision: ${offerCollision}`
        );

        if (offerCollision) {
          if (!entry.polite) {
            log("Dropping offer — impolite peer");
            return;
          }
          try {
            log("Polite rollback — rolling back local offer for:", from);
            await peer.setLocalDescription({ type: "rollback" });
            setPeerEntry(from, {
              ...getPeerEntry(from),
              makingOffer: false,
              pendingCandidates: [],
            });
          } catch (e) {
            log("Rollback failed:", e);
            return;
          }
        }

        addTracksIfNeeded(peer, stream);
        log("setRemoteDescription (offer) for:", from);
        await peer.setRemoteDescription(offer);

        if (cleanedUpRef.current) return;

        if (entry?.pendingCandidates?.length) {
          log(
            `Flushing ${entry.pendingCandidates.length} pending ICE candidates for:`,
            from
          );
          for (const candidate of entry.pendingCandidates) {
            try {
              await peer.addIceCandidate(candidate);
            } catch {}
          }
          setPeerEntry(from, { ...entry, pendingCandidates: [] });
        }

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        log("Sending webrtc-answer to:", from);

        if (cleanedUpRef.current) return;

        socket.emit("webrtc-answer", {
          answer: peer.localDescription,
          to: from,
          roomId: chatId,
        });
      };

      const handleAnswer = async ({ answer, from }) => {
        log("webrtc-answer from:", from);
        const entry = getPeerEntry(from);
        if (!entry?.peer) {
          log("No peer entry for answer from:", from);
          return;
        }
        if (entry?.makingOffer) {
          setPeerEntry(from, { ...entry, makingOffer: false });
        }
        try {
          if (!entry.peer.remoteDescription) {
            log("setRemoteDescription (answer) for:", from);
            await entry.peer.setRemoteDescription(answer);

            const latest = getPeerEntry(from);
            if (latest?.pendingCandidates?.length) {
              log(
                `Flushing ${latest.pendingCandidates.length} pending candidates after answer for:`,
                from
              );
              for (const candidate of latest.pendingCandidates) {
                try {
                  await entry.peer.addIceCandidate(candidate);
                } catch {}
              }
              setPeerEntry(from, { ...latest, pendingCandidates: [] });
            }
          } else {
            log("Remote description already set — skipping answer from:", from);
          }
        } catch (err) {
          logger("[VideoCall] failed to apply answer from", from, err);
        }
      };

      const handleIce = async ({ candidate, from }) => {
        if (cleanedUpRef.current) return;
        log("ice-candidate from:", from);
        const entry = getPeerEntry(from);
        if (!entry) {
          log(
            "No peer entry yet — storing ICE candidate for:",
            from,
            "polite:",
            user._id.localeCompare(from) > 0
          );
          setPeerEntry(from, {
            peer: null,
            pendingCandidates: [candidate],
            makingOffer: false,
            polite: user._id.localeCompare(from) > 0,
          });
          return;
        }
        if (entry.peer?.remoteDescription) {
          try {
            await entry.peer.addIceCandidate(candidate);
          } catch {}
        } else {
          log("Queuing ICE candidate — no remote description yet for:", from);
          setPeerEntry(from, {
            ...entry,
            pendingCandidates: [...(entry.pendingCandidates || []), candidate],
          });
        }
      };

      const handleUserLeft = ({ userId }) => {
        log("user-left-call:", userId);
        handleRemovePeer(userId);

        setTimeout(() => {
          if (
            peersRef.current.size === 0 &&
            socket &&
            chatId &&
            !cleanedUpRef.current
          ) {
            log("All peers gone after user-left — rejoining call room");
            socket.emit("join-call-room", { roomId: chatId });
          }
        }, 2000);
      };

      socket.on("existing-participants", handleExistingParticipants);
      socket.on("webrtc-offer", handleOffer);
      socket.on("webrtc-answer", handleAnswer);
      socket.on("ice-candidate", handleIce);
      socket.on("user-left-call", handleUserLeft);
      socket.on("user-muted", handleUserMuted);

      return () => {
        socket.off("existing-participants", handleExistingParticipants);
        socket.off("webrtc-offer", handleOffer);
        socket.off("webrtc-answer", handleAnswer);
        socket.off("ice-candidate", handleIce);
        socket.off("user-left-call", handleUserLeft);
        socket.off("user-muted", handleUserMuted);
      };
    }, [socket, user?._id]);

    const cleanup = () => {
      if (cleanedUpRef.current) return;
      log("cleanup() called");
      cleanedUpRef.current = true;
      knownPeerIdsRef.current.clear();
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
      socket.emit("invite-to-call", {
        chatId,
        inviteeIds: [inviteeId],
        callType,
      });
      setInvitedUsers((prev) => new Set(prev).add(inviteeId));
      setShowAddParticipant(false);
    };

    const isFrontCamera = facingMode === "user";

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
                    {connectionFailed ? (
                      <>
                        <p className="text-sm font-medium text-slate-300">
                          Unable to connect
                        </p>
                        <button
                          onClick={() => {
                            setConnectionFailed(false);
                            hadConnectionRef.current = false;
                            socket.emit("join-call-room", { roomId: chatId });
                          }}
                          className="text-xs font-semibold text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 px-4 py-2 rounded-lg transition-colors"
                        >
                          Retry
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full border-2 border-sky-500/20 border-t-sky-400 animate-spin" />
                        <p className="text-xs font-medium text-slate-400 tracking-wide">
                          Connecting…
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ) : remoteStreams.length === 1 ? (
                <div
                  className="relative w-full h-full cursor-pointer"
                  onClick={() => canSwap && setSwapped(true)}
                >
                  <RemoteVideo stream={remoteStreams[0].stream} />
                  <span className="absolute bottom-2 left-3 text-[10px] text-white/40 font-medium z-10">
                    {remoteStreams[0].fName}
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

        {networkStatus !== "connected" &&
          (() => {
            const cfg = {
              poor: {
                bg: "bg-amber-500/90",
                icon: <AlertTriangle size={11} />,
              },
              reconnecting: { bg: "bg-sky-500/90", icon: <Wifi size={11} /> },
              offline: { bg: "bg-rose-600/90", icon: <WifiOff size={11} /> },
            }[networkStatus];
            return (
              <div
                className={`absolute top-0 left-0 right-0 z-50 flex items-center justify-center gap-1.5 py-1 ${cfg.bg} backdrop-blur-sm`}
              >
                <span className="text-white">{cfg.icon}</span>
                <span className="text-[11px] font-medium text-white">
                  {networkLabel}
                </span>
                {networkStatus === "reconnecting" && (
                  <span className="w-2 h-2 rounded-full border border-white border-t-transparent animate-spin ml-1" />
                )}
              </div>
            );
          })()}

        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-4 pb-8 bg-gradient-to-b from-slate-950/70 to-transparent">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-900/70 border border-white/10 rounded-full px-3 py-1.5 backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-semibold tracking-[1.8px] uppercase text-slate-400">
                Live
              </span>
            </div>
            <div className="bg-slate-900/70 border border-white/10 rounded-full px-2.5 py-1.5 backdrop-blur-md">
              <NetworkBar />
            </div>
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
              {swapped ? remoteStreams[selectedRemoteIndex]?.fName : "You"}
            </span>
          </div>
        )}

        {callType === "audio" && (
          <div className="flex-1 flex flex-col items-center justify-center px-4 py-6">
            <div
              style={{
                position: "absolute",
                width: 0,
                height: 0,
                overflow: "hidden",
              }}
            >
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
                      const playPromise = el.play();
                      if (playPromise !== undefined) {
                        playPromise.catch(() => {
                          setTimeout(() => {
                            el.play().catch(() => {});
                          }, 500);
                        });
                      }
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
                user={user}
                isMuted={isMuted}
                color={getAvatarColor(activeSpeakerId || user?.fName)}
                isSpeaking={activeSpeakerId === user?._id}
              />
              {remoteStreams.map((u) => (
                <ParticipantCard
                  key={u.userId}
                  color={getAvatarColor(activeSpeakerId || u?.fName)}
                  user={{ fName: u.fName, lName: u.lName, avatar: u.avatar }}
                  isMuted={u.isMuted}
                  isSpeaking={activeSpeakerId === u.userId}
                />
              ))}
            </div>

            <p className="text-xs mt-6 text-slate-500 tracking-wide">
              {remoteStreams.length === 0
                ? connectionFailed
                  ? "Unable to connect"
                  : "Connecting…"
                : "Connected"}
            </p>

            {connectionFailed && remoteStreams.length === 0 && (
              <button
                onClick={() => {
                  setConnectionFailed(false);
                  socket.emit("join-call-room", { roomId: chatId });
                }}
                className="mt-3 text-xs font-semibold text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 px-4 py-2 rounded-lg transition-colors"
              >
                Retry
              </button>
            )}
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
