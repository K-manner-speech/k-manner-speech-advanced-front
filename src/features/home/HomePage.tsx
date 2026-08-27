import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../api/service";
import styles from "../../components/ui/Pages.module.css";

export function HomePage() {
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>안녕하세요, {me.data?.profile.display_name ?? "학습자"}님</p>
          <h1>오늘은 어떤 상황을<br />연습해 볼까요?</h1>
          <p className={styles.lead}>실제 관계와 맥락을 선택하면 AI가 자연스러운 한국어 표현을 코칭해 드려요.</p>
        </div>
        <div className={styles.heroAccent} aria-hidden="true">말</div>
      </section>
      <section className={styles.choiceGrid} aria-label="연습 선택">
        <Link className={styles.choiceCard} to="/practice">
          <span className={styles.cardIcon}>💬</span><span className={styles.cardTag}>일상 · 직장</span>
          <h2>상황별 대화 연습</h2><p>페르소나와 상황을 골라 부담 없이 대화를 시작해요.</p><span className={styles.cardAction}>연습 선택하기 →</span>
        </Link>
        <Link className={`${styles.choiceCard} ${styles.interviewCard}`} to="/interview">
          <span className={styles.cardIcon}>📄</span><span className={styles.cardTag}>이력서 기반</span>
          <h2>AI 면접 연습</h2><p>내 경험을 바탕으로 생성된 질문에 순서대로 답해요.</p><span className={styles.cardAction}>면접 준비하기 →</span>
        </Link>
      </section>
      <section className={styles.infoStrip}>
        <strong>로컬 시연 안내</strong><span>AI 결과는 코칭 참고용이며 감정은 사실이 아닌 추정으로 표시됩니다.</span>
      </section>
    </div>
  );
}
