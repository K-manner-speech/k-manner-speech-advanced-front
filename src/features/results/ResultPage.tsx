import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, waitForTerminal, type SessionResult } from "../../api/service";
import { StatusPanel } from "../../components/ui/StatusPanel";
import sheet from "./ResultPage.module.css";
import { Button } from "../../components/ui/Button";
import { ScreenHeader } from "../../components/ui/ScreenHeader";

const labels: Record<string, string> = {
  question_understanding_fit: "질문 이해·적합성", answer_structure: "답변 구조", specificity_evidence: "구체성·근거",
  job_fit_problem_solving: "직무 적합성·문제 해결력", delivery_attitude: "전달력·태도",
};
type ResultView = "summary" | "scores" | "strengths" | "improvements" | "strength-detail" | "improvement-detail";

type FeedbackEntry = {
  /** 펼침 상태를 식별하고 깊은 링크로 여는 값. */
  key: string;
  label: string;
  /** 접혀 있을 때 보여 줄 한 줄. */
  preview: string | null;
  /** 항목 색. 목록과 펼친 내용이 같은 색을 쓴다. */
  toneClass: string;
  detail: ReactNode;
};

function improvementPreview(summary: string | null | undefined, suggestion: string | null): string | null {
  if (summary?.trim()) return summary.trim();
  if (!suggestion?.trim()) return null;
  const firstSentence = suggestion.trim().match(/^[^.!?。！？]+[.!?。！？]?/)?.[0]?.trim();
  const preview = firstSentence || suggestion.trim();
  return preview.length <= 45 ? preview : `${preview.slice(0, 44).trimEnd()}…`;
}

function compactOverallSummary(summary: string | null | undefined, fallback: string): string {
  const value = summary?.trim();
  if (!value || value.length <= 180) return value || fallback;
  const sentences = value.match(/[^.!?。！？]+[.!?。！？]?/g) ?? [];
  const selected: string[] = [];
  for (const sentence of sentences) {
    const candidate = [...selected, sentence.trim()].join(" ");
    if (candidate.length > 180 || selected.length === 3) break;
    selected.push(sentence.trim());
  }
  return selected.length ? selected.join(" ") : `${value.slice(0, 179).trimEnd()}…`;
}

/**
 * 피드백 항목 목록. 누르면 그 자리에서 펼쳐진다.
 *
 * 항목마다 다른 화면으로 넘어가면 다른 항목과 견주어 보려고 매번 뒤로 가야 한다.
 * 한 화면에서 펼쳤다 접는 편이 비교에 맞고, 화면 수도 줄어든다. 색은 접혔을 때와
 * 펼쳤을 때가 같아야 방금 누른 항목을 다시 찾지 않는다.
 */
function FeedbackAccordion({ entries, initialKey, emptyText }: {
  entries: FeedbackEntry[];
  initialKey?: string;
  emptyText: string;
}) {
  const [openKey, setOpenKey] = useState<string | null>(
    initialKey && entries.some((entry) => entry.key === initialKey) ? initialKey : null,
  );

  if (!entries.length) return <div className={sheet.empty}>{emptyText}</div>;

  return (
    <div className={sheet.items}>
      {entries.map((entry) => {
        const isOpen = entry.key === openKey;
        return (
          <section key={entry.key} className={`${sheet.accordion} ${entry.toneClass} ${isOpen ? sheet.accordionOpen : ""}`}>
            <button
              type="button"
              className={sheet.accordionHead}
              aria-expanded={isOpen}
              aria-controls={`panel-${entry.key}`}
              onClick={() => setOpenKey(isOpen ? null : entry.key)}
            >
              <span className={sheet.accordionTitle}>
                <strong>{entry.label}</strong>
                {entry.preview && !isOpen && <span>{entry.preview}</span>}
              </span>
              <b aria-hidden="true" className={sheet.accordionMark}>›</b>
            </button>
            {isOpen && (
              <div className={sheet.accordionPanel} id={`panel-${entry.key}`}>
                {entry.detail}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

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
  if (data.interview_evaluation) return <InterviewResult data={data} view={view} category={itemKey} onBack={() => navigate(-1)} />;
  // 요약은 대화가 끝난 직후 replace 로 들어오는 화면이라 뒤로가기가 방으로 돌아가면 안 된다.
  const backFromSummary = () => navigate(source === "result" ? "/results" : "/rooms");
  return <GeneralResult data={data} view={view} itemKey={itemKey}
    onBack={view === "summary" ? backFromSummary : () => navigate(-1)} retry={retry} />;
}

const generalLabels: Record<string, string> = {
  honorifics: "높임법", courtesy: "예의와 배려", context_fit: "상황 적합성", naturalness: "자연스러움",
};

/** 자유 대화와 상황 연습 결과. 면접과 같은 요약 → 목록 → 상세 3단으로 보여 준다. */
function GeneralResult({ data, view, itemKey, onBack, retry }: {
  data: SessionResult; view: ResultView; itemKey: string; onBack: () => void;
  retry: UseMutationResult<unknown, Error, string>;
}) {
  const base = `/results/${data.id}`;
  // 항목별 점수가 생기기 전에 만들어진 결과에는 이 값이 없다.
  const scores = data.scores ?? [];
  const strengths = data.items.filter((item) => item.item_type === "strength");
  const improvements = data.items.filter((item) => item.item_type !== "strength");

  if (view === "scores") {
    return (
      <ResultFrame title="항목별 상세 평가" onBack={onBack}>
        <div className={sheet.items}>
          {scores.map((score) => (
            <article key={score.category} className={`${sheet.evidence} ${sheet[score.category] ?? ""}`}>
              <header className={sheet.evidenceHead}>
                <h2>{generalLabels[score.category] ?? score.category}</h2>
                <span className={sheet.badge}>{score.score}/{score.max_score}</span>
              </header>
              {score.evidence && <><h3>내가 한 말</h3><p className={sheet.quote}>“{score.evidence}”</p></>}
              {(score.strength || score.suggestion) && (
                <div className={sheet.suggestion}>
                  <strong>{score.strength ? "잘한 점" : "다듬을 점"}</strong>
                  <p>{score.strength ?? score.suggestion}</p>
                </div>
              )}
            </article>
          ))}
          {!scores.length && (
            <div className={sheet.empty}>이번 연습에서는 항목별 점수를 매기지 못했어요.</div>
          )}
        </div>
      </ResultFrame>
    );
  }

  if (view === "strengths" || view === "improvements" || view === "strength-detail" || view === "improvement-detail") {
    const isStrength = view === "strengths" || view === "strength-detail";
    const entries = isStrength ? strengths : improvements;
    return (
      <ResultFrame title={isStrength ? "잘한 표현" : "개선할 표현"} onBack={onBack}>
        <FeedbackAccordion
          initialKey={itemKey}
          emptyText={isStrength ? "이번 연습에서는 뚜렷하게 확인된 강점이 없어요." : "다듬을 점으로 정리된 표현이 없어요."}
          entries={entries.map((item) => ({
            key: String(item.order),
            label: item.category
              ? generalLabels[item.category] ?? item.category
              : item.title,
            preview: item.title,
            toneClass: item.category ? sheet[item.category] ?? "" : "",
            detail: (
              <>
                {item.category && (
                  <span className={sheet.badge}>{generalLabels[item.category] ?? item.category}</span>
                )}
                <h3>내가 한 말</h3>
                <p className={sheet.quote}>
                  {item.original_expression ?? item.evidence
                    ? `“${item.original_expression ?? item.evidence}”`
                    : "인용할 표현이 기록되지 않았어요."}
                </p>
                <div className={sheet.suggestion}>
                  <strong>{isStrength ? "왜 좋았나요" : "이렇게 바꿔 보세요"}</strong>
                  {!isStrength && item.recommended_expression && (
                    <p className={sheet.quote}>“{item.recommended_expression}”</p>
                  )}
                  {item.explanation && <p>{item.explanation}</p>}
                </div>
              </>
            ),
          }))}
        />
      </ResultFrame>
    );
  }

  return (
    <ResultFrame title="결과 요약" onBack={onBack}>
      <section className={sheet.card}>
        <ScoreBadge score={data.overall_score} />
        <p>{compactOverallSummary(data.summary, "대화에서 관찰된 내용을 기준으로 정리했습니다.")}</p>
      </section>

      <p className={sheet.hint}>
        항목별 점수, 잘한 점, 개선할 점을 누르면 상세 피드백을 확인할 수 있어요.
      </p>

      {/* 요약에서 이미 내용을 읽을 수 있게 한다. 제목만 보여 주고 누르게 하면
          한 번 더 들어가야 무엇을 잘했는지 알 수 있다. */}
      <Link className={sheet.choice} to={`${base}/scores`} aria-label="항목별 점수">
        <h2>항목별 점수</h2>
        <div className={sheet.scoreRows}>
          {scores.map((score) => (
            <span key={score.category} className={sheet[score.category] ?? ""}>
              <b>{generalLabels[score.category] ?? score.category}</b>
              <i><s style={{ width: `${(score.score / score.max_score) * 100}%` }} /></i>
              <em>{score.score}/{score.max_score}</em>
            </span>
          ))}
          {!scores.length && <p>항목별 점수를 매기지 못했어요.</p>}
        </div>
      </Link>

      <Link className={sheet.choice} to={`${base}/strengths`} aria-label="잘한 점">
        <div className={sheet.choiceHeader}>
          <span className={sheet.positiveLabel}><i aria-hidden="true">✓</i> 잘한 점</span>
          <b aria-hidden="true">›</b>
        </div>
        {strengths[0] ? (
          <>
            <strong className={sheet.choiceSummary}>{strengths[0].title}</strong>
            {strengths[0].original_expression && <blockquote className={sheet.choiceQuote}>“{strengths[0].original_expression}”</blockquote>}
          </>
        ) : <p>이번 연습에서는 뚜렷하게 확인된 강점이 없어요.</p>}
      </Link>

      <Link className={`${sheet.choice} ${sheet.choiceWarning}`} to={`${base}/improvements`} aria-label="개선할 점">
        <div className={sheet.choiceHeader}>
          <span className={sheet.warningLabel}><i aria-hidden="true">!</i> 개선할 점</span>
          <b aria-hidden="true">›</b>
        </div>
        {improvements[0] ? (
          <>
            <strong className={sheet.choiceSummary}>{improvements[0].title}</strong>
            {improvements[0].recommended_expression && (
              <div className={sheet.choiceRecommendation}>
                <span>추천 표현</span>
                <blockquote>“{improvements[0].recommended_expression}”</blockquote>
              </div>
            )}
          </>
        ) : <p>다듬을 점으로 정리된 표현이 없어요.</p>}
      </Link>

      {retry.error && <div className={sheet.error} role="alert">{retry.error.message}</div>}
    </ResultFrame>
  );
}


function FailedResult({ data, retry, remove, onBack }: { data: SessionResult; retry: UseMutationResult<unknown, Error, string>; remove: UseMutationResult<void, Error, string>; onBack: () => void }) {
  const detail = data.failure_code === "JOB_DEADLINE_EXCEEDED"
    ? "종합 피드백을 만드는 시간이 제한을 초과했습니다. 대화 내용은 정상적으로 저장되었습니다."
    : data.failure_code === "AI_PROVIDER_SCHEMA_INVALID"
      ? "AI가 만든 피드백이 서버가 요구한 형식을 만족하지 못했습니다. 대화 내용은 정상적으로 저장되었습니다."
      : "종합 피드백 생성을 완료하지 못했습니다. 대화 내용은 정상적으로 저장되었습니다.";

  return (
    <ResultFrame title={data.practice_type === "interview" ? "면접 결과" : "결과 요약"} onBack={onBack}>
      <section className={sheet.card}>
        <h2>피드백 생성을 완료하지 못했어요</h2>
        <p>{detail}</p>
      </section>
      {(retry.error || remove.error) && (
        <p className={sheet.error} role="alert">{(retry.error ?? remove.error)?.message}</p>
      )}
      <div className={sheet.actions}>
        <Button variant="secondary" disabled={retry.isPending} onClick={() => retry.mutate(data.room_id)}>
          {retry.isPending ? "다시 생성 중…" : "피드백 다시 생성"}
        </Button>
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


function InterviewResult({ data, view, category, onBack }: { data: SessionResult; view: ResultView; category: string; onBack: () => void }) {
  const evaluation = data.interview_evaluation!;
  const base = `/results/${data.id}`;
  const strengths = evaluation.scores.filter((score) => score.strength);
  const improvements = evaluation.scores.filter((score) => score.suggestion);

  if (view === "strengths" || view === "improvements" || view === "strength-detail" || view === "improvement-detail") {
    const isStrength = view === "strengths" || view === "strength-detail";
    const entries = isStrength ? strengths : improvements;
    // 상단 바가 "면접 결과"이고 바로 아래에 같은 뜻의 제목이 또 있었다.
    // 화면 이름을 상단 바 한 곳에서만 말한다.
    return (
      <ResultFrame title={isStrength ? "잘한 점" : "보완할 점"} onBack={onBack}>
        <FeedbackAccordion
          initialKey={category}
          emptyText={isStrength ? "이번 면접에서는 뚜렷하게 확인된 강점이 없어요." : "표시할 보완 항목이 없습니다."}
          entries={entries.map((score) => ({
            key: score.category,
            label: labels[score.category] ?? score.category,
            preview: isStrength ? score.strength : improvementPreview(score.summary, score.suggestion),
            toneClass: sheet[score.category] ?? "",
            detail: (
              <>
                <span className={sheet.badge}>{isStrength ? "잘 전달됨" : "보완 필요"}</span>
                <h3>답변에서 포착된 근거</h3>
                <p>{score.evidence ?? (isStrength ? score.strength : score.suggestion)}</p>
                <div className={sheet.suggestion}>
                  <strong>{isStrength ? "전달 방식 관찰" : "다음 답변 제안"}</strong>
                  <p>{isStrength ? score.strength : score.suggestion}</p>
                </div>
              </>
            ),
          }))}
        />
      </ResultFrame>
    );
  }

  return (
    <ResultFrame title="면접 결과" onBack={onBack}>
      <section className={sheet.card}>
        <ScoreBadge score={evaluation.overall_score ?? data.overall_score} />
        <h2>면접 총평</h2>
        <p>{compactOverallSummary(evaluation.summary ?? data.summary, "답변을 바탕으로 면접 결과를 정리했어요.")}</p>
      </section>

      <p className={sheet.hint}>
        잘한 점 또는 부족한 점을 누르면 항목별 상세 피드백을 확인할 수 있어요.
      </p>

      <Link className={sheet.choice} to={`${base}/strengths`} aria-label="이번 면접에서 잘한 점">
        <h2>이번 면접에서 잘한 점</h2>
        {strengths.length ? (
          <div className={sheet.chips}>
            {strengths.map((score) => (
              <span key={score.category} className={sheet[score.category] ?? ""}>{labels[score.category]}</span>
            ))}
          </div>
        ) : <p>이번 면접에서는 뚜렷하게 확인된 강점이 없어요.</p>}
      </Link>

      <Link className={sheet.choice} to={`${base}/improvements`} aria-label="이번 면접에서 부족한 점">
        <h2>이번 면접에서 부족한 점</h2>
        {improvements.length ? (
          <div className={sheet.chips}>
            {improvements.map((score) => (
              <span key={score.category} className={sheet[score.category] ?? ""}>{labels[score.category]}</span>
            ))}
          </div>
        ) : <p>다음 답변에서 보완할 점을 살펴보세요.</p>}
      </Link>

    </ResultFrame>
  );
}


/** 종합 점수. 점수만 크게 두면 무엇의 점수인지 읽히지 않아 이름을 함께 둔다. */
function ScoreBadge({ score }: { score: number | null | undefined }) {
  return (
    <p className={sheet.score}>
      <span>종합 점수</span>
      <strong>{score ?? "—"}</strong>
      <i>/100</i>
    </p>
  );
}


function ResultFrame({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <div>
      <ScreenHeader title={title} onBack={onBack} />
      <div className={sheet.body}>{children}</div>
    </div>
  );
}
