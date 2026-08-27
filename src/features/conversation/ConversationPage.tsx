import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, waitForTerminal, type Message } from "../../api/service";
import { StatusPanel } from "../../components/ui/StatusPanel";
import styles from "../../components/ui/Pages.module.css";

const emotionLabels: Record<string, string> = {
  neutral: "차분함",
  happy: "기쁨",
  sad: "아쉬움",
  angry: "불편함",
  curious: "호기심",
  embarrassment: "난처함",
};

export function ConversationPage() {
  const { roomId = "" } = useParams();
  const [search] = useSearchParams();
  const configurationId = search.get("configuration");
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState<Message | null>(null);
  const room = useQuery({ queryKey: ["room", roomId], queryFn: () => api.room(roomId) });
  const messages = useQuery({ queryKey: ["messages", roomId], queryFn: () => api.messages(roomId) });
  const questions = useQuery({
    queryKey: ["interview-questions", configurationId],
    queryFn: () => api.interviewQuestions(configurationId!),
    enabled: Boolean(configurationId),
  });
  const userAnswerCount = messages.data?.items.filter((message) => message.sender_type === "user").length ?? 0;
  const currentQuestion = questions.data?.questions[userAnswerCount];
  const sortedMessages = useMemo(
    () => [...(messages.data?.items ?? [])].sort((a, b) => a.sequence_no - b.sequence_no),
    [messages.data],
  );
  const send = useMutation({
    mutationFn: async () => {
      const normalizedContent = content.trim();
      if (!normalizedContent) throw new Error("AC-T3-NO-BLANK-MESSAGE: 공백 메시지는 보낼 수 없습니다.");
      const accepted = await api.sendMessage(roomId, normalizedContent, currentQuestion?.id);
      setContent("");
      await queryClient.invalidateQueries({ queryKey: ["messages", roomId] });
      return waitForTerminal(() => api.job(accepted.job.job_id), "succeeded", 20_000);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["messages", roomId] });
      await queryClient.invalidateQueries({ queryKey: ["room", roomId] });
    },
  });

  if (room.isLoading || messages.isLoading) return <StatusPanel title="대화 내용을 불러오고 있어요" />;
  if (room.error || messages.error) return <StatusPanel title="대화를 불러오지 못했어요" detail={(room.error ?? messages.error)?.message} onRetry={() => { void room.refetch(); void messages.refetch(); }} />;
  const isTerminal = room.data?.status !== "in_progress";

  return (
    <div className={`${styles.page} ${styles.conversationPage}`}>
      <header className={styles.conversationHeader}>
        <div><span className={styles.cardTag}>{room.data?.practice_type === "interview" ? "AI 면접" : "대화 연습"}</span><h1>{room.data?.title}</h1><p>{room.data?.goal ?? "상대의 말을 듣고 자연스럽게 답해 보세요."}</p></div>
        <div className={styles.turnBadge}>{room.data?.turn_count ?? 0}턴</div>
      </header>
      <section className={styles.personaStage}>
        <img src="/figma/persona.png" alt="대화 상대가 차분하게 이야기를 듣는 모습" />
        <div><span>AI가 추정한 현재 반응</span><strong>{emotionLabels[sortedMessages.at(-1)?.emotion?.label ?? "neutral"] ?? "차분함"}</strong></div>
      </section>
      {currentQuestion && <section className={styles.questionBanner}><span>질문 {currentQuestion.sequence} / {questions.data?.questions.length}</span><strong>{currentQuestion.text}</strong></section>}
      <section className={styles.messages} aria-live="polite" aria-label="대화 내용">
        {!sortedMessages.length && <div className={styles.empty}>첫 문장을 보내 대화를 시작해 보세요.</div>}
        {sortedMessages.map((message) => (
          <article key={message.id} className={message.sender_type === "user" ? styles.userMessage : styles.aiMessage}>
            <span>{message.sender_type === "user" ? "나" : "AI 대화 상대"}</span>
            <p>{message.content}</p>
            <footer>
              <small>{message.delivery_status === "generating" ? "응답 생성 중" : "전송됨"}</small>
              {message.sender_type === "user" && <button onClick={() => setFeedbackMessage(message)}>피드백 보기</button>}
            </footer>
          </article>
        ))}
        {send.isPending && <div className={styles.aiTyping} role="status"><span /><span /><span /> AI가 맥락을 살펴보고 있어요</div>}
      </section>
      {send.error && <div className={styles.partialError} role="alert"><strong>AI 응답을 완료하지 못했어요.</strong><span>{send.error.message}</span><small>보낸 메시지는 유지됩니다. 잠시 후 다시 시도해 주세요.</small></div>}
      {isTerminal ? (
        <section className={styles.completeCard}><h2>이번 연습이 끝났어요</h2><p>대화 내용은 그대로 유지됩니다. 결과에서 강점과 다음 연습을 확인하세요.</p><Link className={styles.primaryLink} to={`/results/${roomId}`}>결과 보기</Link></section>
      ) : (
        <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); if (!send.isPending) send.mutate(); }}>
          <label htmlFor="message-input">내 답변</label>
          <textarea id="message-input" rows={3} value={content} onChange={(event) => setContent(event.target.value)} placeholder={currentQuestion ? "질문에 대한 답변을 입력하세요" : "상황에 맞는 표현을 입력하세요"} disabled={send.isPending} />
          <div><span>{content.trim().length ? `${content.trim().length}자` : "공백만 있는 내용은 전송되지 않아요"}</span><button className={styles.primaryButton} disabled={!content || send.isPending}>{send.isPending ? "답변 기다리는 중…" : "보내기"}</button></div>
        </form>
      )}
      {feedbackMessage && <FeedbackDialog message={feedbackMessage} onClose={() => setFeedbackMessage(null)} />}
    </div>
  );
}

function FeedbackDialog({ message, onClose }: { message: Message; onClose: () => void }) {
  const feedback = useQuery({ queryKey: ["feedback", message.id], queryFn: () => api.feedback(message.id) });
  return (
    <div className={styles.dialogBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="feedback-title">
        <button className={styles.dialogClose} onClick={onClose} aria-label="피드백 닫기">×</button>
        <p className={styles.eyebrow}>AI 코칭 · 추정 결과</p><h2 id="feedback-title">이 표현의 좋은 점과 개선점</h2>
        {feedback.isLoading && <StatusPanel title="피드백을 확인하고 있어요" />}
        {feedback.error && <div className={styles.partialError}><strong>피드백만 준비되지 않았어요.</strong><span>대화는 정상적으로 보존되었습니다.</span></div>}
        {feedback.data && <><div className={styles.scoreHero}><strong>{feedback.data.overall_score ?? "—"}</strong><span>/ 100</span><p>{feedback.data.summary ?? "점수 없이 설명형 피드백을 제공합니다."}</p></div><div className={styles.scoreGrid}>{feedback.data.scores.map((score) => <article key={score.category}><span>{score.category}</span><strong>{score.score} / {score.max_score}</strong><p>{score.strength ?? score.suggestion ?? "분석 중입니다."}</p></article>)}</div></>}
      </section>
    </div>
  );
}
