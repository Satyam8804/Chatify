import { useRef } from "react";

export const useWebRTC = () => {

const peerRef = useRef(null);

const createPeer = () => {

peerRef.current = new RTCPeerConnection({
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
});

return peerRef.current;

};
return { peerRef, createPeer };
};