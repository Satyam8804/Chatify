export const useCallMedia = ({
  localVideoRef,
  localVideoMainRef,
  localStreamRef,
  currentDeviceIdRef,
  camerasRef,
  cameraIndexRef,
  facingModeRef,
  isMutedRef,
  isVideoOffRef,
  switchingRef,
  peersRef,
  setIsMuted,
  setIsVideoOff,
  setFacingMode,
  setIsSwitching,
  facingMode,
}) => {
  const getLocalStream = async (forceNew = false) => {
    if (localStreamRef.current && !forceNew) return localStreamRef.current;

    if (forceNew && localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch {} });
      localStreamRef.current = null;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facingModeRef.current, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true,
    });

    const videoTrack = stream.getVideoTracks()[0];
    currentDeviceIdRef.current = videoTrack?.getSettings()?.deviceId ?? null;
    localStreamRef.current = stream;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play().catch(() => {});
    }
    if (localVideoMainRef.current) {
      localVideoMainRef.current.srcObject = stream;
      localVideoMainRef.current.play().catch(() => {});
    }

    return stream;
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const tracks = localStreamRef.current.getAudioTracks();
    tracks.forEach((t) => { t.enabled = !t.enabled; });
    const muted = !tracks[0]?.enabled;
    isMutedRef.current = muted;
    setIsMuted(muted);
    peersRef.current.forEach(({ peer }) => {
      const sender = peer.getSenders().find((s) => s.track?.kind === "audio");
      if (sender?.track) sender.track.enabled = !muted;
    });
  };

  const toggleVideo = () => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    isVideoOffRef.current = !track.enabled;
    setIsVideoOff(!track.enabled);
    peersRef.current.forEach(({ peer }) => {
      const sender = peer.getSenders().find((s) => s.track?.kind === "video");
      if (sender?.track) sender.track.enabled = track.enabled;
    });
  };

  const switchCamera = async () => {
    if (switchingRef.current) return;
    switchingRef.current = true;
    setIsSwitching(true);

    try {
      const cameras = camerasRef.current || [];
      if (cameras.length < 2) return;

      cameraIndexRef.current = (cameraIndexRef.current + 1) % cameras.length;
      const nextCamera = cameras[cameraIndexRef.current];

      const oldStream = localStreamRef.current;
      const oldAudioTrack = oldStream?.getAudioTracks()?.[0];
      oldStream?.getVideoTracks().forEach((t) => { try { t.stop(); } catch {} });

      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: nextCamera.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      const newVideoTrack = newVideoStream.getVideoTracks()[0];
      if (!newVideoTrack) throw new Error("No video track from requested camera");

      newVideoStream.getTracks().forEach((t) => { if (t !== newVideoTrack) t.stop(); });

      const composedStream = new MediaStream([
        newVideoTrack,
        ...(oldAudioTrack ? [oldAudioTrack] : []),
      ]);

      localStreamRef.current = composedStream;
      currentDeviceIdRef.current = nextCamera.deviceId;

      const newFacing = newVideoTrack.getSettings()?.facingMode || (facingMode === "user" ? "environment" : "user");
      facingModeRef.current = newFacing;
      setFacingMode(newFacing);

      if (localVideoRef.current) { localVideoRef.current.srcObject = composedStream; localVideoRef.current.play().catch(() => {}); }
      if (localVideoMainRef.current) { localVideoMainRef.current.srcObject = composedStream; localVideoMainRef.current.play().catch(() => {}); }

      peersRef.current.forEach(({ peer }) => {
        if (!peer || peer.connectionState === "closed") return;
        try {
          const oldVideoSender = peer.getSenders().find((s) => s.track?.kind === "video");
          if (oldVideoSender) {
            oldVideoSender.replaceTrack(newVideoTrack).catch((err) => console.warn("[VideoCall] replaceTrack failed:", err));
          } else {
            peer.addTrack(newVideoTrack, composedStream);
          }
        } catch (err) {
          console.warn("[VideoCall] error updating peer senders:", err);
        }
      });

      if (isMutedRef.current) {
        peersRef.current.forEach(({ peer }) => {
          const sender = peer.getSenders().find((s) => s.track?.kind === "audio");
          if (sender?.track) sender.track.enabled = false;
        });
      }
      if (isVideoOffRef.current) newVideoTrack.enabled = false;

    } catch (err) {
      console.error("[VideoCall] camera switch error:", err);
    } finally {
      switchingRef.current = false;
      setIsSwitching(false);
    }
  };

  return { getLocalStream, toggleMute, toggleVideo, switchCamera };
};