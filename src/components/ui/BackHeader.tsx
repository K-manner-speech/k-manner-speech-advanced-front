type BackHeaderProps = {
  title: string;
  onBack: () => void;
};

export function BackHeader({ title, onBack }: BackHeaderProps) {
  return <div className="figmaBackHeader">
    <button type="button" onClick={onBack} aria-label="뒤로 가기">‹</button>
    <strong>{title}</strong>
  </div>;
}
