import { useRef, useCallback } from "react";

export const useCallPeers = ({
  socket,
  user,
  chatId,
  chats,
  getLocalStream,
  getOrCreatePeer,
  getPeerEntry,
  setPeerEntry,
  removePeer,
  isMutedRef,
  isVideoOffRef,
  setRemoteStreams,
  wrappedOnConnected,
}) => {
  const lastRestartRef = useRef({});

  const getUserMeta = (userId) => {
    for (const chat of chats || []) {
      const u = chat?.users?.find((usr) => String(usr._id) === String(userId));
      if (u) {
        return {
          fName: u.fName,
          avatar: u.avatar,
        };
      }
    }
    return { fName: userId, avatar: null };
  };

  const addTracksIfNeeded = (peer, stream) => {
    const senders = peer.getSenders();

    stream.getTracks().forEach((track) => {
      const existing = senders.find((s) => s.track?.kind === track.kind);

      if (existing) {
        if (existing.track?.id !== track.id) {
          existing.replaceTrack(track).catch(() => {});
        }
        return;
      }

      const sender = peer.addTrack(track, stream);

      if (track.kind === "audio" && isMutedRef.current)
        sender.track.enabled = false;

      if (track.kind === "video" && isVideoOffRef.current)
        sender.track.enabled = false;
    });
  };

  const restartIce = useCallback(
    async (userId, peer) => {
      if (!socket?.connected || !peer) return;

      const now = Date.now();

      // ⏳ Prevent spamming restarts
      if (
        lastRestartRef.current[userId] &&
        now - lastRestartRef.current[userId] < 5000
      ) {
        console.log("⏳ Skipping ICE restart (cooldown)");
        return;
      }

      lastRestartRef.current[userId] = now;

      const entry = getPeerEntry(userId);

      if (entry?.makingOffer || entry?.restarting) return;

      // 💀 HARD FAIL → full reconnect
      if (peer.connectionState === "failed") {
        console.log("💀 Peer failed → forcing full reconnect");

        removePeer(userId);

        setTimeout(() => {
          initiateOffer(userId);
        }, 100);

        return;
      }

      // ♻️ Fix non-stable signaling state
      if (peer.signalingState !== "stable") {
        console.log(
          "♻️ Fixing non-stable state before ICE restart:",
          peer.signalingState
        );

        try {
          await peer.setLocalDescription({ type: "rollback" });
          console.log("✅ Rollback success");
        } catch (e) {
          console.log("❌ Rollback failed → forcing full reconnect");

          removePeer(userId);

          setTimeout(() => {
            initiateOffer(userId);
          }, 100);

          return;
        }
      }

      // 🔄 Mark restart in progress
      setPeerEntry(userId, {
        ...(entry || {}),
        restarting: true,
        makingOffer: true,
      });

      try {
        console.log("🔄 Restart ICE for:", userId);

        const offer = await peer.createOffer({ iceRestart: true });
        await peer.setLocalDescription(offer);

        socket.emit("webrtc-offer", {
          offer: peer.localDescription,
          to: userId,
          fromName: user?.fName,
          roomId: chatId,
        });
      } catch (e) {
        console.log("❌ ICE restart failed:", e);

        // 🔥 fallback safety
        removePeer(userId);

        setTimeout(() => {
          initiateOffer(userId);
        }, 100);
      } finally {
        const latest = getPeerEntry(userId);
        if (latest) {
          setPeerEntry(userId, {
            ...latest,
            restarting: false,
            makingOffer: false,
          });
        }
      }
    },
    [socket, chatId]
  );

  const createPeerConnection = (userId) => {
    const existing = getPeerEntry(userId);

    if (
      existing?.peer &&
      existing.peer.connectionState !== "closed" &&
      existing.peer.connectionState !== "failed"
    ) {
      return existing.peer;
    }

    const isPolite = String(user._id) < String(userId);
    const peer = getOrCreatePeer(userId, isPolite);

    // ICE
    peer.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("ice-candidate", {
          candidate: e.candidate,
          to: userId,
          roomId: chatId,
        });
      }
    };

    // TRACK
    peer.ontrack = (e) => {
      const stream = e.streams?.[0];
      if (!stream) return;

      const meta = getUserMeta(userId);

      setRemoteStreams((prev) => {
        const existing = prev.find((p) => p.userId === userId);

        // 🔥 prevent unnecessary re-render
        if (existing && existing.stream === stream) return prev;

        return [
          ...prev.filter((p) => p.userId !== userId),
          {
            userId,
            stream,
            fName: meta.fName,
            avatar: meta.avatar,
            isMuted: !stream.getAudioTracks()[0]?.enabled,
          },
        ];
      });
      wrappedOnConnected?.();
    };

    // STATE
    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;

      console.log("Connection state:", state);

      if (state === "connected") {
        peer.getSenders().forEach((sender) => {
          if (sender.track?.kind === "audio") {
            sender.track.enabled = !isMutedRef.current;
          }
          if (sender.track?.kind === "video") {
            sender.track.enabled = !isVideoOffRef.current;
          }
        });
      }

      if (state === "failed") {
        restartIce(userId, peer);
      }
    };

    peer.oniceconnectionstatechange = () => {
      const state = peer.iceConnectionState;

      console.log("ICE state:", state);

      if (state === "disconnected") {
        setTimeout(() => {
          if (
            peer.iceConnectionState === "disconnected" ||
            peer.iceConnectionState === "failed"
          ) {
            console.log("🔄 ICE recovery triggered");
            restartIce(userId, peer);
          }
        }, 6000);
      }

      if (state === "failed") {
        restartIce(userId, peer);
      }
    };

    return peer;
  };

  const initiateOffer = async (userId) => {
    if (!socket?.connected) return;

    let peer = createPeerConnection(userId);
    if (!peer) return;

    const stream = await getLocalStream();
    addTracksIfNeeded(peer, stream);

    let entry = getPeerEntry(userId);

    // ✅ recreate dead peer
    if (
      peer.connectionState === "failed" ||
      peer.connectionState === "closed"
    ) {
      console.log("♻️ Recreating peer:", userId);
      removePeer(userId);
      return initiateOffer(userId);
    }

    if (entry?.makingOffer) return;

    if (peer.signalingState !== "stable") {
      console.log("⚠️ Recovering non-stable state:", peer.signalingState);

      try {
        await peer.setLocalDescription({ type: "rollback" });
      } catch (e) {
        console.log("♻️ Recreating peer due to bad state");

        removePeer(userId);
        return initiateOffer(userId);
      }
    }

    // ✅ transceiver fix
    peer.getTransceivers().forEach((t) => {
      if (t.direction !== "sendrecv") {
        t.direction = "sendrecv";
      }
    });

    // ✅ debounce
    if (entry?.lastOfferTime && Date.now() - entry.lastOfferTime < 2000) {
      console.log("⏳ Skipping duplicate offer");
      return;
    }

    setPeerEntry(userId, {
      ...(entry || {}),
      makingOffer: true,
      lastOfferTime: Date.now(),
    });

    try {
      console.log("📤 Creating offer →", userId);

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      socket.emit("webrtc-offer", {
        offer: peer.localDescription,
        to: userId,
        fromName: user?.fName,
        roomId: chatId,
      });
    } catch (err) {
      console.error("❌ Offer error:", err);
    } finally {
      const latest = getPeerEntry(userId);
      if (latest) {
        setPeerEntry(userId, {
          ...latest,
          makingOffer: false,
        });
      }
    }
  };

  return {
    createPeerConnection,
    initiateOffer,
    addTracksIfNeeded,
  };
};
