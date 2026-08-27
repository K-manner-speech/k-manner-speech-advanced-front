import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../features/auth";
import { usePreferences } from "../../store/preferences";
import styles from "./AppShell.module.css";

export function AppShell({ children }: PropsWithChildren) {
  const { signOut } = useAuth();
  const { t, i18n } = useTranslation();
  const { language, setLanguage } = usePreferences();
  const navigate = useNavigate();
  useEffect(() => {
    void i18n.changeLanguage(language);
    document.documentElement.lang = language;
  }, [i18n, language]);
  const logout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };
  return (
    <div className={styles.viewport}>
      <header className={styles.header}>
        <NavLink to="/" className={styles.brand} aria-label="K-Manner Speech 홈">
          <span className={styles.logo}>K</span>
          <span>K-Manner <strong>Speech</strong></span>
        </NavLink>
        <div className={styles.headerActions}>
          <button className={styles.language} onClick={() => setLanguage(language === "ko" ? "en" : "ko")} aria-label="화면 언어 전환">{language === "ko" ? "EN" : "한국어"}</button>
          <button className={styles.logout} onClick={() => void logout()}>{t("nav.logout")}</button>
        </div>
      </header>
      <div className={styles.layout}>
        <aside className={styles.aside}>
          <p className={styles.asideLabel}>오늘의 연습</p>
          <h2>한 문장씩,<br />더 자연스럽게.</h2>
          <p>실수해도 괜찮아요. AI 코치가 맥락과 표현을 함께 살펴봅니다.</p>
          <div className={styles.tip}>Tip · 먼저 결론을 말하고 이유를 덧붙여 보세요.</div>
        </aside>
        <main className={styles.main}>{children}</main>
      </div>
      <nav className={styles.navigation} aria-label="주요 메뉴">
        <NavLink to="/" end>{t("nav.home")}</NavLink>
        <NavLink to="/practice">{t("nav.practice")}</NavLink>
        <NavLink to="/interview">{t("nav.interview")}</NavLink>
      </nav>
    </div>
  );
}
