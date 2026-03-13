import { useRef } from "react";

export const useWebRTC = () => {
  const peerRef = useRef(null);

  const createPeer = () => {
    if (peerRef.current) return peerRef.current;

    peerRef.current = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        {
          urls: "turn:global.turn.twilio.com:3478?transport=udp",
          username: "YOUR_TURN_USERNAME",
          credential: "YOUR_TURN_PASSWORD",
        },
      ],
      iceCandidatePoolSize: 10,
    });

    return peerRef.current;
  };

  return { peerRef, createPeer };
};
