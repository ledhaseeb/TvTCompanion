import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
  type ComponentType,
} from "react";
import type { ViewStyle } from "react-native";

interface CastContextType {
  isAvailable: boolean;
  isCasting: boolean;
  isConnecting: boolean;
  deviceName: string | null;
  castState: "noDevicesAvailable" | "notConnected" | "connecting" | "connected";
  requestSession: () => Promise<void>;
  endCastSession: () => Promise<void>;
  loadMedia: (youtubeVideoId: string, title?: string) => Promise<void>;
  pauseMedia: () => Promise<void>;
  playMedia: () => Promise<void>;
  stopMedia: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  NativeCastButton: ComponentType<{
    style?: ViewStyle;
    tintColor?: string;
  }> | null;
}

const CastContext = createContext<CastContextType>({
  isAvailable: false,
  isCasting: false,
  isConnecting: false,
  deviceName: null,
  castState: "noDevicesAvailable",
  requestSession: async () => {},
  endCastSession: async () => {},
  loadMedia: async () => {},
  pauseMedia: async () => {},
  playMedia: async () => {},
  stopMedia: async () => {},
  seekTo: async () => {},
  NativeCastButton: null,
});

export function CastProvider({ children }: { children: ReactNode }) {
  const [isAvailable] = useState(false);
  const [isCasting] = useState(false);
  const [isConnecting] = useState(false);
  const [deviceName] = useState<string | null>(null);

  const requestSession = useCallback(async () => {}, []);
  const endCastSession = useCallback(async () => {}, []);
  const loadMedia = useCallback(async () => {}, []);
  const pauseMedia = useCallback(async () => {}, []);
  const playMedia = useCallback(async () => {}, []);
  const stopMedia = useCallback(async () => {}, []);
  const seekTo = useCallback(async () => {}, []);

  return (
    <CastContext.Provider
      value={{
        isAvailable,
        isCasting,
        isConnecting,
        deviceName,
        castState: "noDevicesAvailable",
        requestSession,
        endCastSession,
        loadMedia,
        pauseMedia,
        playMedia,
        stopMedia,
        seekTo,
        NativeCastButton: null,
      }}
    >
      {children}
    </CastContext.Provider>
  );
}

export function useCast() {
  return useContext(CastContext);
}
