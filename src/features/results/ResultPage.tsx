import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, waitForTerminal, type SessionResult } from "../../api/service";
import { BackHeader } from "../../components/ui/BackHeader";
import { StatusPanel } from "../../components/ui/StatusPanel";
import styles from "../../components/ui/Pages.module.css";

const labels: Record<string, string> = {
  question_understanding_fit: "질문 이해·적합성", answer_structure: "답변 구조", specificity_evidence: "구체성·근거",
  job_fit_problem_solving: "직무 적합성·문제 해결력", delivery_attitude: "전달력·태도",
};
type ResultView = "summary" | "strengths" | "improvements" | "strength-detail" | "improvement-detail";

export function ResultPage({ source = "room", view = "summary" }: { source?: "room" | "result"; view?: ResultView }) {
  const { roomId = "", resultId = "", category = "" } = useParams();
  const resourceId = source === "room" ? roomId : resultId;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const result = useQuery({ queryKey: ["result", source, resourceId], queryFn: () => source === "room" ? api.result(resourceId) : api.resultById(resourceId) });
  const retry = useMutation({ mutationFn: async () => { const accepted = await api.retryResult(roomId); return waitForTerminal(() => api.job(accepted.job.job_id), "succeeded"); }, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["result", source, resourceId] }); } });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteResult(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["results"] });
      navigate("/results", { replace: true });
    },
  });
  if (result.isLoading) return <StatusPanel title="연습 결과를 정리하고 있어요" />;
  if (result.error) return <StatusPanel title="결과가 아직 준비되지 않았어요" detail={result.error.message} onRetry={() => void result.refetch()} />;
  const data = result.data;
  if (!data) return <StatusPanel title="결과가 아직 준비되지 않았어요" />;
  if (data.interview_evaluation) return <InterviewResult data={data} view={view} category={category} onBack={() => navigate(-1)} remove={remove} />;
  return <div className={styles.page}>
    <header className={styles.pageHeader}><BackHeader title="결과 요약" onBack={() => navigate("/rooms")} /><p className={styles.eyebrow}>R01</p><h1>결과 요약</h1><p className={styles.lead}>{data.summary ?? "답변에서 관찰된 내용을 기준으로 정리했습니다."}</p></header>
    <section className={styles.resultHero}><div><span>종합 점수</span><strong>{data.overall_score ?? "—"}</strong><small>/ 100</small></div></section>
    {!!data.items.length && <section className={styles.panel}><h2>표현별 코칭</h2><div className={styles.feedbackList}>{data.items.map((item) => <article key={`${item.item_type}-${item.order}`}><h3>{item.title}</h3><p>{item.explanation ?? item.evidence}</p></article>)}</div></section>}
    {(retry.error || remove.error) && <div className={styles.partialError} role="alert">{(retry.error ?? remove.error)?.message}</div>}
    <div className={styles.actionRow}><Link className={styles.secondaryLink} to="/results">결과 목록</Link>{source === "room" && data.status === "failed" && <button className={styles.secondaryButton} onClick={() => retry.mutate()}>결과 생성 재시도</button>}{source === "result" && <button className={styles.dangerButton} disabled={remove.isPending} onClick={() => { if (window.confirm("이 결과를 삭제할까요? 삭제 후 복구할 수 없습니다.")) remove.mutate(data.id); }}>{remove.isPending ? "삭제 중…" : "결과 삭제"}</button>}</div>
  </div>;
}

function InterviewResult({ data, view, category, onBack, remove }: { data: SessionResult; view: ResultView; category: string; onBack: () => void; remove: UseMutationResult<void, Error, string> }) {
  const evaluation = data.interview_evaluation!;
  const base = `/results/${data.id}`;
  const strengths = evaluation.scores.filter((score) => score.strength);
  const improvements = evaluation.scores.filter((score) => score.suggestion);
  if (view === "strengths" || view === "improvements") {
    const isStrength = view === "strengths";
    const entries = isStrength ? strengths : improvements;
    return <ResultFrame title={isStrength ? "잘한 점 상세" : "부족한 점 상세"} onBack={onBack} className={styles.interviewResultListPage}>
      <h1>{isStrength ? "면접에서 잘한 점" : "다음 면접에서 보완할 점"}</h1>
      <div className={styles.interviewResultItems}>{entries.map((score) => <Link key={score.category} to={`${base}/${isStrength ? "strengths" : "improvements"}/${score.category}`}><strong>{labels[score.category]}</strong><span>{isStrength ? score.strength : score.suggestion}</span><b>›</b></Link>)}</div>
      {!entries.length && <div className={styles.empty}>표시할 항목이 아직 없습니다.</div>}
    </ResultFrame>;
  }
  if (view === "strength-detail" || view === "improvement-detail") {
    const isStrength = view === "strength-detail";
    const score = evaluation.scores.find((item) => item.category === category && (isStrength ? item.strength : item.suggestion));
    return <ResultFrame title={isStrength ? "잘한 점 상세" : "부족한 점 상세"} onBack={onBack} className={styles.interviewResultDetailPage}>
      <h1>{isStrength ? "잘한 점 상세" : "부족한 점 상세"}</h1>
      {score ? <article className={styles.interviewEvidenceCard}><header><h2>{labels[score.category]}</h2><span>{isStrength ? "잘 전달됨" : "보완 필요"}</span></header><h3>답변에서 포착된 근거</h3><p>{score.evidence ?? (isStrength ? score.strength : score.suggestion)}</p><div><strong>{isStrength ? "전달 방식 관찰" : "다음 답변 제안"}</strong><p>{isStrength ? score.strength : score.suggestion}</p></div></article> : <div className={styles.empty}>해당 피드백을 찾을 수 없습니다.</div>}
    </ResultFrame>;
  }
  return <ResultFrame title="면접 결과" onBack={onBack} className={styles.interviewResultSummary}>
    <section className={styles.interviewOverall}><h1>면접 총평</h1><p>{evaluation.summary ?? data.summary ?? "답변을 바탕으로 면접 결과를 정리했어요."}</p>{data.summary && data.summary !== evaluation.summary && <small>{data.summary}</small>}</section>
    <section className={styles.interviewScoreStrip}><span>종합 점수</span><strong>{evaluation.overall_score ?? data.overall_score ?? "—"}</strong><small>/100</small></section>
    <Link aria-label="이번 면접에서 잘한 점" className={styles.interviewResultChoice} to={`${base}/strengths`}><h2>이번 면접에서 잘한 점</h2><div>{strengths.slice(0, 3).map((score) => <span key={score.category}>{labels[score.category]}</span>)}</div><p>{strengths[0]?.strength ?? "답변에서 확인된 강점을 살펴보세요."}</p></Link>
    <Link aria-label="다음 면접에서 보완할 점" className={`${styles.interviewResultChoice} ${styles.interviewResultChoiceWarning}`} to={`${base}/improvements`}><h2>다음 면접에서 보완할 점</h2><div>{improvements.slice(0, 3).map((score) => <span key={score.category}>{labels[score.category]}</span>)}</div><p>{improvements[0]?.suggestion ?? "다음 답변에서 보완할 점을 살펴보세요."}</p></Link>
    {remove.error && <div className={styles.partialError} role="alert">{remove.error.message}</div>}
    <button className={styles.dangerButton} disabled={remove.isPending} onClick={() => { if (window.confirm("이 결과를 삭제할까요? 삭제 후 복구할 수 없습니다.")) remove.mutate(data.id); }}>{remove.isPending ? "삭제 중…" : "결과 삭제"}</button>
  </ResultFrame>;
}

function ResultFrame({ title, onBack, className, children }: { title: string; onBack: () => void; className: string; children: ReactNode }) {
  return <div className={`${styles.page} ${styles.interviewResultPage} ${className}`}><BackHeader title={title} onBack={onBack} /><main>{children}</main></div>;
}
