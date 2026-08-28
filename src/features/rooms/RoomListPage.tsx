import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/service";
import { BackHeader } from "../../components/ui/BackHeader";
import styles from "./RoomListPage.module.css";

export function RoomListPage() {
  const navigate = useNavigate();
  const rooms = useQuery({ queryKey: ["rooms"], queryFn: api.rooms });
  return <div className={styles.page}>
    <BackHeader title="대화 목록" onBack={() => navigate("/")} /><p className={styles.code}>L01</p><h1>대화 목록</h1><p className={styles.subtitle}>Chat history</p>
    {rooms.isLoading && <p className={styles.empty}>대화 목록을 불러오고 있어요.</p>}
    {rooms.isError && <p className={styles.empty}>대화 목록을 불러오지 못했어요.</p>}
    <div className={styles.list}>{rooms.data?.items.map((room) => <Link key={room.id} to={`/rooms/${room.id}`} state={{ from: "/rooms" }}>
      <span>{room.practice_type === "interview" ? "면접" : room.practice_type === "scenario" ? "상황 연습" : "자유 대화"}</span>
      <strong>{room.title}</strong><small>{new Date(room.updated_at).toLocaleDateString("ko-KR")} · {room.turn_count}턴</small>
    </Link>)}</div>
    {!rooms.isLoading && rooms.data?.items.length === 0 && <p className={styles.empty}>아직 대화 내역이 없어요.</p>}
  </div>;
}
