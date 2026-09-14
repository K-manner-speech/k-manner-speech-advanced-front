import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, waitForTerminal, type Message } from "../../api/service";
import { StatusPanel } from "../../components/ui/StatusPanel";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import chat from "./ConversationPage.module.css";
import { Button } from "../../components/ui/Button";
import { latestPersonaReaction, personaImageForEmotion } from "./personaImage";
import { AudioGenerationFailedError, playAutomaticMessageAudio, playManualMessageAudio } from "./audioPlayback";
import { primeStreamingTts, stopActiveTtsPlayback } from "./ttsStreaming";

// 판정 job 의 제한 시간은 20초다. 재시도까지 감안해 조금 더 길게 지켜본다.
export const GOAL_POLL_WINDOW_MS = 40_000;

const emotionLabels: Record<string, string> = {
  neutral: "차분함",
  happy: "기쁨",
  sad: "아쉬움",
  angry: "불편함",
  curious: "호기심",
  embarrassment: "난처함",
};

/* 막대 색을 항목마다 달리해 어느 줄을 보는지 따라가기 쉽게 한다. */
const categoryToneClass: Record<string, string> = {
  honorifics: "honorifics",
  courtesy: "courtesy",
  context_fit: "contextFit",
  naturalness: "naturalness",
};

const feedbackCategoryLabels: Record<string, string> = {
  honorifics: "높임법",
  courtesy: "예의와 배려",
  context_fit: "상황 적합성",
  naturalness: "자연스러움",
};

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export function ConversationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomId = "" } = useParams();
  const [search] = useSearchParams();
  const configurationIdFromUrl = search.get("configuration");
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [inputMode, setInputMode] = useState<"text" | "voice">("text");
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<Message | null>(null);
  const [failedAudioMessageId, setFailedAudioMessageId] = useState<string | null>(null);
  const autoplayAfterSequenceRef = useRef<number | null>(null);
  const conversationStartedAtRef = useRef<number | null>(null);
  // 목표 판정은 답장이 뜬 뒤 몇 초 지나 끝난다. 전송 직후 한 번만 읽으면
  // goal_achieved 가 화면에 영영 도달하지 않으므로, 전송 뒤 잠시 폴링한다.
  const [goalPollUntil, setGoalPollUntil] = useState(0);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  const [missionOpen, setMissionOpen] = useState<boolean | null>(null);
  const room = useQuery({
    queryKey: ["room", roomId],
    queryFn: () => api.room(roomId),
    refetchInterval: (query) => {
      const current = query.state.data;
      if (!current || current.practice_type === "interview") return false;
      if (current.status !== "in_progress") return false;
      if (current.ended_reason === "goal_achieved") return false;
      return Date.now() < goalPollUntil ? 2_000 : false;
    },
  });
  const messages = useQuery({ queryKey: ["messages", roomId], queryFn: () => api.messages(roomId) });
  const configurationId = configurationIdFromUrl ?? room.data?.interview_configuration_id ?? null;
  const questions = useQuery({
    queryKey: ["interview-questions", configurationId],
    queryFn: () => api.interviewQuestions(configurationId!),
    enabled: Boolean(configurationId),
  });
  const currentQuestion = room.data?.current_interview_question_id === undefined
    ? (room.data?.practice_type === "interview" ? questions.data?.questions[0] : undefined)
    : questions.data?.questions.find(
      (question) => question.id === room.data?.current_interview_question_id,
    );
  const sortedMessages = useMemo(
    () => [...(messages.data?.items ?? [])].sort((a, b) => a.sequence_no - b.sequence_no),
    [messages.data],
  );
  const currentEmotion = latestPersonaReaction(sortedMessages);
  const currentEmotionLabel = emotionLabels[currentEmotion] ?? emotionLabels.neutral;
  const send = useMutation({
    mutationFn: async () => {
      const normalizedContent = content.trim();
      if (!normalizedContent) throw new Error("AC-T3-NO-BLANK-MESSAGE: 공백 메시지는 보낼 수 없습니다.");
      const accepted = inputMode === "voice" && voiceBlob
        ? await api.sendVoiceMessage(roomId, normalizedContent, voiceBlob, currentQuestion?.id)
        : await api.sendMessage(roomId, normalizedContent, currentQuestion?.id, "text");
      setContent("");
      setInputMode("text");
      setVoiceBlob(null);
      await queryClient.invalidateQueries({ queryKey: ["messages", roomId] });
      return waitForTerminal(() => api.job(accepted.job.job_id), "succeeded", 50_000);
    },
    onSettled: async () => {
      setGoalPollUntil(Date.now() + GOAL_POLL_WINDOW_MS);
      await queryClient.invalidateQueries({ queryKey: ["messages", roomId] });
      await queryClient.invalidateQueries({ queryKey: ["room", roomId] });
    },
  });
  const completeInterview = useMutation({
    mutationFn: () => room.data?.status === "in_progress"
      ? api.completeInterview(roomId)
      : Promise.resolve(room.data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["room", roomId] });
      navigate(`/rooms/${roomId}/interview-complete`, { replace: true });
    },
  });

  // 목표 달성 카드와 헤더의 종료 버튼이 같은 API를 쓴다. 면접도 중간에 그만둘 수
  // 있어야 하므로 연습 종류로 갈라지는 것은 끝난 뒤 이동할 화면뿐이다.
  const completePractice = useMutation({
    mutationFn: () => api.completePractice(roomId),
    onSuccess: async (completed) => {
      await queryClient.invalidateQueries({ queryKey: ["room", roomId] });
      const next = completed?.practice_type === "interview" ? "interview-complete" : "result";
      navigate(`/rooms/${roomId}/${next}`, { replace: true });
    },
  });
  const continueAfterGoal = useMutation({
    mutationFn: () => api.continueAfterGoal(roomId),
    onSuccess: async () => {
      setGoalPollUntil(0);
      await queryClient.invalidateQueries({ queryKey: ["room", roomId] });
    },
  });

  const beginSend = () => {
    conversationStartedAtRef.current = performance.now();
    autoplayAfterSequenceRef.current = sortedMessages
      .filter((message) => message.sender_type === "persona")
      .reduce((latest, message) => Math.max(latest, message.sequence_no), -1);
    primeStreamingTts();
    send.mutate();
  };

  useEffect(() => () => {
    recognitionRef.current?.stop();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    // 화면을 떠나도 스트리밍 재생과 fetch가 살아 있어 음성이 계속 들린다.
    stopActiveTtsPlayback();
  }, []);

  const toggleVoiceInput = async () => {
    setVoiceError(null);
    if (isListening) {
      recognitionRef.current?.stop();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      setIsListening(false);
      return;
    }
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceError("이 브라우저에서는 음성 입력을 지원하지 않습니다. Chrome 또는 Safari 최신 버전을 사용해 주세요.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setVoiceError("마이크 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해 주세요.");
      return;
    }
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]
      .find((candidate) => MediaRecorder.isTypeSupported(candidate));
    if (!mimeType) {
      stream.getTracks().forEach((track) => track.stop());
      setVoiceError("이 브라우저에서 지원하는 음성 녹음 형식을 찾지 못했습니다. Chrome 또는 Safari 최신 버전을 사용해 주세요.");
      return;
    }
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setVoiceError("음성 녹음을 시작하지 못했습니다. 브라우저를 새로고침한 뒤 다시 시도해 주세요.");
      return;
    }
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => setVoiceBlob(new Blob(chunks, { type: mimeType }));
    recorderRef.current = recorder;
    streamRef.current = stream;
    setVoiceBlob(null);
    const recognition = new Recognition();
    recognition.lang = "ko-KR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) {
        setContent(transcript);
        setInputMode("voice");
      }
    };
    const finishRecording = () => {
      if (recorder.state === "recording") recorder.stop();
      stream.getTracks().forEach((track) => track.stop());
      setIsListening(false);
    };
    recognition.onerror = (event) => {
      finishRecording();
      setVoiceError(event.error === "not-allowed" ? "마이크 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해 주세요." : "음성을 인식하지 못했습니다. 다시 시도해 주세요.");
    };
    recognition.onend = finishRecording;
    recognitionRef.current = recognition;
    setIsListening(true);
    recorder.start();
    recognition.start();
  };
  const mediaAction = useMutation({
    mutationFn: async ({ message, mode }: { message: Message; mode: "automatic" | "manual" }) => {
      if (mode === "manual") {
        await playManualMessageAudio(message.id);
        return;
      }
      const conversationStartedAt = conversationStartedAtRef.current ?? undefined;
      conversationStartedAtRef.current = null;
      await playAutomaticMessageAudio(message.id, conversationStartedAt);
    },
    onMutate: () => setFailedAudioMessageId(null),
    onError: (error, variables) => {
      if (error instanceof AudioGenerationFailedError) setFailedAudioMessageId(variables.message.id);
    },
    onSuccess: () => setFailedAudioMessageId(null),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["messages", roomId] });
    },
  });
  const ttsRetry = useMutation({
    mutationFn: (messageId: string) => api.retryTts(messageId),
    onMutate: () => setFailedAudioMessageId(null),
    onError: (_error, messageId) => setFailedAudioMessageId(messageId),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["messages", roomId] });
    },
  });

  useEffect(() => {
    const threshold = autoplayAfterSequenceRef.current;
    if (threshold === null || send.isPending) return;
    const newest = [...sortedMessages]
      .reverse()
      .find((message) => message.sender_type === "persona" && message.sequence_no > threshold);
    if (!newest) return;
    autoplayAfterSequenceRef.current = null;
    mediaAction.mutate({ message: newest, mode: "automatic" });
  }, [mediaAction, send.isPending, sortedMessages]);

  if (room.isLoading || messages.isLoading) return <StatusPanel title="대화 내용을 불러오고 있어요" />;
  if (room.error || messages.error) return <StatusPanel title="대화를 불러오지 못했어요" detail={(room.error ?? messages.error)?.message} onRetry={() => { void room.refetch(); void messages.refetch(); }} />;
  const isTerminal = room.data?.status !== "in_progress";
  const isInterview = room.data?.practice_type === "interview";
  const cameFromRoomList = (location.state as { from?: unknown } | null)?.from === "/rooms";
  const isAwaitingInterviewEnd = isInterview
    && (isTerminal || room.data?.ended_reason === "awaiting_user_end");
  // 조기 종료는 제안이지 강제가 아니다. 입력창은 열어두고 보내기만 잠근다.
  const isGoalAchieved = !isInterview && !isTerminal
    && room.data?.ended_reason === "goal_achieved";
  const goalChoicePending = isGoalAchieved
    && !completePractice.isPending && !continueAfterGoal.isPending;
  // 목표를 이루지 못했거나 질문이 남았어도 그만둘 수 있어야 한다. 목표 달성 카드나
  // 면접 종료 카드가 떠 있을 때는 거기에 이미 종료 버튼이 있으므로 겹쳐 내지 않는다.
  const canEndAnytime = !isTerminal && !isGoalAchieved && !isAwaitingInterviewEnd;
  const backDestination = cameFromRoomList
    ? "/rooms"
    : isInterview ? "/interview" : "/practice";
  const elapsedSeconds = Math.max(0, Math.round((new Date(room.data?.completed_at ?? room.data?.updated_at ?? 0).getTime() - new Date(room.data?.started_at ?? 0).getTime()) / 1000));
  const elapsed = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:${String(elapsedSeconds % 60).padStart(2, "0")}`;
  if (isTerminal && isInterview && cameFromRoomList) {
    return <Navigate to={`/rooms/${roomId}/interview-complete`} replace />;
  }
  const hasInterviewerMessage = sortedMessages.some((message) => message.sender_type === "persona");
  // 자유채팅에는 미션이 없고, 면접의 안내는 질문 자체가 대신한다.
  const mission = isInterview ? null : room.data?.goal;
  const isMissionOpen = missionOpen ?? false;

  // 면접은 I 섹션에서 따로 다룬다. 여기서는 자유채팅·시나리오 화면을 그린다.
  const personaLabel = room.data?.persona_name ?? "대화 상대";

  return (
    <div className={`${chat.screen} ${isInterview ? chat.interviewScreen : ""}`}>
      <div className={chat.header}>
        <button type="button" className={chat.back} onClick={() => navigate(backDestination)} aria-label="뒤로 가기">‹</button>
        <h1>{isInterview ? "면접 시뮬레이션" : personaLabel}</h1>
        {/* 시안은 이 자리에 진행 시간만 두지만, 면접도 중간에 끝낼 수 있어야 한다.
            질문이 남은 방을 끝낼 방법이 없으면 결과를 못 보는 채로 남는다. 둘을
            나란히 둔다. */}
        <div className={chat.headerRight}>
          {isInterview && <span className={chat.elapsed}>{elapsed}</span>}
          {canEndAnytime && (
            <button
              type="button"
              className={chat.end}
              disabled={completePractice.isPending}
              onClick={() => setEndConfirmOpen(true)}
            >
              종료
            </button>
          )}
        </div>
      </div>

      <div className={chat.intro}>
        {mission && (
          <section className={chat.mission}>
            <button
              type="button"
              className={chat.missionToggle}
              aria-expanded={isMissionOpen}
              onClick={() => setMissionOpen(!isMissionOpen)}
            >
              <b>이번 대화의 미션</b>
              <span aria-hidden="true">{isMissionOpen ? "접기" : "펼치기"}</span>
            </button>
            {isMissionOpen && <p className={chat.missionBody}>{mission}</p>}
          </section>
        )}

        <section className={chat.hero}>
          <img
            src={personaImageForEmotion(currentEmotion)}
            alt={`${isInterview ? "면접 상대" : "대화 상대"}의 ${currentEmotionLabel} 표정`}
          />
          <div className={chat.heroOverlay}>
            <span className={chat.heroText}>
              <b>{isInterview ? "현우 면접관" : (room.data?.title ?? "대화 연습")}</b>
              <small>{isInterview ? "기술 면접관 · Technical Interviewer" : `${personaLabel}과 대화 연습`}</small>
            </span>
            <span className={chat.emotion}>{currentEmotionLabel}</span>
          </div>
        </section>
      </div>

      <section className={chat.messages} aria-live="polite" aria-label="대화 내용">
        {!sortedMessages.length && !isInterview && (
          <p className={chat.empty}>첫 문장을 보내 대화를 시작해 보세요.</p>
        )}
        {isInterview && currentQuestion && !hasInterviewerMessage && (
          <article className={`${chat.turn} ${chat.personaTurn}`} role="group" aria-label="현우 면접관의 질문">
            <img className={chat.avatar} src="/personas/neutral.png" alt="" />
            <div className={chat.personaContent}>
              <b className={chat.senderName}>현우 면접관 · 면접관</b>
              <div className={chat.row}>
                <p className={`${chat.bubble} ${chat.interviewer}`}>{currentQuestion.text}</p>
                <button type="button" className={chat.speak} aria-label="면접 질문 음성 재생" disabled>
                  <img src="/figma/icon-volume.svg" alt="" />
                </button>
              </div>
            </div>
          </article>
        )}
        {sortedMessages.map((message) => message.sender_type === "persona" && isInterview ? (
          <article key={message.id} className={`${chat.turn} ${chat.personaTurn}`} role="group" aria-label={message.sequence_no === 1 ? "현우 면접관의 질문" : "현우 면접관의 답변"}>
            <img className={chat.avatar} src={personaImageForEmotion(message.emotion?.label ?? "neutral")} alt="" />
            <div className={chat.personaContent}>
              <b className={chat.senderName}>현우 면접관 · 면접관</b>
              <div className={chat.row}>
                <p className={`${chat.bubble} ${chat.interviewer}`}>{message.content}</p>
                <button
                  type="button"
                  className={chat.speak}
                  disabled={mediaAction.isPending}
                  onClick={() => mediaAction.mutate({ message, mode: "manual" })}
                  aria-label="면접관 음성 재생"
                >
                  <img src="/figma/icon-volume.svg" alt="" />
                </button>
              </div>
            </div>
          </article>
        ) : message.sender_type === "user" ? (
          <article className={`${chat.turn} ${chat.userTurn}`} key={message.id}>
            <div className={`${chat.row} ${chat.mine}`}>
              {message.input_mode === "voice" && (
                <button type="button" className={chat.voiceReplay} aria-label="내 음성 다시 듣기" disabled>
                  <img src="/figma/icon-volume.svg" alt="" />
                </button>
              )}
              <div className={`${chat.bubble} ${chat.userBubble}`}>
                <span className={chat.inputMode}>
                  {message.input_mode === "voice"
                    ? (isInterview ? "음성 입력 · 전송 완료" : "음성 입력")
                    : "텍스트 입력"}
                </span>
                <p>{message.content}</p>
                {!isInterview && (
                  <button type="button" className={chat.feedbackLink} onClick={() => setFeedbackMessage(message)}>
                    피드백 보기<span aria-hidden="true"> ›</span>
                  </button>
                )}
              </div>
            </div>
          </article>
        ) : (
          <article className={`${chat.turn} ${chat.personaTurn}`} key={message.id}>
            <img className={chat.avatar} src={personaImageForEmotion(message.emotion?.label ?? "neutral")} alt="" />
            <div className={chat.personaContent}>
              <b className={chat.senderName}>{message.sender_type === "system" ? "시스템" : personaLabel}</b>
              <div className={chat.row}>
                <p className={chat.bubble}>{message.content}</p>
                {message.sender_type === "persona" && (
                  <button
                    type="button"
                    className={chat.speak}
                    disabled={mediaAction.isPending}
                    onClick={() => mediaAction.mutate({ message, mode: "manual" })}
                    aria-label="AI 음성 재생"
                  >
                    <img src="/figma/icon-volume.svg" alt="" />
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
        {isListening && (
          <div className={chat.listening} role="status">
            <span>음성 입력 중</span>
            <span className={chat.dots} aria-hidden="true"><i /><i /><i /></span>
          </div>
        )}
        {send.isPending && <p className={chat.typing} role="status">AI가 맥락을 살펴보고 있어요…</p>}
        {isInterview && inputMode === "voice" && content.trim() && (
          <div className={`${chat.row} ${chat.mine} ${chat.transcriptRow}`}>
            <button type="button" className={chat.voiceReplay} aria-label="녹음한 음성 다시 듣기" disabled>
              <img src="/figma/icon-volume.svg" alt="" />
            </button>
            <div className={`${chat.transcript} ${chat.interviewTranscript}`}>
              <span>음성 인식 결과 · 확인 전</span>
              <p>{content}</p>
              <div className={chat.transcriptActions}>
                <Button variant="secondary" compact onClick={() => { setContent(""); setVoiceBlob(null); setInputMode("text"); }}>다시 말하기</Button>
                <Button compact disabled={!voiceBlob || send.isPending} onClick={beginSend}>
                  {send.isPending ? "전송 중…" : "보내기"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>

      <div className={`${chat.conversationFooter} ${isTerminal ? chat.terminalFooter : ""}`}>
        {mediaAction.error && <div className={`${chat.notice} ${chat.error}`} role="alert">
          <span>{mediaAction.error.message}</span>
          {failedAudioMessageId && <Button variant="secondary" compact disabled={ttsRetry.isPending} onClick={() => ttsRetry.mutate(failedAudioMessageId)}>{ttsRetry.isPending ? "음성 다시 생성 중…" : "음성 다시 생성"}</Button>}
        </div>}
        {send.error && <div className={chat.notice} role="alert"><strong>AI 응답을 완료하지 못했어요.</strong><span>{send.error.message}</span><span>보낸 메시지는 유지됩니다. 잠시 후 다시 시도해 주세요.</span></div>}
        {voiceError && <div className={`${chat.notice} ${chat.error}`} role="alert">{voiceError}</div>}
        {completeInterview.error && <div className={chat.notice} role="alert"><strong>면접을 종료하지 못했어요.</strong><span>{completeInterview.error.message}</span></div>}
        {isGoalAchieved && <section className={chat.goalCard} role="status" aria-live="polite">
          <strong>목표를 모두 달성했어요</strong>
          <p>연습을 마치고 피드백을 확인하거나, 대화를 더 이어갈 수 있어요.</p>
          <div className={chat.goalActions}>
            <Button compact disabled={completePractice.isPending || continueAfterGoal.isPending} onClick={() => completePractice.mutate()}>{completePractice.isPending ? "마무리하는 중…" : "연습 종료"}</Button>
            <Button variant="secondary" compact disabled={completePractice.isPending || continueAfterGoal.isPending} onClick={() => continueAfterGoal.mutate()}>{continueAfterGoal.isPending ? "이어가는 중…" : "계속하기"}</Button>
          </div>
          {(completePractice.error || continueAfterGoal.error) && <span className={chat.error}>{(completePractice.error ?? continueAfterGoal.error)?.message}</span>}
        </section>}

        {isAwaitingInterviewEnd ? (
          <section className={chat.micOnly} aria-live="polite">
            <Button disabled={completeInterview.isPending} onClick={() => completeInterview.mutate()}>
              {completeInterview.isPending ? "면접 종료 중…" : "면접 종료"}
            </Button>
            <p>마지막 면접관 답변을 확인한 뒤 면접을 종료해 주세요.</p>
          </section>
        ) : isTerminal ? (
          <section className={`${chat.notice} ${chat.terminalNotice}`}>
            <strong>이번 연습이 끝났어요</strong>
            <span>대화 내용은 그대로 유지됩니다. 결과에서 강점과 다음 연습을 확인하세요.</span>
            <div className={chat.terminalActions}>
              <Link className={chat.terminalPrimary} to={`/rooms/${roomId}/result`}>결과 보기</Link>
              <Link className={chat.terminalSecondary} to="/rooms">대화 목록</Link>
            </div>
          </section>
        ) : isInterview ? (
          <section className={chat.micOnly} aria-live="polite">
            {!(inputMode === "voice" && content.trim()) && (
              <>
                <button
                  type="button"
                  className={chat.micLarge}
                  onClick={() => { void toggleVoiceInput(); }}
                  disabled={send.isPending}
                  aria-label={isListening ? "음성 입력 중지" : "음성 입력 시작"}
                  aria-pressed={isListening}
                >
                  {isListening ? "■" : <img src="/figma/icon-microphone.svg" alt="" />}
                </button>
              </>
            )}
          </section>
        ) : (
          <form className={chat.composer} onSubmit={(event) => { event.preventDefault(); if (!send.isPending) beginSend(); }}>
            <label htmlFor="message-input">내 답변</label>
            <textarea
              id="message-input"
              className={chat.input}
              rows={1}
              value={content}
              onChange={(event) => { setContent(event.target.value); setInputMode("text"); }}
              placeholder={isListening ? "듣고 있어요…" : "메시지를 입력하세요"}
              disabled={send.isPending}
            />
            <button
              type="button"
              className={`${chat.mic} ${isListening ? chat.micActive : ""}`}
              onClick={() => { void toggleVoiceInput(); }}
              disabled={send.isPending || goalChoicePending}
              aria-label={isListening ? "음성 입력 중지" : "음성 입력 시작"}
              aria-pressed={isListening}
            >
              {isListening ? "■" : <img src="/figma/icon-microphone.svg" alt="" />}
            </button>
            <button
              className={chat.send}
              disabled={!content.trim() || send.isPending || isListening || goalChoicePending || (inputMode === "voice" && !voiceBlob)}
              aria-label="보내기"
            >
              <img src="/figma/icon-send.svg" alt="" />
            </button>
          </form>
        )}
      </div>
      {feedbackMessage && <FeedbackDialog message={feedbackMessage} onClose={() => setFeedbackMessage(null)} />}
      {endConfirmOpen && (
        <ConfirmDialog
          title={isInterview ? "면접을 종료할까요?" : "대화를 종료할까요?"}
          description={isInterview
            ? "종료하면 남은 질문은 진행할 수 없고, 지금까지의 답변으로 결과를 만듭니다."
            : "종료하면 이 방에서는 더 이야기할 수 없고, 지금까지의 대화로 결과를 만듭니다."}
          subject={room.data?.title ? { name: room.data.title } : undefined}
          confirmLabel="종료"
          pendingLabel="종료하는 중…"
          pending={completePractice.isPending}
          error={completePractice.error?.message}
          onConfirm={() => completePractice.mutate()}
          onCancel={() => setEndConfirmOpen(false)}
        />
      )}
    </div>
  );
}

function FeedbackDialog({ message, onClose }: { message: Message; onClose: () => void }) {
  const queryClient = useQueryClient();
  const feedback = useQuery({
    queryKey: ["feedback", message.id],
    queryFn: () => api.feedback(message.id),
    refetchInterval: (query) => query.state.data?.status === "processing" ? 1_000 : false,
  });
  const retryFeedback = useMutation({
    mutationFn: () => api.retryFeedback(message.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feedback", message.id] }),
  });
  const isVoice = message.input_mode === "voice";
  const feedbackStatus = feedback.data?.status;
  const statusLabel = feedbackStatus === "processing"
    ? "분석 중"
    : feedbackStatus === "failed"
      ? "분석 실패"
      : "분석 완료";
  const scoreDescription = (feedback.data?.overall_score ?? 0) >= 85
    ? (isVoice ? "균형 잡힌 답변" : "명확하고 정중해요")
    : "조금 더 다듬으면 좋아요";
  return (
    <div className={chat.backdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className={chat.sheet} role="dialog" aria-modal="true" aria-labelledby="feedback-title">
        <div className={chat.handle} aria-hidden="true" />
        <header className={chat.sheetHeader}>
          <div><h2 id="feedback-title">답변 피드백</h2><p>{isVoice ? `마이크 입력 · ${statusLabel}` : `텍스트 입력 · ${statusLabel}`}</p></div>
          <button className={chat.close} onClick={onClose} aria-label="피드백 닫기">×</button>
        </header>
        {feedback.isLoading && <StatusPanel title="피드백을 확인하고 있어요" />}
        {feedback.error && <div className={chat.notice}><strong>피드백만 준비되지 않았어요.</strong><span>대화는 정상적으로 보존되었습니다.</span></div>}
        {feedbackStatus === "processing" && <StatusPanel title="피드백을 분석하고 있어요" detail="완료되면 이 화면에 자동으로 표시됩니다." />}
        {feedbackStatus === "failed" && <div className={chat.notice}><strong>피드백 분석을 완료하지 못했어요.</strong><span>대화는 정상적으로 보존되었습니다. 다시 생성을 요청할 수 있습니다.</span><Button variant="secondary" compact disabled={retryFeedback.isPending} onClick={() => retryFeedback.mutate()}>{retryFeedback.isPending ? "피드백 다시 요청 중…" : "피드백 다시 시도"}</Button></div>}
        {retryFeedback.error && <div className={chat.notice} role="alert"><span>{retryFeedback.error.message}</span></div>}
        {feedback.data && ["ready", "partial"].includes(feedback.data.status) && <div className={chat.content}>
          <section className={chat.overall} aria-label="종합 점수">
            <div className={chat.overallHead}>
              <span>종합 점수</span>
              <b>{scoreDescription}</b>
            </div>
            <p className={chat.overallScore}>
              {feedback.data.overall_score ?? "—"}<small>/100</small>
            </p>
            {feedback.data.summary && <p>{feedback.data.summary}</p>}
          </section>

          <section className={chat.panel} aria-labelledby="criteria-title">
            <h3 id="criteria-title">항목별 평가</h3>
            <div className={chat.bars}>
              {feedback.data.scores.map((score) => {
                const percentage = Math.max(0, Math.min(100, (score.score / score.max_score) * 100));
                return <div className={chat.bar} key={score.category}>
                  <span>{feedbackCategoryLabels[score.category]}</span>
                  <div className={`${chat.track} ${chat[categoryToneClass[score.category] ?? ""] ?? ""}`} aria-hidden="true">
                    <i style={{ width: `${percentage}%` }} />
                  </div>
                  <strong>{score.score}/{score.max_score}</strong>
                </div>;
              })}
            </div>
          </section>

          {isVoice && feedback.data.emotions.length > 0 && <section className={chat.panel} aria-labelledby="emotion-title">
            <h3 id="emotion-title">감정 분석</h3>
            <div className={chat.bars}>
              {feedback.data.emotions.map((emotion) => <div className={chat.bar} key={`${emotion.label}-${emotion.sort_order}`}>
                <span>{emotionLabels[emotion.label] ?? emotion.label}</span>
                <div className={chat.track} aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, emotion.percentage ?? 0))}%` }} /></div>
                <strong>{emotion.percentage ?? 0}%</strong>
              </div>)}
            </div>
          </section>}

          {isVoice && feedback.data.emotions.some((emotion) => emotion.impression) && <section className={chat.panel} aria-labelledby="impression-title">
            <h3 id="impression-title">상대가 느끼는 인상</h3>
            <div className={chat.chips}>{feedback.data.emotions.map((emotion) => emotion.impression && <span key={`${emotion.label}-impression`}>{emotion.impression}</span>)}</div>
          </section>}

          <section className={chat.panel} aria-labelledby="expression-title">
            <h3 id="expression-title">항목별 표현 피드백</h3>
            <div className={chat.expressions}>{feedback.data.scores.map((score) => <article key={`${score.category}-detail`}>
              <h4>{feedbackCategoryLabels[score.category]}</h4>
              {score.strength && <p><strong>잘했어요</strong>{score.strength}</p>}
              {(score.suggestion || score.recommended_text) && <p><strong>제안</strong>{score.suggestion ?? score.recommended_text}</p>}
              {score.recommended_text && score.suggestion && <blockquote>“{score.recommended_text}”</blockquote>}
            </article>)}</div>
          </section>
        </div>}
      </section>
    </div>
  );
}
