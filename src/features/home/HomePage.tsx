import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../api/service";
import styles from "../../components/ui/Pages.module.css";

export function HomePage() {
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  return (
    <div className={styles.page}>
      <header className={styles.mobileTitle}><span>홈</span><p>H01</p><h1>홈</h1></header>
      <section className={styles.homeCard}><strong>최근 대화</strong><p>{me.data?.profile.display_name ?? "학습자"}님의 대화 내역이 여기에 표시돼요.<br />연습을 시작해 보세요.</p></section>
      <Link className={styles.feedbackCard} to="/results"><strong>피드백 모아보기 ›</strong><p>완료한 연습의 종합 점수와 표현 피드백을<br />한 곳에서 다시 확인할 수 있어요.</p></Link>
    </div>
  );
}
