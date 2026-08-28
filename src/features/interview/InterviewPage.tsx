import { useMutation } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api, waitForTerminal } from "../../api/service";
import { BackHeader } from "../../components/ui/BackHeader";
import styles from "../../components/ui/Pages.module.css";

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const SUPPORTED_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
type Screen = "conditions" | "attachments" | "preparing" | "confirmation";
type Stage = "uploading" | "analyzing" | "generating";
type DocumentType = "resume" | "portfolio" | "self_introduction";

export function InterviewPage() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>("conditions");
  const [stage, setStage] = useState<Stage>("uploading");
  const [desiredRole, setDesiredRole] = useState("백엔드 개발자");
  const [applicationType, setApplicationType] = useState("신입");
  const [files, setFiles] = useState<Partial<Record<DocumentType, File>>>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [configurationId, setConfigurationId] = useState<string | null>(null);

  const prepare = useMutation({
    mutationFn: async () => {
      if (!files.resume) throw new Error("이력서 파일을 먼저 선택해 주세요.");
      setScreen("preparing");
      setStage("uploading");
      const setup = await api.createInterviewSetup(desiredRole.trim(), applicationType.trim());
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

  if (screen === "conditions") return <InterviewFrame onBack={goBack} code="I01">
    <h1 aria-label="지원 정보를 입력해 주세요">지원 정보를<br />입력해 주세요</h1>
    <p className={styles.lead}>이력서와 겹치지 않는 지원 희망 정보를<br />직접 입력해 주세요.</p>
    <div className={styles.interviewFields}>
      <label>희망 직무<input aria-label="희망 직무" value={desiredRole} onChange={(event) => setDesiredRole(event.target.value)} maxLength={200} placeholder="희망 직무를 입력해 주세요" /></label>
      <label>지원 유형<select aria-label="지원 유형" value={applicationType} onChange={(event) => setApplicationType(event.target.value)}><option>신입</option><option>경력</option><option>인턴</option></select></label>
    </div>
    <button className={styles.interviewPrimary} disabled={!desiredRole.trim() || !applicationType.trim()} onClick={() => setScreen("attachments")}>다음</button>
  </InterviewFrame>;

  if (screen === "attachments") return <InterviewFrame onBack={goBack} code="I03">
    <h1 aria-label="면접 자료를 첨부해 주세요">면접 자료를<br />첨부해 주세요</h1>
    <p className={styles.lead}>이력서는 필수예요. 포트폴리오와 자기소개서를 추가하면<br />맞춤 질문이 더 정교해져요.</p>
    <div className={styles.interviewAttachments}>
      <Attachment label="이력서 (필수)" detail="PDF 또는 DOCX · 최대 10MB" file={files.resume} onChange={(file) => chooseFile("resume", file)} />
      <Attachment label="포트폴리오 (선택)" detail="PDF 또는 DOCX · 최대 10MB" file={files.portfolio} onChange={(file) => chooseFile("portfolio", file)} />
      <Attachment label="자기소개서 (선택)" detail="PDF 또는 DOCX · 최대 10MB" file={files.self_introduction} onChange={(file) => chooseFile("self_introduction", file)} />
    </div>
    <div className={styles.interviewInfo}>✓ 이력서를 첨부해야 면접 질문 분석을 시작할 수 있어요.</div>
    {fileError && <div className={styles.error} role="alert">{fileError}</div>}
    {prepare.error && <div className={styles.partialError} role="alert"><strong>면접 준비를 완료하지 못했어요.</strong><span>{prepare.error.message}</span><small>선택한 파일은 유지됩니다. 상태를 확인하고 다시 시도해 주세요.</small></div>}
    <button className={styles.interviewPrimary} disabled={!files.resume || prepare.isPending} onClick={() => prepare.mutate()}>첨부한 자료로 분석하기</button>
  </InterviewFrame>;

  if (screen === "preparing") return <InterviewFrame onBack={goBack} code="I04">
    <h1 aria-label="모의 면접을 준비하고 있어요">모의 면접을<br />준비하고 있어요</h1>
    <p className={styles.lead}>첨부한 자료와 선택한 조건으로<br />실제와 같은 면접 흐름을 만들고 있어요.</p>
    <section className={styles.interviewPreparing} aria-live="polite">
      <div className={styles.interviewSpark}>✦</div><div><strong>맞춤 면접을 구성하는 중</strong><small>잠시만 기다려 주세요</small></div>
      <ProgressItem number="1" title="자료 안전하게 업로드" active={stage === "uploading"} done={stage !== "uploading"} />
      <ProgressItem number="2" title="경험과 기술 분석" active={stage === "analyzing"} done={stage === "generating"} />
      <ProgressItem number="3" title="근거 기반 질문 생성" active={stage === "generating"} done={false} />
    </section>
    <div className={styles.interviewPrivacy}><strong>개인정보 안내</strong><p>파일은 비공개 Storage에 저장되며, Browser에 저장 경로나 서명 URL을 남기지 않습니다.</p></div>
  </InterviewFrame>;

  const reflected = [files.resume && "이력서", files.portfolio && "포트폴리오", files.self_introduction && "자기소개서"].filter(Boolean).join(", ");
  return <InterviewFrame onBack={goBack} code="I05">
    <h1 aria-label="면접 구성을 확인해 주세요">면접 구성을<br />확인해 주세요</h1>
    <p className={styles.lead}>선택한 조건과 자료 반영 방식을 확인한 뒤 바로 시작할 수 있어요.</p>
    <section className={styles.interviewSummary}>
      <h2>면접 구성 상세</h2><p>필요한 항목만 반영해 맞춤 질문을 구성했어요.</p>
      <dl><div><dt>희망 직무</dt><dd>{desiredRole}</dd></div><div><dt>지원 유형</dt><dd>{applicationType}</dd></div><div><dt>자료 반영</dt><dd>{reflected}</dd></div></dl>
    </section>
    {startInterview.error && <div className={styles.error} role="alert">{startInterview.error.message}</div>}
    <button className={styles.interviewSecondary} onClick={() => setScreen("conditions")}>면접 다시 구성하기</button>
    <button className={styles.interviewPrimary} disabled={startInterview.isPending} onClick={() => startInterview.mutate()}>{startInterview.isPending ? "면접방 여는 중…" : "면접 시작하기"}</button>
  </InterviewFrame>;
}

function InterviewFrame({ children, onBack, code }: { children: ReactNode; onBack: () => void; code: string }) {
  return <div className={`${styles.page} ${styles.interviewStep}`} data-step={code}><BackHeader title="면접 연습" onBack={onBack} /><main className={styles.interviewStepBody}>{children}</main></div>;
}

function Attachment({ label, detail, file, onChange }: { label: string; detail: string; file?: File; onChange: (file?: File) => void }) {
  return <label className={styles.interviewAttachment}><input aria-label={label} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => onChange(event.target.files?.[0])} /><span>▣</span><strong>{label}</strong><small>{file ? file.name : detail}</small><b>{file ? "변경" : "첨부"}</b></label>;
}

function ProgressItem({ number, title, active, done }: { number: string; title: string; active: boolean; done: boolean }) {
  return <div className={`${styles.progressItem} ${active ? styles.progressActive : ""}`}><span>{done ? "✓" : number}</span><div><strong>{title}</strong><small>{done ? "완료" : active ? "처리 중…" : "대기"}</small></div></div>;
}
