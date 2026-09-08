import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../api/service";
import { Button } from "../../components/ui/Button";
import { StatusPanel } from "../../components/ui/StatusPanel";
import styles from "./HomePage.module.css";

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "쉬움",
  medium: "보통",
  hard: "어려움",
};

export function HomePage() {
  const queryClient = useQueryClient();
  const home = useQuery({ queryKey: ["home"], queryFn: api.home });
  const attend = useMutation({
    mutationFn: api.attend,
    onSuccess: (summary) => queryClient.setQueryData(["home"], summary),
  });

  if (home.isLoading) return <StatusPanel title="오늘의 학습을 준비하고 있어요" />;
  if (home.error) {
    return (
      <StatusPanel
        title="홈을 불러오지 못했어요"
        detail={home.error.message}
        onRetry={() => void home.refetch()}
      />
    );
  }

  const streak = home.data?.streak;
  const recommendation = home.data?.recommendation;

  return (
    <div className={styles.page}>
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true">K</span>
        <span className={styles.name}>K-MANNER SPEECH</span>
      </div>

      {streak && (
        <section className={styles.streak} aria-labelledby="streak-title">
          <div className={styles.streakHead}>
            <h2 className={styles.streakTitle} id="streak-title">
              {streak.streak_days > 0
                ? `${streak.streak_days}일 연속 학습 중`
                : "오늘부터 시작해요"}
            </h2>
            <span className={styles.streakGoal}>
              {streak.goal_days}일 목표 · {streak.recent_days}/{streak.goal_days}
            </span>
          </div>
          <div
            className={styles.track}
            role="img"
            aria-label={`최근 ${streak.goal_days}일 중 ${streak.recent_days}일 출석`}
          >
            {Array.from({ length: streak.goal_days }, (_, index) => (
              <span
                key={index}
                className={`${styles.segment} ${index < streak.recent_days ? styles.segmentFilled : ""}`}
              />
            ))}
          </div>
          {streak.attended_today ? (
            <p className={styles.attended}>✓ 오늘 출석 완료</p>
          ) : (
            <Button
              compact
              disabled={attend.isPending}
              onClick={() => attend.mutate()}
            >
              {attend.isPending ? "기록하는 중…" : "출석하기"}
            </Button>
          )}
        </section>
      )}

      {recommendation ? (
        <section className={styles.recommend} aria-labelledby="recommend-title">
          <div className={styles.recommendHead}>
            <span>오늘의 추천</span>
            <span>말하기 연습</span>
          </div>
          <h2 className={styles.recommendTitle} id="recommend-title">{recommendation.title}</h2>

          {recommendation.opening_message && (
            <div className={styles.preview}>
              <div className={styles.previewWho}>
                <b>
                  {recommendation.persona_name}
                  {recommendation.relationship_label && ` · ${recommendation.relationship_label}`}
                </b>
              </div>
              <p className={styles.previewHint}>이렇게 말을 걸어보세요</p>
              <p className={styles.previewLine}>“{recommendation.opening_message}”</p>
            </div>
          )}

          <p className={styles.meta}>
            {[
              recommendation.goal,
              recommendation.difficulty
                ? DIFFICULTY_LABELS[recommendation.difficulty] ?? recommendation.difficulty
                : null,
              recommendation.estimated_minutes ? `${recommendation.estimated_minutes}분` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          <Link className={styles.start} to="/practice">이 대화 시작하기 ↗</Link>
        </section>
      ) : (
        <p className={styles.empty}>
          아직 추천할 연습을 고르지 못했어요. 연습 유형을 직접 골라 시작해 보세요.
        </p>
      )}

      <section className={styles.feedback}>
        <h2>피드백 모아보기</h2>
        <div className={styles.feedbackRow}>
          <p>지난 연습의 표현과 피드백을 확인해요.</p>
          <Link className={styles.feedbackLink} to="/results">보기 →</Link>
        </div>
      </section>
    </div>
  );
}
