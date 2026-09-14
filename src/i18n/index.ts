import i18n from "i18next";
import { initReactI18next } from "react-i18next";

void i18n.use(initReactI18next).init({
  lng: "ko",
  fallbackLng: "ko",
  interpolation: { escapeValue: false },
  resources: {
    ko: { translation: {
      nav: { home: "홈", practice: "연습", conversations: "대화 목록", account: "내 정보", interview: "면접", logout: "로그아웃" },
      language: {
        section: "언어 선택", save: "선택 완료", saving: "저장 중…",
        display: { title: "표시 언어", lead: "앱의 메뉴와 안내 문구에 사용할 언어를 선택해요", noticeTitle: "언어는 언제든 다시 변경할 수 있어요", noticeBody: "앱의 메뉴와 안내 문구에 적용돼요." },
        native: { title: "모국어", lead: "당신의 모국어를 선택하세요", noticeTitle: "언어는 언제든 다시 변경할 수 있어요", noticeBody: "선택한 언어를 바탕으로 대화 연습을 안내해요." },
      },
    } },
    en: { translation: {
      nav: { home: "Home", practice: "Practice", conversations: "Conversations", account: "My Info", interview: "Interview", logout: "Log out" },
      language: {
        section: "Select a language", save: "Save selection", saving: "Saving…",
        display: { title: "Display Language", lead: "Choose the language used for app menus and guidance.", noticeTitle: "You can change the language at any time", noticeBody: "It will be applied to app menus and guidance." },
        native: { title: "Native Language", lead: "Choose your native language.", noticeTitle: "You can change the language at any time", noticeBody: "We’ll tailor conversation practice guidance to your selection." },
      },
    } },
  },
});

export default i18n;
