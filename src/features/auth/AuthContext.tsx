/* oxlint-disable react/only-export-components -- provider와 전용 hook은 하나의 인증 경계다. */
import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { supabase } from "../../api/supabase";

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setIsLoading(false);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });
    const expire = () => {
      window.sessionStorage.clear();
      setSession(null);
    };
    window.addEventListener("auth:expired", expire);
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
      window.removeEventListener("auth:expired", expire);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error("이메일 또는 비밀번호를 확인해 주세요.");
      },
      async signOut() {
        await supabase.auth.signOut();
        window.sessionStorage.clear();
      },
    }),
    [isLoading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider가 필요합니다.");
  return value;
}
