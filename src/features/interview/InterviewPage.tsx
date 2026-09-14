import { useMutation } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api, waitForTerminal, type ApplicationType } from "../../api/service";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { SelectField } from "../../components/ui/SelectField";
import { usePreferences } from "../../store/preferences";
import styles from "./InterviewPage.module.css";

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const SUPPORTED_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
type Screen = "conditions" | "attachments" | "preparing" | "confirmation";
type Stage = "uploading" | "analyzing" | "generating";
type DocumentType = "resume" | "portfolio" | "self_introduction";

const APPLICATION_TYPES = ["신입", "경력", "인턴"] as const satisfies readonly ApplicationType[];
const APPLICATION_TYPE_LABELS: Record<ApplicationType, string> = {
  신입: "Entry-level",
  경력: "Experienced",
  인턴: "Intern",
};

function isApplicationType(value: string): value is ApplicationType {
  return (APPLICATION_TYPES as readonly string[]).includes(value);
}

export function InterviewPage() {
  const en = usePreferences((state) => state.language) === "en";
  const tr = (ko: string, english: string) => en ? english : ko;
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>("conditions");
  const [stage, setStage] = useState<Stage>("uploading");
  const [desiredRole, setDesiredRole] = useState(en ? "Backend Developer" : "백엔드 개발자");
  const [applicationType, setApplicationType] = useState<ApplicationType>("신입");
  const [files, setFiles] = useState<Partial<Record<DocumentType, File>>>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [configurationId, setConfigurationId] = useState<string | null>(null);

  const prepare = useMutation({
    mutationFn: async () => {
      if (!files.resume) throw new Error("이력서 파일을 먼저 선택해 주세요.");
      setScreen("preparing");
      setStage("uploading");
      const setup = await api.createInterviewSetup(desiredRole.trim(), applicationType);
      const uploaded = [];
      for (const [documentType, selectedFile] of Object.entries(files) as [DocumentType, File][]) {
        uploaded.push(await api.uploadInterviewDocument(setup.id, selectedFile, documentType));
      }
      setStage("analyzing");
      const analysisIds = [];
      for (const document of uploaded) {
        const accepted = await api.analyzeDocument(document.id);
        await waitForTerminal(() => api.analysis(accepted.analysis_id), "succeeded");
        analysisIds.push(accepted.analysis_id);
      }
      setStage("generating");
      const configuration = await api.createInterviewConfiguration(setup.id, analysisIds);
      await waitForTerminal(() => api.interviewConfiguration(configuration.configuration_id), "ready");
      const questions = await api.interviewQuestions(configuration.configuration_id);
      if (!questions.questions.length) throw new Error("생성된 질문이 없습니다. 다시 준비해 주세요.");
      return configuration.configuration_id;
    },
    onSuccess: (id) => { setConfigurationId(id); setScreen("confirmation"); },
    onError: () => setScreen("attachments"),
  });

  const startInterview = useMutation({
    mutationFn: async () => {
      if (!configurationId) throw new Error("면접 구성을 먼저 완료해 주세요.");
      return (await api.createInterviewRoom(configurationId)).id;
    },
    onSuccess: (roomId) => navigate(`/rooms/${roomId}?configuration=${configurationId}`),
  });

  const chooseFile = (documentType: DocumentType, nextFile?: File) => {
    setFileError(null);
    if (!nextFile) return setFiles((current) => ({ ...current, [documentType]: undefined }));
    if (!SUPPORTED_TYPES.includes(nextFile.type) && !/\.(pdf|docx)$/i.test(nextFile.name)) {
      setFileError("PDF 또는 DOCX 파일만 업로드할 수 있습니다.");
      return;
    }
    if (nextFile.size > MAX_DOCUMENT_BYTES) {
      setFileError("AC-T4-DOCUMENT-LIMIT: 파일은 10MB 이하만 업로드할 수 있습니다.");
      return;
    }
    setFiles((current) => ({ ...current, [documentType]: nextFile }));
  };

  const goBack = () => {
    if (screen === "attachments") setScreen("conditions");
    else if (screen === "confirmation") setScreen("attachments");
    else navigate("/practice");
  };

  if (screen === "conditions") return <InterviewFrame onBack={goBack}>
    {/* 줄바꿈이 접근성 이름에 섞이지 않도록 한 줄로 읽히는 이름을 따로 준다. */}
    <h1 className={styles.headline} aria-label={tr("지원 정보를 입력해 주세요", "Enter your application details")}>{tr("지원 정보를", "Enter your application")}<br />{tr("입력해 주세요", "details")}</h1>
    <div className={styles.card}>
      <Field
        label={tr("희망 직무", "Desired Role")}
        aria-label={tr("희망 직무", "Desired Role")}
        value={desiredRole}
        onChange={(event) => setDesiredRole(event.target.value)}
        maxLength={200}
        placeholder={tr("희망 직무를 입력해 주세요", "Enter your desired role")}
      />
      <SelectField
        label={tr("지원 유형", "Application Type")}
        aria-label={tr("지원 유형", "Application Type")}
        placeholder={tr("지원 유형을 입력해 주세요", "Select an application type")}
        value={applicationType}
        // select 는 문자열만 돌려준다. 계약에 있는 값인지 확인하고 받는다.
        onChange={(event) => {
          const value = event.target.value;
          if (isApplicationType(value)) setApplicationType(value);
        }}
        options={APPLICATION_TYPES.map((value) => ({
          value,
          label: tr(value, APPLICATION_TYPE_LABELS[value]),
        }))}
      />
    </div>
    <div className={styles.actions}>
      <Button disabled={!desiredRole.trim()} onClick={() => setScreen("attachments")}>{tr("다음", "Next")}</Button>
    </div>
  </InterviewFrame>;

  if (screen === "attachments") return <InterviewFrame onBack={goBack}>
    <h1 className={styles.headline} aria-label={tr("면접 자료를 첨부해 주세요", "Attach your interview materials")}>{tr("면접 자료를", "Attach your interview")}<br />{tr("첨부해 주세요", "materials")}</h1>
    <p className={styles.lead}>{tr("이력서는 필수예요. 포트폴리오와 자기소개서를 추가하면 맞춤 질문이 더 정교해져요.", "A résumé is required. Adding a portfolio or cover letter will make the questions more personalized.")}</p>
    <div className={styles.attachments}>
      <Attachment label={tr("이력서 (필수)", "Résumé (Required)")} detail={tr("PDF 또는 DOCX · 최대 10MB", "PDF or DOCX · Up to 10MB")} file={files.resume} onChange={(file) => chooseFile("resume", file)} en={en} />
      <Attachment label={tr("포트폴리오 (선택)", "Portfolio (Optional)")} detail={tr("PDF 또는 DOCX · 최대 10MB", "PDF or DOCX · Up to 10MB")} file={files.portfolio} onChange={(file) => chooseFile("portfolio", file)} en={en} />
      <Attachment label={tr("자기소개서 (선택)", "Cover Letter (Optional)")} detail={tr("PDF 또는 DOCX · 최대 10MB", "PDF or DOCX · Up to 10MB")} file={files.self_introduction} onChange={(file) => chooseFile("self_introduction", file)} en={en} />
    </div>
    <div className={styles.info}>✓ {tr("이력서를 첨부해야 면접 질문 분석을 시작할 수 있어요.", "Attach a résumé to start generating interview questions.")}</div>
    {fileError && <div className={styles.error} role="alert">{fileError}</div>}
    {prepare.error && <div className={styles.notice} role="alert"><strong>면접 준비를 완료하지 못했어요.</strong><span>{prepare.error.message}</span><small>선택한 파일은 유지됩니다. 상태를 확인하고 다시 시도해 주세요.</small></div>}
    <div className={styles.actions}>
      <Button disabled={!files.resume || prepare.isPending} onClick={() => prepare.mutate()}>{tr("첨부한 자료로 분석하기", "Analyze Attached Materials")}</Button>
    </div>
  </InterviewFrame>;

  if (screen === "preparing") return <InterviewFrame onBack={goBack}>
    <h1 className={styles.headline} aria-label={tr("모의 면접을 준비하고 있어요", "Preparing your mock interview")}>{tr("모의 면접을", "Preparing your")}<br />{tr("준비하고 있어요", "mock interview")}</h1>
    <p className={styles.lead}>{tr("첨부한 자료와 선택한 조건으로 실제와 같은 면접 흐름을 만들고 있어요.", "We’re creating a realistic interview flow from your settings and materials.")}</p>
    <section className={styles.steps} aria-live="polite">
      <ProgressItem number="1" title={tr("자료 안전하게 업로드", "Securely uploading files")} active={stage === "uploading"} done={stage !== "uploading"} en={en} />
      <ProgressItem number="2" title={tr("경험과 기술 분석", "Analyzing experience and skills")} active={stage === "analyzing"} done={stage === "generating"} en={en} />
      <ProgressItem number="3" title={tr("근거 기반 질문 생성", "Generating evidence-based questions")} active={stage === "generating"} done={false} en={en} />
    </section>
    <div className={styles.privacy}><strong>개인정보 안내</strong><p>파일은 비공개 Storage에 저장되며, Browser에 저장 경로나 서명 URL을 남기지 않습니다.</p></div>
  </InterviewFrame>;

  const reflected = [files.resume && "이력서", files.portfolio && "포트폴리오", files.self_introduction && "자기소개서"].filter(Boolean).join(", ");
  return <InterviewFrame onBack={goBack}>
    <h1 className={styles.headline} aria-label={tr("면접 구성을 확인해 주세요", "Review your interview setup")}>{tr("면접 구성을", "Review your interview")}<br />{tr("확인해 주세요", "setup")}</h1>
    <p className={styles.lead}>{tr("선택한 조건과 자료 반영 방식을 확인한 뒤 바로 시작할 수 있어요.", "Review your settings and materials, then start when you’re ready.")}</p>
    <section className={styles.summary}>
      <h2>{tr("면접 구성 상세", "Interview Setup")}</h2><p>{tr("필요한 항목만 반영해 맞춤 질문을 구성했어요.", "Personalized questions were created from the selected materials.")}</p>
      <dl><div><dt>{tr("희망 직무", "Desired Role")}</dt><dd>{desiredRole}</dd></div><div><dt>{tr("지원 유형", "Application Type")}</dt><dd>{applicationType}</dd></div><div><dt>{tr("자료 반영", "Materials")}</dt><dd>{reflected}</dd></div></dl>
    </section>
    {startInterview.error && <div className={styles.error} role="alert">{startInterview.error.message}</div>}
    <div className={styles.actions}>
      <Button variant="secondary" onClick={() => setScreen("conditions")}>{tr("면접 다시 구성하기", "Edit Setup")}</Button>
      <Button disabled={startInterview.isPending} onClick={() => startInterview.mutate()}>
        {startInterview.isPending ? tr("면접방 여는 중…", "Opening interview…") : tr("면접 시작하기", "Start Interview")}
      </Button>
    </div>
  </InterviewFrame>;
}

function InterviewFrame({ children, onBack }: { children: ReactNode; onBack: () => void }) {
  const en = usePreferences((state) => state.language) === "en";
  return (
    <div className={styles.page}>
      <ScreenHeader title={en ? "Interview Practice" : "면접 연습"} onBack={onBack} />
      {children}
    </div>
  );
}

function Attachment({ label, detail, file, onChange, en }: { label: string; detail: string; file?: File; onChange: (file?: File) => void; en: boolean }) {
  return (
    <label className={`${styles.attachment} ${file ? styles.attached : ""}`}>
      <input aria-label={label} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => onChange(event.target.files?.[0])} />
      <span aria-hidden="true">▣</span>
      <strong>{label}</strong>
      <small>{file ? file.name : detail}</small>
      <b>{file ? (en ? "Change" : "변경") : (en ? "Attach" : "첨부")}</b>
    </label>
  );
}

function ProgressItem({ number, title, active, done, en }: { number: string; title: string; active: boolean; done: boolean; en: boolean }) {
  return (
    <div className={`${styles.step} ${active ? styles.stepActive : ""} ${done ? styles.stepDone : ""}`}>
      <span aria-hidden="true">{done ? "✓" : number}</span>
      <div><strong>{title}</strong><small>{done ? (en ? "Done" : "완료") : active ? (en ? "Processing…" : "처리 중…") : (en ? "Waiting" : "대기")}</small></div>
    </div>
  );
}
