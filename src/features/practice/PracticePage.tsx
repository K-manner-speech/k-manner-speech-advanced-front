import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/service";
import { StatusPanel } from "../../components/ui/StatusPanel";
import { BackHeader } from "../../components/ui/BackHeader";
import styles from "../../components/ui/Pages.module.css";

export function PracticePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"type" | "persona" | "scenario">("type");
  const [practiceType, setPracticeType] = useState<"free_chat" | "scenario">("scenario");
  const [personaId, setPersonaId] = useState("");
  const [scenarioId, setScenarioId] = useState("");
  const personas = useQuery({ queryKey: ["personas"], queryFn: api.personas });
  const scenarios = useQuery({
    queryKey: ["scenarios", personaId],
    queryFn: () => api.scenarios(personaId || undefined),
  });
  const createRoom = useMutation({
    mutationFn: () =>
      api.createRoom({
        practice_type: practiceType,
        persona_id: personaId,
        scenario_id: practiceType === "scenario" ? scenarioId : null,
      }),
    onSuccess: (room) => navigate(`/rooms/${room.id}`),
  });
  const canStart = Boolean(
    personaId && (practiceType === "free_chat" || scenarioId),
  );
  const title = step === "type" ? "연습 유형" : step === "persona" ? "페르소나" : "시나리오";
  const goBack = () => {
    if (step === "scenario") setStep("persona");
    else if (step === "persona") setStep("type");
    else navigate("/");
  };
  if (personas.isLoading || scenarios.isLoading) {
    return <StatusPanel title="연습 상대와 상황을 불러오고 있어요" />;
  }
  if (personas.error || scenarios.error) {
    return <StatusPanel title="연습 목록을 불러오지 못했어요" detail={(personas.error ?? scenarios.error)?.message} onRetry={() => { void personas.refetch(); void scenarios.refetch(); }} />;
  }

  return (
    <div className={styles.page}>
      <header className={styles.mobileTitle}><BackHeader title={title} onBack={goBack} /><p>{step === "type" ? "H02" : step === "persona" ? "H03" : "H04"}</p><h1>{title}</h1></header>
      {step === "type" && <>
        <section className={styles.segmented} aria-label="연습 방식">
          <button aria-pressed={practiceType === "free_chat"} onClick={() => { setPracticeType("free_chat"); setScenarioId(""); }}>자유채팅</button>
          <button aria-pressed={practiceType === "scenario"} onClick={() => setPracticeType("scenario")}>시나리오</button>
          <button aria-pressed={false} onClick={() => navigate("/interview")}>이력서 기반 면접</button>
        </section>
        <div className={styles.stickyAction}><button className={styles.primaryButton} onClick={() => setStep("persona")}>선택하고 계속</button></div>
      </>}
      {step === "persona" && <section aria-labelledby="persona-heading">
        <div className={styles.sectionHeading}><span>1</span><div><h2 id="persona-heading">대화 상대 선택</h2><p>연습하고 싶은 관계를 골라 주세요.</p></div></div>
        {personas.data?.items.length ? (
          <div className={styles.cardGrid}>
            {personas.data.items.map((persona) => (
              <button key={persona.id} className={styles.selectCard} aria-pressed={persona.id === personaId} onClick={() => { setPersonaId(persona.id); setScenarioId(""); }}>
                <img src="/personas/neutral.png" alt={`${persona.role_title ?? "대화 상대"} ${persona.name}의 차분한 표정`} />
                <span className={styles.cardBody}><strong>{persona.name}</strong><small>{persona.role_title ?? "한국어 대화 파트너"}</small><span>{persona.description ?? "함께 자연스러운 대화를 연습해요."}</span></span>
              </button>
            ))}
          </div>
        ) : <div className={styles.empty}>현재 선택 가능한 페르소나가 없습니다.</div>}
        <div className={styles.stickyAction}><button className={styles.primaryButton} disabled={!personaId || createRoom.isPending} onClick={() => practiceType === "scenario" ? setStep("scenario") : createRoom.mutate()}>{practiceType === "scenario" ? "다음" : "대화 시작"}</button></div>
      </section>}
      {step === "scenario" && practiceType === "scenario" && (
        <section aria-labelledby="scenario-heading">
          <div className={styles.sectionHeading}><span>2</span><div><h2 id="scenario-heading">상황 선택</h2><p>선택한 상대와 연습할 상황입니다.</p></div></div>
          <div className={styles.scenarioList}>
            {scenarios.data?.items.map((scenario) => (
              <button key={scenario.id} className={styles.scenarioCard} aria-pressed={scenario.id === scenarioId} onClick={() => setScenarioId(scenario.id)} disabled={!personaId}>
                <span className={styles.cardTag}>{scenario.difficulty ?? "기본"} · {scenario.estimated_minutes ?? 5}분</span>
                <strong>{scenario.title}</strong><span>{scenario.goal ?? "상황에 맞는 표현으로 목표를 달성해 보세요."}</span>
              </button>
            ))}
          </div>
          {createRoom.error && <div className={styles.error} role="alert">{createRoom.error.message}</div>}
          <div className={styles.stickyAction}><button className={styles.primaryButton} disabled={!canStart || createRoom.isPending} onClick={() => createRoom.mutate()}>{createRoom.isPending ? "대화방 준비 중…" : "대화 시작"}</button></div>
        </section>
      )}
    </div>
  );
}
