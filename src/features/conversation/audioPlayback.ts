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

export async function playManualMessageAudio(messageId: string): Promise<void> {
  const completed = await readyAudio(messageId);
  await playCompletedTts(requireSignedUrl(completed));
}

export async function playAutomaticMessageAudio(messageId: string): Promise<void> {
  const available = await waitForAudio(
    messageId,
    (audio) => audio.status === "processing" || audio.status === "ready",
  );
  if (available.status === "ready") {
    await playCompletedTts(requireSignedUrl(available));
    return;
  }

  let streamedDuration = 0;
  try {
    streamedDuration = (await playStreamingTts(messageId)).pcmDurationMs;
  } catch {
    // 생성 초기에 빈 스트림이 닫혀도 사용자 조작을 다시 요구하지 않고 WAV로 전환한다.
    const completed = await readyAudio(messageId);
    await playCompletedTts(requireSignedUrl(completed));
    return;
  }

  const completed = await readyAudio(messageId);
  if (completed.duration_ms !== null && streamedDuration + 100 < completed.duration_ms) {
    await playCompletedTts(requireSignedUrl(completed), streamedDuration);
  }
}
