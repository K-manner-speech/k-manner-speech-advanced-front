import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, waitForTerminal } from "../../api/service";
import styles from "../../components/ui/Pages.module.css";

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const SUPPORTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

type Stage = "idle" | "uploading" | "analyzing" | "generating" | "ready";

export function InterviewPage() {
  const navigate = useNavigate();
  const [desiredRole, setDesiredRole] = useState("백엔드 개발자");
  const [applicationType, setApplicationType] = useState("신입");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const prepare = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("이력서 파일을 먼저 선택해 주세요.");
      setStage("uploading");
      const setup = await api.createInterviewSetup(desiredRole.trim(), applicationType.trim());
      const document = await api.uploadResume(setup.id, file);
      setStage("analyzing");
      const accepted = await api.analyzeDocument(document.id);
      await waitForTerminal(() => api.analysis(accepted.analysis_id), "succeeded");
      setStage("generating");
      const configuration = await api.createInterviewConfiguration(setup.id, accepted.analysis_id);
      await waitForTerminal(
        () => api.interviewConfiguration(configuration.configuration_id),
        "ready",
      );
      const questions = await api.interviewQuestions(configuration.configuration_id);
      if (!questions.questions.length) throw new Error("생성된 질문이 없습니다. 다시 준비해 주세요.");
      const room = await api.createInterviewRoom(configuration.configuration_id);
      setStage("ready");
      return { roomId: room.id, configurationId: configuration.configuration_id };
    },
    onSuccess: ({ roomId, configurationId }) => {
      navigate(`/rooms/${roomId}?configuration=${configurationId}`);
    },
    onError: () => setStage("idle"),
  });

  const chooseFile = (nextFile?: File) => {
    setFileError(null);
    if (!nextFile) return setFile(null);
    if (!SUPPORTED_TYPES.includes(nextFile.type) && !/\.(pdf|docx)$/i.test(nextFile.name)) {
      setFile(null);
      setFileError("PDF 또는 DOCX 이력서만 업로드할 수 있습니다.");
      return;
    }
    if (nextFile.size > MAX_DOCUMENT_BYTES) {
      setFile(null);
      setFileError("AC-T4-DOCUMENT-LIMIT: 이력서는 10MB 이하만 업로드할 수 있습니다.");
      return;
    }
    setFile(nextFile);
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>이력서 기반 AI 면접</p>
        <h1>내 경험에서 시작하는<br />실전 면접 연습</h1>
        <p className={styles.lead}>텍스트를 읽을 수 있는 PDF 또는 DOCX를 분석해 근거 있는 질문 3개를 만듭니다.</p>
      </header>
      <div className={styles.interviewLayout}>
        <section className={styles.panel} aria-labelledby="interview-form-title">
          <h2 id="interview-form-title">면접 준비 정보</h2>
          <div className={styles.form}>
            <label>지원 직무<input value={desiredRole} onChange={(event) => setDesiredRole(event.target.value)} maxLength={200} /></label>
            <label>지원 유형<select value={applicationType} onChange={(event) => setApplicationType(event.target.value)}><option>신입</option><option>경력</option><option>인턴</option></select></label>
            <label className={styles.uploadBox}>
              <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => chooseFile(event.target.files?.[0])} />
              <span className={styles.uploadIcon}>↑</span>
              <strong>{file ? file.name : "이력서를 선택하거나 여기에 놓으세요"}</strong>
              <small>{file ? `${(file.size / 1024 / 1024).toFixed(2)}MB · 업로드 준비됨` : "PDF 또는 DOCX · 최대 10MB · OCR이 필요한 스캔본 제외"}</small>
            </label>
            {fileError && <div className={styles.error} role="alert">{fileError}</div>}
            {prepare.error && <div className={styles.partialError} role="alert"><strong>면접 준비를 완료하지 못했어요.</strong><span>{prepare.error.message}</span><small>선택한 파일은 유지됩니다. 상태를 확인하고 다시 시도해 주세요.</small></div>}
            <button className={styles.primaryButton} disabled={!file || !desiredRole.trim() || prepare.isPending} onClick={() => prepare.mutate()}>{prepare.isPending ? "면접 질문 준비 중…" : "이력서 분석하고 질문 만들기"}</button>
          </div>
        </section>
        <aside className={styles.progressCard} aria-live="polite">
          <p className={styles.eyebrow}>준비 과정</p><h2>약 1~2분이 걸려요</h2>
          <ProgressItem number="1" title="자료 안전하게 업로드" active={stage === "uploading"} done={["analyzing", "generating", "ready"].includes(stage)} />
          <ProgressItem number="2" title="경험과 기술 분석" active={stage === "analyzing"} done={["generating", "ready"].includes(stage)} />
          <ProgressItem number="3" title="근거 기반 질문 생성" active={stage === "generating"} done={stage === "ready"} />
          <div className={styles.privacyNote}><strong>개인정보 안내</strong><p>파일은 비공개 Storage에 저장되며, Browser에 저장 경로나 서명 URL을 남기지 않습니다.</p></div>
        </aside>
      </div>
    </div>
  );
}

function ProgressItem({ number, title, active, done }: { number: string; title: string; active: boolean; done: boolean }) {
  return <div className={`${styles.progressItem} ${active ? styles.progressActive : ""}`}><span>{done ? "✓" : number}</span><div><strong>{title}</strong><small>{done ? "완료" : active ? "처리 중…" : "대기"}</small></div></div>;
}
