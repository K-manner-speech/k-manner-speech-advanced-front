import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { api } from "../../api/service";
import { useAuth } from "../auth";
import styles from "./ProfileEditPage.module.css";

const schema = z.object({
  display_name: z.string().trim().min(1, "이름을 입력해 주세요."),
  birth_date: z.string().min(1, "생년월일을 선택해 주세요."),
  gender: z.string().min(1, "성별을 선택해 주세요."),
  native_language: z.enum(["English", "Japanese", "Chinese"]),
  display_language: z.enum(["ko", "en"]),
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
    const profile = me.data.profile;
    form.reset({
      display_name: profile.display_name ?? "",
      birth_date: profile.birth_date ?? "",
      gender: profile.gender ?? "",
      native_language: (["English", "Japanese", "Chinese"].includes(profile.native_language ?? "") ? profile.native_language : "English") as Values["native_language"],
      display_language: me.data.display_language,
    });
  }, [form, me.data]);
  const save = useMutation({
    mutationFn: async (values: Values) => {
      await api.saveProfile({
        display_name: values.display_name,
        birth_date: values.birth_date,
        gender: values.gender,
        native_language: values.native_language,
      });
      return api.saveLanguage(values.display_language);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/me", { replace: true });
    },
  });
  return <form className={styles.page} onSubmit={form.handleSubmit((values) => save.mutate(values))}>
    <div className={styles.topRow}><button type="button" onClick={() => navigate(-1)} aria-label="뒤로 가기">‹</button><strong>프로필 수정</strong></div>
    <p className={styles.code}>M02</p><h1>프로필 수정</h1><p className={styles.subtitle}>Edit profile</p>
    <div className={styles.fields}>
      <label>이름 · Name<input {...form.register("display_name")} /></label>
      <label>생년월일 · Date of birth<input type="date" {...form.register("birth_date")} /></label>
      <label>성별 · Gender<select {...form.register("gender")}><option value="">선택</option><option value="female">여성</option><option value="male">남성</option><option value="other">기타/응답하지 않음</option></select></label>
      <label>이메일 · Email<input value={session?.user.email ?? ""} readOnly /></label>
      <label>모국어 · Native language<select {...form.register("native_language")}><option value="English">영어</option><option value="Japanese">일본어</option><option value="Chinese">중국어</option></select></label>
      <label>표시 언어 · Display language<select {...form.register("display_language")}><option value="ko">한국어</option><option value="en">English</option></select></label>
    </div>
    {Object.values(form.formState.errors)[0]?.message && <p role="alert" className={styles.error}>{Object.values(form.formState.errors)[0]?.message}</p>}
    {save.error && <p role="alert" className={styles.error}>{save.error.message}</p>}
    <button type="button" className={styles.passwordButton} onClick={() => window.alert("비밀번호 변경 기능은 추후 연결됩니다.")}>비밀번호 변경 · Change password</button>
    <button className={styles.saveButton} disabled={save.isPending}>변경사항 저장 · Save</button>
  </form>;
}
