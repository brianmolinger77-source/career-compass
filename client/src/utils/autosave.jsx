import { useState, useCallback, useRef } from 'react'

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
