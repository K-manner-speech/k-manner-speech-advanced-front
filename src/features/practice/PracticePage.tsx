import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/service";
import { Button } from "../../components/ui/Button";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { StatusPanel } from "../../components/ui/StatusPanel";
import styles from "./PracticePage.module.css";

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "쉬움",
  medium: "보통",
  hard: "어려움",
};

export function PracticePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"type" | "persona" | "scenario">("type");
  const [practiceType, setPracticeType] = useState<"free_chat" | "scenario">("scenario");
  const [scenarioId, setScenarioId] = useState("");
  const personas = useQuery({ queryKey: ["personas"], queryFn: api.personas });
  const scenarios = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => api.scenarios(),
    enabled: step === "scenario",
  });
  const selectedScenario = useQuery({
    queryKey: ["scenario", scenarioId],
    queryFn: () => api.scenario(scenarioId),
    enabled: practiceType === "scenario" && Boolean(scenarioId),
  });
  const effectivePersonaId = practiceType === "scenario"
    ? (selectedScenario.data?.allowed_personas[0]?.persona_id ?? "")
    : "";
  const createRoom = useMutation({
    mutationFn: (personaOverride?: string) =>
      api.createRoom({
        practice_type: practiceType,
        persona_id: personaOverride ?? effectivePersonaId,
        scenario_id: practiceType === "scenario" ? scenarioId : null,
      }),
    onSuccess: (room) => navigate(`/rooms/${room.id}`),
  });
  const canStart = Boolean(
    effectivePersonaId && (practiceType === "free_chat" || scenarioId),
  );

  const title = step === "type" ? "연습 유형" : step === "persona" ? "대화 상대" : "시나리오";
  const goBack = () => (step === "type" ? navigate("/") : setStep("type"));

  if (personas.isLoading || scenarios.isLoading) {
    return <StatusPanel title="연습 상대와 상황을 불러오고 있어요" />;
  }
  if (personas.error || scenarios.error) {
    return (
      <StatusPanel
        title="연습 목록을 불러오지 못했어요"
        detail={(personas.error ?? scenarios.error)?.message}
        onRetry={() => { void personas.refetch(); void scenarios.refetch(); }}
      />
    );
  }

  return (
    <div className={styles.page}>
      <ScreenHeader title={title} onBack={goBack} />

      {step === "type" && (
        <>
          <h2 className={styles.headline}>오늘은 어떤 연습이 필요하세요?</h2>
          <div className={styles.list}>
            <button
              className={styles.card}
              onClick={() => { setPracticeType("free_chat"); setScenarioId(""); setStep("persona"); }}
            >
              <span className={styles.icon} aria-hidden="true">💬</span>
              <span className={styles.text}>
                <b>자유채팅</b>
                <small>주제 없이 편하게 대화를 이어가요</small>
              </span>
            </button>
            <button
              className={`${styles.card} ${styles.highlighted}`}
              onClick={() => { setPracticeType("scenario"); setStep("scenario"); }}
            >
              <span className={styles.icon} aria-hidden="true">📋</span>
              <span className={styles.text}>
                <b>시나리오</b>
                <small>실제 상황에 맞춰 표현을 연습해요</small>
              </span>
              <span className={styles.badge}>오늘 추천</span>
            </button>
            <button className={styles.card} onClick={() => navigate("/interview")}>
              <span className={styles.icon} aria-hidden="true">🧑‍💼</span>
              <span className={styles.text}>
                <b>면접 시뮬레이션</b>
                <small>질문에 답하며 실전 감각을 익혀요</small>
              </span>
            </button>
          </div>
        </>
      )}

      {step === "persona" && (
        <>
          <h2 className={styles.headline}>누구와 이야기해 볼까요?</h2>
          {personas.data?.items.length ? (
            <div className={styles.list}>
              {personas.data.items.map((persona) => (
                <button
                  key={persona.id}
                  className={styles.card}
                  disabled={createRoom.isPending}
                  onClick={() => createRoom.mutate(persona.id)}
                >
                  <img
                    className={styles.icon}
                    src="/personas/neutral.png"
                    alt={`${persona.role_title ?? "대화 상대"} ${persona.name}의 차분한 표정`}
                  />
                  <span className={styles.text}>
                    <b>{persona.name}</b>
                    <small>{persona.description ?? persona.role_title ?? "한국어 대화 파트너"}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>
              현재 선택할 수 있는 대화 상대가 없어요. 잠시 뒤 다시 확인해 주세요.
            </p>
          )}
          {createRoom.error && <p className={styles.error} role="alert">{createRoom.error.message}</p>}
        </>
      )}

      {step === "scenario" && (
        <>
          <h2 className={styles.headline}>어떤 상황을 연습할까요?</h2>
          {scenarios.data?.items.length ? (
            <div className={styles.list}>
              {scenarios.data.items.map((scenario) => (
                <button
                  key={scenario.id}
                  className={`${styles.card} ${scenario.id === scenarioId ? styles.highlighted : ""}`}
                  aria-pressed={scenario.id === scenarioId}
                  onClick={() => setScenarioId(scenario.id)}
                >
                  <span className={styles.text}>
                    <b>{scenario.title}</b>
                    <small>{scenario.goal ?? "상황에 맞는 표현으로 목표를 달성해 보세요."}</small>
                    <span className={styles.meta}>
                      {DIFFICULTY_LABELS[scenario.difficulty ?? ""] ?? scenario.difficulty ?? "기본"}
                      {" · "}
                      {scenario.estimated_minutes ?? 5}분
                    </span>
                  </span>
                  {scenario.id === scenarioId && <span className={styles.badge}>선택됨</span>}
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>
              현재 선택할 수 있는 상황이 없어요. 잠시 뒤 다시 확인해 주세요.
            </p>
          )}
          {(selectedScenario.error || createRoom.error) && (
            <p className={styles.error} role="alert">
              {(selectedScenario.error ?? createRoom.error)?.message}
            </p>
          )}
          <div className={styles.action}>
            <Button
              disabled={!canStart || createRoom.isPending}
              onClick={() => createRoom.mutate(undefined)}
            >
              {createRoom.isPending ? "대화방 준비 중…" : "대화 시작"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
