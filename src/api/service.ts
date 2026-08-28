import type { components } from "./generated/schema";
import { http, unwrap } from "./http";
import { ApiError } from "./http";
import { createIdempotencyKey } from "../lib/idempotency";
import { supabase } from "./supabase";
import { publicConfig } from "../lib/env";

export type Me = components["schemas"]["MeResponse"];
export type Persona = components["schemas"]["PersonaSummary"];
export type Scenario = components["schemas"]["ScenarioSummary"];
export type Room = components["schemas"]["Room"];
export type RoomDetail = components["schemas"]["RoomDetail"];
export type Message = components["schemas"]["Message"];
export type Job = components["schemas"]["Job"];
export type InterviewAnalysis = components["schemas"]["InterviewAnalysis"];
export type InterviewConfiguration = components["schemas"]["InterviewConfiguration"];
export type InterviewQuestion = components["schemas"]["InterviewQuestion"];
export type SessionResult = components["schemas"]["SessionResult"];
export type SessionResultSummary = components["schemas"]["SessionResultSummary"];

export const api = {
  async me() {
    return unwrap(await http.GET("/api/v1/me"));
  },
  async saveProfile(body: components["schemas"]["ProfileReplaceRequest"]) {
    return unwrap(await http.PUT("/api/v1/me/profile", { body }));
  },
  async saveLanguage(display_language: "ko" | "en") {
    return unwrap(await http.PUT("/api/v1/me/language", { body: { display_language } }));
  },
  async saveTerms(consents: components["schemas"]["ConsentInput"][]) {
    return unwrap(await http.PUT("/api/v1/me/terms", { body: { consents } }));
  },
  async completeOnboarding() {
    return unwrap(
      await http.POST("/api/v1/me/onboarding/complete", {
        params: { header: { "Idempotency-Key": createIdempotencyKey() } },
      }),
    );
  },
  async personas() {
    return unwrap(
      await http.GET("/api/v1/personas", { params: { query: { limit: 20 } } }),
    );
  },
  async scenarios(personaId?: string) {
    return unwrap(
      await http.GET("/api/v1/scenarios", {
        params: { query: { limit: 20, persona_id: personaId ?? null } },
      }),
    );
  },
  async scenario(scenarioId: string) {
    return unwrap(
      await http.GET("/api/v1/scenarios/{scenario_id}", {
        params: { path: { scenario_id: scenarioId } },
      }),
    );
  },
  async createRoom(body: components["schemas"]["RoomCreateRequest"]) {
    return unwrap(
      await http.POST("/api/v1/rooms", {
        params: { header: { "Idempotency-Key": createIdempotencyKey() } },
        body,
      }),
    );
  },
  async rooms() {
    return unwrap(
      await http.GET("/api/v1/rooms", {
        params: { query: { limit: 20 } },
      }),
    );
  },
  async room(roomId: string) {
    return unwrap(
      await http.GET("/api/v1/rooms/{room_id}", {
        params: { path: { room_id: roomId } },
      }),
    );
  },
  async messages(roomId: string) {
    return unwrap(
      await http.GET("/api/v1/rooms/{room_id}/messages", {
        params: { path: { room_id: roomId }, query: { limit: 20 } },
      }),
    );
  },
  async sendMessage(
    roomId: string,
    content: string,
    currentInterviewQuestionId?: string,
    inputMode: "text" | "voice" = "text",
  ) {
    const key = createIdempotencyKey();
    return unwrap(
      await http.POST("/api/v1/rooms/{room_id}/messages", {
        params: { path: { room_id: roomId }, header: { "Idempotency-Key": key } },
        body: {
          content,
          input_mode: inputMode,
          client_request_id: key,
          current_interview_question_id: currentInterviewQuestionId ?? null,
        },
      }),
    );
  },
  async sendVoiceMessage(
    roomId: string,
    transcript: string,
    audio: Blob,
    currentInterviewQuestionId?: string,
  ) {
    const key = createIdempotencyKey();
    const form = new FormData();
    form.set("transcript", transcript);
    form.set("audio", audio, `recording.${audio.type.includes("ogg") ? "ogg" : audio.type.includes("mp4") ? "mp4" : "webm"}`);
    if (currentInterviewQuestionId) form.set("current_interview_question_id", currentInterviewQuestionId);
    const { data } = await supabase.auth.getSession();
    const response = await fetch(`${publicConfig.VITE_API_BASE_URL}/api/v1/rooms/${roomId}/voice-messages`, {
      method: "POST",
      headers: {
        ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
        "Idempotency-Key": key,
      },
      body: form,
    });
    const payload = await response.json() as components["schemas"]["MessageAccepted"] & { code?: string; message?: string; retryable?: boolean };
    if (!response.ok) throw new ApiError(payload.code ?? "VOICE_UPLOAD_FAILED", payload.message ?? "음성을 전송하지 못했습니다.", payload.retryable ?? false, response.status);
    return payload;
  },
  async job(jobId: string) {
    return unwrap(
      await http.GET("/api/v1/jobs/{job_id}", {
        params: { path: { job_id: jobId } },
      }),
    );
  },
  async feedback(messageId: string) {
    return unwrap(
      await http.GET("/api/v1/messages/{message_id}/feedback", {
        params: { path: { message_id: messageId } },
      }),
    );
  },
  async audio(messageId: string) {
    return unwrap(
      await http.GET("/api/v1/messages/{message_id}/audio", {
        params: { path: { message_id: messageId } },
      }),
    );
  },
  async retryTts(messageId: string) {
    return unwrap(
      await http.POST("/api/v1/messages/{message_id}/tts/retry", {
        params: { path: { message_id: messageId }, header: { "Idempotency-Key": createIdempotencyKey() } },
      }),
    );
  },
  async repeatMessage(messageId: string, recommendedExpression: string) {
    return unwrap(
      await http.POST("/api/v1/messages/{message_id}/repeat", {
        params: { path: { message_id: messageId }, header: { "Idempotency-Key": createIdempotencyKey() } },
        body: { recommended_expression: recommendedExpression },
      }),
    );
  },
  async result(roomId: string) {
    return unwrap(
      await http.GET("/api/v1/rooms/{room_id}/result", {
        params: { path: { room_id: roomId } },
      }),
    );
  },
  async retryResult(roomId: string) {
    return unwrap(
      await http.POST("/api/v1/rooms/{room_id}/result/retry", {
        params: { path: { room_id: roomId }, header: { "Idempotency-Key": createIdempotencyKey() } },
      }),
    );
  },
  async results(cursor?: string, limit = 20) {
    return unwrap(
      await http.GET("/api/v1/results", { params: { query: { cursor: cursor ?? null, limit } } }),
    );
  },
  async resultById(resultId: string) {
    return unwrap(
      await http.GET("/api/v1/results/{result_id}", { params: { path: { result_id: resultId } } }),
    );
  },
  async deleteResult(resultId: string) {
    return unwrap(
      await http.DELETE("/api/v1/results/{result_id}", {
        params: { path: { result_id: resultId }, header: { "Idempotency-Key": createIdempotencyKey() } },
      }),
    );
  },
  async createInterviewSetup(desiredRole: string, applicationType: string) {
    return unwrap(
      await http.POST("/api/v1/interview-setups", {
        params: { header: { "Idempotency-Key": createIdempotencyKey() } },
        body: { desired_role: desiredRole, application_type: applicationType || null },
      }),
    );
  },
  async uploadResume(setupId: string, file: File) {
    return unwrap(
      await http.POST("/api/v1/interview-documents", {
        params: { header: { "Idempotency-Key": createIdempotencyKey() } },
        body: {
          setup_id: setupId,
          document_type: "resume",
          file: file as unknown as string,
        },
        bodySerializer(body) {
          const form = new FormData();
          form.set("setup_id", body.setup_id);
          form.set("document_type", body.document_type);
          form.set("file", body.file);
          return form;
        },
      }),
    );
  },
  async analyzeDocument(documentId: string) {
    return unwrap(
      await http.POST("/api/v1/interview-documents/{document_id}/analyze", {
        params: {
          path: { document_id: documentId },
          header: { "Idempotency-Key": createIdempotencyKey() },
        },
      }),
    );
  },
  async analysis(analysisId: string) {
    return unwrap(
      await http.GET("/api/v1/interview-analyses/{analysis_id}", {
        params: { path: { analysis_id: analysisId } },
      }),
    );
  },
  async createInterviewConfiguration(setupId: string, analysisId: string) {
    return unwrap(
      await http.POST("/api/v1/interview-configurations", {
        params: { header: { "Idempotency-Key": createIdempotencyKey() } },
        body: {
          setup_id: setupId,
          analysis_ids: [analysisId],
          conditions: { difficulty: "junior", language: "ko" },
          question_count: 3,
        },
      }),
    );
  },
  async interviewConfiguration(configurationId: string) {
    return unwrap(
      await http.GET("/api/v1/interview-configurations/{configuration_id}", {
        params: { path: { configuration_id: configurationId } },
      }),
    );
  },
  async interviewQuestions(configurationId: string) {
    return unwrap(
      await http.GET("/api/v1/interview-configurations/{configuration_id}/questions", {
        params: { path: { configuration_id: configurationId } },
      }),
    );
  },
  async createInterviewRoom(configurationId: string) {
    return unwrap(
      await http.POST(
        "/api/v1/interview-configurations/{configuration_id}/practice-room",
        {
          params: {
            path: { configuration_id: configurationId },
            header: { "Idempotency-Key": createIdempotencyKey() },
          },
        },
      ),
    );
  },
};

export async function waitForTerminal<T extends { status: string }>(
  load: () => Promise<T>,
  successStatus: string,
  timeoutMilliseconds = 65_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    const value = await load();
    if (value.status === successStatus) return value;
    if (["failed", "cancelled", "invalidated"].includes(value.status)) {
      throw new Error("비동기 작업이 완료되지 않았습니다. 다시 시도해 주세요.");
    }
    await new Promise((resolve) => window.setTimeout(resolve, 2_000));
  }
  throw new Error("처리 시간이 길어지고 있습니다. 잠시 후 다시 확인해 주세요.");
}
