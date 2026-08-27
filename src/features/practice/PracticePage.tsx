import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/service";
import { StatusPanel } from "../../components/ui/StatusPanel";
import styles from "../../components/ui/Pages.module.css";

export function PracticePage() {
  const navigate = useNavigate();
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
  const selectedPersona = useMemo(
    () => personas.data?.items.find((persona) => persona.id === personaId),
    [personaId, personas.data],
  );

  if (personas.isLoading || scenarios.isLoading) {
    return <StatusPanel title="연습 상대와 상황을 불러오고 있어요" />;
  }
  if (personas.error || scenarios.error) {
    return <StatusPanel title="연습 목록을 불러오지 못했어요" detail={(personas.error ?? scenarios.error)?.message} onRetry={() => { void personas.refetch(); void scenarios.refetch(); }} />;
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>상황별 한국어 연습</p>
        <h1>누구와 어떤 대화를<br />연습할까요?</h1>
        <p className={styles.lead}>관계와 목표를 먼저 확인하면 더 자연스러운 표현을 연습할 수 있어요.</p>
      </header>
      <section className={styles.segmented} aria-label="연습 방식">
        <button aria-pressed={practiceType === "scenario"} onClick={() => setPracticeType("scenario")}>상황 연습</button>
        <button aria-pressed={practiceType === "free_chat"} onClick={() => { setPracticeType("free_chat"); setScenarioId(""); }}>자유 대화</button>
      </section>
      <section aria-labelledby="persona-heading">
        <div className={styles.sectionHeading}><span>1</span><div><h2 id="persona-heading">대화 상대 선택</h2><p>연습하고 싶은 관계를 골라 주세요.</p></div></div>
        {personas.data?.items.length ? (
          <div className={styles.cardGrid}>
            {personas.data.items.map((persona) => (
              <button key={persona.id} className={styles.selectCard} aria-pressed={persona.id === personaId} onClick={() => { setPersonaId(persona.id); setScenarioId(""); }}>
                <img src="/personas/demo.png" alt={`${persona.role_title ?? "대화 상대"} ${persona.name}의 차분한 표정`} />
                <span className={styles.cardBody}><strong>{persona.name}</strong><small>{persona.role_title ?? "한국어 대화 파트너"}</small><span>{persona.description ?? "함께 자연스러운 대화를 연습해요."}</span></span>
              </button>
            ))}
          </div>
        ) : <div className={styles.empty}>현재 선택 가능한 페르소나가 없습니다.</div>}
      </section>
      {practiceType === "scenario" && (
        <section aria-labelledby="scenario-heading">
          <div className={styles.sectionHeading}><span>2</span><div><h2 id="scenario-heading">상황 선택</h2><p>{selectedPersona ? `${selectedPersona.name}님과 연습할 상황입니다.` : "먼저 대화 상대를 선택해 주세요."}</p></div></div>
          <div className={styles.scenarioList}>
            {scenarios.data?.items.map((scenario) => (
              <button key={scenario.id} className={styles.scenarioCard} aria-pressed={scenario.id === scenarioId} onClick={() => setScenarioId(scenario.id)} disabled={!personaId}>
                <span className={styles.cardTag}>{scenario.difficulty ?? "기본"} · {scenario.estimated_minutes ?? 5}분</span>
                <strong>{scenario.title}</strong><span>{scenario.goal ?? "상황에 맞는 표현으로 목표를 달성해 보세요."}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {createRoom.error && <div className={styles.error} role="alert">{createRoom.error.message}</div>}
      <div className={styles.stickyAction}>
        <div><strong>{selectedPersona?.name ?? "상대를 선택해 주세요"}</strong><span>{practiceType === "free_chat" ? "자유 대화" : scenarios.data?.items.find((s) => s.id === scenarioId)?.title ?? "상황 미선택"}</span></div>
        <button className={styles.primaryButton} disabled={!canStart || createRoom.isPending} onClick={() => createRoom.mutate()}>{createRoom.isPending ? "대화방 준비 중…" : "대화 시작"}</button>
      </div>
    </div>
  );
}
