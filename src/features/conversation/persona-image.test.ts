import { expect, test } from "vitest";
import { PERSONA_PLACEHOLDER, latestPersonaReaction, personaImage } from "./personaImage";

test("6개 감정 라벨은 서로 다른 개별 이미지로 매핑된다", () => {
  const labels = ["neutral", "happy", "sad", "angry", "curious", "embarrassment"];
  const paths = labels.map((label) => personaImage("campus-senior", label));
  expect(paths).toEqual(labels.map((label) => `/personas/campus-senior/${label}.png`));
  expect(new Set(paths)).toHaveLength(6);
});

test("페르소나가 다르면 같은 감정도 다른 이미지를 쓴다", () => {
  // 세 페르소나가 한 얼굴을 나눠 쓰던 것이 이 함수를 만든 이유다.
  const keys = ["campus-senior", "test-team-lead", "test-customer"];
  const paths = keys.map((key) => personaImage(key, "happy"));
  expect(new Set(paths)).toHaveLength(3);
});

test("알 수 없거나 누락된 감정은 neutral 이미지로 안전하게 대체한다", () => {
  expect(personaImage("campus-senior", null)).toBe("/personas/campus-senior/neutral.png");
  expect(personaImage("campus-senior", "../../secret")).toBe("/personas/campus-senior/neutral.png");
});

test("이미지가 없는 페르소나는 다른 인물이 아니라 자리 표시자를 쓴다", () => {
  // 키가 없을 때 특정 인물의 얼굴로 채우면 누구와 말하는지 잘못 익힌다.
  expect(personaImage(null, "happy")).toBe(PERSONA_PLACEHOLDER);
  expect(personaImage(undefined)).toBe(PERSONA_PLACEHOLDER);
});

test("규칙에 맞지 않는 avatar_key 는 경로로 쓰지 않는다", () => {
  expect(personaImage("../../etc/passwd", "happy")).toBe(PERSONA_PLACEHOLDER);
  expect(personaImage("Campus_Senior", "happy")).toBe(PERSONA_PLACEHOLDER);
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
