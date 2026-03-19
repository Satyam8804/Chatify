import { useRef } from "react";

export const useCallPeers = ({
  socket,
  user,
  chatId,
  chats,
  getOrCreatePeer,
  getPeerEntry,
  removePeer,
  isMutedRef,
  isVideoOffRef,
  setRemoteStreams,
  onConnected,
}) => {
  const audioContextRef = useRef(null);
  const rafMapRef = useRef(new Map());
  const cleanupMapRef = useRef(new Map());

  // ✅ Shared AudioContext
  const getAudioContext = () => {
    if (
      !audioContextRef.current ||
      audioContextRef.current.state === "closed"
    ) {
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
    }

    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }

    return audioContextRef.current;
  };

  // ✅ User meta
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

  // ✅ Speaking detection (fixed + optimized)
  const setupSpeakingDetection = (userId, stream) => {
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    // cleanup old
    const oldCleanup = cleanupMapRef.current.get(userId);
    oldCleanup?.();

    const ctx = getAudioContext();

    const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;

    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);

    let lastSpeaking = false;
    let silenceFrames = 0;

    const detect = () => {
      analyser.getByteFrequencyData(data);

      const avg = data.reduce((a, b) => a + b, 0) / data.length;

      let isSpeaking = avg > 28;

      // 🔥 smoothing (important)
      if (!isSpeaking) {
        silenceFrames++;
        if (silenceFrames < 5) isSpeaking = true;
      } else {
        silenceFrames = 0;
      }

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

      const frame = requestAnimationFrame(detect);
      rafMapRef.current.set(userId, frame);
    };

    const frame = requestAnimationFrame(detect);
    rafMapRef.current.set(userId, frame);

    // ✅ cleanup function
    const cleanup = () => {
      const f = rafMapRef.current.get(userId);
      if (f) cancelAnimationFrame(f);

      rafMapRef.current.delete(userId);

      try {
        source.disconnect();
        analyser.disconnect();
      } catch {}
    };

    cleanupMapRef.current.set(userId, cleanup);
  };

  // ✅ remove peer
  const handleRemovePeer = (userId) => {
    cleanupMapRef.current.get(userId)?.();
    cleanupMapRef.current.delete(userId);

    removePeer(userId);

    setRemoteStreams((prev) => prev.filter((s) => s.userId !== userId));
  };

  // ✅ add tracks safely
  const addTracksIfNeeded = (peer, stream) => {
    const senders = peer.getSenders();

    stream.getTracks().forEach((track) => {
      const exists = senders.some((s) => s.track?.kind === track.kind);

      if (!exists) {
        try {
          const sender = peer.addTrack(track, stream);

          if (track.kind === "audio" && isMutedRef.current) {
            sender.track.enabled = false;
          }

          if (track.kind === "video" && isVideoOffRef.current) {
            sender.track.enabled = false;
          }
        } catch (err) {
          console.warn("[useCallPeers] addTrack error:", err);
        }
      }
    });
  };

  // ✅ create peer
  const createPeerConnection = (userId) => {
    const existing = getPeerEntry(userId);
    if (existing?.peer) return existing.peer;

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

    peer.ontrack = (e) => {
      const stream = e.streams?.[0];
      if (!stream) return;

      const { fName, lName, avatar } = getUserMeta(userId);

      setupSpeakingDetection(userId, stream);

      setRemoteStreams((prev) => {
        const exists = prev.find((s) => s.userId === userId);

        if (exists) {
          if (exists.stream === stream) return prev;

          return prev.map((s) =>
            s.userId === userId
              ? {
                  ...s,
                  stream,
                  fName,
                  lName,
                  avatar,
                  isMuted: !stream.getAudioTracks()[0]?.enabled,
                }
              : s
          );
        }

        return [
          ...prev,
          {
            userId,
            stream,
            fName,
            lName,
            avatar,
            isSpeaking: false,
            isMuted: !stream.getAudioTracks()[0]?.enabled,
          },
        ];
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
      if (peer.iceConnectionState === "disconnected") {
        setTimeout(() => {
          if (peer.iceConnectionState === "disconnected") {
            try {
              peer.restartIce();
            } catch {}
          }
        }, 3000);
      }

      if (peer.iceConnectionState === "failed") {
        try {
          peer.restartIce();
        } catch {}
      }
    };

    return peer;
  };

  // ✅ offer
  const initiateOffer = async (userId, getLocalStream) => {
    const peer = createPeerConnection(userId);
    if (!peer) return;

    const stream = await getLocalStream();
    const entry = getPeerEntry(userId);

    if (!entry || peer.signalingState !== "stable") return;

    entry.makingOffer = true;

    addTracksIfNeeded(peer, stream);

    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      socket.emit("webrtc-offer", {
        offer: peer.localDescription,
        to: userId,
        fromName: user?.fName,
        roomId: chatId,
      });
    } catch (err) {
      console.warn("[useCallPeers] offer error:", err);
    } finally {
      entry.makingOffer = false;
    }
  };

  return {
    handleRemovePeer,
    addTracksIfNeeded,
    createPeerConnection,
    initiateOffer,
  };
};
