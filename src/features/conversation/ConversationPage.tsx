import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, waitForTerminal, type Message } from "../../api/service";
import { StatusPanel } from "../../components/ui/StatusPanel";
import { BackHeader } from "../../components/ui/BackHeader";
import styles from "../../components/ui/Pages.module.css";
import { latestPersonaReaction, personaImageForEmotion } from "./personaImage";
import { AudioGenerationFailedError, playAutomaticMessageAudio, playManualMessageAudio } from "./audioPlayback";
import { primeStreamingTts, stopActiveTtsPlayback } from "./ttsStreaming";

const emotionLabels: Record<string, string> = {
  neutral: "차분함",
  happy: "기쁨",
  sad: "아쉬움",
  angry: "불편함",
  curious: "호기심",
  embarrassment: "난처함",
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
  const room = useQuery({ queryKey: ["room", roomId], queryFn: () => api.room(roomId) });
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

  const beginSend = () => {
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
      await playAutomaticMessageAudio(message.id);
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
  const backDestination = cameFromRoomList
    ? "/rooms"
    : isInterview ? "/interview" : "/practice";
  const elapsedSeconds = Math.max(0, Math.round((new Date(room.data?.completed_at ?? room.data?.updated_at ?? 0).getTime() - new Date(room.data?.started_at ?? 0).getTime()) / 1000));
  const elapsed = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:${String(elapsedSeconds % 60).padStart(2, "0")}`;
  if (isTerminal && isInterview && cameFromRoomList) {
    return <Navigate to={`/rooms/${roomId}/interview-complete`} replace />;
  }
  const hasInterviewerMessage = sortedMessages.some((message) => message.sender_type === "persona");

  return (
    <div className={`${styles.page} ${styles.conversationPage} ${isInterview ? styles.interviewConversation : ""}`}>
      <header className={styles.conversationHeader}>
        <BackHeader title={isInterview ? "면접" : "대화"} onBack={() => navigate(backDestination)} />
        {!isInterview && <div><span className={styles.cardTag}>대화 연습</span><h1>{room.data?.title}</h1><p>{room.data?.goal ?? "상대의 말을 듣고 자연스럽게 답해 보세요."}</p></div>}
        <div className={styles.turnBadge}>{room.data?.turn_count ?? 0}턴</div>
      </header>
      {isInterview && <section className={styles.interviewGoal} aria-live="polite"><strong>면접 시뮬레이션</strong><span>진행 시간 {elapsed}</span></section>}
      <section className={styles.personaStage}>
        <img src={personaImageForEmotion(currentEmotion)} alt={`${isInterview ? "면접 상대" : "대화 상대"}의 ${currentEmotionLabel} 표정`} />
        <div>{isInterview && <b>현우 면접관</b>}<span>{isInterview ? "기술 면접관" : "AI가 추정한 현재 반응"}</span><strong>{currentEmotionLabel}</strong></div>
      </section>
      {currentQuestion && !isTerminal && !isInterview && <section className={styles.questionBanner}><span>질문 {currentQuestion.sequence} / {questions.data?.questions.length}</span><strong>{currentQuestion.text}</strong></section>}
      <section className={styles.messages} aria-live="polite" aria-label="대화 내용">
        {!sortedMessages.length && !isInterview && <div className={styles.empty}>첫 문장을 보내 대화를 시작해 보세요.</div>}
        {isInterview && currentQuestion && !hasInterviewerMessage && <article className={styles.interviewMessage} role="group" aria-label="현우 면접관의 질문">
          <header><img src="/personas/neutral.png" alt="" /><strong>현우 면접관 · 면접관</strong></header>
          <div><p>{currentQuestion.text}</p><button type="button" aria-label="면접 질문 음성 재생" disabled>🔊</button></div>
        </article>}
        {sortedMessages.map((message) => message.sender_type === "persona" && isInterview ? (
          <article key={message.id} className={styles.interviewMessage} role="group" aria-label={message.sequence_no === 1 ? "현우 면접관의 질문" : "현우 면접관의 답변"}>
            <header><img src={personaImageForEmotion(message.emotion?.label ?? "neutral")} alt="" /><strong>현우 면접관 · 면접관</strong></header>
            <div><p>{message.content}</p><button type="button" disabled={message.sequence_no === 1 || mediaAction.isPending} onClick={() => mediaAction.mutate({ message, mode: "manual" })} aria-label="면접관 음성 재생">🔊</button></div>
          </article>
        ) : (
          <article key={message.id} className={message.sender_type === "user" ? styles.userMessage : styles.aiMessage}>
            <span>{message.sender_type === "user"
              ? "나"
              : message.sender_type === "system"
                ? "시스템"
                : room.data?.persona_name ?? (room.data?.practice_type === "interview" ? "AI 면접관" : "AI 대화 상대")}</span>
            <p>{message.content}</p>
            {/* 시나리오 인사말은 DB에서 그대로 넣은 문장이라 TTS 음성도 전송 상태도 없다. */}
            {!(message.sender_type === "persona" && message.sequence_no === 1) && <footer className={styles.messageFooter}>
              <small>{message.delivery_status === "generating" ? "응답 생성 중" : "전송됨"}</small>
              {message.sender_type === "user" && !isInterview && <button onClick={() => setFeedbackMessage(message)}>피드백 보기</button>}
              {message.sender_type === "persona" && <span className={styles.messageActions}>
                <button disabled={mediaAction.isPending} onClick={() => mediaAction.mutate({ message, mode: "manual" })} aria-label="AI 음성 재생">{mediaAction.isPending ? "음성 준비 중…" : "음성 재생"}</button>
              </span>}
            </footer>}
          </article>
        ))}
        {send.isPending && <div className={styles.aiTyping} role="status"><span /><span /><span /> AI가 맥락을 살펴보고 있어요</div>}
      </section>
      {mediaAction.error && <div className={styles.partialError} role="alert">
        <span>{mediaAction.error.message}</span>
        {failedAudioMessageId && <button type="button" className={styles.secondaryButton} disabled={ttsRetry.isPending} onClick={() => ttsRetry.mutate(failedAudioMessageId)}>{ttsRetry.isPending ? "음성 다시 생성 중…" : "음성 다시 생성"}</button>}
      </div>}
      {send.error && <div className={styles.partialError} role="alert"><strong>AI 응답을 완료하지 못했어요.</strong><span>{send.error.message}</span><small>보낸 메시지는 유지됩니다. 잠시 후 다시 시도해 주세요.</small></div>}
      {voiceError && <div className={styles.partialError} role="alert">{voiceError}</div>}
      {completeInterview.error && <div className={styles.partialError} role="alert"><strong>면접을 종료하지 못했어요.</strong><span>{completeInterview.error.message}</span></div>}
      {isAwaitingInterviewEnd ? (
        <section className={styles.interviewVoiceComposer} aria-live="polite">
          <button type="button" className={styles.primaryButton} disabled={completeInterview.isPending} onClick={() => completeInterview.mutate()}>{completeInterview.isPending ? "면접 종료 중…" : "면접 종료"}</button>
          <p>마지막 면접관 답변을 확인한 뒤 면접을 종료해 주세요.</p>
        </section>
      ) : isTerminal ? (
        <section className={styles.completeCard}><h2>이번 연습이 끝났어요</h2><p>대화 내용은 그대로 유지됩니다. 결과에서 강점과 다음 연습을 확인하세요.</p><Link className={styles.primaryLink} to={`/rooms/${roomId}/result`}>결과 보기</Link></section>
      ) : isInterview ? (
        <section className={styles.interviewVoiceComposer} aria-live="polite">
          {inputMode === "voice" && content.trim() ? <div className={styles.interviewTranscript}>
            <span>인식된 답변</span><p>{content}</p>
            <div><button type="button" className={styles.secondaryButton} onClick={() => { setContent(""); setVoiceBlob(null); setInputMode("text"); }}>다시 녹음</button><button type="button" className={styles.primaryButton} disabled={!voiceBlob || send.isPending} onClick={beginSend}>{send.isPending ? "답변 전송 중…" : "이 답변 전송"}</button></div>
          </div> : <><button type="button" className={`${styles.interviewMicButton} ${isListening ? styles.micButtonActive : ""}`} onClick={() => { void toggleVoiceInput(); }} disabled={send.isPending} aria-label={isListening ? "음성 입력 중지" : "음성 입력 시작"} aria-pressed={isListening}>{isListening ? "■" : "🎙"}</button><p>{isListening ? "답변을 듣고 있어요. 완료되면 버튼을 눌러 주세요." : "마이크로 답변한 뒤 문장을 확인하고 전송해요"}</p></>}
        </section>
      ) : (
        <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); if (!send.isPending) beginSend(); }}>
          <label htmlFor="message-input">내 답변</label>
          <textarea id="message-input" rows={3} value={content} onChange={(event) => { setContent(event.target.value); setInputMode("text"); }} placeholder={isListening ? "듣고 있어요…" : currentQuestion ? "답변을 입력하세요" : "표현을 입력하세요"} disabled={send.isPending} />
          <div><span>{isListening ? "말씀해 주세요" : content.trim().length ? `${content.trim().length}자 · ${inputMode === "voice" ? voiceBlob ? "음성 녹음 완료" : "녹음 정리 중" : "텍스트 입력"}` : "공백만 있는 내용은 전송되지 않아요"}</span><div className={styles.composerActions}><button type="button" className={`${styles.micButton} ${isListening ? styles.micButtonActive : ""}`} onClick={() => { void toggleVoiceInput(); }} disabled={send.isPending} aria-label={isListening ? "음성 입력 중지" : "음성 입력 시작"} aria-pressed={isListening}>{isListening ? "■" : "🎙"}</button><button className={styles.primaryButton} disabled={!content.trim() || send.isPending || isListening || (inputMode === "voice" && !voiceBlob)}>{send.isPending ? "답변 기다리는 중…" : "보내기"}</button></div></div>
        </form>
      )}
      {feedbackMessage && <FeedbackDialog message={feedbackMessage} onClose={() => setFeedbackMessage(null)} />}
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
    <div className={styles.feedbackBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className={styles.feedbackSheet} role="dialog" aria-modal="true" aria-labelledby="feedback-title">
        <div className={styles.feedbackHandle} aria-hidden="true" />
        <header className={styles.feedbackHeader}>
          <div><h2 id="feedback-title">답변 피드백</h2><p>{isVoice ? `마이크 입력 · ${statusLabel}` : `텍스트 입력 · ${statusLabel}`}</p></div>
          <button className={styles.feedbackClose} onClick={onClose} aria-label="피드백 닫기">×</button>
        </header>
        {feedback.isLoading && <StatusPanel title="피드백을 확인하고 있어요" />}
        {feedback.error && <div className={styles.partialError}><strong>피드백만 준비되지 않았어요.</strong><span>대화는 정상적으로 보존되었습니다.</span></div>}
        {feedbackStatus === "processing" && <StatusPanel title="피드백을 분석하고 있어요" detail="완료되면 이 화면에 자동으로 표시됩니다." />}
        {feedbackStatus === "failed" && <div className={styles.partialError}><strong>피드백 분석을 완료하지 못했어요.</strong><span>대화는 정상적으로 보존되었습니다. 다시 생성을 요청할 수 있습니다.</span><button type="button" className={styles.secondaryButton} disabled={retryFeedback.isPending} onClick={() => retryFeedback.mutate()}>{retryFeedback.isPending ? "피드백 다시 요청 중…" : "피드백 다시 시도"}</button></div>}
        {retryFeedback.error && <div className={styles.partialError} role="alert"><span>{retryFeedback.error.message}</span></div>}
        {feedback.data && ["ready", "partial"].includes(feedback.data.status) && <div className={styles.feedbackContent}>
          <section className={styles.feedbackOverall} aria-label="종합 점수">
            <span>종합 점수</span>
            <div><strong>{feedback.data.overall_score ?? "—"}</strong><small>/100</small></div>
            <b>{scoreDescription}</b>
            {feedback.data.summary && <p>{feedback.data.summary}</p>}
          </section>

          <section className={styles.feedbackPanel} aria-labelledby="criteria-title">
            <h3 id="criteria-title">항목별 평가</h3>
            <div className={styles.feedbackCriteria}>
              {feedback.data.scores.map((score) => {
                const percentage = Math.max(0, Math.min(100, (score.score / score.max_score) * 100));
                return <div className={styles.feedbackCriterion} key={score.category}>
                  <div><span>{feedbackCategoryLabels[score.category]}</span><strong>{score.score}/{score.max_score}</strong></div>
                  <div className={styles.feedbackTrack} aria-hidden="true"><i style={{ width: `${percentage}%` }} /></div>
                </div>;
              })}
            </div>
          </section>

          {isVoice && feedback.data.emotions.length > 0 && <section className={styles.feedbackPanel} aria-labelledby="emotion-title">
            <h3 id="emotion-title">감정 분석</h3>
            <div className={styles.feedbackEmotions}>
              {feedback.data.emotions.map((emotion) => <div key={`${emotion.label}-${emotion.sort_order}`}>
                <div><span>{emotionLabels[emotion.label] ?? emotion.label}</span><strong>{emotion.percentage ?? 0}%</strong></div>
                <div className={styles.feedbackTrack} aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, emotion.percentage ?? 0))}%` }} /></div>
              </div>)}
            </div>
          </section>}

          {isVoice && feedback.data.emotions.some((emotion) => emotion.impression) && <section className={styles.feedbackPanel} aria-labelledby="impression-title">
            <h3 id="impression-title">상대가 느끼는 인상</h3>
            <div className={styles.feedbackImpressions}>{feedback.data.emotions.map((emotion) => emotion.impression && <span key={`${emotion.label}-impression`}>{emotion.impression}</span>)}</div>
          </section>}

          <section className={styles.feedbackPanel} aria-labelledby="expression-title">
            <h3 id="expression-title">항목별 표현 피드백</h3>
            <div className={styles.feedbackExpressions}>{feedback.data.scores.map((score) => <article key={`${score.category}-detail`}>
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
