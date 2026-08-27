import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../api/service";
import { StatusPanel } from "../../components/ui/StatusPanel";
import styles from "../../components/ui/Pages.module.css";

const statusLabels: Record<string, string> = { processing: "정리 중", partial: "일부 완료", succeeded: "완료", failed: "생성 실패" };

export function ResultListPage() {
  const results = useQuery({ queryKey: ["results"], queryFn: () => api.results(undefined, 20) });
  if (results.isLoading) return <StatusPanel title="연습 결과를 불러오고 있어요" />;
  if (results.error) return <StatusPanel title="결과 목록을 불러오지 못했어요" detail={results.error.message} onRetry={() => void results.refetch()} />;
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}><p className={styles.eyebrow}>나의 연습 기록</p><h1>좋은 연습 결과를 다시 확인하세요</h1><p className={styles.lead}>방이 정리된 뒤에도 저장된 결과 스냅샷은 이곳에서 확인할 수 있습니다.</p></header>
      {!results.data?.items.length ? <div className={styles.empty}>아직 저장된 결과가 없습니다.</div> : <section className={styles.resultList} aria-label="저장된 결과 목록">
        {results.data.items.map((result) => <article key={result.id} className={styles.resultListItem}>
          <div><span className={styles.cardTag}>{statusLabels[result.status] ?? result.status}</span><h2>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeStyle: "short" }).format(new Date(result.created_at))}</h2><p>{result.attempt_no}번째 결과 · 누락 항목 {result.missing_categories.length}개</p></div>
          <Link className={styles.secondaryLink} to={`/results/${result.id}`}>결과 상세 보기</Link>
        </article>)}
      </section>}
    </div>
  );
}
