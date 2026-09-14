import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router-dom";
import { usePreferences } from "../../store/preferences";
import styles from "./AppShell.module.css";

function NavIcon({ type }: { type: "home" | "practice" | "chat" | "account" }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.15, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg className={styles.navIcon} viewBox="0 0 20 20" aria-hidden="true">
      {type === "home" && <path {...common} d="M2.3 8.6 10 2.3l7.7 6.3M4.2 7.7v9.2h11.6V7.7" />}
      {type === "practice" && <>
        <rect {...common} x="3.1" y="1.9" width="13.8" height="16.2" rx="3.1" />
        <path {...common} strokeWidth=".9" d="M6.2 6.9h7.6M6.2 10h7.6M6.2 13.1h5.3" />
      </>}
      {type === "chat" && <>
        <path {...common} d="M4 1.8h12a1.8 1.8 0 0 1 1.8 1.8v7.2a1.8 1.8 0 0 1-1.8 1.8H8.8l-4.5 3.6v-3.6H4a1.8 1.8 0 0 1-1.8-1.8V3.6A1.8 1.8 0 0 1 4 1.8Z" />
        <path {...common} strokeWidth=".9" d="M6.4 6.3h7.2M6.4 9.3h4.8" />
      </>}
      {type === "account" && <>
        <circle {...common} cx="10" cy="5.8" r="3.5" />
        <path {...common} d="M4.2 17.7c0-3.9 2.6-6.2 5.8-6.2s5.8 2.3 5.8 6.2" />
      </>}
    </svg>
  );
}

export function AppShell({ children }: PropsWithChildren) {
  const { t, i18n } = useTranslation();
  const { language } = usePreferences();
  const { pathname } = useLocation();
  useEffect(() => {
    void i18n.changeLanguage(language);
    document.documentElement.lang = language;
  }, [i18n, language]);
  const isConversation = /^\/rooms\/[^/]+\/?$/.test(pathname);
  const practiceActive = pathname === "/practice" || pathname === "/interview" || pathname.startsWith("/rooms/") || pathname.startsWith("/results/");
  return (
    <div className={`${styles.viewport} ${isConversation ? styles.conversationViewport : ""}`}>
      <header className={styles.header}>
        <span>9:41</span>
        <span>5G ▰</span>
      </header>
      <main className={styles.main}>{children}</main>
      {!isConversation && (
        <nav className={styles.navigation} aria-label="주요 메뉴">
          <NavLink to="/" end><NavIcon type="home" />{t("nav.home")}</NavLink>
          <NavLink to="/practice" className={practiceActive ? styles.active : undefined}><NavIcon type="practice" />{t("nav.practice")}</NavLink>
          <NavLink to="/rooms" end><NavIcon type="chat" />대화 목록</NavLink>
          <NavLink to="/me"><NavIcon type="account" />내 정보</NavLink>
        </nav>
      )}
    </div>
  );
}
