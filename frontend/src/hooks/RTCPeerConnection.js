import { useRef } from "react";
import { useAuth } from "../context/authContext";
import { useSocket } from "../context/socketContext";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:global.relay.metered.ca:80",
      username: import.meta.env.VITE_METERED_USERNAME || "",
      credential: import.meta.env.VITE_METERED_PASSWORD || "",
    },
    {
      urls: "turn:global.relay.metered.ca:80?transport=tcp",
      username: import.meta.env.VITE_METERED_USERNAME || "",
      credential: import.meta.env.VITE_METERED_PASSWORD || "",
    },
    {
      urls: "turn:global.relay.metered.ca:443",
      username: import.meta.env.VITE_METERED_USERNAME || "",
      credential: import.meta.env.VITE_METERED_PASSWORD || "",
    },
    {
      urls: "turns:global.relay.metered.ca:443?transport=tcp",
      username: import.meta.env.VITE_METERED_USERNAME || "",
      credential: import.meta.env.VITE_METERED_PASSWORD || "",
    },
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: "all",
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
  sdpSemantics: "unified-plan",
};

export const useWebRTC = () => {
  const peersRef = useRef(new Map());
  const { socket } = useSocket();

  const getOrCreatePeer = (userId) => {
    const entry = peersRef.current.get(userId);

    if (entry?.peer) return entry.peer;

    const peer = new RTCPeerConnection(ICE_SERVERS);

    peersRef.current.set(userId, {
      peer,
      pendingCandidates: entry?.pendingCandidates || [],
      makingOffer: entry?.makingOffer || false,
      polite: entry?.polite ?? String(userId) > String(socket.userId),
    });

    return peer;
  };

  const getPeerEntry = (userId) => peersRef.current.get(userId);
  const setPeerEntry = (userId, data) => peersRef.current.set(userId, data);

  const removePeer = (userId) => {
    const entry = peersRef.current.get(userId);

    if (entry?.peer) {
      try {
        entry.peer.ontrack = null;
        entry.peer.onicecandidate = null;
        entry.peer.close();
      } catch {}
    }

    peersRef.current.delete(userId);
  };

  const closeAllPeers = () => {
    peersRef.current.forEach(({ peer }) => {
      try {
        peer?.close();
      } catch {}
    });
    peersRef.current.clear();
  };

  const replaceVideoTrack = (newTrack) => {
    peersRef.current.forEach(({ peer }) => {
      const sender = peer.getSenders().find((s) => s.track?.kind === "video");
      if (sender && newTrack) sender.replaceTrack(newTrack);
    });
  };

  const replaceAudioTrack = (newTrack) => {
    peersRef.current.forEach(({ peer }) => {
      const sender = peer.getSenders().find((s) => s.track?.kind === "audio");
      if (sender && newTrack) sender.replaceTrack(newTrack);
    });
  };

  return {
    peersRef,
    getOrCreatePeer,
    getPeerEntry,
    setPeerEntry,
    removePeer,
    closeAllPeers,
    replaceVideoTrack,
    replaceAudioTrack,
  };
};
