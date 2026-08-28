import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/service";
import { BackHeader } from "../../components/ui/BackHeader";
import { StatusPanel } from "../../components/ui/StatusPanel";
import styles from "../../components/ui/Pages.module.css";

const statusLabels: Record<string, string> = { processing: "정리 중", partial: "일부 완료", succeeded: "완료", failed: "생성 실패" };

export function ResultListPage() {
  const navigate = useNavigate();
  const results = useQuery({ queryKey: ["results"], queryFn: () => api.results(undefined, 20) });
  if (results.isLoading) return <StatusPanel title="연습 결과를 불러오고 있어요" />;
  if (results.error) return <StatusPanel title="결과 목록을 불러오지 못했어요" detail={results.error.message} onRetry={() => void results.refetch()} />;
  return (
    <div className={`${styles.page} ${styles.feedbackListPage}`}>
      <BackHeader title="피드백 목록" onBack={() => navigate(-1)} />
      <header className={styles.feedbackListHeader}><p className={styles.eyebrow}>R00</p><h1>피드백 목록</h1><p>완료한 연습의 피드백을 다시 확인해 보세요.</p></header>
      {!results.data?.items.length ? <div className={styles.empty}>아직 저장된 결과가 없습니다.</div> : <section className={styles.resultList} aria-label="저장된 결과 목록">
        {results.data.items.map((result) => <Link key={result.id} className={styles.feedbackResultCard} to={`/results/${result.id}`} aria-label={`${result.attempt_no}번째 연습 피드백 확인`}>
          <time>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(result.created_at))}</time>
          <div><h2>{result.attempt_no}번째 연습 피드백</h2><strong>{statusLabels[result.status] ?? result.status} ›</strong></div>
          <p>{result.missing_categories.length ? `누락 항목 ${result.missing_categories.length}개를 제외한 피드백이에요.` : "완료한 연습의 강점과 개선점을 확인해 보세요."}</p>
        </Link>)}
      </section>}
    </div>
  );
}
