import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, AlertTriangle, Pause, Play, Repeat2 } from 'lucide-react'
import { gsap } from 'gsap'
import { CANVAS_DIMENSIONS, DEFAULT_CODE } from '../shared/utils/constants'
import desktopMonitorUrl from '../../assets/preview/desktop-monitor.png'
import phonePortraitUrl from '../../assets/preview/phone-portrait.png'
import './ProjectPreview.css'

type PreviewFormat = 'landscape' | 'portrait'

interface PreviewLayer {
  id?: string | number
  elementId?: string
  name?: string
  type?: string
  base64?: string
  url?: string
  zIndex?: number
  x?: number
  y?: number
  width?: number
  height?: number
  opacity?: number
  rotation?: number
  text?: string
  fontSize?: number
  fontFamily?: string
  color?: string
  fontWeight?: string
  textAlign?: CanvasTextAlign
}

interface ProjectPreviewProps {
  projectName?: string
  images?: PreviewLayer[]
  code?: string
  cssCode?: string
  format?: PreviewFormat
  sourceFormat?: PreviewFormat
  sceneBackground?: string
  sceneBorderStyle?: string
  sceneBorderColor?: string
  onBack: () => void
}

const getCanvasDimensions = (format: PreviewFormat) => (
  CANVAS_DIMENSIONS[format] || CANVAS_DIMENSIONS.landscape
)

const getLayerKey = (layer: PreviewLayer, index: number) => (
  String(layer.id || layer.elementId || `preview-layer-${index}`)
)

const PLAYBACK_RATES = [0.5, 1, 1.5, 2]

const formatTimelineTime = (seconds: number) => {
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds - minutes * 60

  return `${String(minutes).padStart(2, '0')}:${remainingSeconds.toFixed(1).padStart(4, '0')}`
}

const applyTimelineLoopMode = (timeline: gsap.core.Timeline, isLooping: boolean) => {
  timeline.repeat(isLooping ? -1 : 0)

  if (isLooping) {
    return
  }

  timeline.getChildren(true, true, true).forEach((animation) => {
    animation.repeat(0)
  })
}

/**
 * Renders a routed project preview inside the matching device mockup.
 */
const ProjectPreview = ({
  projectName = 'Creative',
  images = [],
  code = DEFAULT_CODE,
  cssCode = '',
  format = 'landscape',
  sourceFormat = 'landscape',
  sceneBackground = '#ffffff',
  sceneBorderStyle = 'none',
  sceneBorderColor = '#000000',
  onBack
}: ProjectPreviewProps) => {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const playbackRateRef = useRef(1)
  const isLoopingRef = useRef(false)
  const hasCompletedPlaybackRef = useRef(false)
  const [stageScale, setStageScale] = useState(1)
  const [animationError, setAnimationError] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isLooping, setIsLooping] = useState(false)

  const canvasDimensions = getCanvasDimensions(format)
  const sourceDimensions = getCanvasDimensions(sourceFormat)
  const isPortraitPreview = format === 'portrait'
  const deviceMockupUrl = isPortraitPreview ? phonePortraitUrl : desktopMonitorUrl
  const deviceMockupLabel = isPortraitPreview ? 'phone' : 'desktop monitor'

  const preparedLayers = useMemo(() => {
    const scaleX = canvasDimensions.width / sourceDimensions.width
    const scaleY = canvasDimensions.height / sourceDimensions.height
    const fontScale = Math.min(scaleX, scaleY)

    return [...images]
      .sort((leftLayer, rightLayer) => (leftLayer.zIndex || 0) - (rightLayer.zIndex || 0))
      .map((layer, index) => ({
        ...layer,
        elementId: layer.elementId || String(layer.id || `preview-layer-${index}`),
        zIndex: layer.zIndex ?? index,
        x: (layer.x || 0) * scaleX,
        y: (layer.y || 0) * scaleY,
        width: layer.width ? layer.width * scaleX : undefined,
        height: layer.height ? layer.height * scaleY : undefined,
        fontSize: layer.fontSize ? layer.fontSize * fontScale : 16
      }))
  }, [canvasDimensions.height, canvasDimensions.width, images, sourceDimensions.height, sourceDimensions.width])

  useEffect(() => {
    const updateScale = () => {
      try {
        const viewport = viewportRef.current

        if (!viewport) {
          return
        }

        const viewportRect = viewport.getBoundingClientRect()
        const nextScale = Math.max(
          viewportRect.width / canvasDimensions.width,
          viewportRect.height / canvasDimensions.height
        ) * 1.01

        setStageScale(Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1)
      } catch {
        setStageScale(1)
      }
    }

    updateScale()

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateScale)
      : null

    if (resizeObserver && viewportRef.current) {
      resizeObserver.observe(viewportRef.current)
    }

    window.addEventListener('resize', updateScale)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateScale)
    }
  }, [canvasDimensions.height, canvasDimensions.width])

  useEffect(() => {
    let timeline: gsap.core.Timeline | null = null
    let isCancelled = false
    let lastSyncedTime = -1

    const syncTimelineClock = () => {
      const activeTimeline = timelineRef.current

      if (!activeTimeline) {
        return
      }

      const nextDuration = activeTimeline.duration()
      const nextTime = Math.min(activeTimeline.time(), nextDuration)
      const hasReachedEnd = nextDuration > 0 && nextTime >= nextDuration - 0.03

      if (!isLoopingRef.current && (hasCompletedPlaybackRef.current || hasReachedEnd)) {
        hasCompletedPlaybackRef.current = true
        activeTimeline.pause(nextDuration, false)
        setCurrentTime(nextDuration)
        setDuration(nextDuration)
        setIsPlaying(false)
        return
      }

      if (Math.abs(nextTime - lastSyncedTime) >= 0.04 || nextTime === 0 || nextTime === nextDuration) {
        lastSyncedTime = nextTime
        setCurrentTime(nextTime)
      }

      setDuration(nextDuration)
      setIsPlaying(!activeTimeline.paused() && nextTime < nextDuration)
    }

    const runAnimation = async () => {
      try {
        setAnimationError('')
        setCurrentTime(0)
        setDuration(0)
        setIsPlaying(false)
        hasCompletedPlaybackRef.current = false

        const stage = stageRef.current

        if (!stage || preparedLayers.length === 0) {
          return
        }

        const imageElements = Array.from(stage.querySelectorAll('img'))

        await Promise.all(
          imageElements.map((imageElement) => new Promise<void>((resolve) => {
            if (imageElement.complete) {
              resolve()
              return
            }

            imageElement.addEventListener('load', () => resolve(), { once: true })
            imageElement.addEventListener('error', () => resolve(), { once: true })
          }))
        )

        if (isCancelled) {
          return
        }

        const wrapperBody = `
          const timeline = gsap.timeline()
          timeline${code || DEFAULT_CODE}
          return timeline
        `
        const timelineFactory = new Function('gsap', 'images', 'container', wrapperBody)
        const nextTimeline = timelineFactory(gsap, [], stage)

        if (!nextTimeline || typeof nextTimeline.play !== 'function') {
          throw new Error('Animation timeline was not created.')
        }

        timeline = nextTimeline
        timelineRef.current = nextTimeline
        applyTimelineLoopMode(timeline, isLoopingRef.current)
        timeline.timeScale(playbackRateRef.current)
        timeline.eventCallback('onComplete', () => {
          if (isLoopingRef.current) {
            return
          }

          const timelineDuration = timeline?.duration() || 0
          hasCompletedPlaybackRef.current = true
          if (timeline) {
            applyTimelineLoopMode(timeline, false)
          }
          timeline?.pause(timelineDuration, false)
          setCurrentTime(timelineDuration)
          setIsPlaying(false)
        })
        timeline.play(0)
        setDuration(timeline.duration())
        setIsPlaying(true)
        gsap.ticker.add(syncTimelineClock)
      } catch (error) {
        if (!isCancelled) {
          setAnimationError(error instanceof Error ? error.message : 'Unable to run the preview animation.')
        }
      }
    }

    void runAnimation()

    return () => {
      isCancelled = true
      gsap.ticker.remove(syncTimelineClock)
      timelineRef.current = null
      timeline?.kill()
    }
  }, [code, preparedLayers])

  const handleTogglePlayback = () => {
    const timeline = timelineRef.current

    if (!timeline) {
      return
    }

    const timelineDuration = timeline.duration()

    if (timeline.time() >= timelineDuration) {
      hasCompletedPlaybackRef.current = false
      timeline.restart()
      setIsPlaying(true)
      return
    }

    if (timeline.paused()) {
      if (hasCompletedPlaybackRef.current) {
        hasCompletedPlaybackRef.current = false
        timeline.restart()
        setIsPlaying(true)
        return
      }

      timeline.play()
      setIsPlaying(true)
      return
    }

    timeline.pause()
    setIsPlaying(false)
  }

  const handlePlaybackRateChange = (nextRate: number) => {
    playbackRateRef.current = nextRate
    setPlaybackRate(nextRate)
    timelineRef.current?.timeScale(nextRate)
  }

  const handleToggleLoop = () => {
    const nextLooping = !isLoopingRef.current
    const timeline = timelineRef.current

    isLoopingRef.current = nextLooping
    if (nextLooping) {
      hasCompletedPlaybackRef.current = false
    }
    setIsLooping(nextLooping)

    if (!timeline) {
      return
    }

    applyTimelineLoopMode(timeline, nextLooping)

    if (nextLooping && timeline.time() >= timeline.duration()) {
      timeline.restart()
      setIsPlaying(true)
      return
    }

    if (!nextLooping && timeline.time() >= timeline.duration()) {
      hasCompletedPlaybackRef.current = true
      timeline.pause(timeline.duration(), false)
      setCurrentTime(timeline.duration())
      setIsPlaying(false)
    }
  }

  const handleTimelineSeek = (value: string) => {
    const timeline = timelineRef.current
    const nextTime = Number(value)

    if (!timeline || Number.isNaN(nextTime)) {
      return
    }

    timeline.time(Math.min(Math.max(nextTime, 0), duration || timeline.duration()), false)
    hasCompletedPlaybackRef.current = nextTime >= timeline.duration() - 0.03 && !isLoopingRef.current
    setCurrentTime(nextTime)
    setIsPlaying(!timeline.paused() && nextTime < timeline.duration())
  }

  return (
    <main className="project-preview-page">
      <style>{cssCode}</style>

      <header className="project-preview-header">
        <button type="button" className="project-preview-back" onClick={onBack}>
          <ArrowLeft size={16} />
          Back to studio
        </button>

        <div className="project-preview-title">
          <span>Routed preview</span>
          <strong>{projectName}</strong>
        </div>
      </header>

      <section
        className={`project-preview-monitor-shell ${
          isPortraitPreview ? 'project-preview-monitor-shell--portrait' : 'project-preview-monitor-shell--landscape'
        }`}
        aria-label={`${projectName} preview`}
      >
        <img
          className="project-preview-monitor-image"
          src={deviceMockupUrl}
          alt=""
          aria-label={`${deviceMockupLabel} mockup`}
          aria-hidden="true"
        />

        <div className="project-preview-screen" ref={viewportRef}>
          <div
            className="project-preview-stage"
            ref={stageRef}
            style={{
              width: `${canvasDimensions.width}px`,
              height: `${canvasDimensions.height}px`,
              backgroundColor: sceneBackground,
              border: sceneBorderStyle !== 'none' ? `1px ${sceneBorderStyle} ${sceneBorderColor}` : 'none',
              transform: `translate(-50%, -50%) scale(${stageScale})`
            }}
          >
            {preparedLayers.map((layer, index) => (
              <div
                key={getLayerKey(layer, index)}
                className="project-preview-layer"
                style={{
                  left: `${layer.x || 0}px`,
                  top: `${layer.y || 0}px`,
                  zIndex: layer.zIndex
                }}
              >
                {layer.type === 'text' ? (
                  <div
                    id={layer.elementId}
                    className="preview-text"
                    data-image-index={index}
                    style={{
                      width: layer.width ? `${layer.width}px` : 'auto',
                      opacity: layer.opacity ?? 1,
                      transform: layer.rotation ? `rotate(${layer.rotation}deg)` : 'none',
                      transformOrigin: 'center center',
                      fontSize: `${layer.fontSize || 16}px`,
                      fontFamily: layer.fontFamily || 'Arial',
                      color: layer.color || '#000000',
                      fontWeight: layer.fontWeight || 'normal',
                      textAlign: layer.textAlign || 'left'
                    }}
                  >
                    {layer.text || 'New text'}
                  </div>
                ) : (
                  <img
                    id={layer.elementId}
                    src={layer.base64 || layer.url || ''}
                    alt={layer.name || 'Preview layer'}
                    className="preview-image"
                    data-image-index={index}
                    style={{
                      width: layer.width ? `${layer.width}px` : 'auto',
                      height: layer.height ? `${layer.height}px` : 'auto',
                      maxWidth: `${canvasDimensions.width}px`,
                      maxHeight: `${canvasDimensions.height}px`,
                      opacity: layer.opacity ?? 1,
                      transform: layer.rotation ? `rotate(${layer.rotation}deg)` : 'none',
                      transformOrigin: 'center center'
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="project-preview-controls" aria-label="Preview timeline controls">
        <button
          type="button"
          className="project-preview-control-button"
          onClick={handleTogglePlayback}
          disabled={!timelineRef.current || Boolean(animationError)}
          aria-label={isPlaying ? 'Pause preview timeline' : 'Play preview timeline'}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>

        <button
          type="button"
          className={`project-preview-control-button project-preview-loop-button ${isLooping ? 'active' : ''}`}
          onClick={handleToggleLoop}
          disabled={!timelineRef.current || Boolean(animationError)}
          aria-label={isLooping ? 'Disable preview autoplay repeat' : 'Enable preview autoplay repeat'}
          aria-pressed={isLooping}
        >
          <Repeat2 size={16} />
        </button>

        <div className="project-preview-timeline-control">
          <div className="project-preview-time-row">
            <span>{formatTimelineTime(currentTime)}</span>
            <span>{formatTimelineTime(duration)}</span>
          </div>
          <input
            type="range"
            min="0"
            max={Math.max(duration, 0.01)}
            step="0.01"
            value={Math.min(currentTime, Math.max(duration, 0.01))}
            onChange={(event) => handleTimelineSeek(event.target.value)}
            disabled={!timelineRef.current || Boolean(animationError)}
            aria-label="Seek preview timeline"
          />
        </div>

        <div className="project-preview-speed-control" aria-label="Playback speed">
          {PLAYBACK_RATES.map((rate) => (
            <button
              key={rate}
              type="button"
              className={`project-preview-speed-button ${playbackRate === rate ? 'active' : ''}`}
              onClick={() => handlePlaybackRateChange(rate)}
              disabled={!timelineRef.current || Boolean(animationError)}
            >
              {rate}x
            </button>
          ))}
        </div>
      </section>

      {animationError && (
        <div className="project-preview-error" role="alert">
          <AlertTriangle size={16} />
          <span>{animationError}</span>
        </div>
      )}
    </main>
  )
}

export default ProjectPreview
