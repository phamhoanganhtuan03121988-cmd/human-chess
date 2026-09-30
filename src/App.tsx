import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { Difficulty } from './ai/difficulty.ts';
import { initAudio, requestMusic, toggleSound } from './audio/index.ts';
import { CharacterActionCard } from './components/CharacterActionCard.tsx';
import { CombatOverlay } from './components/combat/CombatOverlay.tsx';
import { ConfirmNewGameDialog } from './components/ConfirmDialog.tsx';
import { GameBoard } from './components/GameBoard.tsx';
import { getBoardPerspective } from './board/perspective.ts';
import { HelpDialog } from './components/HelpDialog.tsx';
import { Hud } from './components/Hud.tsx';
import { ReplayView } from './components/ReplayView.tsx';
import { SidePanel } from './components/SidePanel.tsx';
import { StartScreen } from './components/StartScreen.tsx';
import { OnlineLobby } from './components/online/OnlineLobby.tsx';
import { SurrenderDialog } from './components/online/SurrenderDialog.tsx';
import { WaitingRoom } from './components/online/WaitingRoom.tsx';
import type { GameMode } from './multiplayer/types.ts';
import { useOnlineGame } from './game/useOnlineGame.ts';
import { roomIdFromPath, setRoomPath } from './game/route.ts';
import { isBoardDebugEnabled } from './config/debug.ts';
import { pieceAt } from './engine/index.ts';
import {
  createUiState,
  getActivity,
  getAiState,
  getStatusView,
  isFinished,
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
  // A shared room link (/room/KX7P9A) opens straight into online play.
  const linkedRoom = useRef(roomIdFromPath()).current;
  const [inviteRoom, setInviteRoom] = useState<string | null>(linkedRoom);
  const [mode, setMode] = useState<GameMode>(linkedRoom ? 'online' : 'local-ai');
  const [screen, setScreen] = useState<Screen>(linkedRoom ? 'game' : initialScreen);
  const [leaving, setLeaving] = useState(false);
  const [saved, setSaved] = useState<LoadedGame | null>(() => (initialScreen === 'start' && !linkedRoom ? loadSavedGame() : null));
  const [ui, dispatch] = useReducer(uiReducer, undefined, () =>
    createUiState(undefined, { aiSide: AI_SIDE, difficulty: loadDifficulty() }),
  );
  const [helpOpen, setHelpOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(defaultHistoryOpen);
  const [surrenderOpen, setSurrenderOpen] = useState(false);
  const [debug, setDebug] = useState(isBoardDebugEnabled);
  const showDebugControl = useRef(isBoardDebugEnabled()).current;

  const inGame = screen === 'game' && !leaving;
  const isOnline = mode === 'online';
  const online = useOnlineGame(ui, dispatch, isOnline);
  const seated = isOnline && online.seat !== null && online.room !== null;
  // Presentation only: an online Blue seat sees the board from Blue's side.
  const boardPerspective = getBoardPerspective(isOnline ? (online.seat?.side ?? null) : null);
  const waitingForOpponent = seated && online.room!.status === 'waiting';
  const showLobby = isOnline && !seated;
  const modalOpen = screen === 'start' || helpOpen || confirmOpen || surrenderOpen || showLobby || waitingForOpponent;
  const aiState = getAiState(ui);
  const activity = getActivity(ui);
  const presenting = isPresenting(ui);

  useAiOpponent(ui, dispatch, inGame && !replaying && !isOnline);
  useGameAudio(ui);

  // Audio unlocks on the first interaction; mute/volume drive the master level.
  useEffect(() => initAudio(), []);

  // Save after every completed engine state (never mid-move / mid-combat).
  const ply = ui.game.history.length;
  useEffect(() => {
    if (screen === 'game' && !replaying && !isOnline) saveGame(ui); // online games live on the server
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, replaying, ui.gameId, ply, presenting, ui.game.status, ui.difficulty]);

  const setDifficulty = useCallback((d: Difficulty) => {
    dispatch({ type: 'setDifficulty', difficulty: d });
    saveDifficulty(d);
  }, []);

  const enterGame = () => {
    // "CHƠI VỚI MÁY" / "TIẾP TỤC" / "CHƠI ONLINE" is the user gesture that lets the background music start.
    requestMusic();
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

  // ---- online ----------------------------------------------------------------
  // Rejoin the remembered seat when a room link is opened again (refresh).
  useEffect(() => {
    if (linkedRoom) online.resume(linkedRoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Keep the room in the address bar so the page can be refreshed or shared.
  const seatRoom = isOnline ? (online.seat?.roomId ?? null) : null;
  useEffect(() => {
    if (seatRoom) setRoomPath(seatRoom);
  }, [seatRoom]);

  const playOnline = () => {
    requestMusic(); // a user gesture: background music may start
    setMode('online');
    setScreen('game');
  };
  const leaveOnline = () => {
    online.leave();
    setInviteRoom(null);
    setSurrenderOpen(false);
    setReplaying(false);
    setRoomPath(null);
    setMode('local-ai');
    dispatch({ type: 'load', state: createUiState(undefined, { aiSide: AI_SIDE, difficulty: ui.difficulty }) });
    setSaved(loadSavedGame());
    setScreen('start');
  };

  const gameOver = ui.game.status !== 'playing';
  // Character card for the selected piece (the board itself shows plain tokens).
  const selectedPiece = inGame && !replaying && ui.selected ? pieceAt(ui.game.board, ui.selected) : null;
  const newGameDisabled = presenting || aiState === 'thinking';
  const requestNewGame = () => {
    if (newGameDisabled) return;
    if (gameOver || ply === 0) dispatch({ type: 'newGame' });
    else setConfirmOpen(true);
  };

  const finished = isFinished(ui);
  const opponent = seated ? (online.seat!.side === 'red' ? online.room!.bluePlayer : online.room!.redPlayer) : null;
  const onlineHud = seated
    ? {
        connection: online.connection,
        roomId: online.seat!.roomId,
        mySide: online.seat!.side,
        opponent,
        playing: online.room!.status === 'playing' && !finished,
        onSurrender: () => setSurrenderOpen(true),
        onLeave: leaveOnline,
      }
    : null;

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
          <ReplayView
            records={ui.game.history}
            onExit={() => setReplaying(false)}
            showPanel={historyOpen}
            debug={debug}
            perspective={boardPerspective}
          />
        ) : (
          <>
            <Hud
              status={getStatusView(ui.game, aiState, ui.forfeit)}
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
              online={onlineHud}
            />
            <div className="game-layout">
              <GameBoard
                ui={ui}
                dispatch={dispatch}
                debug={debug}
                perspective={boardPerspective}
                onNewGame={isOnline ? leaveOnline : () => dispatch({ type: 'newGame' })}
                onReplay={ply > 0 ? () => setReplaying(true) : null}
              />
              {historyOpen && <SidePanel history={ui.game.history} />}
            </div>
          </>
        )}
      </main>
      {selectedPiece && (
        <CharacterActionCard
          key={`${selectedPiece.side}-${selectedPiece.type}`}
          side={selectedPiece.side}
          type={selectedPiece.type}
          moveCount={ui.legalMoves.length}
        />
      )}
      {ui.combat && !replaying && <CombatOverlay key={ui.combat.id} combat={ui.combat} dispatch={dispatch} />}
      {screen === 'start' && (
        <StartScreen
          difficulty={ui.difficulty}
          onDifficulty={setDifficulty}
          canResume={saved !== null}
          onPlay={playNew}
          onResume={resume}
          onPlayOnline={playOnline}
          leaving={leaving}
        />
      )}
      {showLobby && (
        <OnlineLobby
          initialRoomId={inviteRoom}
          busy={online.busy}
          problem={online.problem}
          onCreate={online.createRoom}
          onJoin={online.joinRoom}
          onBack={leaveOnline}
        />
      )}
      {waitingForOpponent && <WaitingRoom seat={online.seat!} connection={online.connection} onLeave={leaveOnline} />}
      {surrenderOpen && (
        <SurrenderDialog
          onCancel={() => setSurrenderOpen(false)}
          onConfirm={() => {
            setSurrenderOpen(false);
            online.surrender();
          }}
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
