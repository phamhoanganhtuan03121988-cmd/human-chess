import { DIFFICULTIES, DIFFICULTY_LABELS } from '../../ai/difficulty.ts';
import type { Difficulty } from '../../ai/difficulty.ts';

interface Props {
  value: Difficulty;
  onChange: (d: Difficulty) => void;
  disabled?: boolean;
  id?: string;
}

/** Compact difficulty dropdown (start screen and toolbar). */
export function DifficultyPicker({ value, onChange, disabled = false, id }: Props) {
  return (
    <select
      id={id}
      className="difficulty-select"
      aria-label="Độ khó"
      value={value}
      disabled={disabled}
      data-testid="difficulty-select"
      onChange={(e) => onChange(e.target.value as Difficulty)}
    >
      {DIFFICULTIES.map((d) => (
        <option key={d} value={d}>
          {DIFFICULTY_LABELS[d]}
        </option>
      ))}
    </select>
  );
}
