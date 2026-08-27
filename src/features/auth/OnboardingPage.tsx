import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { api } from "../../api/service";
import styles from "../../components/ui/Pages.module.css";

const schema = z.object({
  display_name: z.string().trim().min(1, "이름을 입력해 주세요."),
  birth_date: z.string().min(1, "생년월일을 선택해 주세요."),
  gender: z.string().min(1, "성별을 선택해 주세요."),
  native_language: z.enum(["English", "Japanese", "Chinese"], {
    error: "모국어를 선택해 주세요.",
  }),
  display_language: z.enum(["ko", "en"]),
  terms: z.literal(true, { error: "필수 약관에 동의해 주세요." }),
});
type Values = z.infer<typeof schema>;

export function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { display_language: "ko", terms: false as never },
  });
  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      await api.saveProfile({
        display_name: values.display_name,
        birth_date: values.birth_date,
        gender: values.gender,
        native_language: values.native_language,
      });
      await api.saveLanguage(values.display_language);
      await api.saveTerms([
        { consent_type: "terms", policy_version: "v1", accepted: true },
        { consent_type: "privacy", policy_version: "v1", accepted: true },
      ]);
      return api.completeOnboarding();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/", { replace: true });
    },
  });

  return (
    <main className={styles.centerPage}>
      <section className={styles.panel} aria-labelledby="onboarding-title">
        <p className={styles.eyebrow}>첫 연습 전 한 번만</p>
        <h1 id="onboarding-title">기본 정보를 확인해 주세요</h1>
        <p className={styles.lead}>AI 코칭과 화면 언어에 필요한 최소 정보만 사용합니다.</p>
        <form className={styles.formGrid} onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
          <label>이름<input {...form.register("display_name")} /></label>
          <label>생년월일<input type="date" {...form.register("birth_date")} /></label>
          <label>성별<select {...form.register("gender")}><option value="">선택</option><option value="female">여성</option><option value="male">남성</option><option value="other">기타/응답하지 않음</option></select></label>
          <label>모국어<select {...form.register("native_language")}><option value="">선택</option><option value="English">영어</option><option value="Japanese">일본어</option><option value="Chinese">중국어</option></select></label>
          <fieldset className={styles.fullWidth}>
            <legend>화면 언어</legend>
            <label className={styles.inline}><input type="radio" value="ko" {...form.register("display_language")} />한국어</label>
            <label className={styles.inline}><input type="radio" value="en" {...form.register("display_language")} />English</label>
          </fieldset>
          <label className={`${styles.inline} ${styles.fullWidth}`}>
            <input type="checkbox" {...form.register("terms")} /> 이용약관과 개인정보 처리에 동의합니다. (필수)
          </label>
          {Object.values(form.formState.errors)[0]?.message && <div role="alert" className={`${styles.error} ${styles.fullWidth}`}>{Object.values(form.formState.errors)[0]?.message}</div>}
          {mutation.error && <div role="alert" className={`${styles.error} ${styles.fullWidth}`}>{mutation.error.message}</div>}
          <button className={`${styles.primaryButton} ${styles.fullWidth}`} disabled={mutation.isPending}>저장하고 시작하기</button>
        </form>
      </section>
    </main>
  );
}
