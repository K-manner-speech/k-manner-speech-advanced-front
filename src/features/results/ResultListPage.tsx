import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatListDate } from "../../lib/date";
import { api } from "../../api/service";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { StatusPanel } from "../../components/ui/StatusPanel";
import styles from "./ResultListPage.module.css";

const statusLabels: Record<string, string> = { processing: "정리 중", partial: "일부 완료", succeeded: "완료", failed: "생성 실패" };

function resultStatusLabel(status: string, failureCode?: string | null) {
  if (status === "failed" && failureCode === "JOB_DEADLINE_EXCEEDED") return "생성 시간 초과";
  return statusLabels[status] ?? status;
}

const filters = [
  { value: "all", label: "전체" },
  { value: "free_chat", label: "자유채팅" },
  { value: "scenario", label: "시나리오" },
  { value: "interview", label: "면접" },
] as const;

const sorts = [
  { value: "recent", label: "최신순" },
  { value: "score", label: "점수순" },
] as const;

export function ResultListPage() {
  const navigate = useNavigate();
  const results = useQuery({ queryKey: ["results"], queryFn: () => api.results(undefined, 20) });
  const [practiceType, setPracticeType] = useState<(typeof filters)[number]["value"]>("all");
  const [sort, setSort] = useState<(typeof sorts)[number]["value"]>("recent");

  // 목록은 한 번에 20건까지만 받으므로 거르고 세우는 일은 화면에서 한다.
  const items = useMemo(() => {
    const rows = (results.data?.items ?? [])
      .filter((result) => practiceType === "all" || result.practice_type === practiceType);
    if (sort === "recent") return rows;
    // 점수순에서 아직 점수가 없는 결과는 뒤로 보낸다. 0점과 구분해야 한다.
    return [...rows].sort((a, b) => (b.overall_score ?? -1) - (a.overall_score ?? -1));
  }, [results.data, practiceType, sort]);

  if (results.isLoading) return <StatusPanel title="연습 결과를 불러오고 있어요" />;
  if (results.error) return <StatusPanel title="결과 목록을 불러오지 못했어요" detail={results.error.message} onRetry={() => void results.refetch()} />;

  const hasResults = Boolean(results.data?.items.length);
  return (
    <div className={styles.page}>
      <ScreenHeader title="피드백 목록" onBack={() => navigate(-1)} />
      <h1 className={styles.headline}>완료한 연습의 피드백을 다시 확인해 보세요</h1>

      {hasResults && (
        <div className={styles.controls}>
          <label className={styles.control}>
            <span className={styles.controlLabel}>연습 종류</span>
            <select value={practiceType} onChange={(event) => setPracticeType(event.target.value as typeof practiceType)}>
              {filters.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
            </select>
          </label>
          <label className={`${styles.control} ${styles.controlSort}`}>
            <span className={styles.controlLabel}>정렬</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
              {sorts.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
      )}

      {!hasResults ? (
        <p className={styles.empty}>아직 저장된 결과가 없습니다.</p>
      ) : !items.length ? (
        <p className={styles.empty}>이 연습 종류로 저장된 결과가 없어요.</p>
      ) : (
        <section className={styles.list} aria-label="저장된 결과 목록">
          {items.map((result) => (
            <Link
              key={result.id}
              className={styles.card}
              to={`/results/${result.id}`}
              aria-label={`${result.display_title} 피드백 확인`}
            >
              <time>{formatListDate(result.created_at)}</time>
              <div className={styles.head}>
                <h2>{result.display_title}</h2>
                {/* 점수가 있으면 점수를, 없으면 왜 없는지를 보여 준다. 빈 자리는
                    아직 만드는 중인지 실패했는지 알려 주지 않는다. */}
                {result.overall_score === null || result.overall_score === undefined ? (
                  <span className={styles.status}>{resultStatusLabel(result.status, result.failure_code)}</span>
                ) : (
                  <span className={styles.score}>{result.overall_score}점<b aria-hidden="true">›</b></span>
                )}
              </div>
              <p>
                {result.summary
                  ?? (result.missing_categories.length
                    ? `누락 항목 ${result.missing_categories.length}개를 제외한 피드백이에요.`
                    : "완료한 연습의 강점과 개선점을 확인해 보세요.")}
              </p>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
