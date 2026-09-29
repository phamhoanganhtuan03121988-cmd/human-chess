import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { Difficulty } from './ai/difficulty.ts';
import { initAudio, toggleSound } from './audio/index.ts';
import { CombatOverlay } from './components/combat/CombatOverlay.tsx';
import { ConfirmNewGameDialog } from './components/ConfirmDialog.tsx';
import { GameBoard } from './components/GameBoard.tsx';
import { HelpDialog } from './components/HelpDialog.tsx';
import { Hud } from './components/Hud.tsx';
import { ReplayView } from './components/ReplayView.tsx';
import { SidePanel } from './components/SidePanel.tsx';
import { StartScreen } from './components/StartScreen.tsx';
import { isBoardDebugEnabled } from './config/debug.ts';
import {
  createUiState,
  getActivity,
  getAiState,
  getStatusView,
  isPresenting,
  uiReducer,
} from './game/controller.ts';
import { clearSavedGame, loadDifficulty, loadSavedGame, saveDifficulty, saveGame } from './game/persistence.ts';
import type { LoadedGame } from './game/persistence.ts';
import { useAiOpponent } from './game/useAiOpponent.ts';
import { useGameAudio } from './game/useGameAudio.ts';

/** The human plays Red, the computer plays Blue. */
const AI_SIDE = 'blue' as const;
/** Start screen fade/scale-out before the board takes over. */
export const START_TRANSITION_MS = 260;

type Screen = 'start' | 'game';

interface AppProps {
  /** 'start' shows the title screen first (default); 'game' goes straight to the board. */
  initialScreen?: Screen;
}

function defaultHistoryOpen(): boolean {
  return typeof window !== 'undefined' && window.innerWidth >= 1000 && window.innerHeight >= 600;
}

export function App({ initialScreen = 'start' }: AppProps) {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [leaving, setLeaving] = useState(false);
  const [saved, setSaved] = useState<LoadedGame | null>(() => (initialScreen === 'start' ? loadSavedGame() : null));
  const [ui, dispatch] = useReducer(uiReducer, undefined, () =>
    createUiState(undefined, { aiSide: AI_SIDE, difficulty: loadDifficulty() }),
  );
  const [helpOpen, setHelpOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(defaultHistoryOpen);
  const [debug, setDebug] = useState(isBoardDebugEnabled);
  const showDebugControl = useRef(isBoardDebugEnabled()).current;

  const inGame = screen === 'game' && !leaving;
  const modalOpen = screen === 'start' || helpOpen || confirmOpen;
  const aiState = getAiState(ui);
  const activity = getActivity(ui);
  const presenting = isPresenting(ui);

  useAiOpponent(ui, dispatch, inGame && !replaying);
  useGameAudio(ui);

  // Audio unlocks on the first interaction; mute/volume drive the master level.
  useEffect(() => initAudio(), []);

  // Save after every completed engine state (never mid-move / mid-combat).
  const ply = ui.game.history.length;
  useEffect(() => {
    if (screen === 'game' && !replaying) saveGame(ui);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, replaying, ui.gameId, ply, presenting, ui.game.status, ui.difficulty]);

  const setDifficulty = useCallback((d: Difficulty) => {
    dispatch({ type: 'setDifficulty', difficulty: d });
    saveDifficulty(d);
  }, []);

  const enterGame = () => {
    setLeaving(true);
    window.setTimeout(() => {
      setScreen('game');
      setLeaving(false);
    }, START_TRANSITION_MS);
  };
  const playNew = () => {
    clearSavedGame();
    setSaved(null);
    dispatch({ type: 'newGame' });
    enterGame();
  };
  const resume = () => {
    if (saved) {
      dispatch({
        type: 'load',
        state: createUiState(saved.game, { aiSide: AI_SIDE, difficulty: saved.difficulty, lastMove: saved.lastMove }),
      });
      saveDifficulty(saved.difficulty);
    }
    setSaved(null);
    enterGame();
  };

  const gameOver = ui.game.status !== 'playing';
  const newGameDisabled = presenting || aiState === 'thinking';
  const requestNewGame = () => {
    if (newGameDisabled) return;
    if (gameOver || ply === 0) dispatch({ type: 'newGame' });
    else setConfirmOpen(true);
  };

  const modalRef = useRef(modalOpen);
  modalRef.current = modalOpen;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target)) {
        toggleSound();
        return;
      }
      if (modalRef.current) return; // dialogs handle their own keys
      if (e.key === 'Escape') dispatch({ type: 'clearSelection' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const debugControl = showDebugControl ? (
    <label className="toolbar__debug">
      <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} /> Debug
    </label>
  ) : undefined;

  return (
    <>
      <main className="app" inert={modalOpen || undefined} style={{ '--side-w': historyOpen ? 'var(--side-panel-w)' : '0px' } as React.CSSProperties}>
        {replaying ? (
          <ReplayView records={ui.game.history} onExit={() => setReplaying(false)} showPanel={historyOpen} debug={debug} />
        ) : (
          <>
            <Hud
              status={getStatusView(ui.game, aiState)}
              activity={activity}
              aiSide={ui.aiSide}
              difficulty={ui.difficulty}
              onDifficulty={setDifficulty}
              difficultyDisabled={newGameDisabled}
              newGameDisabled={newGameDisabled}
              onNewGame={requestNewGame}
              onHelp={() => setHelpOpen(true)}
              historyOpen={historyOpen}
              onToggleHistory={() => setHistoryOpen((o) => !o)}
              debugControl={debugControl}
            />
            <div className="game-layout">
              <GameBoard
                ui={ui}
                dispatch={dispatch}
                debug={debug}
                onNewGame={() => dispatch({ type: 'newGame' })}
                onReplay={ply > 0 ? () => setReplaying(true) : null}
              />
              {historyOpen && <SidePanel history={ui.game.history} />}
            </div>
          </>
        )}
      </main>
      {ui.combat && !replaying && <CombatOverlay key={ui.combat.id} combat={ui.combat} dispatch={dispatch} />}
      {screen === 'start' && (
        <StartScreen
          difficulty={ui.difficulty}
          onDifficulty={setDifficulty}
          canResume={saved !== null}
          onPlay={playNew}
          onResume={resume}
          leaving={leaving}
        />
      )}
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
      {confirmOpen && (
        <ConfirmNewGameDialog
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            dispatch({ type: 'newGame' });
          }}
        />
      )}
      <div className="rotate-hint" role="note">
        <div className="rotate-hint__icon" aria-hidden="true">
          ⟲
        </div>
        <p>Xoay điện thoại sang ngang để chơi</p>
      </div>
    </>
  );
}

/** True when the key event comes from a text-entry control (shortcuts are ignored there). */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range'].includes(target.type);
  return false;
}
