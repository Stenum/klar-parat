import { useCallback, useMemo, useRef, useState } from 'react';

const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAB9AAACABAAZGF0YQAAAAA=';

type VoicePlayer = {
  enabled: boolean;
  enabling: boolean;
  error: string | null;
  enable: () => Promise<boolean>;
  play: (audioUrl: string) => Promise<void>;
  setError: (message: string | null) => void;
};

export const useVoicePlayer = (): VoicePlayer => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'auto';
    }
    return audioRef.current;
  }, []);

  const enable = useCallback(async () => {
    if (enabled) {
      return true;
    }

    if (enabling) {
      return false;
    }

    setEnabling(true);

    try {
      const audio = ensureAudio();
      audio.src = SILENT_WAV;
      audio.load();
      await audio.play();
      setEnabled(true);
      setError(null);
      return true;
    } catch (err) {
      console.error(err);
      setError('Unable to enable voice playback. Please try again.');
      return false;
    } finally {
      setEnabling(false);
    }
  }, [enabled, enabling, ensureAudio]);

  const play = useCallback(
    async (audioUrl: string) => {
      const audio = ensureAudio();
      audio.pause();
      audio.currentTime = 0;
      audio.src = audioUrl;
      audio.load();
      await audio.play();
    },
    [ensureAudio]
  );

  return useMemo(
    () => ({
      enabled,
      enabling,
      error,
      enable,
      play,
      setError
    }),
    [enabled, enabling, error, enable, play, setError]
  );
};
