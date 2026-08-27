import i18n from "i18next";
import { initReactI18next } from "react-i18next";

void i18n.use(initReactI18next).init({
  lng: "ko",
  fallbackLng: "ko",
  interpolation: { escapeValue: false },
  resources: {
    ko: { translation: { nav: { home: "홈", practice: "연습", interview: "면접", logout: "로그아웃" } } },
    en: { translation: { nav: { home: "Home", practice: "Practice", interview: "Interview", logout: "Log out" } } },
  },
});

export default i18n;
