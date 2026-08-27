import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/service";
import { useAuth } from "../auth";
import styles from "./MyAccountPage.module.css";

const languageName = (value: string | null | undefined) => {
  const names: Record<string, string> = {
    ko: "한국어 · Korean",
    en: "영어 · English",
    English: "영어 · English",
    Japanese: "일본어 · Japanese",
    Chinese: "중국어 · Chinese",
  };
  return value ? names[value] ?? value : "-";
};

export function MyAccountPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const profile = me.data?.profile;
  const logout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };
  return (
    <div className={styles.page}>
      <div className={styles.topRow}><strong>내 정보</strong><button onClick={() => void logout()}>로그아웃</button></div>
      <p className={styles.code}>M01</p>
      <h1>내 정보</h1><p className={styles.subtitle}>My account</p>
      {me.isError && <p className={styles.error}>정보를 불러오지 못했습니다.</p>}
      <dl className={styles.details}>
        <div><dt>이름 · Name</dt><dd>{profile?.display_name || "-"}</dd></div>
        <div><dt>출생년도 · Year of birth</dt><dd>{profile?.birth_date?.slice(0,4) || "-"}</dd></div>
        <div><dt>이메일 · Email</dt><dd>{session?.user.email || "-"}</dd></div>
        <div><dt>모국어 · Native language</dt><dd>{languageName(profile?.native_language)}</dd></div>
        <div><dt>표시 언어 · Display language</dt><dd>{languageName(me.data?.display_language)}</dd></div>
      </dl>
      <button className={styles.deleteButton} onClick={() => window.alert("회원 탈퇴는 확인 절차 화면에서 진행됩니다.")}>회원 탈퇴 · Delete account</button>
      <button className={styles.editButton} onClick={() => navigate("/onboarding")}>프로필 수정 · Edit profile</button>
    </div>
  );
}
