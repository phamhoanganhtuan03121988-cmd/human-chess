import { useSyncExternalStore } from 'react';
import { getVolume, setVolume, subscribeVolume } from '../../audio/index.ts';

/** Master volume (persisted). */
export function VolumeSlider({ id }: { id?: string }) {
  const volume = useSyncExternalStore(subscribeVolume, getVolume, getVolume);
  return (
    <input
      id={id}
      type="range"
      className="volume-slider"
      min={0}
      max={100}
      step={5}
      value={Math.round(volume * 100)}
      aria-label="Âm lượng"
      aria-valuetext={`${Math.round(volume * 100)}%`}
      data-testid="volume-slider"
      onChange={(e) => setVolume(Number(e.target.value) / 100)}
    />
  );
}
