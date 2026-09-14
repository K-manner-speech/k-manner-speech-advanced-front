import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { api } from "../../api/service";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { StatusPanel } from "../../components/ui/StatusPanel";
import { useAuth } from "../auth";
import styles from "./ProfileEditPage.module.css";

const schema = z.object({
  display_name: z.string().trim().min(1, "이름을 입력해 주세요."),
  birth_date: z.string().min(1, "생년월일을 선택해 주세요."),
});
type Values = z.infer<typeof schema>;

export function ProfileEditPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  useEffect(() => {
    if (!me.data) return;
    form.reset({
      display_name: me.data.profile.display_name ?? "",
      birth_date: me.data.profile.birth_date ?? "",
    });
  }, [form, me.data]);

  const save = useMutation({
    // 프로필은 통째로 바꾸는 API 다. 이 화면이 다루지 않는 값도 그대로 실어
    // 보내지 않으면 성별과 모국어가 지워진다.
    mutationFn: (values: Values) => api.saveProfile({
      display_name: values.display_name,
      birth_date: values.birth_date,
      gender: me.data?.profile.gender ?? "",
      native_language: me.data?.profile.native_language ?? "",
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/me", { replace: true });
    },
  });

  if (me.isLoading) return <StatusPanel title="프로필을 불러오고 있어요" />;
  if (me.error || !me.data) {
    return <StatusPanel title="프로필을 불러오지 못했어요" detail={me.error?.message} onRetry={() => void me.refetch()} />;
  }

  const name = me.data.profile.display_name ?? "";
  return (
    <form className={styles.page} onSubmit={form.handleSubmit((values) => save.mutate(values))}>
      <ScreenHeader title="프로필 수정" onBack={() => navigate(-1)} />

      <div className={styles.identity}>
        <span className={styles.avatar} aria-hidden="true">{name.slice(0, 1) || "?"}</span>
        <b>{name ? `${name}님` : "학습자님"}</b>
        <small>{session?.user.email ?? "-"}</small>
      </div>

      <h2 className={styles.sectionTitle}>기본 정보</h2>
      <div className={styles.card}>
        <Field
          label="이름"
          placeholder="이름 입력"
          error={form.formState.errors.display_name?.message}
          {...form.register("display_name")}
        />
        <Field
          label="생년월일"
          type="date"
          error={form.formState.errors.birth_date?.message}
          {...form.register("birth_date")}
        />
      </div>

      <h2 className={styles.sectionTitle}>알림</h2>
      <div className={styles.notice}>
        <strong>이름은 대화 피드백에만 사용돼요</strong>
        <span>다른 사용자에게 공개되지 않아요.</span>
      </div>

      {save.error && <p role="alert" className={styles.error}>{save.error.message}</p>}

      <div className={styles.action}>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "저장 중…" : "수정 완료"}
        </Button>
      </div>
    </form>
  );
}
