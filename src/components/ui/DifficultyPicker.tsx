import { DIFFICULTIES, DIFFICULTY_LABELS } from '../../ai/difficulty.ts';
import type { Difficulty } from '../../ai/difficulty.ts';

interface Props {
  value: Difficulty;
  onChange: (d: Difficulty) => void;
  disabled?: boolean;
  /** 'segmented' (start screen) or 'select' (compact toolbar). */
  variant?: 'segmented' | 'select';
  id?: string;
}

export function DifficultyPicker({ value, onChange, disabled = false, variant = 'select', id }: Props) {
  if (variant === 'select') {
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
  return (
    <div className="segmented" role="radiogroup" aria-label="Độ khó" data-testid="difficulty-segmented">
      {DIFFICULTIES.map((d) => (
        <button
          key={d}
          type="button"
          role="radio"
          aria-checked={value === d}
          className={value === d ? 'segmented__item is-active' : 'segmented__item'}
          disabled={disabled}
          onClick={() => onChange(d)}
        >
          {DIFFICULTY_LABELS[d]}
        </button>
      ))}
    </div>
  );
}
