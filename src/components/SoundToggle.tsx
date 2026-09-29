import { useSyncExternalStore } from 'react';
import { isMuted, subscribeMute, toggleSound } from '../audio/index.ts';

/** Toolbar sound on/off (persisted). Also toggled with the M key. */
export function SoundToggle() {
  const muted = useSyncExternalStore(subscribeMute, isMuted, isMuted);
  return (
    <button
      type="button"
      className={muted ? 'toolbar__button sound-toggle is-muted' : 'toolbar__button sound-toggle'}
      aria-pressed={!muted}
      aria-label={muted ? 'Sound OFF (press M to turn on)' : 'Sound ON (press M to mute)'}
      title={muted ? 'Sound OFF (M)' : 'Sound ON (M)'}
      data-testid="sound-toggle"
      onClick={() => toggleSound()}
    >
      <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
    </button>
  );
}
