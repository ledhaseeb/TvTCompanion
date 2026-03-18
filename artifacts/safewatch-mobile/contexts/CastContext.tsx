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
  skipVideo: async () => {},
  skipToVideo: async () => {},
  onReceiverMessage: () => () => {},
  NativeCastButton: null,
};

const CastCtx = createContext<CastContextType>(defaultContext);

interface CastDevice {
  friendlyName?: string;
}

interface CastSession {
  device?: CastDevice;
  addChannel: (namespace: string) => CastChannel;
}

interface CastChannel {
  sendMessage: (message: string) => Promise<void>;
  onMessage: (handler: (message: string | Record<string, unknown>) => void) => Subscription;
}

interface Subscription {
  remove?: () => void;
}

interface GoogleCastModule {
  CastContext: {
    onCastStateChanged: (handler: (state: number) => void) => Subscription;
    showCastDialog: () => Promise<void>;
  };
  SessionManager: {
    onSessionStarted: (handler: (session: CastSession) => void) => Subscription;
    onSessionEnded: (handler: () => void) => Subscription;
    getCurrentCastSession: () => Promise<CastSession | null>;
    endCurrentSession: (stopCasting: boolean) => Promise<void>;
  };
  CastButton?: ComponentType<{ style?: ViewStyle; tintColor?: string }>;
}

let GoogleCast: GoogleCastModule | null = null;
let CastButtonComponent: ComponentType<{ style?: ViewStyle; tintColor?: string }> | null = null;

try {
  const mod = require("react-native-google-cast");
  GoogleCast = (mod.default || mod) as GoogleCastModule;
  CastButtonComponent = (mod.CastButton || null) as typeof CastButtonComponent;
} catch {
  console.log("[Cast] react-native-google-cast not available (Expo Go)");
}

function attachChannelListener(
  channel: CastChannel,
  listeners: React.RefObject<Set<(msg: ReceiverMessage) => void>>,
): Subscription {
  return channel.onMessage((message: string | Record<string, unknown>) => {
    let parsed: ReceiverMessage;
    if (typeof message === "string") {
      try {
        parsed = JSON.parse(message) as ReceiverMessage;
      } catch {
        return;
      }
    } else {
      parsed = message as ReceiverMessage;
    }
    listeners.current.forEach((cb) => cb(parsed));
  });
}

export function CastProvider({ children }: { children: ReactNode }) {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [castState, setCastState] = useState<CastContextType["castState"]>("noDevicesAvailable");

  const messageListenersRef = useRef<Set<(msg: ReceiverMessage) => void>>(new Set());
  const channelRef = useRef<CastChannel | null>(null);
  const channelReadyRef = useRef(false);
  const pendingMessagesRef = useRef<object[]>([]);

  useEffect(() => {
    if (!GoogleCast || Platform.OS === "web") return;

    let castStateListener: Subscription | undefined;
    let sessionStartedListener: Subscription | undefined;
    let sessionEndedListener: Subscription | undefined;
    let channelMessageListener: Subscription | undefined;

    const setupSession = (session: CastSession) => {
      console.log("[Cast] setupSession called, device:", session.device?.friendlyName);
      setIsCasting(true);
      setIsConnecting(false);
      setDeviceName(session.device?.friendlyName || "Chromecast");

      try {
        const channel = session.addChannel(NAMESPACE);
        channelRef.current = channel;
        channelReadyRef.current = true;
        console.log("[Cast] Channel created for namespace:", NAMESPACE);

        channelMessageListener = attachChannelListener(channel, messageListenersRef);

        const pending = pendingMessagesRef.current.splice(0);
        console.log("[Cast] Sending", pending.length, "pending messages");
        for (const msg of pending) {
          channel.sendMessage(JSON.stringify(msg)).catch((e: unknown) => {
            console.warn("[Cast] Failed to send queued message:", e);
          });
        }
      } catch (e) {
        console.warn("[Cast] Channel setup error:", e);
      }
    };

    const checkForSession = async (attempt = 1) => {
      if (channelReadyRef.current) return;
      try {
        const session = await GoogleCast!.SessionManager.getCurrentCastSession();
        if (session && !channelReadyRef.current) {
          console.log("[Cast] Found active session via poll (attempt", attempt + "), setting up...");
          setupSession(session);
        } else if (!session && attempt < 10) {
          console.log("[Cast] No session found on attempt", attempt, ", retrying...");
          setTimeout(() => checkForSession(attempt + 1), 500);
        } else {
          console.log("[Cast] Session poll gave up after", attempt, "attempts, channelReady:", channelReadyRef.current);
        }
      } catch (e) {
        console.warn("[Cast] Poll check error (attempt " + attempt + "):", e);
        if (attempt < 10) {
          setTimeout(() => checkForSession(attempt + 1), 500);
        }
      }
    };

    const setup = async () => {
      try {
        const castCtx = GoogleCast.CastContext;

        castStateListener = castCtx.onCastStateChanged((state: number) => {
          const stateMap: Record<number, CastContextType["castState"]> = {
            0: "noDevicesAvailable",
            1: "notConnected",
            2: "connecting",
            3: "connected",
          };
          const newState = stateMap[state] || "notConnected";
          console.log("[Cast] State changed:", newState, "raw:", state);
          setCastState(newState);
          setIsAvailable(state > 0);
          setIsConnecting(state === 2);

          if (state === 3) {
            setTimeout(checkForSession, 500);
          } else {
            setIsCasting(false);
          }
        });

        const sessionManager = GoogleCast.SessionManager;

        sessionStartedListener = sessionManager.onSessionStarted((session: CastSession) => {
          console.log("[Cast] onSessionStarted fired");
          setupSession(session);
        });

        sessionEndedListener = sessionManager.onSessionEnded(() => {
          console.log("[Cast] onSessionEnded fired");
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
          setupSession(currentSession);
        }
      } catch (e) {
        console.warn("[Cast] Setup error:", e);
      }
    };

    setup();

    return () => {
      castStateListener?.remove?.();
      sessionStartedListener?.remove?.();
      sessionEndedListener?.remove?.();
      channelMessageListener?.remove?.();
    };
  }, []);

  const sendMessage = useCallback(async (message: object) => {
    const msgType = (message as { type?: string }).type || "unknown";
    if (channelReadyRef.current && channelRef.current) {
      try {
        console.log("[Cast] Sending message:", msgType);
        await channelRef.current.sendMessage(JSON.stringify(message));
        console.log("[Cast] Message sent successfully:", msgType);
      } catch (e) {
        console.warn("[Cast] Send message error:", msgType, e);
      }
    } else {
      console.log("[Cast] Channel not ready, queuing message:", msgType, "channelReady:", channelReadyRef.current);
      pendingMessagesRef.current.push(message);
    }
  }, []);

  const requestSession = useCallback(async () => {
    if (!GoogleCast) return;
    try {
      setIsConnecting(true);
      await GoogleCast.CastContext.showCastDialog();
    } catch (e) {
      console.warn("[Cast] Request session error:", e);
      setIsConnecting(false);
    }
  }, []);

  const endCastSession = useCallback(async () => {
    if (!GoogleCast) return;
    try {
      await sendMessage({ type: "STOP" });
      await GoogleCast.SessionManager.endCurrentSession(true);
    } catch (e) {
      console.warn("[Cast] End session error:", e);
    }
    channelRef.current = null;
    channelReadyRef.current = false;
    pendingMessagesRef.current = [];
    setIsCasting(false);
    setDeviceName(null);
  }, [sendMessage]);

  const loadPlaylist = useCallback(async (playlist: PlaylistVideo[], startIndex = 0) => {
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

  const seekTo = useCallback(async (_position: number) => {
  }, []);

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
