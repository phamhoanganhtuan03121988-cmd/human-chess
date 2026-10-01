import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Difficulty } from '../ai/difficulty.ts';
import type { Side } from '../engine/index.ts';
import type { Activity, StatusView } from '../game/controller.ts';
import { SoundToggle } from './SoundToggle.tsx';
import { StatusPanel } from './StatusPanel.tsx';
import { DifficultyPicker } from './ui/DifficultyPicker.tsx';
import { MusicControl } from './ui/MusicControl.tsx';
import { ConnectionBadge } from './online/ConnectionBadge.tsx';
import type { ConnectionStatus } from '../multiplayer/client.ts';
import type { PlayerInfo } from '../multiplayer/types.ts';
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
  /** Online play: connection, room and the online actions (replaces difficulty / new game). */
  online?: OnlineHud | null;
}

export interface OnlineHud {
  readonly connection: ConnectionStatus;
  readonly roomId: string;
  readonly mySide: Side;
  readonly opponent: PlayerInfo | null;
  /** The game is in progress (surrender possible) vs finished (leave). */
  readonly playing: boolean;
  readonly onSurrender: () => void;
  readonly onLeave: () => void;
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
        {!props.online && (
          <label className="hud__field">
            <span className="hud__label">Độ khó</span>
            <DifficultyPicker
              id={`difficulty-${idSuffix}`}
              value={props.difficulty}
              onChange={props.onDifficulty}
              disabled={props.difficultyDisabled}
            />
          </label>
        )}
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
      <StatusPanel
        status={props.status}
        activity={props.activity}
        aiSide={props.aiSide}
        onlineSide={props.online?.mySide ?? null}
      />
      {props.online && <OnlineHudInfo online={props.online} />}
      <div className="hud__secondary">{secondary('bar')}</div>
      <SoundToggle />
      {props.online ? (
        props.online.playing ? (
          <button
            type="button"
            className="toolbar__button toolbar__button--danger"
            data-testid="surrender"
            onClick={props.online.onSurrender}
          >
            Đầu hàng
          </button>
        ) : (
          <button
            type="button"
            className="toolbar__button toolbar__button--accent"
            data-testid="leave-online"
            onClick={props.online.onLeave}
          >
            Rời phòng
          </button>
        )
      ) : (
        <button
          type="button"
          className="toolbar__button toolbar__button--accent"
          disabled={props.newGameDisabled}
          data-testid="new-game"
          onClick={props.onNewGame}
        >
          Ván mới
        </button>
      )}
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

function useIsMobileView(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (typeof window.matchMedia === 'function') {
      return window.matchMedia('(max-width: 700px)').matches;
    }
    return window.innerWidth <= 700;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => {
      if (typeof window.matchMedia === 'function') {
        setIsMobile(window.matchMedia('(max-width: 700px)').matches);
      } else {
        setIsMobile(window.innerWidth <= 700);
      }
    };
    if (typeof window.matchMedia === 'function') {
      const mq = window.matchMedia('(max-width: 700px)');
      mq.addEventListener?.('change', update);
      return () => mq.removeEventListener?.('change', update);
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return isMobile;
}

/** Connection state, room code and opponent (with a warning while the opponent is away on desktop). */
function OnlineHudInfo({ online }: { online: OnlineHud }) {
  const away = online.opponent !== null && !online.opponent.connected && online.playing;
  const isMobile = useIsMobileView();
  const [reconnected, setReconnected] = useState(false);
  const prevConnectedRef = useRef(online.opponent?.connected ?? true);

  useEffect(() => {
    const prev = prevConnectedRef.current;
    const curr = online.opponent?.connected ?? true;
    prevConnectedRef.current = curr;

    if (!prev && curr && online.playing) {
      setReconnected(true);
      const timer = window.setTimeout(() => setReconnected(false), 2500);
      return () => window.clearTimeout(timer);
    }
  }, [online.opponent?.connected, online.playing]);

  return (
    <div className="hud__online" data-testid="online-hud">
      <ConnectionBadge status={online.connection} compact />
      <span className="hud__room" title="Mã phòng">
        #{online.roomId}
      </span>
      {online.opponent && (
        <span className={`hud__opponent side-${online.opponent.side}`} title="Đối thủ" data-testid="opponent">
          vs {online.opponent.nickname}
        </span>
      )}
      {away && !isMobile && (
        <span className="hud__away" role="status" data-testid="opponent-away">
          Đối thủ mất kết nối…
        </span>
      )}
      {!away && reconnected && !isMobile && (
        <span className="hud__away hud__away--reconnected" role="status" data-testid="opponent-reconnected">
          Đã kết nối lại
        </span>
      )}
    </div>
  );
}
