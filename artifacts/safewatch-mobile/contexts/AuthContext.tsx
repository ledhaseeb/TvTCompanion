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

function normalizeUser(u: Record<string, unknown>): AppUser {
  return {
    id: (u.id as string) || "",
    firebaseUid: (u.firebaseUid || u.firebase_uid || "") as string,
    email: (u.email as string) || "",
    displayName: (u.displayName ?? u.display_name ?? null) as string | null,
    role: (u.role as string) || "parent",
    parentAccountId: (u.parentAccountId ?? u.parent_account_id ?? null) as string | null,
    isFoundingMember: (u.isFoundingMember ?? u.is_founding_member ?? 0) as number | undefined,
  };
}

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

  const fetchOrCreateUser = useCallback(async (freshToken?: string): Promise<AppUser | null> => {
    try {
      let token = freshToken;
      if (!token) {
        try {
          const auth = getFirebaseAuth();
          const currentUser = auth.currentUser;
          if (currentUser) {
            token = await currentUser.getIdToken(true);
            await setAuthToken(token);
          }
        } catch {}
      }
      if (!token) {
        token = await getIdToken();
      }
      if (!token) return null;

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };

      const getRes = await fetch(apiUrl("/api/users/me"), { headers });

      if (getRes.ok) {
        const raw = await getRes.json();
        return normalizeUser(raw);
      }

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
        const raw = await createRes.json();
        return normalizeUser(raw);
      }

      const errText = await createRes.text().catch(() => "");
      console.warn("fetchOrCreateUser failed:", getRes.status, createRes.status, errText);
      return null;
    } catch (err) {
      console.warn("fetchOrCreateUser error:", err);
      return null;
    }
  }, []);

  const login = useCallback(
    async (firebaseIdToken: string) => {
      await setAuthToken(firebaseIdToken);
      const userData = await fetchOrCreateUser(firebaseIdToken);
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
