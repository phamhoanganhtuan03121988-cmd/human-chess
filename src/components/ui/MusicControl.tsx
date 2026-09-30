import { useSyncExternalStore } from 'react';
import {
  getMusicStatus,
  getMusicVolume,
  isMusicEnabled,
  setMusicEnabled,
  setMusicVolume,
  subscribeMusicSettings,
  subscribeMusicStatus,
} from '../../audio/index.ts';

/**
 * Background-music on/off and volume (persisted). The master sound toggle and
 * volume still apply on top. Disabled, with an explanation, when the
 * soundtrack file is not available.
 */
export function MusicControl({ id }: { id?: string }) {
  const enabled = useSyncExternalStore(subscribeMusicSettings, isMusicEnabled, isMusicEnabled);
  const volume = useSyncExternalStore(subscribeMusicSettings, getMusicVolume, getMusicVolume);
  const status = useSyncExternalStore(subscribeMusicStatus, getMusicStatus, getMusicStatus);
  const unavailable = status === 'unavailable';
  const label = unavailable ? 'Nhạc nền chưa có' : enabled ? 'Nhạc nền BẬT' : 'Nhạc nền TẮT';
  return (
    <span className="music-control" data-status={status}>
      <button
        type="button"
        className={enabled && !unavailable ? 'toolbar__button music-toggle is-on' : 'toolbar__button music-toggle'}
        aria-pressed={enabled && !unavailable}
        aria-label={label}
        title={label}
        disabled={unavailable}
        data-testid="music-toggle"
        onClick={() => setMusicEnabled(!enabled)}
      >
        <span aria-hidden="true">♪</span>
      </button>
      <input
        id={id}
        type="range"
        className="volume-slider volume-slider--music"
        min={0}
        max={100}
        step={5}
        value={Math.round(volume * 100)}
        disabled={unavailable || !enabled}
        aria-label="Âm lượng nhạc nền"
        aria-valuetext={`${Math.round(volume * 100)}%`}
        data-testid="music-volume"
        onChange={(e) => setMusicVolume(Number(e.target.value) / 100)}
      />
    </span>
  );
}
