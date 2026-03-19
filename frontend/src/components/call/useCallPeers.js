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
  const sharedAudioContextRef = useRef(null);
  const animationFramesRef = useRef(new Map());

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
          name: u.fName,
          avatar: u.avatar ?? null,
        };
      }
    }
    return { name: userId, avatar: null };
  };

  const setupSpeakingDetection = (userId, incomingStream) => {
    const audioTrack = incomingStream.getAudioTracks()[0];
    if (!audioTrack) return;

    const existingFrame = animationFramesRef.current.get(userId);
    if (existingFrame) {
      cancelAnimationFrame(existingFrame);
      animationFramesRef.current.delete(userId);
    }

    const audioContext = getAudioContext();
    const source = audioContext.createMediaStreamSource(
      new MediaStream([audioTrack])
    );
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

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

    removePeer(userId);
    setRemoteStreams((prev) => prev.filter((s) => s.userId !== userId));
  };

  const addTracksIfNeeded = (peer, stream) => {
    const senders = peer.getSenders();
    stream.getTracks().forEach((track) => {
      const alreadyAdded = senders.some((s) => s.track?.kind === track.kind);
      if (!alreadyAdded) {
        try {
          const sender = peer.addTrack(track, stream);
          if (track.kind === "audio" && isMutedRef.current)
            sender.track.enabled = false;
          if (track.kind === "video" && isVideoOffRef.current)
            sender.track.enabled = false;
        } catch (err) {
          console.warn("[useCallPeers] addTrack failed:", err);
        }
      }
    });
  };

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
      const incomingStream = e.streams?.[0];
      if (!incomingStream) return;

      const { name, avatar } = getUserMeta(userId);

      setupSpeakingDetection(userId, incomingStream);

      setRemoteStreams((prev) => {
        const exists = prev.find((s) => s.userId === userId);

        if (exists) {
          if (exists.stream === incomingStream) return prev;
          return prev.map((s) =>
            s.userId === userId
              ? {
                  ...s,
                  stream: incomingStream,
                  name,
                  avatar,
                  isMuted: !incomingStream.getAudioTracks()[0]?.enabled,
                }
              : s
          );
        }

        return [
          ...prev,
          {
            userId,
            stream: incomingStream,
            name,
            avatar,
            isSpeaking: false,
            isMuted: !incomingStream.getAudioTracks()[0]?.enabled,
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

  const initiateOffer = async (userId, userName, getLocalStream) => {
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
      console.warn("[useCallPeers] initiateOffer error:", err);
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
