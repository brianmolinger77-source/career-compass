import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * Creates a debounced autosave function.
 * @param {Function} saveFn - The function to call with the latest data
 * @param {number} delay - Debounce delay in milliseconds (default 1500)
 * @returns {Function} - Debounced save function
 */
export function createAutosave(saveFn, delay = 1500) {
  let timer = null

  return function debouncedSave(data) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      saveFn(data)
    }, delay)
  }
}

/**
 * Hook for managing save status UI state.
 * @returns {{ saveStatus, setSaving, setSaved, setError, setIdle }}
 */
export function useSaveStatus() {
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle' | 'saving' | 'saved' | 'error'
  const savedTimerRef = useRef(null)

  const setSaving = useCallback(() => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    setSaveStatus('saving')
  }, [])

  const setSaved = useCallback(() => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    setSaveStatus('saved')
  }, [])

  const setError = useCallback(() => {
    setSaveStatus('error')
  }, [])

  const setIdle = useCallback(() => {
    setSaveStatus('idle')
  }, [])

  return { saveStatus, setSaving, setSaved, setError, setIdle }
}

/**
 * Hook that provides a debounced autosave with status tracking.
 * @param {Function} saveFn - Async function that saves data
 * @param {number} delay - Debounce delay in ms
 * @returns {{ triggerSave, saveStatus }}
 */
export function useAutosave(saveFn, delay = 1500) {
  const { saveStatus, setSaving, setSaved, setError } = useSaveStatus()
  const timerRef = useRef(null)
  const saveFnRef = useRef(saveFn)
  saveFnRef.current = saveFn

  const triggerSave = useCallback((data) => {
    setSaving()
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        await saveFnRef.current(data)
        setSaved()
      } catch (err) {
        console.error('Autosave failed:', err)
        setError()
      }
    }, delay)
  }, [delay, setSaving, setSaved, setError])

  return { triggerSave, saveStatus }
}

export function SaveStatusIndicator({ status }) {
  const config = {
    idle:   { label: 'All changes saved \u2713',      className: 'text-blue-300/40' },
    saving: { label: 'Saving...',                     className: 'text-blue-200' },
    saved:  { label: 'All changes saved \u2713',      className: 'text-green-400' },
    error:  { label: 'Save failed \u2014 retrying',   className: 'text-amber-400' },
  }

  const { label, className } = config[status] ?? config.idle

  return (
    <span className={`text-xs font-medium transition-colors duration-300 ${className}`}>
      {label}
    </span>
  )
}

// Field-level retry engine, extracted from RoleCard.jsx (built during THE-124).
// Same behavior, generalized: `resetKey` replaces role.id as the entity identity
// used to tear down stale timers when the caller switches entities. `onSave` and
// `onEmergencyFlush` take only `patch` — the caller closes over whatever id it
// needs (see RoleCard's refactor in step 2).

const RETRY_DELAYS_MS = [1000, 2000, 4000]

// Per-field save status shown next to a single input/textarea. Deliberately quiet on
// the happy path (the shared header already pulses "Saving.../Saved" for that) — this
// only speaks up once a save is actually in trouble, and never claims to be "retrying"
// once it has genuinely stopped.
export function FieldSaveStatus({ state, onRetry }) {
  if (!state) return null
  if (state.status === 'retrying') {
    const label = state.manual
      ? 'Retrying…'
      : `Save failed — retrying (${state.attempt - 1} of ${RETRY_DELAYS_MS.length})…`
    return <p className="text-xs text-amber-600 mt-1">{label}</p>
  }
  if (state.status === 'error') {
    return (
      <p className="text-xs text-red-600 mt-1 flex items-center gap-2">
        <span>Save failed. Your last change here wasn't saved.</span>
        <button
          type="button"
          onClick={onRetry}
          className="underline font-medium hover:text-red-700 flex-shrink-0"
        >
          Retry
        </button>
      </p>
    )
  }
  return null
}

/**
 * Per-field autosave with retry, backoff, manual retry, and flush-on-close.
 * One instance per entity (a role, or the mentee-level field group) — not one
 * per field — so all pending fields on that entity flush as a single merged
 * request on tab close, matching the existing role-field behavior.
 *
 * @param {Object} opts
 * @param {*} opts.resetKey - Identity of the entity being edited (role.id, or
 *   menteeId for a mentee-level field group). Effect dependency for the two
 *   flush paths below — switching entities cleanly tears down stale timers
 *   instead of leaking them into the new entity.
 * @param {(patch: Object) => Promise} opts.onSave - Single-attempt save. Caller
 *   still owns the optimistic "Saving.../Saved" header pulse — this hook only
 *   owns retry/backoff on failure.
 * @param {(patch: Object) => Promise} opts.onEmergencyFlush - Keepalive flush
 *   for real tab close.
 * @returns {{ fieldStatuses, triggerFieldSave, handleManualRetry, FieldSaveStatus }}
 */
export function useFieldRetry({ resetKey, onSave, onEmergencyFlush }) {
  const fieldState = useRef({})
  const [fieldStatuses, setFieldStatuses] = useState({})
  const latestOnSave = useRef(onSave)
  const latestOnEmergencyFlush = useRef(onEmergencyFlush)
  const isMountedRef = useRef(true)

  useEffect(() => {
    latestOnSave.current = onSave
    latestOnEmergencyFlush.current = onEmergencyFlush
  })

  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])

  function clearFieldStatus(field) {
    setFieldStatuses(prev => {
      if (!(field in prev)) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function attemptSave(field, attempt, isManual = false) {
    const entry = fieldState.current[field]
    if (!entry) return

    if (attempt > 1 || isManual) {
      setFieldStatuses(prev => ({ ...prev, [field]: { status: 'retrying', attempt, manual: isManual && attempt === 1 } }))
    } else {
      clearFieldStatus(field)
    }

    latestOnSave.current(entry.patch)
      .then(() => {
        if (!isMountedRef.current) return
        const current = fieldState.current[field]
        if (current && current.patch === entry.patch) {
          delete fieldState.current[field]
          clearFieldStatus(field)
        }
      })
      .catch(() => {
        if (!isMountedRef.current) return
        const current = fieldState.current[field]
        if (!current || current.patch !== entry.patch) return

        if (attempt > RETRY_DELAYS_MS.length) {
          setFieldStatuses(prev => ({ ...prev, [field]: { status: 'error', attempt } }))
          return
        }
        const delay = RETRY_DELAYS_MS[attempt - 1]
        setFieldStatuses(prev => ({ ...prev, [field]: { status: 'retrying', attempt: attempt + 1 } }))
        current.retryTimerId = setTimeout(() => attemptSave(field, attempt + 1), delay)
      })
  }

  function handleManualRetry(field) {
    const entry = fieldState.current[field]
    if (!entry) return
    if (entry.retryTimerId) clearTimeout(entry.retryTimerId)
    attemptSave(field, 1, true)
  }

  useEffect(() => {
    return () => {
      const fields = Object.keys(fieldState.current)
      if (fields.length === 0) return
      const mergedPatch = {}
      for (const field of fields) {
        const entry = fieldState.current[field]
        clearTimeout(entry.debounceTimerId)
        clearTimeout(entry.retryTimerId)
        Object.assign(mergedPatch, entry.patch)
        delete fieldState.current[field]
      }
      latestOnSave.current(mergedPatch)
        .catch(err => console.error('Failed to flush pending edit on navigation:', err))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  useEffect(() => {
    function flushForClose() {
      const fields = Object.keys(fieldState.current)
      if (fields.length === 0) return
      const patchesByField = {}
      const mergedPatch = {}
      for (const field of fields) {
        const entry = fieldState.current[field]
        clearTimeout(entry.debounceTimerId)
        clearTimeout(entry.retryTimerId)
        patchesByField[field] = entry.patch
        Object.assign(mergedPatch, entry.patch)
        delete fieldState.current[field]
      }
      latestOnEmergencyFlush.current(mergedPatch)
        .catch(() => {
          for (const field of fields) {
            fieldState.current[field] = { patch: patchesByField[field], debounceTimerId: null, retryTimerId: null }
            attemptSave(field, 1)
          }
        })
    }
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        flushForClose()
      }
    }
    window.addEventListener('pagehide', flushForClose)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', flushForClose)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  function triggerFieldSave(field, patch, { debounceMs = 1500 } = {}) {
    clearFieldStatus(field)

    const existing = fieldState.current[field]
    if (existing) {
      clearTimeout(existing.debounceTimerId)
      clearTimeout(existing.retryTimerId)
    }
    const debounceTimerId = setTimeout(() => {
      fieldState.current[field].debounceTimerId = null
      attemptSave(field, 1)
    }, debounceMs)
    fieldState.current[field] = { patch, debounceTimerId, retryTimerId: null }
  }

  return { fieldStatuses, triggerFieldSave, handleManualRetry, FieldSaveStatus }
}
