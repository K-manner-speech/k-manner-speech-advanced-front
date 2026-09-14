import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type Preferences = {
  language: "ko" | "en";
  ttsAutoplay: boolean;
  setLanguage(language: "ko" | "en"): void;
  setTtsAutoplay(enabled: boolean): void;
};

/**
 * localStorage 를 쓰되 없으면 메모리에 담는다.
 *
 * 저장소는 항상 있는 물건이 아니다. 테스트 환경에는 없고, 브라우저도 사생활
 * 보호 설정이나 저장소 차단에서는 접근 자체가 예외를 던진다. 그때 설정을
 * 바꾸다 화면이 통째로 죽는 것보다, 이번 세션 동안만 기억하고 넘어가는 편이
 * 낫다. 언어와 자동 재생은 잃어도 다시 고르면 되는 값이다.
 */
function createSafeStorage(): Storage {
  try {
    const probe = "__k-manner-probe__";
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const memory = new Map<string, string>();
    return {
      get length() {
        return memory.size;
      },
      clear: () => memory.clear(),
      getItem: (key: string) => memory.get(key) ?? null,
      key: (index: number) => [...memory.keys()][index] ?? null,
      removeItem: (key: string) => void memory.delete(key),
      setItem: (key: string, value: string) => void memory.set(key, value),
    };
  }
}

export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      language: "ko",
      ttsAutoplay: true,
      setLanguage: (language) => set({ language }),
      setTtsAutoplay: (ttsAutoplay) => set({ ttsAutoplay }),
    }),
    { name: "k-manner-preferences", storage: createJSONStorage(createSafeStorage) },
  ),
);
