// Browser side of an OpenAI Realtime call over WebRTC: microphone in, tutor audio out,
// JSON events on the "oai-events" data channel.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ServerEvent = { type: string; [key: string]: any };

export type RealtimeConnection = {
  mic: MediaStreamTrack;
  send: (event: object) => void;
  close: () => void;
};

export class MicrophoneError extends Error {}

export async function getMicrophone(deviceId?: string): Promise<MediaStream> {
  const constraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: deviceId ? { ...constraints, deviceId: { exact: deviceId } } : constraints,
    });
  } catch (error) {
    // a remembered device may be gone; fall back to the default one
    if (deviceId && error instanceof Error && error.name === "OverconstrainedError") return getMicrophone();
    throw new MicrophoneError(error instanceof Error ? error.name : "mic");
  }
}

export async function listMicrophones(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === "audioinput" && d.deviceId);
}

export async function connectRealtime({
  clientSecret,
  stream,
  audioElement,
  onEvent,
  onClose,
}: {
  clientSecret: string;
  stream: MediaStream;
  audioElement: HTMLAudioElement;
  onEvent: (event: ServerEvent) => void;
  onClose: () => void;
}): Promise<RealtimeConnection> {
  const mic = stream.getAudioTracks()[0];
  if (!mic) throw new MicrophoneError("NoTrack");

  const pc = new RTCPeerConnection();
  pc.ontrack = (e) => {
    audioElement.srcObject = e.streams[0];
    void audioElement.play().catch(() => {});
  };
  pc.addTrack(mic, stream);

  const dc = pc.createDataChannel("oai-events");
  dc.onmessage = (e) => {
    try {
      onEvent(JSON.parse(e.data));
    } catch {
      // ignore malformed frames
    }
  };

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    dc.close();
    pc.close();
    stream.getTracks().forEach((t) => t.stop());
    audioElement.srcObject = null;
    onClose();
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed" || pc.connectionState === "closed") close();
  };

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const res = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      body: offer.sdp,
      headers: { Authorization: `Bearer ${clientSecret}`, "Content-Type": "application/sdp" },
    });
    if (!res.ok) throw new Error(`SDP exchange failed: ${res.status}`);
    await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });

    await new Promise<void>((resolve, reject) => {
      if (dc.readyState === "open") return resolve();
      const timer = setTimeout(() => reject(new Error("Data channel timeout")), 15_000);
      dc.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  } catch (error) {
    close();
    throw error;
  }

  return {
    mic,
    send: (event) => {
      if (dc.readyState === "open") dc.send(JSON.stringify(event));
    },
    close,
  };
}
