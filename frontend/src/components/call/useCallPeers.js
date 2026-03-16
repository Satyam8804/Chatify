export const useCallPeers = ({
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
}) => {
  const handleRemovePeer = (userId) => {
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
          console.warn("[VideoCall] addTrack failed:", err);
        }
      }
    });
  };

  const createPeerConnection = (userId, userName) => {
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
    console.log("[VideoCall] initiating offer to:", userId);
    const peer = createPeerConnection(userId, userName);
    if (!peer) return;
    const stream = await getLocalStream();
    const entry = getPeerEntry(userId);
    if (!entry || peer.signalingState !== "stable") return;

    entry.makingOffer = true; // ✅ moved BEFORE try block and addTracksIfNeeded

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
      console.warn("[VideoCall] initiateOffer error:", err);
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
