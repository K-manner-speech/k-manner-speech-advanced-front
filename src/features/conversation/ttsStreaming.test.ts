import { describe, expect, test, vi } from "vitest";
import { playCompletedTts, STREAMING_TTS_BUFFER_POLICY, ttsProcessorSource } from "./ttsStreaming";

describe("streaming TTS buffering policy", () => {
  test("24kHz PCM을 최초 1초 모은 뒤 재생한다", () => {
    expect(STREAMING_TTS_BUFFER_POLICY.initialSamples).toBe(24_000);
    expect(ttsProcessorSource).toContain("this.hasStarted?12000:24000");
  });

  test("언더런 후에는 0.5초를 다시 모을 때까지 재생을 멈춘다", () => {
    expect(STREAMING_TTS_BUFFER_POLICY.rebufferSamples).toBe(12_000);
    expect(ttsProcessorSource).toContain("this.started=false");
    expect(ttsProcessorSource).toContain("this.hasStarted=true");
  });

  test("HTTP 종료가 아니라 남은 PCM 소진 뒤 재생 완료를 알린다", () => {
    expect(ttsProcessorSource).toContain("type:'playback-ended'");
    expect(ttsProcessorSource).not.toContain("type:'ended'");
  });

  test("새 WAV 재생은 기존 플레이어를 중지해 음성이 겹치지 않는다", async () => {
    const players: Array<{ play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; removeAttribute: ReturnType<typeof vi.fn>; load: ReturnType<typeof vi.fn> }> = [];
    vi.stubGlobal("Audio", function AudioMock() {
      const player = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), removeAttribute: vi.fn(), load: vi.fn() };
      players.push(player);
      return player;
    });

    await playCompletedTts("https://example.test/first.wav");
    await playCompletedTts("https://example.test/second.wav");

    expect(players[0]?.pause).toHaveBeenCalledOnce();
    expect(players[0]?.removeAttribute).toHaveBeenCalledWith("src");
    expect(players[1]?.play).toHaveBeenCalledOnce();
  });
});
