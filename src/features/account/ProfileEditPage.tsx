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
import { SelectField } from "../../components/ui/SelectField";
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
  return (
    <form className={styles.page} onSubmit={form.handleSubmit((values) => save.mutate(values))}>
      <ScreenHeader title="프로필 수정" onBack={() => navigate(-1)} />
      <div className={styles.card}>
        <Field label="이름 · Name" placeholder="이름 입력" {...form.register("display_name")} />
        <Field label="생년월일 · Date of birth" type="date" {...form.register("birth_date")} />
        <SelectField
          label="성별 · Gender"
          placeholder="성별 선택"
          options={[
            { value: "female", label: "여성 · Female" },
            { value: "male", label: "남성 · Male" },
            { value: "other", label: "기타 · Prefer not to say" },
          ]}
          {...form.register("gender")}
        />
        {/* 이메일 변경은 아직 서버에 방법이 없다. 보여 주되 고칠 수 없음을 알린다. */}
        <Field label="이메일 · Email" value={session?.user.email ?? ""} readOnly />
        <SelectField
          label="모국어 · Native language"
          placeholder="모국어 선택"
          options={[
            { value: "English", label: "영어 · English" },
            { value: "Japanese", label: "일본어 · Japanese" },
            { value: "Chinese", label: "중국어 · Chinese" },
          ]}
          {...form.register("native_language")}
        />
        <SelectField
          label="표시 언어 · Display language"
          placeholder="표시 언어 선택"
          options={[
            { value: "ko", label: "한국어" },
            { value: "en", label: "English" },
          ]}
          {...form.register("display_language")}
        />
      </div>

      {Object.values(form.formState.errors)[0]?.message && (
        <p role="alert" className={styles.error}>{Object.values(form.formState.errors)[0]?.message}</p>
      )}
      {save.error && <p role="alert" className={styles.error}>{save.error.message}</p>}

      <div className={styles.action}>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "저장 중…" : "변경사항 저장"}
        </Button>
      </div>
    </form>
  );
}
