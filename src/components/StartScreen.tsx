import type { Difficulty } from '../ai/difficulty.ts';
import { DifficultyPicker } from './ui/DifficultyPicker.tsx';
import { Modal } from './ui/Modal.tsx';
import { SoundToggle } from './SoundToggle.tsx';

interface StartScreenProps {
  difficulty: Difficulty;
  onDifficulty: (d: Difficulty) => void;
  /** An unfinished saved game exists (offer to resume). */
  canResume: boolean;
  onPlay: () => void;
  onResume: () => void;
  /** CHƠI ONLINE (private room). */
  onPlayOnline: () => void;
  leaving: boolean;
}

/** Title screen over the (dimmed) board: play / resume, difficulty and sound. */
export function StartScreen({ difficulty, onDifficulty, canResume, onPlay, onResume, onPlayOnline, leaving }: StartScreenProps) {
  return (
    <Modal labelledBy="start-title" className={leaving ? 'start-screen is-leaving' : 'start-screen'} testId="start-screen">
      <div className="start">
        <div className="start__seal" aria-hidden="true">
          帥
        </div>
        <h1 id="start-title" className="start__title">
          CỜ TƯỚNG
        </h1>
        <p className="start__subtitle">CINEMATIC XIANGQI</p>
        {canResume ? (
          <div className="start__resume" data-testid="resume-prompt">
            <p className="start__question">TIẾP TỤC VÁN CŨ?</p>
            <div className="start__actions">
              <button type="button" className="btn btn--primary" data-autofocus onClick={onResume}>
                TIẾP TỤC
              </button>
              <button type="button" className="btn" onClick={onPlay}>
                VÁN MỚI
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn--primary btn--large" data-autofocus onClick={onPlay}>
            CHƠI VỚI MÁY
          </button>
        )}
        <button type="button" className="btn btn--online" data-testid="play-online" onClick={onPlayOnline}>
          CHƠI ONLINE
        </button>
        <div className="start__settings">
          <label className="start__row" htmlFor="start-difficulty">
            <span className="start__label">Độ khó</span>
            <DifficultyPicker id="start-difficulty" value={difficulty} onChange={onDifficulty} />
          </label>
          <div className="start__row">
            <span className="start__label" id="start-sound-label">
              Âm thanh
            </span>
            <SoundToggle />
          </div>
        </div>
        <p className="start__hint">Với máy: bạn cầm quân Đỏ · độ khó áp dụng cho máy</p>
      </div>
    </Modal>
  );
}
