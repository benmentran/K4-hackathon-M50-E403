"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export const FOCUS_IDLE_THRESHOLD_MS = 15_000

export type FocusIncidentKind = "low-focus" | "lost-focus"

export type FocusIncident = {
    id: string
    kind: FocusIncidentKind
    startMs: number
    endMs?: number
    page: number
}

export type MicrophoneState = "off" | "starting" | "ready" | "unavailable"

type UseFocusTrackerOptions = {
    page: number
    deckId: string
}

type UseFocusTrackerResult = {
    incidents: FocusIncident[]
    activeIncident: FocusIncident | null
    sessionStartedAt: number
    microphoneState: MicrophoneState
    simulationSilence: boolean
    setSimulationSilence: (enabled: boolean) => void
    enableMicrophone: () => Promise<void>
}

export function useFocusTracker({ page, deckId }: UseFocusTrackerOptions): UseFocusTrackerResult {
    const sessionStartedAtRef = useRef(Date.now())
    const idleSinceRef = useRef<number | null>(null)
    const silenceSinceRef = useRef<number | null>(null)
    const activeIncidentRef = useRef<FocusIncident | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const audioContextRef = useRef<AudioContext | null>(null)
    const analyserRef = useRef<AnalyserNode | null>(null)
    const [incidents, setIncidents] = useState<FocusIncident[]>([])
    const [activeIncident, setActiveIncident] = useState<FocusIncident | null>(null)
    const [microphoneState, setMicrophoneState] = useState<MicrophoneState>("off")
    const [simulationSilence, setSimulationSilence] = useState(false)

    const finishIncident = useCallback((now: number) => {
        const active = activeIncidentRef.current
        if (!active) return
        const finished = { ...active, endMs: now }
        setIncidents((current) => [...current, finished])
        activeIncidentRef.current = null
        setActiveIncident(null)
    }, [])

    const evaluateFocus = useCallback(() => {
        const now = Date.now()
        const idleSince = idleSinceRef.current
        const silenceSince = silenceSinceRef.current
        const idle = idleSince !== null && now - idleSince >= FOCUS_IDLE_THRESHOLD_MS
        const silent = silenceSince !== null && now - silenceSince >= FOCUS_IDLE_THRESHOLD_MS
        const kind: FocusIncidentKind | null = idle && silent ? "lost-focus" : idle ? "low-focus" : null

        if (!kind) {
            if (activeIncidentRef.current) finishIncident(now)
            return
        }

        const active = activeIncidentRef.current
        if (active?.kind === kind) return
        if (active) finishIncident(now)

        const incident: FocusIncident = {
            id: `${deckId}-${now}`,
            kind,
            startMs: idleSince ?? now,
            page,
        }
        activeIncidentRef.current = incident
        setActiveIncident(incident)
    }, [deckId, finishIncident, page])

    const registerInteraction = useCallback(() => {
        const now = Date.now()
        idleSinceRef.current = now
        silenceSinceRef.current = null
        if (activeIncidentRef.current) finishIncident(now)
    }, [finishIncident])

    const enableMicrophone = useCallback(async () => {
        if (microphoneState === "ready" || microphoneState === "starting") return
        if (!navigator.mediaDevices?.getUserMedia) {
            setMicrophoneState("unavailable")
            return
        }

        setMicrophoneState("starting")
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const context = new AudioContext()
            const analyser = context.createAnalyser()
            analyser.fftSize = 512
            context.createMediaStreamSource(stream).connect(analyser)
            streamRef.current = stream
            audioContextRef.current = context
            analyserRef.current = analyser
            setMicrophoneState("ready")
        } catch {
            setMicrophoneState("unavailable")
        }
    }, [microphoneState])

    useEffect(() => {
        idleSinceRef.current = Date.now()
        silenceSinceRef.current = null
        const onInteraction = () => registerInteraction()
        window.addEventListener("pointerdown", onInteraction, { passive: true })
        window.addEventListener("keydown", onInteraction)

        const timer = window.setInterval(() => {
            const analyser = analyserRef.current
            if (simulationSilence || analyser) {
                let silent = simulationSilence
                if (analyser && !simulationSilence) {
                    const samples = new Uint8Array(analyser.fftSize)
                    analyser.getByteTimeDomainData(samples)
                    const rms = Math.sqrt(
                        samples.reduce((sum, sample) => sum + (sample - 128) ** 2, 0) / samples.length,
                    )
                    silent = rms < 2.5
                }
                if (silent) silenceSinceRef.current ??= Date.now()
                else silenceSinceRef.current = null
            }
            evaluateFocus()
        }, 500)

        return () => {
            window.removeEventListener("pointerdown", onInteraction)
            window.removeEventListener("keydown", onInteraction)
            window.clearInterval(timer)
            streamRef.current?.getTracks().forEach((track) => track.stop())
            void audioContextRef.current?.close()
        }
    }, [evaluateFocus, registerInteraction, simulationSilence])

    useEffect(() => {
        if (!activeIncidentRef.current) return
        activeIncidentRef.current = { ...activeIncidentRef.current, page }
        setActiveIncident(activeIncidentRef.current)
    }, [page])

    return {
        incidents,
        activeIncident,
        sessionStartedAt: sessionStartedAtRef.current,
        microphoneState,
        simulationSilence,
        setSimulationSilence,
        enableMicrophone,
    }
}

export function focusElapsedSeconds(incident: FocusIncident, now = Date.now()) {
    const end = incident.endMs ?? now
    return Math.max(0, Math.round((end - incident.startMs) / 1000))
}