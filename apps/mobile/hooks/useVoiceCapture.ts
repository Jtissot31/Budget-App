/**
 * Capture vocale : permission micro → enregistrement `expo-audio` → transcription Gemini.
 *
 * Tout le pipeline tient dans Expo Go (`expo-audio` est embarqué dans Expo Go, la
 * transcription passe par l'API Gemini déjà configurée) : aucun dev build requis.
 *
 * La capture démarre **seule** dès que `active` passe à true, et s'arrête **seule** après
 * ~1,5 s de silence — l'appelant n'a rien à lancer ni à couper.
 *
 * Pas de transcription en direct pendant que la personne parle : l'API Gemini utilisée est
 * requête/réponse, et le .m4a n'est lisible qu'une fois finalisé par `stop()`. Une vraie
 * reconnaissance continue demanderait un module natif (donc un dev build, pas Expo Go).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';

import {
  TranscriptionError,
  isSpeechTranscriptionAvailable,
  transcribeSpeechFromFile,
} from '@/lib/ai/transcribeSpeech';

export type VoiceCaptureStatus =
  | 'idle'
  | 'starting'
  | 'listening'
  | 'transcribing'
  | 'ready'
  | 'error';

export type VoiceCaptureErrorKind =
  | 'permission'
  | 'recording'
  | 'no-speech'
  | 'no-api-key'
  | 'network';

/** Garde-fou : au-delà, on coupe et on transcrit ce qui a été dit. */
const MAX_RECORDING_MS = 30_000;

/**
 * AAC mono en .m4a sur les deux plateformes.
 *
 * On n'utilise **pas** `RecordingPresets.LOW_QUALITY` : sur Android il produit du
 * AMR-NB dans un conteneur .3gp, un format que Gemini n'accepte pas (sa liste
 * couvre wav/mp3/aiff/aac/ogg/flac/mp4). Mono 64 kbps suffit largement pour de la
 * voix et garde la requête inline légère.
 */
const RECORDING_OPTIONS: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 64000,
  isMeteringEnabled: true,
  android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MEDIUM,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: 'audio/webm', bitsPerSecond: 64000 },
};

/** Cadence de lecture du niveau micro — onde fluide et détection de silence fine. */
const METERING_INTERVAL_MS = 150;

/** Au-dessus : on considère que ça parle (0..1 normalisé, ~-39 dBFS). */
const SPEECH_LEVEL = 0.35;
/** Silence continu après avoir parlé → coupure automatique. */
const SILENCE_HOLD_MS = 1_500;
/** Laisse le temps au micro de monter avant d'évaluer le silence. */
const START_GRACE_MS = 800;
/** Personne n'a parlé du tout : on coupe et on affiche « je n'ai rien entendu ». */
const NO_SPEECH_TIMEOUT_MS = 7_000;

/** dBFS (~-60 silence, 0 saturation) → 0..1 pour l'animation d'onde. */
function normalizeMetering(metering: number | undefined): number {
  if (metering === undefined || Number.isNaN(metering)) return 0;
  return Math.min(1, Math.max(0, (metering + 60) / 60));
}

export type VoiceCapture = {
  status: VoiceCaptureStatus;
  errorKind: VoiceCaptureErrorKind | null;
  transcript: string;
  /** Niveau sonore normalisé 0..1 — pilote l'onde animée. */
  level: number;
  durationMillis: number;
  /**
   * True quand la plateforme remonte bien le niveau micro : la capture se coupe
   * alors seule après un silence. Sinon, seul le bouton stop (ou le cap 30s) coupe.
   */
  silenceAutoStop: boolean;
  /** Coupe le micro et lance la transcription. */
  stop: () => void;
  /** Relance une capture complète (permission incluse). */
  retry: () => void;
  /** Correction manuelle du texte reconnu. */
  editTranscript: (value: string) => void;
};

export function useVoiceCapture(active: boolean): VoiceCapture {
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, METERING_INTERVAL_MS);

  const [status, setStatus] = useState<VoiceCaptureStatus>('idle');
  const [errorKind, setErrorKind] = useState<VoiceCaptureErrorKind | null>(null);
  const [transcript, setTranscript] = useState('');
  const [attempt, setAttempt] = useState(0);

  // Lu depuis des callbacks async : doit refléter le rendu courant, pas une clôture figée.
  const statusRef = useRef(status);
  statusRef.current = status;

  const activeRef = useRef(active);
  activeRef.current = active;

  const abortRef = useRef<AbortController | null>(null);

  // Détection de silence — pilotée par le métering, donc sans effet si la plateforme ne le remonte pas.
  const [meteringAvailable, setMeteringAvailable] = useState(false);
  const speechSeenRef = useRef(false);
  const lastLoudAtRef = useRef(0);

  const fail = useCallback((kind: VoiceCaptureErrorKind) => {
    setErrorKind(kind);
    setStatus('error');
  }, []);

  const releaseAudioSession = useCallback(async () => {
    try {
      await setAudioModeAsync({ allowsRecording: false });
    } catch {
      // Session audio déjà libérée — sans effet sur la transcription.
    }
  }, []);

  useEffect(() => {
    if (!active) {
      setStatus('idle');
      setErrorKind(null);
      setTranscript('');
      return;
    }

    let cancelled = false;
    setTranscript('');
    setErrorKind(null);
    setStatus('starting');

    void (async () => {
      if (!isSpeechTranscriptionAvailable()) {
        if (!cancelled) fail('no-api-key');
        return;
      }

      let granted = false;
      try {
        ({ granted } = await AudioModule.requestRecordingPermissionsAsync());
      } catch {
        if (!cancelled) fail('permission');
        return;
      }

      if (cancelled) return;
      if (!granted) {
        fail('permission');
        return;
      }

      try {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        if (cancelled) return;

        // `prepareToRecordAsync` doit être attendu, sinon `record()` échoue en silence.
        await recorder.prepareToRecordAsync();
        if (cancelled) return;

        recorder.record();
        setStatus('listening');
      } catch {
        if (!cancelled) fail('recording');
      }
    })();

    return () => {
      cancelled = true;
      abortRef.current?.abort();
      abortRef.current = null;
      // Peut échouer si rien n'était en cours (feuille fermée avant le démarrage du micro).
      try {
        void recorder.stop().catch(() => undefined);
      } catch {
        // Enregistreur non préparé — rien à libérer.
      }
      void releaseAudioSession();
    };
  }, [active, attempt, fail, recorder, releaseAudioSession]);

  const stop = useCallback(() => {
    if (statusRef.current !== 'listening') return;
    setStatus('transcribing');

    void (async () => {
      let uri: string | null = null;
      try {
        await recorder.stop();
        uri = recorder.uri;
      } catch {
        await releaseAudioSession();
        if (activeRef.current) fail('recording');
        return;
      }

      await releaseAudioSession();

      if (!uri) {
        if (activeRef.current) fail('recording');
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const text = await transcribeSpeechFromFile(uri, controller.signal);
        if (!activeRef.current || controller.signal.aborted) return;
        setTranscript(text);
        setStatus('ready');
      } catch (error) {
        if (!activeRef.current || controller.signal.aborted) return;
        fail(error instanceof TranscriptionError ? error.kind : 'network');
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    })();
  }, [fail, recorder, releaseAudioSession]);

  // Coupure automatique : évite un micro laissé ouvert et un clip trop lourd pour l'inline.
  useEffect(() => {
    if (status !== 'listening') return;
    const timer = setTimeout(stop, MAX_RECORDING_MS);
    return () => clearTimeout(timer);
  }, [status, stop]);

  // Suit le niveau micro pour savoir quand la personne a parlé, puis s'est tue.
  useEffect(() => {
    if (status !== 'listening') return;

    if (recorderState.metering !== undefined && !Number.isNaN(recorderState.metering)) {
      setMeteringAvailable(true);
    }

    if (normalizeMetering(recorderState.metering) >= SPEECH_LEVEL) {
      speechSeenRef.current = true;
      lastLoudAtRef.current = Date.now();
    }
  }, [recorderState.metering, status]);

  // Fin de phrase = silence tenu. Sans métering fiable, on laisse le bouton stop et le cap 30s faire.
  useEffect(() => {
    if (status !== 'listening') {
      speechSeenRef.current = false;
      lastLoudAtRef.current = 0;
      return;
    }
    if (!meteringAvailable) return;

    const startedAt = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      if (elapsed < START_GRACE_MS) return;

      if (!speechSeenRef.current) {
        if (elapsed >= NO_SPEECH_TIMEOUT_MS) stop();
        return;
      }

      if (Date.now() - lastLoudAtRef.current >= SILENCE_HOLD_MS) stop();
    }, METERING_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [meteringAvailable, status, stop]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  const editTranscript = useCallback((value: string) => setTranscript(value), []);

  return {
    status,
    errorKind,
    transcript,
    level: status === 'listening' ? normalizeMetering(recorderState.metering) : 0,
    durationMillis: recorderState.durationMillis ?? 0,
    silenceAutoStop: meteringAvailable,
    stop,
    retry,
    editTranscript,
  };
}
