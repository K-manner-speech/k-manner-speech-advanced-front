import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/service";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useAuth } from "../auth";
import styles from "./MyAccountPage.module.css";

const languageName = (value: string | null | undefined) => {
  const names: Record<string, string> = {
    ko: "한국어",
    en: "English",
    English: "영어",
    Japanese: "일본어",
    Chinese: "중국어",
  };
  return value ? names[value] ?? value : "-";
};

export function MyAccountPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const profile = me.data?.profile;
  const [confirming, setConfirming] = useState<"logout" | "withdraw" | null>(null);
  const logout = async () => {
    await signOut();
    navigate("/start", { replace: true });
  };
  // 탈퇴는 되돌릴 수 없고 성공하면 세션도 사라진다. 확인을 한 번 받는다.
  const withdraw = useMutation({
    mutationFn: api.deleteAccount,
    onSuccess: async () => {
      await signOut();
      navigate("/start", { replace: true });
    },
  });

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>내 정보</h1>

      <section className={styles.profile}>
        <span className={styles.avatar} aria-hidden="true">
          {(profile?.display_name ?? "?").slice(0, 1)}
        </span>
        <span>
          <b>{profile?.display_name ? `${profile.display_name}님` : "학습자님"}</b>
          <small>{session?.user.email ?? "-"}</small>
        </span>
      </section>

      {me.isError && <p className={styles.error}>정보를 불러오지 못했습니다.</p>}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>계정</h2>
        <div className={styles.rows}>
          <Link className={styles.row} to="/me/edit">
            <span aria-hidden="true">👤</span>
            <b>프로필 수정</b>
            <small>이름과 생년월일을 수정해요</small>
            <span className={styles.chevron} aria-hidden="true">›</span>
          </Link>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>환경 설정</h2>
        <div className={styles.rows}>
          <Link className={styles.row} to="/me/edit">
            <span aria-hidden="true">🌐</span>
            <b>모국어</b>
            <span className={styles.value}>{languageName(profile?.native_language)}</span>
            <span className={styles.chevron} aria-hidden="true">›</span>
          </Link>
          <Link className={styles.row} to="/me/edit">
            <span aria-hidden="true">🌐</span>
            <b>표시 언어</b>
            <span className={styles.value}>{languageName(me.data?.display_language)}</span>
            <span className={styles.chevron} aria-hidden="true">›</span>
          </Link>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>도움말</h2>
        <div className={styles.rows}>
          <a className={styles.row} href="mailto:support@example.com">
            <span aria-hidden="true">?</span>
            <b>문의하기</b>
            <small>서비스 이용 중 궁금한 점이 있나요?</small>
            <span className={styles.chevron} aria-hidden="true">›</span>
          </a>
        </div>
      </section>

      <div className={styles.footer}>
        <button type="button" className={styles.logout} onClick={() => setConfirming("logout")}>로그아웃</button>
        <button type="button" className={styles.withdraw} onClick={() => setConfirming("withdraw")}>
          회원 탈퇴
        </button>
      </div>

      {confirming === "logout" && (
        <ConfirmDialog
          title="로그아웃할까요?"
          description="다시 이용하려면 로그인해야 해요. 저장된 연습 기록은 그대로 남습니다."
          confirmLabel="로그아웃"
          onConfirm={() => void logout()}
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming === "withdraw" && (
        <ConfirmDialog
          title="회원 탈퇴할까요?"
          description="대화 기록과 피드백이 모두 삭제되며 복구할 수 없습니다."
          subject={{ name: session?.user.email ?? "내 계정" }}
          confirmLabel="회원 탈퇴"
          pendingLabel="탈퇴 처리 중…"
          pending={withdraw.isPending}
          error={withdraw.error?.message}
          onConfirm={() => withdraw.mutate()}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}
