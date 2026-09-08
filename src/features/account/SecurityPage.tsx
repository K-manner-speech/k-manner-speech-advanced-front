import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/service";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { useAuth } from "../auth";
import styles from "./SecurityPage.module.css";

export function SecurityPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  // 주소는 세션이 들고 있다. 프로필 API 가 주지 않아 여기서 읽는다.
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });

  return (
    <div className={styles.page}>
      <ScreenHeader title="이메일 · 비밀번호" onBack={() => navigate(-1)} />

      <h2 className={styles.sectionTitle}>로그인 정보</h2>
      <Link className={styles.card} to="/me/security/email">
        <span className={styles.rowText}>
          <b>이메일</b>
          <small>{session?.user.email ?? "-"}</small>
        </span>
        <span className={styles.chevron} aria-hidden="true">›</span>
      </Link>

      <h2 className={styles.sectionTitle}>보안</h2>
      <Link className={styles.card} to="/me/security/password">
        <span className={styles.rowText}>
          <b>비밀번호 변경</b>
          <small>안전한 비밀번호로 변경해요</small>
        </span>
        <span className={styles.chevron} aria-hidden="true">›</span>
      </Link>

      <h2 className={styles.sectionTitle}>알림</h2>
      <div className={styles.notice}>
        <strong>보안 관련 알림</strong>
        <span>비밀번호가 변경되면 이메일로 알려드려요.</span>
      </div>

      {me.error && <p className={styles.error} role="alert">{me.error.message}</p>}
    </div>
  );
}
