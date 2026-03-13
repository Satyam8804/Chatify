import { useRef } from "react";

export const useWebRTC = () => {
  const peerRef = useRef(null);

  const createPeer = () => {
    // recreate peer if closed or failed
    if (
      peerRef.current &&
      peerRef.current.connectionState !== "closed" &&
      peerRef.current.connectionState !== "failed"
    ) {
      return peerRef.current;
    }

    peerRef.current = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    });

    return peerRef.current;
  };

  return { peerRef, createPeer };
};