import { useRef } from "react";

export const useWebRTC = () => {
  const peerRef = useRef(null);

  const createPeer = () => {
    const peer = peerRef.current;

    // reuse peer if still usable
    if (
      peer &&
      peer.connectionState !== "closed" &&
      peer.connectionState !== "failed"
    ) {
      return peer;
    }

    // close old peer if exists
    if (peer) {
      try {
        peer.close();
      } catch {}
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
      sdpSemantics: "unified-plan",
    });

    return peerRef.current;
  };

  return { peerRef, createPeer };
};
