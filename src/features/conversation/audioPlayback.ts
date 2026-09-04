import { api } from "../../api/service";
import { playCompletedTts, playStreamingTts } from "./ttsStreaming";

type AudioAccess = Awaited<ReturnType<typeof api.audio>>;

export class AudioGenerationFailedError extends Error {
  constructor() {
    super("음성 생성에 실패했습니다.");
    this.name = "AudioGenerationFailedError";
  }
}

async function waitForAudio(
  messageId: string,
  predicate: (audio: AudioAccess) => boolean,
  timeoutMilliseconds = 60_000,
): Promise<AudioAccess> {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    try {
      const audio = await api.audio(messageId);
      if (audio.status === "failed") throw new AudioGenerationFailedError();
      if (predicate(audio)) return audio;
    } catch (error) {
      if (error instanceof AudioGenerationFailedError) throw error;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 500));
  }
  throw new Error("음성 생성이 지연되고 있습니다. 잠시 후 다시 재생해 주세요.");
}

async function readyAudio(messageId: string): Promise<AudioAccess> {
  return waitForAudio(messageId, (audio) => audio.status === "ready");
}

function requireSignedUrl(audio: AudioAccess): string {
  if (!audio.signed_url) throw new Error("완성된 음성을 불러오지 못했습니다.");
  return audio.signed_url;
}

function conversationToTts(startedAt: number | undefined, ttsStartedAt: number): number | null {
  return startedAt === undefined ? null : Math.max(0, ttsStartedAt - startedAt);
}

function logCompletedPlayback(
  messageId: string,
  mode: "completed" | "fallback",
  conversationStartedAt: number | undefined,
  ttsStartedAt: number,
): void {
  const firstRenderMs = Math.max(0, performance.now() - ttsStartedAt);
  const conversationToTtsMs = conversationToTts(conversationStartedAt, ttsStartedAt);
  console.info("tts_playback_performance", {
    message_id: messageId,
    mode,
    conversation_to_tts_ms: conversationToTtsMs,
    first_byte_ms: null,
    first_render_ms: firstRenderMs,
    total_time_to_audio_ms: conversationToTtsMs === null
      ? null
      : conversationToTtsMs + firstRenderMs,
    stream_complete_ms: null,
    pcm_duration_ms: null,
    underrun_ms: null,
    result: "success",
  });
}

export async function playManualMessageAudio(messageId: string): Promise<void> {
  const completed = await readyAudio(messageId);
  await playCompletedTts(requireSignedUrl(completed));
}

export async function playAutomaticMessageAudio(
  messageId: string,
  conversationStartedAt?: number,
): Promise<void> {
  const ttsStartedAt = performance.now();
  const available = await waitForAudio(
    messageId,
    (audio) => audio.status === "processing" || audio.status === "ready",
  );
  if (available.status === "ready") {
    await playCompletedTts(requireSignedUrl(available));
    logCompletedPlayback(messageId, "completed", conversationStartedAt, ttsStartedAt);
    return;
  }

  let streamedDuration = 0;
  try {
    const result = await playStreamingTts(messageId);
    streamedDuration = result.pcmDurationMs;
    const conversationToTtsMs = conversationToTts(conversationStartedAt, ttsStartedAt);
    console.info("tts_playback_performance", {
      message_id: messageId,
      mode: "streaming",
      conversation_to_tts_ms: conversationToTtsMs,
      first_byte_ms: result.firstByteMs,
      first_render_ms: result.firstRenderMs,
      total_time_to_audio_ms: conversationToTtsMs === null
        ? null
        : conversationToTtsMs + result.firstRenderMs,
      stream_complete_ms: result.completeMs,
      pcm_duration_ms: result.pcmDurationMs,
      underrun_ms: result.underrunMs,
      result: "success",
    });
  } catch {
    // 생성 초기에 빈 스트림이 닫혀도 사용자 조작을 다시 요구하지 않고 WAV로 전환한다.
    const completed = await readyAudio(messageId);
    await playCompletedTts(requireSignedUrl(completed));
    logCompletedPlayback(messageId, "fallback", conversationStartedAt, ttsStartedAt);
    return;
  }

  const completed = await readyAudio(messageId);
  if (completed.duration_ms !== null && streamedDuration + 100 < completed.duration_ms) {
    await playCompletedTts(requireSignedUrl(completed), streamedDuration);
  }
}
