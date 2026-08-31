import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/service";
import { ApiError } from "../../api/http";
import { BackHeader } from "../../components/ui/BackHeader";
import { StatusPanel } from "../../components/ui/StatusPanel";
import styles from "../../components/ui/Pages.module.css";

export function InterviewCompletePage() {
  const { roomId = "" } = useParams();
  const navigate = useNavigate();
  const room = useQuery({ queryKey: ["room", roomId], queryFn: () => api.room(roomId) });
  const result = useQuery({
    queryKey: ["result", "room", roomId],
    queryFn: () => api.result(roomId),
    enabled: room.data?.practice_type === "interview" && room.data.status !== "in_progress",
    retry: false,
    refetchInterval: (query) => query.state.error instanceof ApiError
      && query.state.error.code === "RESULT_PROCESSING" ? 1_000 : false,
  });
  if (room.isLoading) return <StatusPanel title="면접 결과를 정리하고 있어요" />;
  if (room.error || !room.data) return <StatusPanel title="면접 정보를 불러오지 못했어요" detail={room.error?.message} onRetry={() => void room.refetch()} />;
  if (room.data.practice_type !== "interview" || room.data.status === "in_progress") return <Navigate to={`/rooms/${roomId}`} replace />;
  const seconds = Math.max(0, Math.round((new Date(room.data.completed_at ?? room.data.updated_at).getTime() - new Date(room.data.started_at).getTime()) / 1000));
  const elapsed = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return <div className={`${styles.page} ${styles.interviewCompletePage}`}>
    <BackHeader title="면접" onBack={() => navigate("/rooms")} />
    <main aria-live="polite">
      <span className={styles.interviewCompleteIcon}>✓</span>
      <h1>면접이 종료되었습니다</h1>
      <p>답변이 모두 안전하게 저장되었습니다.<br />종합 피드백에서 표현과 어투를 확인해보세요.</p>
      <div><strong>총 진행 시간&nbsp; {elapsed}</strong><strong>답변 {room.data.turn_count}개 저장 완료</strong></div>
      {result.data ? <Link className={styles.primaryLink} to={`/rooms/${roomId}/result`}>종합 피드백 확인</Link>
        : <button className={styles.primaryButton} disabled>종합 피드백 정리 중…</button>}
      {result.error && (!(result.error instanceof ApiError) || result.error.code !== "RESULT_PROCESSING")
        && <div className={styles.partialError} role="alert"><strong>종합 피드백을 준비하지 못했어요.</strong><span>{result.error.message}</span><button type="button" onClick={() => void result.refetch()}>다시 확인</button></div>}
    </main>
  </div>;
}
