import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/service";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { StatusPanel } from "../../components/ui/StatusPanel";
import styles from "./ResultListPage.module.css";

const statusLabels: Record<string, string> = { processing: "정리 중", partial: "일부 완료", succeeded: "완료", failed: "생성 실패" };

function resultStatusLabel(status: string, failureCode?: string | null) {
  if (status === "failed" && failureCode === "JOB_DEADLINE_EXCEEDED") return "생성 시간 초과";
  return statusLabels[status] ?? status;
}

export function ResultListPage() {
  const navigate = useNavigate();
  const results = useQuery({ queryKey: ["results"], queryFn: () => api.results(undefined, 20) });
  if (results.isLoading) return <StatusPanel title="연습 결과를 불러오고 있어요" />;
  if (results.error) return <StatusPanel title="결과 목록을 불러오지 못했어요" detail={results.error.message} onRetry={() => void results.refetch()} />;
  return (
    <div className={styles.page}>
      <ScreenHeader title="피드백 목록" onBack={() => navigate(-1)} />
      <h1 className={styles.headline}>완료한 연습의 피드백을 다시 확인해 보세요</h1>
      {!results.data?.items.length ? (
        <p className={styles.empty}>아직 저장된 결과가 없습니다.</p>
      ) : (
        <section className={styles.list} aria-label="저장된 결과 목록">
          {results.data.items.map((result) => (
            <Link
              key={result.id}
              className={styles.card}
              to={`/results/${result.id}`}
              aria-label={`${result.display_title} 피드백 확인`}
            >
              <time>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(result.created_at))}</time>
              <div className={styles.head}>
                <h2>{result.display_title}</h2>
                <span className={styles.status}>{resultStatusLabel(result.status, result.failure_code)}</span>
              </div>
              <p>
                {result.missing_categories.length
                  ? `누락 항목 ${result.missing_categories.length}개를 제외한 피드백이에요.`
                  : "완료한 연습의 강점과 개선점을 확인해 보세요."}
              </p>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
