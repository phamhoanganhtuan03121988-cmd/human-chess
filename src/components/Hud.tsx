import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Difficulty } from '../ai/difficulty.ts';
import type { Side } from '../engine/index.ts';
import type { Activity, StatusView } from '../game/controller.ts';
import { SoundToggle } from './SoundToggle.tsx';
import { StatusPanel } from './StatusPanel.tsx';
import { DifficultyPicker } from './ui/DifficultyPicker.tsx';
import { MusicControl } from './ui/MusicControl.tsx';
import { VolumeSlider } from './ui/VolumeSlider.tsx';

interface HudProps {
  status: StatusView;
  activity: Activity;
  aiSide: Side | null;
  difficulty: Difficulty;
  onDifficulty: (d: Difficulty) => void;
  difficultyDisabled: boolean;
  newGameDisabled: boolean;
  onNewGame: () => void;
  onHelp: () => void;
  historyOpen: boolean;
  onToggleHistory: () => void;
  /** Development-only board debug switch (shown with ?debug=1). */
  debugControl?: ReactNode;
}

/**
 * Compact game toolbar. Status, sound and "new game" are always visible;
 * difficulty, volume, help and history move into a ⋮ menu on narrow screens.
 */
export function Hud(props: HudProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (menu.current && !menu.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [menuOpen]);

  const secondary = (idSuffix: 'bar' | 'menu') => {
    const inMenu = idSuffix === 'menu';
    return (
      <>
        <label className="hud__field">
          <span className="hud__label">Độ khó</span>
          <DifficultyPicker
            id={`difficulty-${idSuffix}`}
            value={props.difficulty}
            onChange={props.onDifficulty}
            disabled={props.difficultyDisabled}
          />
        </label>
        <label className="hud__field">
          <span className="hud__label" aria-hidden="true">
            {inMenu ? 'Âm lượng' : '🔉'}
          </span>
          <VolumeSlider id={`volume-${idSuffix}`} />
        </label>
        <div className="hud__field">
          <span className="hud__label" aria-hidden="true">
            {inMenu ? 'Nhạc nền' : ''}
          </span>
          <MusicControl id={`music-${idSuffix}`} />
        </div>
        <button type="button" className="toolbar__button" aria-label="Cách chơi" title="Cách chơi" onClick={props.onHelp}>
          ?{inMenu && <span className="hud__text">Cách chơi</span>}
        </button>
        <button
          type="button"
          className={props.historyOpen ? 'toolbar__button is-on' : 'toolbar__button'}
          aria-label="Lịch sử nước đi"
          aria-pressed={props.historyOpen}
          title="Lịch sử nước đi"
          data-testid="history-toggle"
          onClick={props.onToggleHistory}
        >
          ☰{inMenu && <span className="hud__text">Lịch sử nước đi</span>}
        </button>
        {props.debugControl}
      </>
    );
  };

  return (
    <header className="toolbar" role="toolbar" aria-label="Bảng điều khiển">
      <StatusPanel status={props.status} activity={props.activity} aiSide={props.aiSide} />
      <div className="hud__secondary">{secondary('bar')}</div>
      <SoundToggle />
      <button
        type="button"
        className="toolbar__button toolbar__button--accent"
        disabled={props.newGameDisabled}
        data-testid="new-game"
        onClick={props.onNewGame}
      >
        Ván mới
      </button>
      <div className="hud__more" ref={menu}>
        <button
          type="button"
          className="toolbar__button"
          aria-label="Thêm tùy chọn"
          aria-haspopup="true"
          aria-expanded={menuOpen}
          data-testid="more-menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          ⋮
        </button>
        {menuOpen && (
          <div
            className="hud__menu"
            role="menu"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setMenuOpen(false);
              }
            }}
          >
            {secondary('menu')}
          </div>
        )}
      </div>
    </header>
  );
}
