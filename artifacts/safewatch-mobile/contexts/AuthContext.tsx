import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  getIdToken,
  setAuthToken,
  clearAuth,
  setUserRole,
  onTokenRefresh,
  isFirebaseConfigured,
  getFirebaseAuth,
} from "@/lib/auth";
import { apiRequest } from "@/lib/query-client";
import { apiUrl } from "@/lib/api";
import type { AppUser } from "@/lib/types";

interface AuthContextType {
  user: AppUser | null;
  isLoading: boolean;
  isCaregiver: boolean;
  login: (firebaseIdToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isCaregiver: false,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const unsubRef = useRef<(() => void) | null>(null);

  const fetchOrCreateUser = useCallback(async (): Promise<AppUser | null> => {
    try {
      const token = await getIdToken();
      if (!token) return null;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };

      const getRes = await fetch(apiUrl("/api/users/me"), { headers });

      if (getRes.ok) {
        return await getRes.json();
      }

      if (getRes.status === 404 || getRes.status === 401) {
        let email = "";
        let displayName = null;
        try {
          const auth = getFirebaseAuth();
          const currentUser = auth.currentUser;
          if (currentUser) {
            email = currentUser.email || "";
            displayName = currentUser.displayName || null;
          }
        } catch {}
        const createRes = await fetch(apiUrl("/api/users/me"), {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ email, displayName }),
        });
        if (createRes.ok) {
          return await createRes.json();
        }
      }

      return null;
    } catch {
      return null;
    }
  }, []);

  const login = useCallback(
    async (firebaseIdToken: string) => {
      await setAuthToken(firebaseIdToken);
      const userData = await fetchOrCreateUser();
      if (userData) {
        setUser(userData);
        await setUserRole(userData.role);
      } else {
        await clearAuth();
        throw new Error("Failed to authenticate. Please try again.");
      }
    },
    [fetchOrCreateUser],
  );

  const logout = useCallback(async () => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    await clearAuth();
    setUser(null);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const token = await getIdToken();
        if (token) {
          const userData = await fetchOrCreateUser();
          if (userData) {
            setUser(userData);
            await setUserRole(userData.role);
          } else {
            await clearAuth();
          }
        }
      } catch {
      }
      setIsLoading(false);
    })();

    try {
      if (isFirebaseConfigured()) {
        unsubRef.current = onTokenRefresh(async (newToken) => {
          if (!newToken) {
            setUser(null);
          }
        });
      }
    } catch {
    }

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
      }
    };
  }, [fetchOrCreateUser]);

  const isCaregiver = user?.role === "caregiver";

  return (
    <AuthContext.Provider value={{ user, isLoading, isCaregiver, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useIsCaregiver() {
  const { isCaregiver } = useAuth();
  return isCaregiver;
}
