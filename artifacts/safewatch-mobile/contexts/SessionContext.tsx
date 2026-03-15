import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { apiRequest, apiRequestRaw } from "@/lib/query-client";
import type { Video, TaperMode } from "@/lib/types";

export class SessionConflictError extends Error {
  conflictMessage: string;
  constructor(message: string) {
    super(message);
    this.name = "SessionConflictError";
    this.conflictMessage = message;
  }
}

interface SessionState {
  sessionId: string | null;
  childIds: string[];
  childNames: string[];
  playlist: Video[];
  calmingVideos: Video[];
  currentIndex: number;
  includeWindDown: boolean;
  taperMode: TaperMode;
  flatlineLevel: number;
  sessionMinutes: number;
  finishMode: "soft" | "hard";
  isActive: boolean;
  startTimeMs: number | null;
  wasOverride: boolean;
  totalSecondsWatched: number;
}

interface SessionContextType {
  session: SessionState;
  startSession: (params: {
    childIds: string[];
    childNames: string[];
    playlist: Video[];
    calmingVideos: Video[];
    includeWindDown: boolean;
    taperMode: TaperMode;
    flatlineLevel: number;
    sessionMinutes: number;
    finishMode: "soft" | "hard";
    force?: boolean;
  }) => Promise<string | null>;
  endSession: () => Promise<void>;
  advanceVideo: () => void;
  setCurrentIndex: (index: number) => void;
  updateWatchTime: (seconds: number) => void;
  resetSession: () => void;
}

const initialSession: SessionState = {
  sessionId: null,
  childIds: [],
  childNames: [],
  playlist: [],
  calmingVideos: [],
  currentIndex: 0,
  includeWindDown: true,
  taperMode: "taper_down",
  flatlineLevel: 3,
  sessionMinutes: 30,
  finishMode: "soft",
  isActive: false,
  startTimeMs: null,
  wasOverride: false,
  totalSecondsWatched: 0,
};

const SessionContext = createContext<SessionContextType>({
  session: initialSession,
  startSession: async () => null,
  endSession: async () => {},
  advanceVideo: () => {},
  setCurrentIndex: () => {},
  updateWatchTime: () => {},
  resetSession: () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>(initialSession);

  const startSession = useCallback(
    async (params: {
      childIds: string[];
      childNames: string[];
      playlist: Video[];
      calmingVideos: Video[];
      includeWindDown: boolean;
      taperMode: TaperMode;
      flatlineLevel: number;
      sessionMinutes: number;
      finishMode: "soft" | "hard";
      force?: boolean;
    }): Promise<string | null> => {
      const body: Record<string, unknown> = {
        childIds: params.childIds,
        totalDurationSeconds: params.sessionMinutes * 60,
        taperMode: params.taperMode,
        flatlineLevel: params.flatlineLevel,
        includeWindDown: params.includeWindDown,
        finishMode: params.finishMode,
      };
      if (params.force) {
        body.force = true;
      }

      const res = await apiRequestRaw("POST", "/api/sessions", body);

      if (res.status === 409) {
        let conflictMsg = "There is already an active session on another device.";
        try {
          const conflictData = await res.json();
          if (conflictData.message) {
            conflictMsg = conflictData.message;
          }
        } catch {}
        throw new SessionConflictError(conflictMsg);
      }

      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }

      const data = await res.json();
      const sessionId = data.id || data.sessionId;

      if (!sessionId) {
        throw new Error("Failed to create session");
      }

      setSession({
        sessionId,
        childIds: params.childIds,
        childNames: params.childNames,
        playlist: params.playlist,
        calmingVideos: params.calmingVideos,
        currentIndex: 0,
        includeWindDown: params.includeWindDown,
        taperMode: params.taperMode,
        flatlineLevel: params.flatlineLevel,
        sessionMinutes: params.sessionMinutes,
        finishMode: params.finishMode,
        isActive: true,
        startTimeMs: Date.now(),
        wasOverride: false,
        totalSecondsWatched: 0,
      });

      return sessionId;
    },
    [],
  );

  const endSession = useCallback(async () => {
    if (session.sessionId) {
      try {
        await apiRequest("PATCH", `/api/sessions/${session.sessionId}`, {
          endedAt: new Date().toISOString(),
          totalDurationSeconds: session.totalSecondsWatched,
        });
      } catch (err: unknown) {
        console.warn("Failed to end session on server:", err instanceof Error ? err.message : err);
      }
    }
    setSession((prev) => ({ ...prev, isActive: false }));
  }, [session.sessionId, session.totalSecondsWatched]);

  const advanceVideo = useCallback(() => {
    setSession((prev) => {
      const nextIndex = prev.currentIndex + 1;
      if (nextIndex >= prev.playlist.length) {
        if (prev.includeWindDown && prev.calmingVideos.length > 0) {
          return {
            ...prev,
            playlist: [...prev.playlist, prev.calmingVideos[0]],
            currentIndex: nextIndex,
            includeWindDown: false,
          };
        }
        return { ...prev, isActive: false };
      }
      return { ...prev, currentIndex: nextIndex };
    });
  }, []);

  const setCurrentIndex = useCallback((index: number) => {
    setSession((prev) => ({ ...prev, currentIndex: index }));
  }, []);

  const updateWatchTime = useCallback((seconds: number) => {
    setSession((prev) => ({ ...prev, totalSecondsWatched: seconds }));
  }, []);

  const resetSession = useCallback(() => {
    setSession(initialSession);
  }, []);

  return (
    <SessionContext.Provider
      value={{
        session,
        startSession,
        endSession,
        advanceVideo,
        setCurrentIndex,
        updateWatchTime,
        resetSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
