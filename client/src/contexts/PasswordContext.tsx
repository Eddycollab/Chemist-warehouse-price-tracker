import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const STORAGE_KEY = "cw_access_verified";
const STORAGE_EXPIRY_KEY = "cw_access_expiry";
// 7 days in ms
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

interface PasswordContextType {
  isVerified: boolean;
  verify: () => void;
  logout: () => void;
}

const PasswordContext = createContext<PasswordContextType>({
  isVerified: false,
  verify: () => {},
  logout: () => {},
});

export function PasswordProvider({ children }: { children: ReactNode }) {
  const [isVerified, setIsVerified] = useState<boolean>(() => {
    try {
      const verified = localStorage.getItem(STORAGE_KEY);
      const expiry = localStorage.getItem(STORAGE_EXPIRY_KEY);
      if (verified === "true" && expiry) {
        const expiryTime = parseInt(expiry, 10);
        if (Date.now() < expiryTime) {
          return true;
        }
        // expired — clear
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_EXPIRY_KEY);
      }
    } catch {
      // ignore
    }
    return false;
  });

  const verify = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
      localStorage.setItem(
        STORAGE_EXPIRY_KEY,
        String(Date.now() + SESSION_DURATION)
      );
    } catch {
      // ignore
    }
    setIsVerified(true);
  };

  const logout = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_EXPIRY_KEY);
    } catch {
      // ignore
    }
    setIsVerified(false);
  };

  return (
    <PasswordContext.Provider value={{ isVerified, verify, logout }}>
      {children}
    </PasswordContext.Provider>
  );
}

export function usePassword() {
  return useContext(PasswordContext);
}
