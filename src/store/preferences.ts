import { create } from "zustand";
import { persist } from "zustand/middleware";

type Preferences = {
  language: "ko" | "en";
  ttsAutoplay: boolean;
  setLanguage(language: "ko" | "en"): void;
  setTtsAutoplay(enabled: boolean): void;
};

export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      language: "ko",
      ttsAutoplay: true,
      setLanguage: (language) => set({ language }),
      setTtsAutoplay: (ttsAutoplay) => set({ ttsAutoplay }),
    }),
    { name: "k-manner-preferences" },
  ),
);
