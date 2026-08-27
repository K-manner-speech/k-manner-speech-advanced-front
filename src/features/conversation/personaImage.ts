const supportedEmotions = new Set([
  "neutral",
  "happy",
  "sad",
  "angry",
  "curious",
  "embarrassment",
]);

type ReactionMessage = {
  sender_type: string;
  sequence_no: number;
  emotion: { status: string; label: string | null } | null;
};

export function latestPersonaReaction(messages: ReactionMessage[]): string {
  const latest = [...messages]
    .sort((left, right) => right.sequence_no - left.sequence_no)
    .find(
      (message) =>
        message.sender_type === "persona" &&
        message.emotion?.status === "succeeded" &&
        Boolean(message.emotion.label && supportedEmotions.has(message.emotion.label)),
    );
  return latest?.emotion?.label ?? "neutral";
}

export function personaImageForEmotion(label: string | null | undefined): string {
  const emotion = label && supportedEmotions.has(label) ? label : "neutral";
  return `/personas/${emotion}.png`;
}
