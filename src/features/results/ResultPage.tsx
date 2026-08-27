import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/service";
import { StatusPanel } from "../../components/ui/StatusPanel";
import { BackHeader } from "../../components/ui/BackHeader";
import styles from "../../components/ui/Pages.module.css";

const labels: Record<string, string> = {
  question_understanding_fit: "질문 이해·적합성",
  answer_structure: "답변 구조",
  specificity_evidence: "구체성·근거",
  job_fit_problem_solving: "직무 적합성·문제 해결력",
  delivery_attitude: "전달력·태도",
};

export function ResultPage() {
  const navigate = useNavigate();
  const { roomId = "" } = useParams();
  const result = useQuery({ queryKey: ["result", roomId], queryFn: () => api.result(roomId) });
  if (result.isLoading) return <StatusPanel title="연습 결과를 정리하고 있어요" />;
  if (result.error) return <StatusPanel title="결과가 아직 준비되지 않았어요" detail={result.error.message} onRetry={() => void result.refetch()} />;
  const data = result.data;
  const interview = data?.interview_evaluation;
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}><BackHeader title="결과 요약" onBack={() => navigate("/rooms")} /><p className={styles.eyebrow}>R01</p><h1>결과 요약</h1><p className={styles.lead}>{data?.summary ?? interview?.summary ?? "답변에서 실제로 관찰된 내용을 기준으로 정리했습니다."}</p></header>
      <section className={styles.resultHero}><div><span>종합 점수</span><strong>{data?.overall_score ?? interview?.overall_score ?? "—"}</strong><small>/ 100</small></div><p>점수가 일부 누락되면 임의로 0점을 채우지 않고 설명형 피드백만 제공합니다.</p></section>
      {interview && <section className={styles.scoreGrid}>{interview.scores.map((score) => <article key={score.category}><span>{labels[score.category]}</span><strong>{score.score} / {score.max_score}</strong><p>{score.strength ?? score.suggestion ?? "답변 근거를 더 구체화해 보세요."}</p></article>)}</section>}
      {!!data?.items.length && <section className={styles.panel}><h2>표현별 코칭</h2><div className={styles.feedbackList}>{data.items.map((item) => <article key={`${item.item_type}-${item.order}`}><span className={styles.cardTag}>{item.category ?? item.item_type}</span><h3>{item.title}</h3><p>{item.explanation ?? item.evidence}</p>{item.recommended_expression && <blockquote>{item.recommended_expression}</blockquote>}</article>)}</div></section>}
      <div className={styles.actionRow}><Link className={styles.secondaryLink} to="/">홈으로</Link><Link className={styles.primaryLink} to="/practice">다시 연습하기</Link></div>
    </div>
  );
}
