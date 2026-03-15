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

let GoogleCast: any = null;
let CastButton: ComponentType<any> | null = null;

try {
  const mod = require("react-native-google-cast");
  GoogleCast = mod.default || mod;
  CastButton = mod.CastButton || null;
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
  const sessionRef = useRef<any>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!GoogleCast || Platform.OS === "web") return;

    let castStateListener: any;
    let sessionStartedListener: any;
    let sessionEndedListener: any;
    let channelMessageListener: any;

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
          setCastState(newState);
          setIsAvailable(state > 0);
          setIsConnecting(state === 2);
          setIsCasting(state === 3);
        });

        const sessionManager = GoogleCast.SessionManager;

        sessionStartedListener = sessionManager.onSessionStarted((session: any) => {
          sessionRef.current = session;
          setIsCasting(true);
          setIsConnecting(false);
          setDeviceName(session.device?.friendlyName || "Chromecast");

          const channel = session.addChannel(NAMESPACE);
          channelRef.current = channel;

          channelMessageListener = channel.onMessage((message: any) => {
            let parsed: ReceiverMessage;
            if (typeof message === "string") {
              try { parsed = JSON.parse(message); } catch { return; }
            } else {
              parsed = message;
            }
            messageListenersRef.current.forEach((cb) => cb(parsed));
          });
        });

        sessionEndedListener = sessionManager.onSessionEnded(() => {
          sessionRef.current = null;
          channelRef.current = null;
          setIsCasting(false);
          setDeviceName(null);
          setCastState("notConnected");

          messageListenersRef.current.forEach((cb) =>
            cb({ type: "SESSION_STOPPED" })
          );
        });

        const currentSession = await sessionManager.getCurrentCastSession();
        if (currentSession) {
          sessionRef.current = currentSession;
          setIsCasting(true);
          setDeviceName(currentSession.device?.friendlyName || "Chromecast");

          const channel = currentSession.addChannel(NAMESPACE);
          channelRef.current = channel;
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
    const channel = channelRef.current;
    if (channel) {
      try {
        await channel.sendMessage(JSON.stringify(message));
      } catch (e) {
        console.warn("[Cast] Send message error:", e);
      }
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
    sessionRef.current = null;
    channelRef.current = null;
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
        NativeCastButton: CastButton,
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
