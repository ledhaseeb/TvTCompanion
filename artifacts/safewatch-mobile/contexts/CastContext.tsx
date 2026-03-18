import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
  type ComponentType,
} from "react";
import { Platform } from "react-native";
import type { ViewStyle } from "react-native";

const NAMESPACE = "urn:x-cast:com.safewatch.cast";

interface CastStatusMessage {
  type: "STATUS";
  currentIndex: number;
  isPlaying: boolean;
  totalVideos: number;
  currentVideoTitle: string;
  currentVideoId: string;
  elapsedSeconds: number;
  videoCurrentTime?: number;
  videoDuration?: number;
}

interface CastEventMessage {
  type: "VIDEO_ENDED" | "VIDEO_ERROR" | "SESSION_COMPLETE" | "SESSION_STOPPED";
  index?: number;
  error?: number;
  title?: string;
}

type ReceiverMessage = CastStatusMessage | CastEventMessage;

interface PlaylistVideo {
  youtubeId?: string;
  youtubeVideoId?: string;
  title?: string;
  [key: string]: unknown;
}

interface CastContextType {
  isAvailable: boolean;
  isCasting: boolean;
  isConnecting: boolean;
  deviceName: string | null;
  castState: "noDevicesAvailable" | "notConnected" | "connecting" | "connected";
  requestSession: () => Promise<void>;
  endCastSession: () => Promise<void>;
  loadPlaylist: (playlist: PlaylistVideo[], startIndex?: number) => Promise<void>;
  loadMedia: (youtubeVideoId: string, title?: string) => Promise<void>;
  pauseMedia: () => Promise<void>;
  playMedia: () => Promise<void>;
  stopMedia: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  seekForward: (seconds?: number) => Promise<void>;
  seekBackward: (seconds?: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  skipVideo: () => Promise<void>;
  skipToVideo: (index: number) => Promise<void>;
  onReceiverMessage: (callback: (msg: ReceiverMessage) => void) => () => void;
  NativeCastButton: ComponentType<{
    style?: ViewStyle;
    tintColor?: string;
  }> | null;
}

const defaultContext: CastContextType = {
  isAvailable: false,
  isCasting: false,
  isConnecting: false,
  deviceName: null,
  castState: "noDevicesAvailable",
  requestSession: async () => {},
  endCastSession: async () => {},
  loadPlaylist: async () => {},
  loadMedia: async () => {},
  pauseMedia: async () => {},
  playMedia: async () => {},
  stopMedia: async () => {},
  seekTo: async () => {},
  seekForward: async () => {},
  seekBackward: async () => {},
  setVolume: async () => {},
  skipVideo: async () => {},
  skipToVideo: async () => {},
  onReceiverMessage: () => () => {},
  NativeCastButton: null,
};

const CastCtx = createContext<CastContextType>(defaultContext);

type CastStateString = "noDevicesAvailable" | "notConnected" | "connecting" | "connected";

interface CastChannelObj {
  sendMessage: (message: Record<string, unknown> | string) => Promise<void>;
  onMessage: (listener: (message: Record<string, unknown> | string) => void) => void;
  offMessage: () => void;
  remove: () => Promise<void>;
}

interface CastSessionObj {
  id?: string;
  addChannel: (namespace: string) => Promise<CastChannelObj>;
  getCastDevice: () => Promise<{ friendlyName?: string; modelName?: string } | null>;
}

interface SessionManagerObj {
  onSessionStarted: (handler: (session: CastSessionObj) => void) => { remove: () => void };
  onSessionStartFailed: (handler: (session: CastSessionObj, error: string) => void) => { remove: () => void };
  onSessionEnded: (handler: (session: CastSessionObj, error?: string) => void) => { remove: () => void };
  onSessionResumed: (handler: (session: CastSessionObj) => void) => { remove: () => void };
  getCurrentCastSession: () => Promise<CastSessionObj | null>;
  endCurrentSession: (stopCasting?: boolean) => Promise<void>;
}

interface GoogleCastAPI {
  onCastStateChanged: (listener: (castState: CastStateString) => void) => { remove: () => void };
  showCastDialog: () => Promise<boolean>;
  getSessionManager: () => SessionManagerObj;
  sessionManager: SessionManagerObj;
}

let GoogleCast: GoogleCastAPI | null = null;
let CastButtonComponent: ComponentType<{ style?: ViewStyle; tintColor?: string }> | null = null;

try {
  const mod = require("react-native-google-cast");
  GoogleCast = (mod.default || mod) as GoogleCastAPI;
  CastButtonComponent = (mod.CastButton || null) as typeof CastButtonComponent;
  console.log("[Cast] Module loaded successfully");
} catch {
  console.log("[Cast] react-native-google-cast not available (Expo Go)");
}

export function CastProvider({ children }: { children: ReactNode }) {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [castState, setCastState] = useState<CastContextType["castState"]>("noDevicesAvailable");

  const messageListenersRef = useRef<Set<(msg: ReceiverMessage) => void>>(new Set());
  const channelRef = useRef<CastChannelObj | null>(null);
  const channelReadyRef = useRef(false);
  const pendingMessagesRef = useRef<object[]>([]);

  useEffect(() => {
    if (!GoogleCast || Platform.OS === "web") return;

    let castStateSubscription: { remove: () => void } | undefined;
    let sessionStartedSubscription: { remove: () => void } | undefined;
    let sessionStartFailedSubscription: { remove: () => void } | undefined;
    let sessionEndedSubscription: { remove: () => void } | undefined;
    let sessionResumedSubscription: { remove: () => void } | undefined;

    const setupSession = async (session: CastSessionObj) => {
      console.log("[Cast] setupSession called, session id:", session.id);
      setIsCasting(true);
      setIsConnecting(false);

      try {
        const device = await session.getCastDevice();
        const name = device?.friendlyName || "Chromecast";
        console.log("[Cast] Device:", name);
        setDeviceName(name);
      } catch (e) {
        console.warn("[Cast] getCastDevice error:", e);
        setDeviceName("Chromecast");
      }

      try {
        const channel = await session.addChannel(NAMESPACE);
        channelRef.current = channel;
        channelReadyRef.current = true;
        console.log("[Cast] Channel created for namespace:", NAMESPACE);

        channel.onMessage((message: Record<string, unknown> | string) => {
          let parsed: ReceiverMessage;
          if (typeof message === "string") {
            try {
              parsed = JSON.parse(message) as ReceiverMessage;
            } catch {
              return;
            }
          } else {
            parsed = message as unknown as ReceiverMessage;
          }
          console.log("[Cast] Received message:", parsed.type);
          messageListenersRef.current.forEach((cb) => cb(parsed));
        });

        const pending = pendingMessagesRef.current.splice(0);
        console.log("[Cast] Sending", pending.length, "pending messages");
        for (const msg of pending) {
          try {
            await channel.sendMessage(msg as Record<string, unknown>);
            console.log("[Cast] Sent pending message:", (msg as { type?: string }).type);
          } catch (e) {
            console.warn("[Cast] Failed to send queued message:", e);
          }
        }
      } catch (e) {
        console.warn("[Cast] Channel setup error:", e);
      }
    };

    const sessionManager = GoogleCast.getSessionManager();

    const setup = async () => {
      try {
        castStateSubscription = GoogleCast!.onCastStateChanged((state: CastStateString) => {
          console.log("[Cast] State changed:", state);
          setCastState(state);
          setIsAvailable(state !== "noDevicesAvailable");
          setIsConnecting(state === "connecting");

          if (state === "connected") {
            sessionManager.getCurrentCastSession().then((session) => {
              if (session && !channelReadyRef.current) {
                console.log("[Cast] State=connected, found session via poll");
                setupSession(session);
              }
            }).catch((e) => {
              console.warn("[Cast] Poll error on state change:", e);
            });
          } else if (state !== "connecting") {
            setIsCasting(false);
          }
        });

        sessionStartedSubscription = sessionManager.onSessionStarted((session: CastSessionObj) => {
          console.log("[Cast] onSessionStarted fired, id:", session.id);
          setupSession(session);
        });

        sessionStartFailedSubscription = sessionManager.onSessionStartFailed((_session: CastSessionObj, error: string) => {
          console.warn("[Cast] Session start failed:", error);
          setIsConnecting(false);
          setIsCasting(false);
        });

        sessionResumedSubscription = sessionManager.onSessionResumed((session: CastSessionObj) => {
          console.log("[Cast] onSessionResumed fired");
          setupSession(session);
        });

        sessionEndedSubscription = sessionManager.onSessionEnded((_session: CastSessionObj, error?: string) => {
          console.log("[Cast] onSessionEnded fired, error:", error);
          if (channelRef.current) {
            try {
              channelRef.current.offMessage();
              channelRef.current.remove().catch(() => {});
            } catch {}
          }
          channelRef.current = null;
          channelReadyRef.current = false;
          setIsCasting(false);
          setDeviceName(null);
          setCastState("notConnected");
          pendingMessagesRef.current = [];

          messageListenersRef.current.forEach((cb) =>
            cb({ type: "SESSION_STOPPED" })
          );
        });

        const currentSession = await sessionManager.getCurrentCastSession();
        if (currentSession) {
          console.log("[Cast] Found existing session on mount");
          await setupSession(currentSession);
        }
      } catch (e) {
        console.warn("[Cast] Setup error:", e);
      }
    };

    setup();

    return () => {
      castStateSubscription?.remove?.();
      sessionStartedSubscription?.remove?.();
      sessionStartFailedSubscription?.remove?.();
      sessionEndedSubscription?.remove?.();
      sessionResumedSubscription?.remove?.();
    };
  }, []);

  const sendMessage = useCallback(async (message: object) => {
    const msgType = (message as { type?: string }).type || "unknown";
    if (channelReadyRef.current && channelRef.current) {
      try {
        console.log("[Cast] Sending message:", msgType);
        await channelRef.current.sendMessage(message as Record<string, unknown>);
        console.log("[Cast] Message sent successfully:", msgType);
      } catch (e) {
        console.warn("[Cast] Send message error:", msgType, e);
      }
    } else {
      console.log("[Cast] Channel not ready, queuing message:", msgType);
      pendingMessagesRef.current.push(message);
    }
  }, []);

  const requestSession = useCallback(async () => {
    if (!GoogleCast) return;
    try {
      setIsConnecting(true);
      console.log("[Cast] Showing cast dialog...");
      await GoogleCast.showCastDialog();
    } catch (e) {
      console.warn("[Cast] Request session error:", e);
      setIsConnecting(false);
    }
  }, []);

  const endCastSession = useCallback(async () => {
    if (!GoogleCast) return;
    try {
      await sendMessage({ type: "STOP" });
      const sessionManager = GoogleCast.getSessionManager();
      await sessionManager.endCurrentSession(true);
    } catch (e) {
      console.warn("[Cast] End session error:", e);
    }
    if (channelRef.current) {
      try {
        channelRef.current.offMessage();
        await channelRef.current.remove();
      } catch {}
    }
    channelRef.current = null;
    channelReadyRef.current = false;
    pendingMessagesRef.current = [];
    setIsCasting(false);
    setDeviceName(null);
  }, [sendMessage]);

  const loadPlaylist = useCallback(async (playlist: PlaylistVideo[], startIndex = 0) => {
    console.log("[Cast] loadPlaylist called, videos:", playlist.length, "startIndex:", startIndex);
    await sendMessage({
      type: "LOAD_PLAYLIST",
      playlist: playlist.map((v) => ({
        youtubeId: v.youtubeId || v.youtubeVideoId || "",
        title: v.title || "",
      })),
      startIndex,
    });
  }, [sendMessage]);

  const loadMedia = useCallback(async (youtubeVideoId: string, title?: string) => {
    await sendMessage({
      type: "LOAD_PLAYLIST",
      playlist: [{ youtubeId: youtubeVideoId, title: title || "" }],
      startIndex: 0,
    });
  }, [sendMessage]);

  const pauseMedia = useCallback(async () => {
    await sendMessage({ type: "PAUSE" });
  }, [sendMessage]);

  const playMedia = useCallback(async () => {
    await sendMessage({ type: "PLAY" });
  }, [sendMessage]);

  const stopMedia = useCallback(async () => {
    await sendMessage({ type: "STOP" });
  }, [sendMessage]);

  const seekTo = useCallback(async (position: number) => {
    await sendMessage({ type: "SEEK_TO", position });
  }, [sendMessage]);

  const seekForward = useCallback(async (seconds = 10) => {
    await sendMessage({ type: "SEEK_FORWARD", seconds });
  }, [sendMessage]);

  const seekBackward = useCallback(async (seconds = 10) => {
    await sendMessage({ type: "SEEK_BACKWARD", seconds });
  }, [sendMessage]);

  const setVolume = useCallback(async (volume: number) => {
    await sendMessage({ type: "SET_VOLUME", volume: Math.max(0, Math.min(100, volume)) });
  }, [sendMessage]);

  const skipVideo = useCallback(async () => {
    await sendMessage({ type: "SKIP" });
  }, [sendMessage]);

  const skipToVideo = useCallback(async (index: number) => {
    await sendMessage({ type: "SKIP_TO", index });
  }, [sendMessage]);

  const onReceiverMessage = useCallback((callback: (msg: ReceiverMessage) => void) => {
    messageListenersRef.current.add(callback);
    return () => {
      messageListenersRef.current.delete(callback);
    };
  }, []);

  return (
    <CastCtx.Provider
      value={{
        isAvailable,
        isCasting,
        isConnecting,
        deviceName,
        castState,
        requestSession,
        endCastSession,
        loadPlaylist,
        loadMedia,
        pauseMedia,
        playMedia,
        stopMedia,
        seekTo,
        seekForward,
        seekBackward,
        setVolume,
        skipVideo,
        skipToVideo,
        onReceiverMessage,
        NativeCastButton: CastButtonComponent,
      }}
    >
      {children}
    </CastCtx.Provider>
  );
}

export function useCast() {
  return useContext(CastCtx);
}

export type { ReceiverMessage, CastStatusMessage, CastEventMessage, PlaylistVideo };
