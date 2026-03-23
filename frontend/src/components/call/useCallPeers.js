import { useRef, useEffect } from "react";

export const useCallPeers = ({
  socket,
  user,
  chatId,
  chats,
  getOrCreatePeer,
  getPeerEntry,
  setPeerEntry,
  removePeer,
  isMutedRef,
  isVideoOffRef,
  setRemoteStreams,
  wrappedOnConnected,
  adaptBitrateToNetwork,
}) => {
  const sharedAudioContextRef = useRef(null);
  const animationFramesRef = useRef(new Map());
  const audioNodesRef = useRef(new Map());

  const getAudioContext = () => {
    if (
      !sharedAudioContextRef.current ||
      sharedAudioContextRef.current.state === "closed"
    ) {
      sharedAudioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
    }
    if (sharedAudioContextRef.current.state === "suspended") {
      sharedAudioContextRef.current.resume();
    }
    return sharedAudioContextRef.current;
  };

  const getUserMeta = (userId) => {
    for (const chat of chats || []) {
      const u = chat?.users?.find((usr) => String(usr._id) === String(userId));
      if (u) {
        return {
          fName: u.fName,
          lName: u.lName ?? null,
          avatar: u.avatar ?? null,
        };
      }
    }
    return { fName: userId, lName: null, avatar: null };
  };

  const setupSpeakingDetection = (userId, incomingStream) => {
    const audioTrack = incomingStream.getAudioTracks()[0];
    if (!audioTrack) return;

    const existingFrame = animationFramesRef.current.get(userId);
    if (existingFrame) {
      cancelAnimationFrame(existingFrame);
      animationFramesRef.current.delete(userId);
    }

    const prevNodes = audioNodesRef.current.get(userId);
    if (prevNodes) {
      try {
        prevNodes.source?.disconnect();
      } catch {}
      try {
        prevNodes.analyser?.disconnect();
      } catch {}
      audioNodesRef.current.delete(userId);
    }

    const audioContext = getAudioContext();
    const source = audioContext.createMediaStreamSource(
      new MediaStream([audioTrack])
    );
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    audioNodesRef.current.set(userId, { source, analyser });

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let lastSpeaking = false;

    const detect = () => {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const isSpeaking = avg > 25;

      if (isSpeaking !== lastSpeaking) {
        lastSpeaking = isSpeaking;
        setRemoteStreams((prev) =>
          prev.map((s) =>
            s.userId === userId
              ? { ...s, isSpeaking: !s.isMuted && isSpeaking }
              : s
          )
        );
      }

      animationFramesRef.current.set(userId, requestAnimationFrame(detect));
    };

    animationFramesRef.current.set(userId, requestAnimationFrame(detect));
  };

  const handleRemovePeer = (userId) => {
    const frame = animationFramesRef.current.get(userId);
    if (frame) {
      cancelAnimationFrame(frame);
      animationFramesRef.current.delete(userId);
    }

    const nodes = audioNodesRef.current.get(userId);
    if (nodes) {
      try {
        nodes.source?.disconnect();
      } catch {}
      try {
        nodes.analyser?.disconnect();
      } catch {}
      audioNodesRef.current.delete(userId);
    }

    removePeer(userId);
    setRemoteStreams((prev) => prev.filter((s) => s.userId !== userId));
  };

  const addTracksIfNeeded = (peer, stream) => {
    const senders = peer.getSenders();

    stream.getTracks().forEach((track) => {
      const existingSender = senders.find((s) => s.track?.kind === track.kind);

      if (existingSender) {
        if (
          existingSender.track?.readyState === "ended" ||
          existingSender.track?.id !== track.id
        ) {
          existingSender.replaceTrack(track).catch((err) => {
            console.warn("[useCallPeers] replaceTrack failed:", err);
          });
        }
        return;
      }

      try {
        const sender = peer.addTrack(track, stream);
        if (track.kind === "audio" && isMutedRef.current)
          sender.track.enabled = false;
        if (track.kind === "video" && isVideoOffRef.current)
          sender.track.enabled = false;
      } catch (err) {
        console.warn("[useCallPeers] addTrack failed:", err);
      }
    });
  };

  const createPeerConnection = (userId, fromName) => {
    const existing = getPeerEntry(userId);

    if (
      existing?.peer &&
      existing.peer.connectionState !== "closed" &&
      existing.peer.connectionState !== "failed"
    ) {
      return existing.peer;
    }

    if (existing?.peer) {
      try {
        existing.peer.ontrack = null;
        existing.peer.onicecandidate = null;
        existing.peer.onconnectionstatechange = null;
        existing.peer.oniceconnectionstatechange = null;
        existing.peer.onnegotiationneeded = null;
        existing.peer.close();
      } catch {}
    }

    const polite = user._id.localeCompare(userId) > 0;
    const peer = getOrCreatePeer(userId, polite);
    if (!peer) return null;

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("ice-candidate", {
          candidate: e.candidate,
          to: userId,
          roomId: chatId,
        });
      }
    };

    peer.onnegotiationneeded = async () => {
      // FIX: guard closed peer
      if (peer.connectionState === "closed") return;
      const entry = getPeerEntry(userId);
      if (entry?.makingOffer) return;
      if (peer.signalingState !== "stable") return;

      const now = Date.now();
      const lastOffer = peer._lastOfferTime || 0;
      if (now - lastOffer < 2000) return;
      peer._lastOfferTime = now;

      try {
        setPeerEntry(userId, { ...getPeerEntry(userId), makingOffer: true });
        const offer = await peer.createOffer();
        if (peer.signalingState !== "stable") return;
        await peer.setLocalDescription(offer);
        socket.emit("webrtc-offer", {
          offer: peer.localDescription,
          to: userId,
          fromName: user?.fName,
          roomId: chatId,
        });
      } catch (err) {
        console.warn("[useCallPeers] onnegotiationneeded offer error:", err);
      } finally {
        const latest = getPeerEntry(userId);
        if (latest) setPeerEntry(userId, { ...latest, makingOffer: false });
      }
    };

    peer.ontrack = (e) => {
      const incomingStream = e.streams?.[0];
      if (!incomingStream) return;
      console.log(
        "🎥 ontrack fired — kind:",
        e.track.kind,
        "streamId:",
        incomingStream.id
      );

      const meta = getUserMeta(userId);
      const fName = meta.fName !== userId ? meta.fName : fromName ?? userId;
      const { lName, avatar } = meta;

      // FIX: only setup speaking detection on audio track, not on every track event
      if (e.track.kind === "audio") {
        setupSpeakingDetection(userId, incomingStream);
      }

      setRemoteStreams((prev) => {
        const updated = prev.filter((s) => s.userId !== userId);

        return [
          ...updated,
          {
            userId,
            stream: incomingStream,
            streamId: incomingStream.id + "-" + Date.now(), // 🔥 KEY FIX
            fName,
            lName,
            avatar,
            isSpeaking: false,
            isMuted: !incomingStream.getAudioTracks()[0]?.enabled,
          },
        ];
      });

      wrappedOnConnected?.();
    };

    peer.oniceconnectionstatechange = async () => {
      const state = peer.iceConnectionState;
      console.log("ICE state:", state);

      // ✅ When reconnected → re-apply bitrate
      if (state === "connected") {
        console.log("✅ ICE connected — applying bitrate tuning");
        try {
          adaptBitrateToNetwork?.(); // 🔥 ADD THIS
        } catch {}
      }

      // ignore temporary
      if (state === "disconnected") {
        console.log("⚠️ ICE disconnected — waiting...");
        return;
      }

      // restart only if failed
      if (state === "failed") {
        console.log("🔄 ICE failed — restarting");

        try {
          if (peer.signalingState !== "stable") return;

          const offer = await peer.createOffer({ iceRestart: true });
          await peer.setLocalDescription(offer);

          socket.emit("webrtc-offer", {
            offer: peer.localDescription,
            to: userId,
            fromName: user?.fName,
            roomId: chatId,
          });
        } catch (e) {
          console.warn("ICE restart failed:", e);
        }
      }
    };

    return peer;
  };

  const initiateOffer = async (userId, getLocalStream) => {
    if (!getLocalStream) return;

    let peer = createPeerConnection(userId);
    if (!peer) return;

    const stream = await getLocalStream();
    if (!stream || stream.getTracks().length === 0) {
      console.warn("❌ No local tracks available");
      return;
    }

    let entry = getPeerEntry(userId);
    if (!entry) {
      getOrCreatePeer(userId);
      entry = getPeerEntry(userId);
    }
    if (!entry) return;

    if (peer.signalingState === "have-local-offer") {
      try {
        console.warn("⚠️ Peer stuck in have-local-offer — rolling back");
        await peer.setLocalDescription({ type: "rollback" });
        setPeerEntry(userId, {
          ...(getPeerEntry(userId) || {}),
          makingOffer: false,
        });
        entry = getPeerEntry(userId);
        peer = entry?.peer;
        if (!peer || peer.signalingState !== "stable") return;
      } catch (e) {
        console.warn("❌ Rollback failed — closing peer");
        try {
          peer.ontrack = null;
          peer.onicecandidate = null;
          peer.onconnectionstatechange = null;
          peer.oniceconnectionstatechange = null;
          peer.onnegotiationneeded = null;
          peer.close();
        } catch {}
        removePeer(userId);
        return;
      }
    }

    if (peer.signalingState !== "stable") {
      console.warn("⚠️ Peer not stable:", peer.signalingState);
      return;
    }

    setPeerEntry(userId, {
      ...(getPeerEntry(userId) || {}),
      makingOffer: true,
    });

    addTracksIfNeeded(peer, stream);

    await new Promise((r) => setTimeout(r, 0));

    if (peer.signalingState !== "stable") {
      console.warn(
        "⚠️ Peer state changed during track add:",
        peer.signalingState
      );
      setPeerEntry(userId, {
        ...(getPeerEntry(userId) || {}),
        makingOffer: false,
      });
      return;
    }

    try {
      const offer = await peer.createOffer();
      if (peer.signalingState !== "stable") {
        setPeerEntry(userId, {
          ...(getPeerEntry(userId) || {}),
          makingOffer: false,
        });
        return;
      }
      await peer.setLocalDescription(offer);
      socket.emit("webrtc-offer", {
        offer: peer.localDescription,
        to: userId,
        fromName: user?.fName,
        roomId: chatId,
      });
    } catch (err) {
      console.error("❌ offer error:", err);
      try {
        peer.close();
      } catch {}
      removePeer(userId);
    } finally {
      const latest = getPeerEntry(userId);
      if (latest)
        setPeerEntry(userId, { ...(latest || {}), makingOffer: false });
    }
  };

  useEffect(() => {
    const frames = animationFramesRef.current;
    const audioNodes = audioNodesRef.current;

    return () => {
      frames.forEach((frame) => cancelAnimationFrame(frame));
      frames.clear();

      audioNodes.forEach(({ source, analyser }) => {
        try {
          source?.disconnect();
        } catch {}
        try {
          analyser?.disconnect();
        } catch {}
      });
      audioNodes.clear();

      try {
        sharedAudioContextRef.current?.close();
      } catch {}
    };
  }, []);

  return {
    handleRemovePeer,
    addTracksIfNeeded,
    createPeerConnection,
    initiateOffer,
  };
};
