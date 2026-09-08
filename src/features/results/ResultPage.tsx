import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, waitForTerminal, type SessionResult } from "../../api/service";
import { BackHeader } from "../../components/ui/BackHeader";
import { StatusPanel } from "../../components/ui/StatusPanel";
import styles from "../../components/ui/Pages.module.css";
import sheet from "./ResultPage.module.css";
import { Button } from "../../components/ui/Button";
import { ScreenHeader } from "../../components/ui/ScreenHeader";

const labels: Record<string, string> = {
  question_understanding_fit: "질문 이해·적합성", answer_structure: "답변 구조", specificity_evidence: "구체성·근거",
  job_fit_problem_solving: "직무 적합성·문제 해결력", delivery_attitude: "전달력·태도",
};
type ResultView = "summary" | "scores" | "strengths" | "improvements" | "strength-detail" | "improvement-detail";

export function ResultPage({ source = "room", view = "summary" }: { source?: "room" | "result"; view?: ResultView }) {
  const { roomId = "", resultId = "", key: itemKey = "" } = useParams();
  const resourceId = source === "room" ? roomId : resultId;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const result = useQuery({ queryKey: ["result", source, resourceId], queryFn: () => source === "room" ? api.result(resourceId) : api.resultById(resourceId) });
  const retry = useMutation({
    mutationFn: async (targetRoomId: string) => {
      const accepted = await api.retryResult(targetRoomId);
      return waitForTerminal(() => api.job(accepted.job.job_id), "succeeded", 190_000);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["result", source, resourceId] });
      await queryClient.invalidateQueries({ queryKey: ["results"] });
    },
  });
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
  if (data.status === "failed") return <FailedResult data={data} retry={retry} remove={remove} onBack={() => navigate(-1)} />;
  if (data.interview_evaluation) return <InterviewResult data={data} view={view} category={itemKey} onBack={() => navigate(-1)} remove={remove} />;
  // 요약은 대화가 끝난 직후 replace 로 들어오는 화면이라 뒤로가기가 방으로 돌아가면 안 된다.
  const backFromSummary = () => navigate(source === "result" ? "/results" : "/rooms");
  return <GeneralResult data={data} view={view} source={source}
    onBack={view === "summary" ? backFromSummary : () => navigate(-1)} retry={retry} remove={remove} />;
}

const generalLabels: Record<string, string> = {
  honorifics: "높임법", courtesy: "예의와 배려", context_fit: "상황 적합성", naturalness: "자연스러움",
};

/** 자유 대화와 상황 연습 결과. 면접과 같은 요약 → 목록 → 상세 3단으로 보여 준다. */
function GeneralResult({ data, view, source, onBack, retry, remove }: {
  data: SessionResult; view: ResultView; source: "room" | "result"; onBack: () => void;
  retry: UseMutationResult<unknown, Error, string>; remove: UseMutationResult<void, Error, string>;
}) {
  const base = `/results/${data.id}`;
  // 항목별 점수가 생기기 전에 만들어진 결과에는 이 값이 없다.
  const scores = data.scores ?? [];
  const strengths = data.items.filter((item) => item.item_type === "strength");
  const improvements = data.items.filter((item) => item.item_type !== "strength");

  if (view === "scores") {
    return (
      <ResultFrame title="항목별 상세 평가" onBack={onBack} className={styles.resultDetailPage}>
        <div className={styles.resultItems}>
          {scores.map((score) => (
            <article key={score.category} className={styles.resultEvidenceCard}>
              <header>
                <h2>{generalLabels[score.category] ?? score.category}</h2>
                <span>{score.score}/{score.max_score}</span>
              </header>
              {score.evidence && <><h3>내가 한 말</h3><p>{score.evidence}</p></>}
              {(score.strength || score.suggestion) && (
                <div>
                  <strong>{score.strength ? "잘한 점" : "다듬을 점"}</strong>
                  <p>{score.strength ?? score.suggestion}</p>
                </div>
              )}
            </article>
          ))}
          {!scores.length && (
            <div className={styles.empty}>이번 연습에서는 항목별 점수를 매기지 못했어요.</div>
          )}
        </div>
      </ResultFrame>
    );
  }

  if (view === "strengths" || view === "improvements") {
    const isStrength = view === "strengths";
    const entries = isStrength ? strengths : improvements;
    return (
      <ResultFrame
        title={isStrength ? "잘한 표현" : "개선할 표현"}
        onBack={onBack}
        className={styles.resultDetailPage}
      >
        <div className={styles.resultItems}>
          {entries.map((item) => (
            <article key={item.order} className={styles.resultEvidenceCard}>
              <header>
                <h2>{item.title}</h2>
                {item.category && <span>{generalLabels[item.category] ?? item.category}</span>}
              </header>
              <h3>내가 한 말</h3>
              <p>{item.original_expression ?? item.evidence ?? "인용할 표현이 기록되지 않았어요."}</p>
              <div>
                <strong>{isStrength ? "왜 좋았나요" : "이렇게 바꿔 보세요"}</strong>
                {!isStrength && item.recommended_expression && <p>{item.recommended_expression}</p>}
                {item.explanation && <p>{item.explanation}</p>}
              </div>
            </article>
          ))}
          {!entries.length && (
            <div className={styles.empty}>
              {isStrength ? "이번 연습에서는 뚜렷하게 확인된 강점이 없어요." : "다듬을 점으로 정리된 표현이 없어요."}
            </div>
          )}
        </div>
      </ResultFrame>
    );
  }

  return (
    <ResultFrame title="결과 요약" onBack={onBack} className={styles.resultSummary}>
      <section className={styles.resultOverall}>
        <h1>종합 점수 {data.overall_score ?? "—"}/100</h1>
        <p>{data.summary ?? "대화에서 관찰된 내용을 기준으로 정리했습니다."}</p>
      </section>

      <p className={styles.resultHint}>
        항목별 점수, 잘한 점, 개선할 점을 누르면 상세 피드백을 확인할 수 있어요.
      </p>

      {/* 요약에서 이미 내용을 읽을 수 있게 한다. 제목만 보여 주고 누르게 하면
          한 번 더 들어가야 무엇을 잘했는지 알 수 있다. */}
      <Link className={styles.resultChoice} to={`${base}/scores`} aria-label="항목별 점수">
        <h2>항목별 점수</h2>
        <div className={styles.resultScoreRows}>
          {scores.map((score) => (
            <span key={score.category}>
              <b>{generalLabels[score.category] ?? score.category}</b>
              <i style={{ width: `${(score.score / score.max_score) * 100}%` }} />
              <em>{score.score}/{score.max_score}</em>
            </span>
          ))}
          {!scores.length && <p>항목별 점수를 매기지 못했어요.</p>}
        </div>
      </Link>

      <Link className={styles.resultChoice} to={`${base}/strengths`} aria-label="잘한 점">
        <h2>✓ 잘한 점</h2>
        {strengths[0] ? (
          <>
            <p>{strengths[0].title}</p>
            {strengths[0].original_expression && <blockquote>“{strengths[0].original_expression}”</blockquote>}
          </>
        ) : <p>이번 연습에서는 뚜렷하게 확인된 강점이 없어요.</p>}
      </Link>

      <Link className={`${styles.resultChoice} ${styles.resultChoiceWarning}`} to={`${base}/improvements`} aria-label="개선할 점">
        <h2>! 개선할 점</h2>
        {improvements[0] ? (
          <>
            <p>{improvements[0].title}</p>
            {improvements[0].recommended_expression && <blockquote>추천 “{improvements[0].recommended_expression}”</blockquote>}
          </>
        ) : <p>다듬을 점으로 정리된 표현이 없어요.</p>}
      </Link>

      {(retry.error || remove.error) && <div className={styles.partialError} role="alert">{(retry.error ?? remove.error)?.message}</div>}
      <div className={styles.actionRow}>
        <Link className={styles.secondaryLink} to="/results">결과 목록</Link>
        {source === "result" && (
          <button className={styles.dangerButton} disabled={remove.isPending} onClick={() => remove.mutate(data.id)}>
            {remove.isPending ? "삭제 중…" : "결과 삭제"}
          </button>
        )}
      </div>
    </ResultFrame>
  );
}


function FailedResult({ data, retry, remove, onBack }: { data: SessionResult; retry: UseMutationResult<unknown, Error, string>; remove: UseMutationResult<void, Error, string>; onBack: () => void }) {
  const detail = data.failure_code === "JOB_DEADLINE_EXCEEDED"
    ? "종합 피드백을 만드는 시간이 제한을 초과했습니다. 대화 내용은 정상적으로 저장되었습니다."
    : data.failure_code === "AI_PROVIDER_SCHEMA_INVALID"
      ? "AI가 만든 피드백이 서버가 요구한 형식을 만족하지 못했습니다. 대화 내용은 정상적으로 저장되었습니다."
      : "종합 피드백 생성을 완료하지 못했습니다. 대화 내용은 정상적으로 저장되었습니다.";
  return <div className={styles.page}>
    <header className={styles.pageHeader}><BackHeader title={data.practice_type === "interview" ? "면접 결과" : "결과 요약"} onBack={onBack} /><h1>피드백 생성을 완료하지 못했어요</h1><p className={styles.lead}>{detail}</p></header>
    {(retry.error || remove.error) && <div className={styles.partialError} role="alert">{(retry.error ?? remove.error)?.message}</div>}
    <div className={styles.actionRow}><Link className={styles.secondaryLink} to="/results">결과 목록</Link><button className={styles.secondaryButton} disabled={retry.isPending} onClick={() => retry.mutate(data.room_id)}>{retry.isPending ? "다시 생성 중…" : "피드백 다시 생성"}</button><button className={styles.dangerButton} disabled={remove.isPending} onClick={() => { if (window.confirm("이 결과를 삭제할까요? 삭제 후 복구할 수 없습니다.")) remove.mutate(data.id); }}>{remove.isPending ? "삭제 중…" : "결과 삭제"}</button></div>
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
    return (
      <ResultFrame title="면접 결과" onBack={onBack}>
        <h1 className={sheet.detailTitle}>
          {isStrength ? "이번 면접에서 잘한 점" : "다음 면접에서 보완할 점"}
        </h1>
        <div className={sheet.items}>
          {entries.map((score) => (
            <Link
              key={score.category}
              className={sheet.item}
              to={`${base}/${isStrength ? "strengths" : "improvements"}/${score.category}`}
            >
              <strong>{labels[score.category]}</strong>
              <span>{isStrength ? score.strength : score.suggestion}</span>
              <b aria-hidden="true">›</b>
            </Link>
          ))}
          {!entries.length && (
            <p className={sheet.empty}>
              {isStrength ? "이번 면접에서는 뚜렷하게 확인된 강점이 없어요." : "표시할 보완 항목이 없습니다."}
            </p>
          )}
        </div>
      </ResultFrame>
    );
  }

  if (view === "strength-detail" || view === "improvement-detail") {
    const isStrength = view === "strength-detail";
    const score = evaluation.scores.find((item) => item.category === category && (isStrength ? item.strength : item.suggestion));
    return (
      <ResultFrame title="면접 결과" onBack={onBack}>
        <h1 className={sheet.detailTitle}>{isStrength ? "잘한 점 상세" : "부족한 점 상세"}</h1>
        {score ? (
          <article className={sheet.evidence}>
            <header className={sheet.evidenceHead}>
              <h2>{labels[score.category]}</h2>
              <span className={sheet.badge}>{isStrength ? "잘 전달됨" : "보완 필요"}</span>
            </header>
            <h3>답변에서 포착된 근거</h3>
            <p>{score.evidence ?? (isStrength ? score.strength : score.suggestion)}</p>
            <div className={sheet.suggestion}>
              <strong>{isStrength ? "전달 방식 관찰" : "다음 답변 제안"}</strong>
              <p>{isStrength ? score.strength : score.suggestion}</p>
            </div>
          </article>
        ) : (
          <p className={sheet.empty}>해당 피드백을 찾을 수 없습니다.</p>
        )}
      </ResultFrame>
    );
  }

  return (
    <ResultFrame title="면접 결과" onBack={onBack}>
      <section className={sheet.card}>
        <h2>면접 총평</h2>
        <p>{evaluation.summary ?? data.summary ?? "답변을 바탕으로 면접 결과를 정리했어요."}</p>
      </section>

      <p className={sheet.hint}>
        잘한 점 또는 부족한 점을 누르면 항목별 상세 피드백을 확인할 수 있어요.
      </p>

      <Link className={sheet.choice} to={`${base}/strengths`} aria-label="이번 면접에서 잘한 점">
        <h2>이번 면접에서 잘한 점</h2>
        {strengths.length ? (
          <div className={sheet.chips}>
            {strengths.map((score, index) => (
              <span key={score.category} className={sheet[`tone${index % 5}`]}>{labels[score.category]}</span>
            ))}
          </div>
        ) : <p>이번 면접에서는 뚜렷하게 확인된 강점이 없어요.</p>}
      </Link>

      <Link className={sheet.choice} to={`${base}/improvements`} aria-label="이번 면접에서 부족한 점">
        <h2>이번 면접에서 부족한 점</h2>
        {improvements.length ? (
          <div className={sheet.chips}>
            {improvements.map((score, index) => (
              <span key={score.category} className={sheet[`tone${index % 5}`]}>{labels[score.category]}</span>
            ))}
          </div>
        ) : <p>다음 답변에서 보완할 점을 살펴보세요.</p>}
      </Link>

      {remove.error && <p className={sheet.error} role="alert">{remove.error.message}</p>}
      <div className={sheet.actions}>
        <Button
          variant="danger"
          disabled={remove.isPending}
          onClick={() => { if (window.confirm("이 결과를 삭제할까요? 삭제 후 복구할 수 없습니다.")) remove.mutate(data.id); }}
        >
          {remove.isPending ? "삭제 중…" : "결과 삭제"}
        </Button>
      </div>
    </ResultFrame>
  );
}


function ResultFrame({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <div className={sheet.page}>
      <ScreenHeader title={title} onBack={onBack} />
      <div className={sheet.body}>{children}</div>
    </div>
  );
}
