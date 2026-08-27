import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router-dom";
import { usePreferences } from "../../store/preferences";
import styles from "./AppShell.module.css";

export function AppShell({ children }: PropsWithChildren) {
  const { t, i18n } = useTranslation();
  const { language } = usePreferences();
  const { pathname } = useLocation();
  useEffect(() => {
    void i18n.changeLanguage(language);
    document.documentElement.lang = language;
  }, [i18n, language]);
  const practiceActive = pathname === "/practice" || pathname === "/interview" || pathname.startsWith("/rooms/") || pathname.startsWith("/results/");
  return (
    <div className={styles.viewport}>
      <header className={styles.header}>
        <span>9:41</span>
        <span>5G ▰</span>
      </header>
      <main className={styles.main}>{children}</main>
      <nav className={styles.navigation} aria-label="주요 메뉴">
        <NavLink to="/" end><span className={`${styles.navIcon} ${styles.homeIcon}`} aria-hidden="true" />{t("nav.home")}</NavLink>
        <NavLink to="/practice" className={practiceActive ? styles.active : undefined}><span className={`${styles.navIcon} ${styles.practiceIcon}`} aria-hidden="true" />{t("nav.practice")}</NavLink>
        <NavLink to="/rooms" end><span className={`${styles.navIcon} ${styles.chatIcon}`} aria-hidden="true" />대화 목록</NavLink>
        <NavLink to="/me"><span className={`${styles.navIcon} ${styles.accountIcon}`} aria-hidden="true" />내 정보</NavLink>
      </nav>
    </div>
  );
}
