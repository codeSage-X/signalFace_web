'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Crop as CropIcon,
  Image as ImageIcon,
  Loader2,
  Play,
  Square,
  RectangleHorizontal,
  RectangleVertical,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ASPECT_RATIOS,
  FILTER_PRESETS,
  IMAGE_RATIOS,
  NEUTRAL_ADJUSTMENTS,
  VIDEO_RATIOS,
  extractFrames,
  ratioValue,
  renderCover,
  renderImage,
  toCssFilter,
  type Adjustments,
  type AspectRatio,
  type VideoFrame,
} from './mediaEditing';

export interface ComposerResult {
  /** The processed files, in the order they were given. */
  files: File[];
  aspectRatio: AspectRatio;
  /** Only produced for a video post whose author picked a frame. */
  cover?: File;
  /** Whether the video should start with sound on. */
  soundOn: boolean;
}

type Step = 'crop' | 'edit';

const RATIO_ICONS: Record<AspectRatio, typeof Square> = {
  ORIGINAL: ImageIcon,
  '1:1': Square,
  '4:5': RectangleVertical,
  '16:9': RectangleHorizontal,
  '9:16': RectangleVertical,
};

const ADJUSTMENT_FIELDS: { key: keyof Adjustments; label: string; min: number }[] = [
  { key: 'brightness', label: 'Brightness', min: -100 },
  { key: 'contrast', label: 'Contrast', min: -100 },
  { key: 'fade', label: 'Fade', min: 0 },
  { key: 'saturation', label: 'Saturation', min: -100 },
  { key: 'temperature', label: 'Temperature', min: -100 },
  { key: 'vignette', label: 'Vignette', min: 0 },
];

/**
 * The two-step post composer: frame the media, then edit it.
 *
 * Step two slides a panel out of the right edge and the shell grows to meet it,
 * which is why the width is animated on the container rather than the panel —
 * animating the panel alone would have it overlap the media instead of the media
 * making room for it.
 */
export function MediaComposer({
  files,
  isVideo,
  onCancel,
  onDone,
}: {
  files: File[];
  /** Drives which ratios are offered and whether step two edits or covers. */
  isVideo: boolean;
  onCancel: () => void;
  onDone: (result: ComposerResult) => void;
}) {
  const [step, setStep] = useState<Step>('crop');
  const [ratio, setRatio] = useState<AspectRatio>('ORIGINAL');
  const [adjustments, setAdjustments] = useState<Adjustments>(NEUTRAL_ADJUSTMENTS);
  const [presetName, setPresetName] = useState('Original');
  const [panelTab, setPanelTab] = useState<'Filters' | 'Adjustments'>('Filters');
  const [soundOn, setSoundOn] = useState(true);

  const [frames, setFrames] = useState<VideoFrame[]>([]);
  const [framesLoading, setFramesLoading] = useState(false);
  const [coverTime, setCoverTime] = useState<number | null>(null);

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);

  const ratios = isVideo ? VIDEO_RATIOS : IMAGE_RATIOS;

  // One blob URL per file, created once and revoked on unmount — recreating them
  // per render would leak a URL on every keystroke of a slider.
  /**
   * Blob URLs for the selected files.
   *
   * Created inside the effect, not in a memo. With the memo, StrictMode's
   * mount/unmount/remount ran the cleanup and revoked every URL, then remounted
   * without re-running the memo — so the second pass held dead URLs and every
   * preview rendered as a broken image. Creating them here means the remount
   * makes fresh ones.
   */
  const [previews, setPreviews] = useState<string[]>([]);
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const activePreview = previews[index];

  const trackRef = useRef<HTMLDivElement>(null);

  // Which slide is centred, read from scroll position so it is correct whether
  // the move came from a swipe, an arrow or a dot.
  const handleTrackScroll = () => {
    const el = trackRef.current;
    if (!el || !el.clientWidth) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    if (next >= 0 && next < files.length) setIndex(next);
  };

  const goToSlide = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const target = Math.max(0, Math.min(files.length - 1, i));
    el.scrollTo({ left: target * el.clientWidth, behavior: 'smooth' });
  };
  const frameRatio = ratioValue(ratio);
  const cssFilter = toCssFilter(adjustments);

  // Cover frames are only worth extracting once the author reaches step two.
  useEffect(() => {
    if (step !== 'edit' || !isVideo || frames.length || framesLoading) return;

    setFramesLoading(true);
    extractFrames(files[0])
      .then((result) => {
        setFrames(result);
        if (result.length) setCoverTime(result[0].time);
      })
      .catch(() => setError('Could not read frames from that video.'))
      .finally(() => setFramesLoading(false));
  }, [step, isVideo, files, frames.length, framesLoading]);

  const applyPreset = useCallback((name: string) => {
    const preset = FILTER_PRESETS.find((p) => p.name === name);
    if (!preset) return;
    setPresetName(name);
    // A preset is a starting point, so it replaces the sliders rather than
    // stacking on whatever was there before.
    setAdjustments({ ...NEUTRAL_ADJUSTMENTS, ...preset.adjustments });
  }, []);

  const finish = async () => {
    setProcessing(true);
    setError(null);

    try {
      if (isVideo) {
        // The video bytes are untouched — a browser can't re-encode one — so the
        // ratio travels as metadata and the cover as a separate still.
        const cover =
          coverTime !== null ? await renderCover(files[0], coverTime, ratio) : undefined;
        onDone({ files, aspectRatio: ratio, cover, soundOn });
        return;
      }

      // Images are genuinely cropped and filtered, so every viewer sees the
      // author's framing without needing to know the ratio.
      const processed: File[] = [];
      for (const file of files) {
        processed.push(await renderImage(file, ratio, adjustments));
      }
      onDone({ files: processed, aspectRatio: ratio, soundOn });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process that media.');
    } finally {
      setProcessing(false);
    }
  };

  const panelOpen = step === 'edit';

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div
        // Fixed width and height, at every step. The shell used to grow when the
        // panel appeared, which made the whole dialog jump; now it stays put and
        // the panel takes its space from the stage beside it.
        //
        // The explicit height also gives the stage something to be 100% of —
        // without it, an 'Original' media (which sets no aspect-ratio) had no
        // height to derive and the dialog collapsed to a strip.
        className="bg-[#1A1A1C] rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl
          flex flex-col w-full max-w-[1075px] h-[90vh] sm:h-[84vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 h-12 border-b border-white/10 flex-shrink-0">
          <button
            onClick={() => (step === 'edit' ? setStep('crop') : onCancel())}
            aria-label={step === 'edit' ? 'Back to crop' : 'Cancel'}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition"
          >
            <ArrowLeft size={18} />
          </button>

          <p className="text-white font-semibold text-sm">
            {step === 'crop' ? 'Crop' : 'Edit'}
          </p>

          <button
            onClick={() => (step === 'crop' ? setStep('edit') : finish())}
            disabled={processing}
            className="px-2 h-9 text-sm font-semibold text-[#7DA2FF] hover:text-white transition disabled:opacity-60 flex items-center gap-1.5"
          >
            {processing && <Loader2 size={13} className="animate-spin" />}
            {processing ? 'Working…' : 'Next'}
          </button>
        </div>

        {/* Stacked on small screens — a 384px panel cannot sit beside the stage
            on a 412px viewport — and side by side from `lg`. */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0">
          {/* Media stage */}
          <div className="relative flex-1 min-w-0 min-h-0 bg-[#111113] overflow-hidden">
            {/* One slide per selected file, on a native scroll-snap track: real
                swiping on touch and trackpad, with the arrows driving the same
                scroll. The previous version only had dots, so a multi-image post
                could be inspected but never swiped. */}
            <div
              ref={trackRef}
              onScroll={handleTrackScroll}
              className={`w-full h-full flex ${
                previews.length > 1 ? 'overflow-x-auto snap-x snap-mandatory' : 'overflow-hidden'
              } [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`}
            >
              {previews.map((preview, i) => (
                <div
                  key={preview}
                  className="w-full h-full flex-shrink-0 snap-center flex items-center justify-center p-2 sm:p-4"
                >
                  <div
                    className="relative overflow-hidden bg-black flex items-center justify-center"
                    // With a ratio the box takes the full height and derives its
                    // width, clamped so a wide frame can't overflow. Without one
                    // ('Original') it shrink-wraps the media below.
                    style={
                      frameRatio
                        ? { aspectRatio: String(frameRatio), height: '100%', maxWidth: '100%' }
                        : { maxWidth: '100%', maxHeight: '100%' }
                    }
                  >
                    {isVideo ? (
                      <video
                        src={preview}
                        className={frameRatio ? 'w-full h-full object-cover' : 'max-w-full max-h-full'}
                        style={{ filter: cssFilter }}
                        muted={!soundOn}
                        controls={step === 'edit'}
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={preview}
                        alt=""
                        // Covers only once a ratio is chosen — that crop is the
                        // author's decision. 'Original' shows the whole image.
                        className={frameRatio ? 'w-full h-full object-cover' : 'max-w-full max-h-full'}
                        style={{ filter: cssFilter }}
                      />
                    )}

                    {/* Vignette can't be a CSS filter, so it previews as an overlay. */}
                    {adjustments.vignette > 0 && (
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,${
                            adjustments.vignette / 100
                          }) 100%)`,
                        }}
                      />
                    )}

                    {isVideo && step === 'crop' && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                          <Play size={24} fill="white" className="text-white ml-0.5" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Arrows are pointer-only; touch users swipe the track. */}
            {previews.length > 1 && (
              <>
                {index > 0 && (
                  <button
                    onClick={() => goToSlide(index - 1)}
                    aria-label="Previous item"
                    className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm items-center justify-center z-10 hover:bg-black/80 transition"
                  >
                    <ChevronLeft size={17} className="text-white" />
                  </button>
                )}
                {index < previews.length - 1 && (
                  <button
                    onClick={() => goToSlide(index + 1)}
                    aria-label="Next item"
                    className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm items-center justify-center z-10 hover:bg-black/80 transition"
                  >
                    <ChevronRight size={17} className="text-white" />
                  </button>
                )}
              </>
            )}

            {/* Ratio picker — bottom-left, as in the design */}
            {step === 'crop' && (
              <div className="absolute bottom-3 left-3 rounded-xl bg-black/70 backdrop-blur-md overflow-hidden">
                {ratios.map((option) => {
                  const Icon = RATIO_ICONS[option];
                  const selected = ratio === option;
                  return (
                    <button
                      key={option}
                      onClick={() => setRatio(option)}
                      className={`flex items-center justify-between gap-6 w-full px-3 py-2 text-sm transition ${
                        selected
                          ? 'bg-white/10 text-white font-semibold'
                          : 'text-white/70 hover:bg-white/5'
                      }`}
                    >
                      <span>{option === 'ORIGINAL' ? 'Original' : option}</span>
                      <Icon size={15} className="flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Which item is on screen. The ratio and look apply to every item,
                so these only move the track. */}
            {files.length > 1 && (
              <div className="absolute bottom-3 right-3 flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-black/60 backdrop-blur-sm">
                <span className="text-white text-[11px] font-semibold tabular-nums">
                  {index + 1}/{files.length}
                </span>
                <span className="flex gap-1.5">
                  {files.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => goToSlide(i)}
                      aria-label={`Go to item ${i + 1}`}
                      className={`w-2 h-2 rounded-full transition ${
                        i === index ? 'bg-white' : 'bg-white/40'
                      }`}
                    />
                  ))}
                </span>
              </div>
            )}

            {step === 'crop' && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/60 text-white/80 text-[11px]">
                <CropIcon size={11} />
                {ratio === 'ORIGINAL' ? 'Original' : ratio}
              </div>
            )}
          </div>

          {/* The panel that slides out. Rendered only at step two, and its own
              translate gives it the sideways entrance over the widening shell. */}
          {panelOpen && (
            <div
              className="w-full lg:w-[384px] flex-shrink-0 border-t lg:border-t-0 lg:border-l border-white/10
                bg-[#1A1A1C] overflow-y-auto
                max-h-[45%] lg:max-h-none
                animate-[composer-slide-up_400ms_ease-out] lg:animate-[composer-slide_400ms_ease-out]"
            >
              {isVideo ? (
                <VideoPanel
                  frames={frames}
                  loading={framesLoading}
                  coverTime={coverTime}
                  onPickCover={setCoverTime}
                  soundOn={soundOn}
                  onToggleSound={() => setSoundOn((s) => !s)}
                />
              ) : (
                <ImagePanel
                  tab={panelTab}
                  onTab={setPanelTab}
                  preview={activePreview}
                  presetName={presetName}
                  onPreset={applyPreset}
                  adjustments={adjustments}
                  onAdjust={(key, value) => {
                    setAdjustments((prev) => ({ ...prev, [key]: value }));
                    // Sliders move the look away from the preset it started from.
                    setPresetName('Custom');
                  }}
                />
              )}
            </div>
          )}
        </div>

        {error && (
          <p className="px-4 py-2 text-xs text-red-300 bg-red-500/10 border-t border-red-500/20">
            {error}
          </p>
        )}
      </div>

    </div>
  );
}

function VideoPanel({
  frames,
  loading,
  coverTime,
  onPickCover,
  soundOn,
  onToggleSound,
}: {
  frames: VideoFrame[];
  loading: boolean;
  coverTime: number | null;
  onPickCover: (time: number) => void;
  soundOn: boolean;
  onToggleSound: () => void;
}) {
  return (
    <div className="p-4 space-y-6">
      <div>
        <p className="text-white font-semibold text-sm mb-3">Cover photo</p>

        {loading ? (
          <div className="flex items-center gap-2 text-white/60 text-xs">
            <Loader2 size={13} className="animate-spin" />
            Reading frames…
          </div>
        ) : frames.length === 0 ? (
          <p className="text-white/50 text-xs">
            No frames available. The first frame will be used.
          </p>
        ) : (
          <>
            <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {frames.map((frame) => {
                const selected = coverTime === frame.time;
                return (
                  <button
                    key={frame.time}
                    onClick={() => onPickCover(frame.time)}
                    aria-label={`Use the frame at ${frame.time.toFixed(1)} seconds`}
                    className={`relative flex-shrink-0 h-16 w-11 rounded-md overflow-hidden transition ${
                      selected
                        ? 'ring-2 ring-white'
                        : 'ring-1 ring-white/15 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={frame.dataUrl} alt="" className="w-full h-full object-cover" />
                  </button>
                );
              })}
            </div>
            <p className="text-white/40 text-[11px] mt-2">
              {coverTime !== null
                ? `Cover taken at ${coverTime.toFixed(1)}s`
                : 'Pick the frame people see first.'}
            </p>
          </>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-white font-semibold text-sm">Sound on</span>
        <button
          onClick={onToggleSound}
          role="switch"
          aria-checked={soundOn}
          aria-label="Sound on"
          className={`relative w-11 h-6 rounded-full transition ${
            soundOn ? 'bg-white' : 'bg-white/20'
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full transition-all flex items-center justify-center ${
              soundOn ? 'left-[22px] bg-black' : 'left-0.5 bg-white'
            }`}
          >
            {soundOn ? (
              <Volume2 size={10} className="text-white" />
            ) : (
              <VolumeX size={10} className="text-black" />
            )}
          </span>
        </button>
      </div>
    </div>
  );
}

function ImagePanel({
  tab,
  onTab,
  preview,
  presetName,
  onPreset,
  adjustments,
  onAdjust,
}: {
  tab: 'Filters' | 'Adjustments';
  onTab: (tab: 'Filters' | 'Adjustments') => void;
  preview: string;
  presetName: string;
  onPreset: (name: string) => void;
  adjustments: Adjustments;
  onAdjust: (key: keyof Adjustments, value: number) => void;
}) {
  return (
    <div>
      <div className="flex border-b border-white/10 sticky top-0 bg-[#1A1A1C] z-10">
        {(['Filters', 'Adjustments'] as const).map((option) => (
          <button
            key={option}
            onClick={() => onTab(option)}
            className={`flex-1 py-3 text-sm font-semibold transition ${
              tab === option
                ? 'text-[#7DA2FF] border-b-2 border-[#7DA2FF]'
                : 'text-white/60 hover:text-white'
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {tab === 'Filters' ? (
        <div className="p-4 grid grid-cols-3 gap-3">
          {FILTER_PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => onPreset(preset.name)}
              className="group"
            >
              <span
                className={`block aspect-square rounded-lg overflow-hidden ring-2 transition ${
                  presetName === preset.name ? 'ring-white' : 'ring-transparent'
                }`}
              >
                <img
                  src={preview}
                  alt=""
                  className="w-full h-full object-cover"
                  // Each swatch previews its own look on the real image.
                  style={{
                    filter: toCssFilter({ ...NEUTRAL_ADJUSTMENTS, ...preset.adjustments }),
                  }}
                />
              </span>
              <span
                className={`block mt-1 text-[11px] truncate ${
                  presetName === preset.name ? 'text-white font-semibold' : 'text-white/60'
                }`}
              >
                {preset.name}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="p-4 space-y-5">
          {ADJUSTMENT_FIELDS.map(({ key, label, min }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor={`adj-${key}`} className="text-white text-sm">
                  {label}
                </label>
                <span className="text-white/50 text-xs tabular-nums">{adjustments[key]}</span>
              </div>
              <input
                id={`adj-${key}`}
                type="range"
                min={min}
                max={100}
                value={adjustments[key]}
                onChange={(e) => onAdjust(key, Number(e.target.value))}
                className="w-full accent-white"
              />
            </div>
          ))}

          <button
            onClick={() => onPreset('Original')}
            className="text-xs text-white/60 hover:text-white transition"
          >
            Reset all
          </button>
        </div>
      )}
    </div>
  );
}

export { ASPECT_RATIOS };
