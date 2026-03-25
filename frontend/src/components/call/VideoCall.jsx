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
import { MicOff, Wifi, WifiOff, AlertTriangle } from "lucide-react";
import ParticipantCard from "./ParticipantCard";
import { getAvatarColor } from "../../utils/getAvatarColor";
import PiPThumbnail from "./PiPThumbnail";

const log = (...args) => console.log("[VideoCall]", ...args);

const startWatchdog = ({
  cleanedUpRef,
  peersRef,
  setConnectionFailed,
  cleanupRef,
  initiateOffer,
}) => {
  if (cleanupRef.current?.watchdog) {
    clearInterval(cleanupRef.current.watchdog);
  }

  let watchdogAttempt = 0;
  const MAX_WATCHDOG_RETRIES = 5;

  const watchdog = setInterval(async () => {
    if (cleanedUpRef.current) {
      clearInterval(watchdog);
      return;
    }

    const hasRemote =
      peersRef.current.size > 0 &&
      [...peersRef.current.values()].some(
        ({ peer }) => peer && peer.connectionState === "connected"
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

    console.log("🔧 Watchdog → fixing peers");

    for (const [userId, entry] of peersRef.current.entries()) {
      const peer = entry?.peer;
      if (!peer) continue;

      const state = peer.connectionState;
      console.log("👀 Peer:", userId, state);

      if (state === "connected" || state === "connecting") continue;

      try {
        if (state === "new" || state === "disconnected" || state === "failed") {
          if (peer.signalingState !== "stable") {
            console.log("♻️ Watchdog forcing recovery:", userId);

            try {
              await peer.setLocalDescription({ type: "rollback" });
            } catch {}

            await initiateOffer(userId);
            continue;
          }
        }
      } catch (e) {
        console.log("❌ Watchdog error:", e);
      }
    }
  }, 8000);

  cleanupRef.current = { ...cleanupRef.current, watchdog };
};

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
    const hasCalledRef = useRef(false);
    const lastJoinRef = useRef(0);
    const joinInFlightRef = useRef(false);
    const knownPeerIdsRef = useRef(new Set());
    const emptyParticipantsRetryRef = useRef(0);
    const userLeftTimerRef = useRef(null);
    const isRejoinRef = useRef(false);

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

    const activeVideoRef = swapped ? localVideoMainRef : localVideoRef;

    const safeJoinRoom = useCallback(() => {
      if (!socket || !chatId || cleanedUpRef.current) return;

      const now = Date.now();

      if (joinInFlightRef.current) return;
      if (now - lastJoinRef.current < 3000) {
        log("🚫 join-call-room skipped (throttled)");
        return;
      }

      lastJoinRef.current = now;
      joinInFlightRef.current = true;

      log("✅ join-call-room");
      socket.emit("join-call-room", { roomId: chatId });

      setTimeout(() => {
        joinInFlightRef.current = false;
      }, 1000);
    }, [socket, chatId]);

    useEffect(() => {
      const interval = setInterval(() => {
        const video = localVideoRef.current || localVideoMainRef.current;

        if (!video) return;

        if (video.paused) {
          video.play().catch(() => {});
        }
      }, 4000);

      return () => clearInterval(interval);
    }, []);

    useEffect(() => {
      const call = JSON.parse(localStorage.getItem("ongoingCall"));

      if (call?.chatId === chatId) {
        isRejoinRef.current = true;
        console.log("♻️ Rejoin detected");
      }
    }, [chatId]);

    const wrappedOnConnected = useCallback(() => {
      hadConnectionRef.current = true;
      onConnected?.();
    }, [onConnected]);

    useEffect(() => {
      facingModeRef.current = facingMode;
    }, [facingMode]);

    useEffect(() => {
      const activeVideo = swapped
        ? localVideoMainRef.current
        : localVideoRef.current;

      const inactiveVideo = swapped
        ? localVideoRef.current
        : localVideoMainRef.current;

      if (!activeVideo || !localStreamRef.current) return;

      // ✅ attach ONLY to active video
      activeVideo.srcObject = localStreamRef.current;
      activeVideo.muted = true;
      activeVideo.playsInline = true;
      activeVideo.autoplay = true;
      activeVideo.play().catch(() => {});

      // ❗ detach inactive video (VERY IMPORTANT)
      if (inactiveVideo) {
        inactiveVideo.srcObject = null;
      }
    }, [swapped]);

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
    }, [remoteStreams.length, swapped]);

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

    useEffect(() => {
      if (!socket) return;

      if (isRejoinRef.current && socket.connected) {
        console.log("📡 Sending rejoin ping (socket ready)");

        socket.emit("ping-rejoin", {
          chatId,
        });

        // ✅ prevent duplicate
        isRejoinRef.current = false;
      }
    }, [socket?.connected, chatId]);

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

    const { addTracksIfNeeded, createPeerConnection, initiateOffer } =
      useCallPeers({
        socket,
        user,
        chatId,
        chats,
        getLocalStream,
        getOrCreatePeer,
        getPeerEntry,
        removePeer,
        setPeerEntry,
        isMutedRef,
        isVideoOffRef,
        setRemoteStreams,
        wrappedOnConnected,
        adaptBitrateToNetwork,
        peersRef,
      });

    useEffect(() => {
      if (!socket || !chatId) return;

      if (peersRef.current.size > 0 && !cleanedUpRef.current) {
        console.log("🚫 Prevent re-init during active call");
        return;
      }

      log("useEffect init — chatId:", chatId);
      cleanedUpRef.current = false;
      emptyParticipantsRetryRef.current = 0;

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

        const attempt = async () => {
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

          // ❌ OFFLINE HANDLING
          if (!navigator.onLine) {
            setNetworkStatus("offline");
            setNetworkLabel("Offline");

            if (retryCount < MAX_RETRIES) {
              retryCount++;
              timeout = setTimeout(attempt, 3000);
            }
            return;
          }

          retryCount = 0;

          const effectiveType = connection?.effectiveType;
          const downlink = connection?.downlink;

          // ✅ network status
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
            setNetworkStatus("connected"); // ✅ FIXED
            setNetworkLabel("");
          }

          // ✅ ensure local video is playing
          [localVideoRef.current, localVideoMainRef.current].forEach(
            (video) => {
              if (!video) return;

              if (!video.srcObject && localStreamRef.current) {
                video.srcObject = localStreamRef.current;
              }

              if (video.paused || video.readyState < 2) {
                console.log("▶️ Resume video");
                video.play().catch(() => {});
              }
            }
          );

          // ✅ FIX: ONLY reset video track (NO renegotiation here)
          for (const [userId, { peer }] of peersRef.current.entries()) {
            if (!peer) continue;

            try {
              const videoTrack = localStreamRef.current?.getVideoTracks()[0];

              if (videoTrack) {
                const sender = peer
                  .getSenders()
                  .find((s) => s.track?.kind === "video");

                if (sender) {
                  console.log("🎥 Soft video refresh:", userId);

                  await sender.replaceTrack(null);
                  await new Promise((r) => setTimeout(r, 100));
                  await sender.replaceTrack(videoTrack);
                }
              }
            } catch (e) {
              console.log("❌ Soft refresh failed:", e);
            }
          }

          // ✅ bitrate adjust only
          if (networkStatus !== "poor") {
            adaptBitrateToNetwork();
          }
        };

        return () => {
          clearTimeout(timeout);
          retryCount = 0;

          console.log("🌐 Network change detected (debounced)");
          timeout = setTimeout(attempt, 3000);
        };
      })();

      const handleOnline = () => {
        console.log("🌐 Network back online");

        // ✅ reset join throttle
        lastJoinRef.current = 0;
        joinInFlightRef.current = false;

        setNetworkStatus("reconnecting");
        setNetworkLabel("Reconnecting…");

        // ✅ reattach local video
        const videoTrack = localStreamRef.current?.getVideoTracks()[0];
        if (videoTrack && localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
          localVideoRef.current.play().catch(() => {});
        }

        // ✅ STEP 1: rejoin signaling room
        safeJoinRoom();

        // ✅ STEP 2: HARD RESET video pipeline + single renegotiation
        setTimeout(async () => {
          if (!socket?.connected) return;

          for (const [userId, { peer }] of peersRef.current.entries()) {
            if (!peer) continue;

            if (
              peer.connectionState !== "connected" &&
              peer.connectionState !== "connecting"
            )
              continue;

            try {
              const videoTrack = localStreamRef.current?.getVideoTracks()[0];

              if (videoTrack) {
                const sender = peer
                  .getSenders()
                  .find((s) => s.track?.kind === "video");

                if (sender) {
                  console.log("🎥 Reset video track (online):", userId);

                  await sender.replaceTrack(null);
                  await new Promise((r) => setTimeout(r, 150));
                  await sender.replaceTrack(videoTrack);
                }
              }

              console.log("📤 Renegotiate after online:", userId);
              await initiateOffer(userId); // ✅ ONLY ONE PLACE
            } catch (e) {
              console.log("❌ Online recovery failed:", e);
            }
          }
        }, 600); // ✅ safe delay

        // ✅ STEP 3: run network stabilization (NO renegotiation inside)
        setTimeout(() => {
          handleConnectionChange();
        }, 300);
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

      const handleUserJoinedEarly = async ({ userId }) => {
        if (cleanedUpRef.current) return;
        clearTimeout(userLeftTimerRef.current);

        log("user-joined-call (early handler):", userId);

        if (!userId || String(userId) === String(user?._id)) return;

        knownPeerIdsRef.current.add(userId);

        const existingEntry = getPeerEntry(userId);
        if (existingEntry?.peer) return;
        if (pendingPeersRef.current.has(userId)) return;

        pendingPeersRef.current.add(userId);
        try {
          await initiateOffer(userId);
        } finally {
          pendingPeersRef.current.delete(userId);
        }
      };

      socket.on("user-joined-call", handleUserJoinedEarly);

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
          safeJoinRoom();

          if (
            initiator?.isInitiator &&
            initiator?.receiverIds?.length &&
            !hasCalledRef.current &&
            socket?.connected
          ) {
            hasCalledRef.current = true;

            socket.emit("video-call-user", {
              chatId,
              receiverIds: initiator.receiverIds,
              isGroup: !!initiator.isGroup,
              callType,
            });
          }

          startWatchdog({
            cleanedUpRef,
            peersRef,
            setConnectionFailed,
            cleanupRef,
            initiateOffer,
          });

          log("init() complete");
        } catch (err) {
          logger("[VideoCall] init error:", err);
        }
      };

      init();

      return () => {
        if (cleanupRef.current?.watchdog) {
          clearInterval(cleanupRef.current.watchdog);
        }
        clearTimeout(userLeftTimerRef?.current);
        socket.off("user-joined-call", handleUserJoinedEarly);

        navigator.mediaDevices.removeEventListener(
          "devicechange",
          handleDeviceChange
        );

        if (connection) {
          connection.removeEventListener("change", handleConnectionChange);
        }

        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);

        localStreamRef.current?.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
        localStreamRef.current = null;

        hasCalledRef.current = false;
        lastJoinRef.current = 0;
        joinInFlightRef.current = false;

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
          emptyParticipantsRetryRef.current += 1;

          if (emptyParticipantsRetryRef.current > 10) {
            log("Too many empty retries — stopping");
            setConnectionFailed(true);
            return;
          }

          log(
            `existing-participants empty — retry ${emptyParticipantsRetryRef.current}/10`
          );

          const isPolite = user._id < chatId;
          const delay = isPolite ? 4000 : 2000;

          setTimeout(() => {
            if (!cleanedUpRef.current && socket) {
              safeJoinRoom();
            }
          }, delay);

          return;
        }

        for (const { userId } of others) {
          knownPeerIdsRef.current.add(userId);

          const entry = getPeerEntry(userId);

          log(
            `Participant ${userId} — existingPeer: ${!!entry?.peer}, state: ${
              entry?.peer?.connectionState
            }, makingOffer: ${entry?.makingOffer}, restarting: ${
              entry?.restarting
            }, pendingCandidates: ${entry?.pendingCandidates?.length ?? 0}`
          );

          if (entry?.peer) {
            const state = entry.peer.connectionState;

            if (state === "connected" || state === "connecting") {
              continue;
            }

            // 🔥 KEY FIX: allow recovery
            if (
              state === "new" ||
              state === "disconnected" ||
              state === "failed"
            ) {
              console.log("♻️ Recovering stuck peer:", userId);
              await initiateOffer(userId);
              continue;
            }

            if (entry.makingOffer || entry.restarting) {
              continue;
            }
          }

          if (entry?.pendingCandidates?.length && !entry?.peer) {
            console.log(
              `Pre-creating peer for ${userId} — has ${entry.pendingCandidates.length} pending candidates`
            );
            createPeerConnection(userId);
          }

          console.log("Initiating offer to existing participant:", userId);
          await initiateOffer(userId);
        }

        emptyParticipantsRetryRef.current = 0;
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

        let peer = createPeerConnection(from);
        if (!peer) return;

        let entry = getPeerEntry(from);
        if (!entry) {
          return;
        }

        const offerCollision =
          entry.makingOffer || peer.signalingState !== "stable";

        log(
          `Offer collision — makingOffer: ${entry.makingOffer}, state: ${peer.signalingState}, polite: ${entry.polite}`
        );

        if (offerCollision) {
          if (!entry.polite) {
            console.log("❌ Ignoring offer (impolite)");
            return;
          }

          console.log("✅ Polite peer rollback");

          try {
            await peer.setLocalDescription({ type: "rollback" });
          } catch {
            peer.close();
            removePeer(from);
            peer = createPeerConnection(from);
          }
        }

        addTracksIfNeeded(peer, stream);

        if (peer.signalingState !== "stable") {
          console.log("⚠️ Forcing recovery from:", peer.signalingState);

          try {
            await peer.setLocalDescription({ type: "rollback" });
          } catch (e) {
            console.log("Rollback failed, recreating peer");

            peer.close();
            removePeer(from);
            peer = createPeerConnection(from);
          }
        }

        await peer.setRemoteDescription(offer);

        const latest = getPeerEntry(from);
        if (latest?.pendingCandidates?.length) {
          log(`Flushing ${latest.pendingCandidates.length} ICE`);
          for (const c of latest.pendingCandidates) {
            await peer.addIceCandidate(c).catch(() => {});
          }
          setPeerEntry(from, { ...latest, pendingCandidates: [] });
        }

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        log("Sending answer to:", from);

        if (cleanedUpRef.current) return;

        socket.emit("webrtc-answer", {
          answer: peer.localDescription,
          to: from,
          roomId: chatId,
        });
      };

      const handleAnswer = async ({ answer, from }) => {
        const entry = getPeerEntry(from);
        if (!entry?.peer) return;

        const peer = entry.peer;

        try {
          console.log(
            "📥 Applying answer from:",
            from,
            "| state:",
            peer.signalingState
          );

          // ✅ Always try applying answer
          await peer.setRemoteDescription(answer);

          // ✅ flush pending ICE
          const latest = getPeerEntry(from);
          if (latest?.pendingCandidates?.length) {
            console.log(
              "🧊 Flushing ICE candidates:",
              latest.pendingCandidates.length
            );

            for (const c of latest.pendingCandidates) {
              await peer.addIceCandidate(c).catch(() => {});
            }

            setPeerEntry(from, {
              ...latest,
              pendingCandidates: [],
            });
          }
        } catch (err) {
          console.log("❌ Answer apply failed:", err);

          // 🔥 Recovery (important)
          if (peer.signalingState !== "stable") {
            try {
              console.log("♻️ Forcing recovery via rollback");

              await peer.setLocalDescription({ type: "rollback" });
              await peer.setRemoteDescription(answer);
            } catch (err) {
              console.log("❌ Answer apply failed:", err);

              if (peer.signalingState !== "stable") {
                try {
                  console.log("♻️ Forcing rollback recovery");

                  await peer.setLocalDescription({ type: "rollback" });
                  await peer.setRemoteDescription(answer);
                } catch (e) {
                  console.log("💀 Hard reset peer");

                  removePeer(from);

                  createPeerConnection(from);

                  // ✅ THIS IS WHAT SHOULD COME HERE
                  setTimeout(() => {
                    console.log("♻️ Re-initiating offer after reset:", from);
                    initiateOffer(from);
                  }, 100);
                }
              }
            }
          }
        }
      };

      const handleIce = async ({ candidate, from }) => {
        if (cleanedUpRef.current) return;

        const entry = getPeerEntry(from);

        if (!entry) {
          setPeerEntry(from, {
            peer: null,
            pendingCandidates: [candidate],
            makingOffer: false,
            polite: user._id < from,
            restarting: false,
            recoveryAttempts: 0,
          });
          return;
        }

        if (entry.peer?.remoteDescription) {
          await entry.peer.addIceCandidate(candidate).catch(() => {});
        } else {
          setPeerEntry(from, {
            ...entry,
            pendingCandidates: [...(entry.pendingCandidates || []), candidate],
          });
        }
      };

      const handleUserLeft = ({ userId }) => {
        console.log("User maybe left:", userId);

        setTimeout(() => {
          const entry = getPeerEntry(userId);
          if (!entry?.peer) return;

          const state = entry.peer.connectionState;

          if (state === "disconnected" || state === "failed") {
            console.log("Removing peer:", userId);
            removePeer(userId);
          } else {
            console.log("Recovered, not removing:", userId);
          }
        }, 5000);
      };

      const handlePeerRejoin = async ({ userId }) => {
        console.log("♻️ Peer rejoined:", userId);

        if (!userId || String(userId) === String(user?._id)) return;

        try {
          await initiateOffer(userId); // 🔥 force renegotiation
        } catch (e) {
          console.log("Rejoin offer failed:", e);
        }
      };

      socket.on("peer-rejoin", handlePeerRejoin);

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
        socket.off("peer-rejoin", handlePeerRejoin);
      };
    }, [
      socket,
      user?._id,
      user?.fName,
      chatId,
      createPeerConnection,
      getLocalStream,
      getPeerEntry,
      initiateOffer,
      removePeer,
      setPeerEntry,
      addTracksIfNeeded,
      safeJoinRoom,
    ]);

    const cleanup = () => {
      if (cleanedUpRef.current) return;
      log("cleanup() called");
      cleanedUpRef.current = true;

      clearTimeout(userLeftTimerRef.current);
      if (cleanupRef.current?.watchdog) {
        clearInterval(cleanupRef.current.watchdog);
      }

      knownPeerIdsRef.current.clear();
      hadConnectionRef.current = false;
      emptyParticipantsRetryRef.current = 0;
      pendingPeersRef.current.clear();

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
      setConnectionFailed(false);
      setNetworkStatus("connected");
      setNetworkLabel("");

      hasCalledRef.current = false;
      lastJoinRef.current = 0;
      joinInFlightRef.current = false;
    };

    cleanupRef.current = cleanup;
    useEffect(() => () => cleanupRef.current?.(), []);
    useImperativeHandle(ref, () => ({
      cleanup: () => cleanupRef.current?.(),
      getParticipants: () => getFinalParticipants(),
    }));

    const callChat = useMemo(
      () => chats?.find((c) => String(c._id) === String(chatId)),
      [chats, chatId]
    );

    const getFinalParticipants = () => {
      const map = new Map();

      // self
      map.set(user._id, {
        _id: user._id,
        name: user.fName,
        avatar: user.avatar,
      });

      // joined users (real participants)
      remoteStreams.forEach((u) => {
        if (!u?.userId) return;
        map.set(u.userId, {
          _id: u.userId,
          name: u.fName,
          avatar: u.avatar,
        });
      });

      return Array.from(map.values());
    };

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

      setInvitedUsers((prev) => {
        const updated = new Set(prev);
        updated.add(inviteeId);
        return updated;
      });

      setShowAddParticipant(false);
    };

    const isFrontCamera = facingMode === "user";

    const networkCfgMap = {
      poor: { bg: "bg-amber-500/90", icon: <AlertTriangle size={11} /> },
      reconnecting: { bg: "bg-sky-500/90", icon: <Wifi size={11} /> },
      offline: { bg: "bg-rose-600/90", icon: <WifiOff size={11} /> },
    };
    const networkCfg = networkCfgMap[networkStatus];

    return (
      <div className="relative w-full h-full bg-slate-950 overflow-hidden flex flex-col">
        {callType === "video" && (
          <div className="flex-1 relative min-h-0 overflow-hidden">
            {/* ── Main view (remote or local when swapped) ── */}
            <div
              className={`absolute inset-0 transition-all duration-300 ease-in-out ${
                swapped
                  ? "opacity-0 scale-95 pointer-events-none"
                  : "opacity-100 scale-100"
              }`}
            >
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
                            emptyParticipantsRetryRef.current = 0;
                            startWatchdog({
                              cleanedUpRef,
                              peersRef,
                              setConnectionFailed,
                              cleanupRef,
                              initiateOffer,
                            });
                            safeJoinRoom();
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
                  {remoteStreams[0]?.stream && (
                    <RemoteVideo stream={remoteStreams[0].stream} />
                  )}
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
                // ✅ 2 remote = horizontal split (top/bottom), 3+ = grid
                <div
                  className={`w-full h-full p-1 grid gap-1 ${
                    remoteStreams.length === 2
                      ? "grid-cols-1 grid-rows-2"
                      : remoteStreams.length === 3
                      ? "grid-cols-2 grid-rows-2"
                      : remoteStreams.length === 4
                      ? "grid-cols-2 grid-rows-2"
                      : remoteStreams.length <= 6
                      ? "grid-cols-3 grid-rows-2"
                      : "grid-cols-3 grid-rows-3"
                  }`}
                >
                  {remoteStreams.map(
                    ({ userId, stream, fName, isMuted }, i) => (
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
                          {fName}
                        </span>
                        {isMuted && (
                          <span className="absolute bottom-2 right-2 z-10 bg-black/70 backdrop-blur-md p-1.5 rounded-full border border-white/10">
                            <MicOff size={12} className="text-white" />
                          </span>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {/* ── Local (self) view when swapped to main ── */}
            <div
              className={`absolute inset-0 transition-all duration-300 ease-in-out ${
                swapped
                  ? "opacity-100 scale-100"
                  : "opacity-0 scale-95 pointer-events-none"
              }`}
            >
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

        {/* ── Network status banner ── */}
        {networkStatus !== "connected" && networkCfg && (
          <div
            className={`absolute top-0 left-0 right-0 z-50 flex items-center justify-center gap-1.5 py-1 ${networkCfg.bg} backdrop-blur-sm`}
          >
            <span className="text-white">{networkCfg.icon}</span>
            <span className="text-[11px] font-medium text-white">
              {networkLabel}
            </span>
            {networkStatus === "reconnecting" && (
              <span className="w-2 h-2 rounded-full border border-white border-t-transparent animate-spin ml-1" />
            )}
          </div>
        )}

        {/* ── Top bar ── */}
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

        {/* ── PiP thumbnail ── */}
        {callType === "video" && (
          <PiPThumbnail
            swapped={swapped}
            canSwap={canSwap}
            onSwap={() => canSwap && setSwapped((p) => !p)}
            remoteStreams={remoteStreams}
            selectedRemoteIndex={selectedRemoteIndex}
            isMuted={isMuted}
            localVideoRef={localVideoRef}
            isFrontCamera={isFrontCamera}
            isVideoOff={isVideoOff}
          />
        )}

        {/* ── Audio call UI ── */}
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
              {remoteStreams
                .filter((u) => u && u.userId)
                .map((u) => (
                  <audio
                    key={`${u.userId}-${u.stream?.id ?? "no-stream"}`}
                    autoPlay
                    playsInline
                    ref={(el) => {
                      if (el && u.stream) {
                        try {
                          el.srcObject = u.stream;
                          el.muted = false;
                          el.volume = 1;
                          const p = el.play();
                          if (p !== undefined)
                            p.catch(() =>
                              setTimeout(() => el.play().catch(() => {}), 500)
                            );
                        } catch (e) {
                          console.warn("[AudioCall] ref error:", e);
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
              {remoteStreams
                .filter((u) => u && u.userId)
                .map((u) => (
                  <ParticipantCard
                    key={u.userId}
                    color={getAvatarColor(u?.fName || u.userId)}
                    user={{
                      fName: u.fName || "...",
                      lName: u.lName,
                      avatar: u.avatar,
                    }}
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
                  emptyParticipantsRetryRef.current = 0;
                  startWatchdog({
                    cleanedUpRef,
                    peersRef,
                    setConnectionFailed,
                    cleanupRef,
                    initiateOffer,
                  });
                  safeJoinRoom();
                }}
                className="mt-3 text-xs font-semibold text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 px-4 py-2 rounded-lg transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* ── Controls ── */}
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
