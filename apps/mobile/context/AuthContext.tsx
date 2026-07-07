/**
 * Auth Context — Takma ad (nickname) yerel depolama yönetimi
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  PropsWithChildren,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface AuthContextValue {
  nickname: string | null;
  loading: boolean;
  saveNickname: (nickname: string) => Promise<void>;
  clearNickname: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const NICKNAME_KEY = "kadromu_kur_nickname";

export function AuthProvider({ children }: PropsWithChildren) {
  const [nickname, setNickname] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(NICKNAME_KEY)
      .then((val) => {
        setNickname(val);
      })
      .catch((err) => {
        console.error("Takma ad yüklenirken hata:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const saveNickname = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await AsyncStorage.setItem(NICKNAME_KEY, trimmed);
    setNickname(trimmed);
  };

  const clearNickname = async () => {
    await AsyncStorage.removeItem(NICKNAME_KEY);
    setNickname(null);
  };

  return (
    <AuthContext.Provider
      value={{
        nickname,
        loading,
        saveNickname,
        clearNickname,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
