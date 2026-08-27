import { expect, test } from "vitest";
import { latestPersonaReaction, personaImageForEmotion } from "./personaImage";

test("6개 감정 라벨은 서로 다른 개별 이미지로 매핑된다", () => {
  const labels = ["neutral", "happy", "sad", "angry", "curious", "embarrassment"];
  const paths = labels.map(personaImageForEmotion);
  expect(paths).toEqual(labels.map((label) => `/personas/${label}.png`));
  expect(new Set(paths)).toHaveLength(6);
});

test("알 수 없거나 누락된 감정은 neutral 이미지로 안전하게 대체한다", () => {
  expect(personaImageForEmotion(null)).toBe("/personas/neutral.png");
  expect(personaImageForEmotion("../../secret")).toBe("/personas/neutral.png");
});

test("최신 persona 답변의 반응만 선택하고 사용자 감정과 system 메시지는 무시한다", () => {
  expect(latestPersonaReaction([
    { sender_type: "user", sequence_no: 1, emotion: { status: "succeeded", label: "happy" } },
    { sender_type: "persona", sequence_no: 2, emotion: { status: "succeeded", label: "angry" } },
    { sender_type: "system", sequence_no: 3, emotion: null },
  ])).toBe("angry");
  expect(latestPersonaReaction([
    { sender_type: "user", sequence_no: 1, emotion: { status: "succeeded", label: "happy" } },
  ])).toBe("neutral");
});
