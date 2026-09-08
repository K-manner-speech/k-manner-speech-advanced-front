import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/service";
import { Button } from "../../components/ui/Button";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { StatusPanel } from "../../components/ui/StatusPanel";
import styles from "./LanguageSettingPage.module.css";

type Option = { value: string; name: string; sub: string };

// 표시 언어는 서버가 ko·en 만 받는다. 시안에는 네 가지가 있지만 고르면 아무
// 일도 일어나지 않는 줄을 만들지 않는다. 서버가 늘면 여기도 늘린다.
const DISPLAY_OPTIONS: Option[] = [
  { value: "ko", name: "한국어", sub: "Korean" },
  { value: "en", name: "English", sub: "English" },
];

const NATIVE_OPTIONS: Option[] = [
  { value: "English", name: "English", sub: "영어" },
  { value: "Japanese", name: "日本語", sub: "일본어" },
  { value: "Chinese", name: "中文", sub: "중국어" },
];

const COPY = {
  native: {
    title: "모국어",
    lead: "당신의 모국어를 선택하세요",
    noticeTitle: "언어는 언제든 다시 변경할 수 있어요",
    noticeBody: "선택한 언어를 바탕으로 대화 연습을 안내해요.",
    options: NATIVE_OPTIONS,
  },
  display: {
    title: "표시 언어",
    lead: "앱의 메뉴와 안내 문구에 사용할 언어를 선택해요",
    noticeTitle: "언어는 언제든 다시 변경할 수 있어요",
    noticeBody: "앱의 메뉴와 안내 문구에 적용돼요.",
    options: DISPLAY_OPTIONS,
  },
} as const;

export function LanguageSettingPage({ kind }: { kind: "native" | "display" }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const [picked, setPicked] = useState<string | null>(null);
  const copy = COPY[kind];

  const save = useMutation({
    mutationFn: async (value: string) => {
      if (kind === "display") return api.saveLanguage(value as "ko" | "en");
      // 프로필은 통째로 바꾸는 API 라 나머지 값을 그대로 실어 보낸다.
      const profile = me.data!.profile;
      return api.saveProfile({
        display_name: profile.display_name ?? "",
        birth_date: profile.birth_date ?? "",
        gender: profile.gender ?? "",
        native_language: value,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/me", { replace: true });
    },
  });

  if (me.isLoading) return <StatusPanel title="설정을 불러오고 있어요" />;
  if (me.error || !me.data) {
    return <StatusPanel title="설정을 불러오지 못했어요" detail={me.error?.message} onRetry={() => void me.refetch()} />;
  }

  const saved = kind === "display" ? me.data.display_language : me.data.profile.native_language;
  const selected = picked ?? saved ?? "";

  return (
    <div className={styles.page}>
      <ScreenHeader title={copy.title} onBack={() => navigate(-1)} />
      <p className={styles.lead}>{copy.lead}</p>

      <h2 className={styles.sectionTitle}>언어 선택</h2>
      <div className={styles.options} role="radiogroup" aria-label={copy.title}>
        {copy.options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={option.value === selected}
            className={styles.option}
            onClick={() => setPicked(option.value)}
          >
            <span className={styles.optionText}>
              <b>{option.name}</b>
              <small>{option.sub}</small>
            </span>
            {option.value === selected && <span className={styles.check} aria-hidden="true">✓</span>}
          </button>
        ))}
      </div>

      <div className={styles.notice}>
        <strong>{copy.noticeTitle}</strong>
        <span>{copy.noticeBody}</span>
      </div>

      {save.error && <p className={styles.error} role="alert">{save.error.message}</p>}

      <div className={styles.action}>
        <Button
          disabled={!selected || selected === saved || save.isPending}
          onClick={() => save.mutate(selected)}
        >
          {save.isPending ? "저장 중…" : "선택 완료"}
        </Button>
      </div>
    </div>
  );
}
