import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/service";
import { Button } from "../../components/ui/Button";
import { PersonaAvatar } from "../../components/ui/PersonaAvatar";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { StatusPanel } from "../../components/ui/StatusPanel";
import { usePreferences } from "../../store/preferences";
import styles from "./PracticePage.module.css";

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "쉬움",
  medium: "보통",
  hard: "어려움",
};
const DIFFICULTY_LABELS_EN: Record<string, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

function conciseGoal(goal: string | null): string {
  const fallback = "상황에 맞는 표현으로 목표를 달성해 보세요.";
  const normalized = goal?.trim();
  if (!normalized) return fallback;

  const sentences = normalized.match(/[^.!?。！？]+[.!?。！？]?/g);
  if (normalized.length > 50 && sentences && sentences.length > 1) {
    return sentences.at(-1)?.trim() || normalized;
  }
  return normalized;
}

function personaTraits(description: string | null, roleTitle: string | null, en = false): string[] {
  const source = description ?? "";
  const role = roleTitle ?? "";
  const relationship = /선배/.test(role + source)
    ? "학과 선배"
    : /팀장|상사/.test(role + source)
      ? "직장 상사"
      : /고객/.test(role + source)
        ? "서비스 고객"
        : role || "대화 상대";
  const personality = /친절|편하게/.test(source)
    ? "친근함"
    : /일정|근거|꼼꼼/.test(source)
      ? "꼼꼼함"
      : /불만|구체적인 해결/.test(source)
        ? "단호함"
        : "차분함";
  if (!en) return [relationship, personality];
  const translations: Record<string, string> = {
    "학과 선배": "Senior Student", "직장 상사": "Work Supervisor", "서비스 고객": "Customer",
    "대화 상대": "Conversation Partner", "친근함": "Friendly", "꼼꼼함": "Detail-oriented",
    "단호함": "Assertive", "차분함": "Calm",
  };
  return [translations[relationship] ?? relationship, translations[personality] ?? personality];
}

function traitTone(trait: string): string {
  if (/선배|상사|고객|대화 상대|Student|Supervisor|Customer|Partner/.test(trait)) return "traitBlue";
  if (/친근|Friendly/.test(trait)) return "traitGreen";
  if (/꼼꼼|Detail/.test(trait)) return "traitAmber";
  if (/단호|Assertive/.test(trait)) return "traitRose";
  if (/차분|Calm/.test(trait)) return "traitPurple";
  return "traitNeutral";
}

export function PracticePage() {
  const en = usePreferences((state) => state.language) === "en";
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

  const title = step === "type" ? (en ? "Practice Type" : "연습 유형") : step === "persona" ? (en ? "Conversation Partner" : "대화 상대") : (en ? "Scenario" : "시나리오");
  const goBack = () => (step === "type" ? navigate("/") : setStep("type"));

  if (personas.isLoading || scenarios.isLoading) {
    return <StatusPanel title={en ? "Loading practice options…" : "연습 상대와 상황을 불러오고 있어요"} />;
  }
  if (personas.error || scenarios.error) {
    return (
      <StatusPanel
        title={en ? "Couldn’t load practice options" : "연습 목록을 불러오지 못했어요"}
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
          <h2 className={styles.headline}>{en ? "What would you like to practice today?" : "오늘은 어떤 연습이 필요하세요?"}</h2>
          <div className={styles.list}>
            <button
              className={styles.card}
              onClick={() => { setPracticeType("free_chat"); setScenarioId(""); setStep("persona"); }}
            >
              <span className={`${styles.icon} ${styles.chatIcon}`} aria-hidden="true" />
              <span className={styles.text}>
                <b>{en ? "Free Chat" : "자유채팅"}</b>
                <small>{en ? "Have a relaxed conversation without a set topic" : "주제 없이 편하게 대화를 이어가요"}</small>
              </span>
            </button>
            <button
              className={styles.card}
              onClick={() => { setPracticeType("scenario"); setStep("scenario"); }}
            >
              <span className={`${styles.icon} ${styles.scenarioIcon}`} aria-hidden="true" />
              <span className={styles.text}>
                <b>{en ? "Scenario" : "시나리오"}</b>
                <small>{en ? "Practice expressions for real-life situations" : "실제 상황에 맞춰 표현을 연습해요"}</small>
              </span>
            </button>
            <button className={styles.card} onClick={() => navigate("/interview")}>
              <span className={`${styles.icon} ${styles.interviewIcon}`} aria-hidden="true" />
              <span className={styles.text}>
                <b>{en ? "Interview Simulation" : "면접 시뮬레이션"}</b>
                <small>{en ? "Build confidence by answering interview questions" : "질문에 답하며 실전 감각을 익혀요"}</small>
              </span>
            </button>
          </div>
        </>
      )}

      {step === "persona" && (
        <>
          <h2 className={`${styles.headline} ${styles.personaHeadline}`}>{en ? "Who would you like to talk with?" : "누구와 이야기해 볼까요?"}</h2>
          {personas.data?.items.length ? (
            <div className={styles.list}>
              {personas.data.items.map((persona) => (
                <button
                  key={persona.id}
                  className={`${styles.card} ${styles.personaCard}`}
                  disabled={createRoom.isPending}
                  onClick={() => createRoom.mutate(persona.id)}
                >
                  <PersonaAvatar
                    className={styles.personaAvatar}
                    avatarKey={persona.avatar_key}
                    alt={`${persona.role_title ?? "대화 상대"} ${persona.name}의 차분한 표정`}
                  />
                  <span className={styles.text}>
                    <b>{persona.name}</b>
                    <span className={styles.traitLabel}>{en ? "Profile" : "대화 특징"}</span>
                    <span className={styles.traits}>
                      {personaTraits(persona.description, persona.role_title, en).map((trait) => (
                        <span className={styles[traitTone(trait)]} key={trait}>{trait}</span>
                      ))}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>
              {en ? "No conversation partners are available right now. Please try again later." : "현재 선택할 수 있는 대화 상대가 없어요. 잠시 뒤 다시 확인해 주세요."}
            </p>
          )}
          {createRoom.error && <p className={styles.error} role="alert">{createRoom.error.message}</p>}
        </>
      )}

      {step === "scenario" && (
        <>
          <h2 className={`${styles.headline} ${styles.scenarioHeadline}`}>{en ? "Which situation would you like to practice?" : "어떤 상황을 연습할까요?"}</h2>
          {scenarios.data?.items.length ? (
            <div className={styles.list}>
              {scenarios.data.items.map((scenario) => (
                <button
                  key={scenario.id}
                  className={`${styles.card} ${styles.scenarioCard} ${scenario.id === scenarioId ? styles.highlighted : ""}`}
                  aria-pressed={scenario.id === scenarioId}
                  onClick={() => setScenarioId(scenario.id)}
                >
                  <span className={styles.text}>
                    <b>{scenario.title}</b>
                    <span className={styles.scenarioGoal}>
                      <em>{en ? "Practice Goal" : "연습 목표"}</em>
                      <small>{conciseGoal(scenario.goal)}</small>
                    </span>
                    <span className={styles.meta}>
                      <span>{en
                        ? (DIFFICULTY_LABELS_EN[scenario.difficulty ?? ""] ?? scenario.difficulty ?? "Standard")
                        : (DIFFICULTY_LABELS[scenario.difficulty ?? ""] ?? scenario.difficulty ?? "기본")}</span>
                      <span>{en ? `About ${scenario.estimated_minutes ?? 5} min` : `약 ${scenario.estimated_minutes ?? 5}분`}</span>
                    </span>
                  </span>
                  {scenario.id === scenarioId && <span className={styles.badge}>{en ? "Selected" : "선택됨"}</span>}
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>
              {en ? "No scenarios are available right now. Please try again later." : "현재 선택할 수 있는 상황이 없어요. 잠시 뒤 다시 확인해 주세요."}
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
              {createRoom.isPending ? (en ? "Preparing conversation…" : "대화방 준비 중…") : (en ? "Start Conversation" : "대화 시작")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
