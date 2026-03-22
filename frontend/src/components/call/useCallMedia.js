import { useRef } from "react";

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
  callType,
  socket,
  chatId,
}) => {
  const gettingStreamRef = useRef(false);

  const getVideoConstraints = (deviceId = null) => {
    const connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;

    let width = { ideal: 1280 };
    let height = { ideal: 720 };
    let frameRate = { ideal: 30 };

    if (connection) {
      const { effectiveType, downlink } = connection;
      if (
        effectiveType === "slow-2g" ||
        effectiveType === "2g" ||
        downlink < 1
      ) {
        width = { ideal: 320 };
        height = { ideal: 240 };
        frameRate = { ideal: 15 };
      } else if (effectiveType === "3g" || downlink < 5) {
        width = { ideal: 640 };
        height = { ideal: 480 };
        frameRate = { ideal: 24 };
      }
    }

    return deviceId
      ? { deviceId: { exact: deviceId }, width, height, frameRate }
      : { facingMode: facingModeRef.current, width, height, frameRate };
  };

  const getLocalStream = async (forceNew = false) => {
    if (localStreamRef.current && !forceNew) return localStreamRef.current;

    if (gettingStreamRef.current) {
      await new Promise((r) => setTimeout(r, 200));
      return localStreamRef.current;
    }

    gettingStreamRef.current = true;

    try {
      if (forceNew && localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
        localStreamRef.current = null;
      }

      const isAudio = callType === "audio";

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isAudio ? false : getVideoConstraints(),
      });

      if (!isAudio) {
        const videoTrack = stream.getVideoTracks()[0];
        currentDeviceIdRef.current =
          videoTrack?.getSettings()?.deviceId ?? null;
      }

      localStreamRef.current = stream;

      if (!isAudio) {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }
        if (localVideoMainRef.current) {
          localVideoMainRef.current.srcObject = stream;
          localVideoMainRef.current.play().catch(() => {});
        }
      }

      return stream;
    } finally {
      gettingStreamRef.current = false;
    }
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;

    const tracks = localStreamRef.current.getAudioTracks();
    tracks.forEach((t) => {
      t.enabled = !t.enabled;
    });

    const muted = !tracks[0]?.enabled;
    isMutedRef.current = muted;
    setIsMuted(muted);

    peersRef.current.forEach(({ peer }) => {
      const sender = peer.getSenders().find((s) => s.track?.kind === "audio");
      if (sender?.track) sender.track.enabled = !muted;
    });

    // FIX: was sending chatId, backend expects roomId
    socket.emit("mute-state", {
      roomId: chatId,
      isMuted: muted,
    });
  };

  const adaptBitrateToNetwork = () => {
    const connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;

    if (!connection) return;

    const { effectiveType, downlink } = connection;
    const isSlow =
      effectiveType === "slow-2g" || effectiveType === "2g" || downlink < 1;
    const isMedium = effectiveType === "3g" || (downlink >= 1 && downlink < 5);

    if (!isSlow && !isMedium) return;

    const maxBitrate = isSlow ? 100_000 : 250_000;
    const maxFramerate = isSlow ? 10 : 20;
    const scaleDown = isSlow ? 4 : 2;

    peersRef.current.forEach(({ peer }) => {
      if (!peer || peer.connectionState === "closed") return;

      const videoSender = peer
        .getSenders()
        .find((s) => s.track?.kind === "video");
      if (!videoSender) return;

      const params = videoSender.getParameters();
      if (!params.encodings?.length) return;

      params.encodings[0].maxBitrate = maxBitrate;
      params.encodings[0].maxFramerate = maxFramerate;
      params.encodings[0].scaleResolutionDownBy = scaleDown;

      videoSender.setParameters(params).catch(() => {});
    });
  };

  const toggleVideo = () => {
    if (callType === "audio") return;
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
    if (callType === "audio") return;
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
      oldStream?.getVideoTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });

      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: getVideoConstraints(nextCamera.deviceId),
        audio: false,
      });

      const newVideoTrack = newVideoStream.getVideoTracks()[0];
      if (!newVideoTrack)
        throw new Error("No video track from requested camera");

      newVideoStream.getTracks().forEach((t) => {
        if (t !== newVideoTrack) t.stop();
      });

      const composedStream = new MediaStream([
        newVideoTrack,
        ...(oldAudioTrack ? [oldAudioTrack] : []),
      ]);

      localStreamRef.current = composedStream;
      currentDeviceIdRef.current = nextCamera.deviceId;

      const newFacing =
        newVideoTrack.getSettings()?.facingMode ||
        (facingMode === "user" ? "environment" : "user");
      facingModeRef.current = newFacing;
      setFacingMode(newFacing);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = composedStream;
        localVideoRef.current.play().catch(() => {});
      }
      if (localVideoMainRef.current) {
        localVideoMainRef.current.srcObject = composedStream;
        localVideoMainRef.current.play().catch(() => {});
      }

      peersRef.current.forEach(({ peer }) => {
        if (!peer || peer.connectionState === "closed") return;
        try {
          const oldVideoSender = peer
            .getSenders()
            .find((s) => s.track?.kind === "video");
          if (oldVideoSender) {
            oldVideoSender
              .replaceTrack(newVideoTrack)
              .catch((err) =>
                console.warn("[VideoCall] replaceTrack failed:", err)
              );
          } else {
            peer.addTrack(newVideoTrack, composedStream);
          }
        } catch (err) {
          console.warn("[VideoCall] error updating peer senders:", err);
        }
      });

      if (isMutedRef.current) {
        peersRef.current.forEach(({ peer }) => {
          const sender = peer
            .getSenders()
            .find((s) => s.track?.kind === "audio");
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

  return {
    getLocalStream,
    toggleMute,
    toggleVideo,
    switchCamera,
    getVideoConstraints,
    adaptBitrateToNetwork,
  };
};
