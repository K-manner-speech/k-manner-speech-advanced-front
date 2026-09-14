import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { api } from "../../api/service";
import { usePreferences } from "../../store/preferences";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { SelectField } from "../../components/ui/SelectField";
import { AuthLayout } from "./AuthLayout";
import styles from "./AuthLayout.module.css";
import languageStyles from "./LanguageChoice.module.css";

const schema = z.object({
  display_name: z.string().trim().min(1, "이름을 입력해 주세요."),
  birth_date: z.string().min(1, "생년월일을 선택해 주세요."),
  gender: z.string().min(1, "성별을 선택해 주세요."),
  native_language: z.enum(["Korean", "English", "Japanese", "Chinese"], {
    error: "모국어를 선택해 주세요.",
  }),
});
type Values = z.infer<typeof schema>;

const GENDERS = [
  { value: "female", label: "여성 · Female" },
  { value: "male", label: "남성 · Male" },
  { value: "other", label: "기타 · Prefer not to say" },
];
const NATIVE_LANGUAGES = [
  { value: "Korean", label: "한국어 · Korean" },
  { value: "English", label: "영어 · English" },
  { value: "Japanese", label: "일본어 · Japanese" },
  { value: "Chinese", label: "중국어 · Chinese" },
];
const DISPLAY_LANGUAGES = [
  { value: "ko", glyph: "가", title: "한국어", subtitle: "Korean" },
  { value: "en", glyph: "A", title: "English", subtitle: "영어" },
] as const;

export function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"profile" | "language">("profile");
  const [displayLanguage, setDisplayLanguage] = useState<"ko" | "en">("ko");
  const setLanguage = usePreferences((state) => state.setLanguage);
  const form = useForm<Values>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      await api.saveProfile(values);
      await api.saveLanguage(displayLanguage);
      // 약관 동의는 A03 에서 받았지만 그때는 세션이 없어 기록할 수 없다.
      // 로그인 뒤 첫 저장 시점에 남긴다.
      await api.saveTerms([
        { consent_type: "terms", policy_version: "v1", accepted: true },
        { consent_type: "privacy", policy_version: "v1", accepted: true },
      ]);
      return api.completeOnboarding();
    },
    onSuccess: async () => {
      setLanguage(displayLanguage);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/", { replace: true });
    },
  });

  const goToLanguage = form.handleSubmit(() => setStep("language"));

  if (step === "language") {
    return (
      <AuthLayout title={"사용할 언어를\n선택해 주세요"} titleId="language-title">
        <div className={languageStyles.choices} role="radiogroup" aria-labelledby="language-title">
          {DISPLAY_LANGUAGES.map((option) => {
            const selected = displayLanguage === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`${languageStyles.choice} ${selected ? languageStyles.selected : ""}`}
                onClick={() => setDisplayLanguage(option.value)}
              >
                <span className={languageStyles.glyph} aria-hidden="true">{option.glyph}</span>
                <span className={languageStyles.text}>
                  <b>{option.title}</b>
                  <small>{option.subtitle}</small>
                </span>
                <span className={languageStyles.check} aria-hidden="true">{selected ? "✓" : ""}</span>
              </button>
            );
          })}
        </div>

        <p className={languageStyles.notice}>
          <span className={languageStyles.noticeIcon} aria-hidden="true">i</span>
          <span>
            <b>언어는 언제든 설정에서 변경할 수 있어요.</b>
            프로필 설정에서 원하는 언어를 다시 선택할 수 있어요.
          </span>
        </p>

        {mutation.error && <div className={styles.error} role="alert">{mutation.error.message}</div>}

        <div className={styles.action}>
          <Button
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(form.getValues())}
          >
            {mutation.isPending ? "저장 중…" : "확인 · Confirm"}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={"K-Manner Speech와\n프로필을 설정해요"}
      titleId="profile-title"
      step="가입 2/2 · Profile"
      onBack={() => navigate("/login")}
    >
      <form className={styles.form} onSubmit={goToLanguage} noValidate>
        <div className={styles.card}>
          <Field
            label="이름 · Name"
            placeholder="이름 입력 · Enter name"
            autoComplete="name"
            error={form.formState.errors.display_name?.message}
            {...form.register("display_name")}
          />
          <Field
            label="생년월일 · Date of birth"
            type="date"
            placeholder="날짜 선택 · Select date"
            error={form.formState.errors.birth_date?.message}
            {...form.register("birth_date")}
          />
          <SelectField
            label="성별 · Gender"
            placeholder="성별 선택 · Select gender"
            options={GENDERS}
            error={form.formState.errors.gender?.message}
            {...form.register("gender")}
          />
          <SelectField
            label="모국어 · Native language"
            placeholder="모국어 선택 · Select language"
            options={NATIVE_LANGUAGES}
            error={form.formState.errors.native_language?.message}
            {...form.register("native_language")}
          />
        </div>

        <div className={styles.action}>
          <Button type="submit">가입 완료 · Complete sign up</Button>
        </div>
      </form>
    </AuthLayout>
  );
}
