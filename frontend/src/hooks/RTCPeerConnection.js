import { useRef } from "react";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },

  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: "all",
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
  sdpSemantics: "unified-plan",
};

export const useWebRTC = () => {
  const peersRef = useRef(new Map());

  const getOrCreatePeer = (userId, polite = false) => {
    const entry = peersRef.current.get(userId);

    if (entry?.peer) return entry.peer;

    const peer = new RTCPeerConnection(ICE_SERVERS);

    peersRef.current.set(userId, {
      peer,
      pendingCandidates: entry?.pendingCandidates || [],
      makingOffer: false,
      polite,
    });

    return peer; // ✅ IMPORTANT
  };

  const getPeerEntry = (userId) => peersRef.current.get(userId);
  const setPeerEntry = (userId, data) => peersRef.current.set(userId, data);

  const removePeer = (userId) => {
    const entry = peersRef.current.get(userId);

    if (entry?.peer) {
      try {
        entry.peer.ontrack = null;
        entry.peer.onicecandidate = null;
        entry.peer.onconnectionstatechange = null;
        entry.peer.oniceconnectionstatechange = null;
        entry.peer.close();
      } catch {}
    }

    peersRef.current.delete(userId);
  };

  const closeAllPeers = () => {
    peersRef.current.forEach(({ peer }) => {
      try {
        peer.ontrack = null;
        peer.onicecandidate = null;
        peer.onconnectionstatechange = null;
        peer.oniceconnectionstatechange = null;
        peer?.close();
      } catch {}
    });
    peersRef.current.clear();
  };

  return {
    peersRef,
    getOrCreatePeer,
    getPeerEntry,
    setPeerEntry,
    removePeer,
    closeAllPeers,
  };
};
