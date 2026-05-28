"use client";

import { useState, useEffect, useCallback } from "react";
import Cookies from "js-cookie";
import type { User } from "./types";

const ACCESS_TOKEN_KEY = "ats_access_token";
const REFRESH_TOKEN_KEY = "ats_refresh_token";
const USER_KEY = "ats_user";
const AUTH_CHANGED_EVENT = "ats-auth-changed";

function notifyAuthChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  }
}

// ---- Cookie helpers ----
export function getAccessToken(): string | undefined {
  return Cookies.get(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  Cookies.set(ACCESS_TOKEN_KEY, token, { expires: 1, sameSite: "lax" });
}

export function getRefreshToken(): string | undefined {
  return Cookies.get(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  Cookies.set(REFRESH_TOKEN_KEY, token, { expires: 7, sameSite: "lax" });
}

export function getStoredUser(): User | null {
  const raw = Cookies.get(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User): void {
  Cookies.set(USER_KEY, JSON.stringify(user), { expires: 7, sameSite: "lax" });
}

export function removeTokens(): void {
  Cookies.remove(ACCESS_TOKEN_KEY);
  Cookies.remove(REFRESH_TOKEN_KEY);
  Cookies.remove(USER_KEY);
  notifyAuthChanged();
}

export function storeAuthData(accessToken: string, refreshToken: string, user: User): void {
  setAccessToken(accessToken);
  setRefreshToken(refreshToken);
  setStoredUser(user);
  notifyAuthChanged();
}

// ---- useAuth hook ----
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const syncAuthState = () => {
      const token = getAccessToken();
      const storedUser = getStoredUser();
      if (token && storedUser) {
        setUser(storedUser);
        setIsLoggedIn(true);
      } else {
        setUser(null);
        setIsLoggedIn(false);
      }
      setIsLoading(false);
    };

    syncAuthState();

    window.addEventListener(AUTH_CHANGED_EVENT, syncAuthState);
    window.addEventListener("storage", syncAuthState);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncAuthState);
      window.removeEventListener("storage", syncAuthState);
    };
  }, []);

  const logout = useCallback(() => {
    removeTokens();
    setUser(null);
    setIsLoggedIn(false);
  }, []);

  const updateUser = useCallback((userData: User) => {
    setStoredUser(userData);
    setUser(userData);
    setIsLoggedIn(true);
    notifyAuthChanged();
  }, []);

  return {
    user,
    isLoggedIn,
    isLoading,
    isCandidate: user?.role === "CANDIDATE",
    isRecruiter: user?.role === "RECRUITER",
    logout,
    updateUser,
  };
}
