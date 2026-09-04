import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type Room } from "../../api/service";
import { BackHeader } from "../../components/ui/BackHeader";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import styles from "./RoomListPage.module.css";

const LONG_PRESS_MILLISECONDS = 500;

function practiceLabel(practiceType: string) {
  if (practiceType === "interview") return "면접";
  return practiceType === "scenario" ? "상황 연습" : "자유 대화";
}

export function RoomListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const rooms = useQuery({ queryKey: ["rooms"], queryFn: api.rooms });
  const [target, setTarget] = useState<Room | null>(null);
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const remove = useMutation({
    mutationFn: (roomId: string) => api.deleteRoom(roomId),
    onSuccess: async () => {
      setTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
  });

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const startPress = (room: Room) => {
    longPressed.current = false;
    clearTimer();
    timer.current = window.setTimeout(() => {
      longPressed.current = true;
      setTarget(room);
    }, LONG_PRESS_MILLISECONDS);
  };

  return (
    <div className={styles.page}>
      <BackHeader title="대화 목록" onBack={() => navigate("/")} />
      <p className={styles.code}>L01</p>
      <h1>대화 목록</h1>
      <p className={styles.subtitle}>Chat history</p>
      {rooms.isLoading && <p className={styles.empty}>대화 목록을 불러오고 있어요.</p>}
      {rooms.isError && <p className={styles.empty}>대화 목록을 불러오지 못했어요.</p>}
      <div className={styles.list}>
        {rooms.data?.items.map((room) => (
          <div key={room.id} className={styles.row}>
            <Link
              to={`/rooms/${room.id}`}
              state={{ from: "/rooms" }}
              onPointerDown={() => startPress(room)}
              onPointerUp={clearTimer}
              onPointerLeave={clearTimer}
              onContextMenu={(event) => {
                event.preventDefault();
                setTarget(room);
              }}
              onClick={(event) => {
                // 꾹 눌러 삭제 팝업을 띄운 경우에는 대화방으로 이동하지 않는다.
                if (longPressed.current) event.preventDefault();
              }}
            >
              <span>{practiceLabel(room.practice_type)}</span>
              <strong>{room.title}</strong>
              <small>
                {new Date(room.updated_at).toLocaleDateString("ko-KR")} · {room.turn_count}턴
              </small>
            </Link>
            <button
              type="button"
              className={styles.more}
              aria-label={`${room.title} 대화방 관리`}
              onClick={() => setTarget(room)}
            >
              ⋯
            </button>
          </div>
        ))}
      </div>
      {!rooms.isLoading && rooms.data?.items.length === 0 && (
        <p className={styles.empty}>아직 대화 내역이 없어요.</p>
      )}
      {target && (
        <ConfirmDialog
          title="대화방을 삭제할까요?"
          description="삭제한 대화방과 대화 기록은 복구할 수 없습니다."
          subject={{ name: target.title, caption: practiceLabel(target.practice_type) }}
          confirmLabel="삭제"
          pendingLabel="삭제 중…"
          pending={remove.isPending}
          error={remove.error?.message}
          onConfirm={() => remove.mutate(target.id)}
          onCancel={() => setTarget(null)}
        />
      )}
    </div>
  );
}
