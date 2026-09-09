import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { api, waitForTerminal } from "../../api/service";
import { ApiError } from "../../api/http";
import { Button } from "../../components/ui/Button";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { StatusPanel } from "../../components/ui/StatusPanel";
import styles from "./InterviewCompletePage.module.css";

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
  const createResult = useMutation({
    mutationFn: async () => {
      const accepted = await api.retryResult(roomId);
      return waitForTerminal(() => api.job(accepted.job.job_id), "succeeded", 190_000);
    },
    onSettled: async () => { await result.refetch(); },
  });
  if (room.isLoading) return <StatusPanel title="면접 결과를 정리하고 있어요" />;
  if (room.error || !room.data) return <StatusPanel title="면접 정보를 불러오지 못했어요" detail={room.error?.message} onRetry={() => void room.refetch()} />;
  if (room.data.practice_type !== "interview" || room.data.status === "in_progress") return <Navigate to={`/rooms/${roomId}`} replace />;
  const seconds = Math.max(0, Math.round((new Date(room.data.completed_at ?? room.data.updated_at).getTime() - new Date(room.data.started_at).getTime()) / 1000));
  const elapsed = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const resultMissing = result.error instanceof ApiError && result.error.code === "RESULT_NOT_FOUND";
  return (
    <div className={styles.page}>
      <ScreenHeader title="면접" onBack={() => navigate("/rooms")} />
      <main className={styles.body} aria-live="polite">
        <span className={styles.icon} aria-hidden="true">✓</span>
        <h1 className={styles.title}>면접이 종료되었습니다</h1>
        <p className={styles.lead}>
          답변이 모두 안전하게 저장되었습니다.<br />종합 피드백에서 표현과 어투를 확인해보세요.
        </p>
        <div className={styles.facts}>
          <strong>총 진행 시간 {elapsed}</strong>
          <strong>답변 {room.data.turn_count}개 저장 완료</strong>
        </div>

        {createResult.error && (
          <div className={styles.notice} role="alert">
            <strong>종합 피드백 생성에 실패했어요.</strong>
            <span>{createResult.error.message}</span>
          </div>
        )}
        {result.error && !resultMissing
          && (!(result.error instanceof ApiError) || result.error.code !== "RESULT_PROCESSING") && (
          <div className={styles.notice} role="alert">
            <strong>종합 피드백을 준비하지 못했어요.</strong>
            <span>{result.error.message}</span>
            <Button variant="secondary" compact onClick={() => void result.refetch()}>다시 확인</Button>
          </div>
        )}

        <div className={styles.action}>
          {result.data ? (
            <Link className={styles.link} to={`/rooms/${roomId}/result`}>종합 피드백 확인</Link>
          ) : resultMissing ? (
            <Button disabled={createResult.isPending} onClick={() => createResult.mutate()}>
              {createResult.isPending ? "종합 피드백 생성 중…" : "종합 피드백 생성"}
            </Button>
          ) : (
            <Button disabled>종합 피드백 정리 중…</Button>
          )}
        </div>
      </main>
    </div>
  );
}
