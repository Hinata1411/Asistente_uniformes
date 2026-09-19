import { useEffect, useRef } from 'react'
import { signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'

import { auth } from '../firebase/config'
import { notify } from '../services/toastStore'

function useSessionTimeout({
  timeoutMinutes = 15,
  warningMinutes = 1
} = {}) {
  const navigate = useNavigate()

  const logoutTimerRef = useRef(null)
  const warningTimerRef = useRef(null)
  const warningShownRef = useRef(false)

  const clearTimers = () => {
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current)
    }

    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current)
    }
  }

  const logout = async () => {
    try {
      clearTimers()

      await signOut(auth)

      navigate('/login', {
        replace: true
      })
    } catch (error) {
      console.error(
        'Error cerrando sesión por inactividad:',
        error
      )
    }
  }

  const resetTimers = () => {
    clearTimers()

    warningShownRef.current = false

    const timeoutMs =
      timeoutMinutes * 60 * 1000

    const warningMs =
      Math.max(
        timeoutMs -
          warningMinutes * 60 * 1000,
        0
      )

    warningTimerRef.current =
      setTimeout(() => {
        if (
          warningShownRef.current
        ) {
          return
        }

        warningShownRef.current = true

        notify(
          `Tu sesión se cerrará en ${warningMinutes} minuto(s) por inactividad.`,
          'warning',
          warningMinutes * 60 * 1000
        )
      }, warningMs)

    logoutTimerRef.current =
      setTimeout(() => {
        logout()
      }, timeoutMs)
  }

  useEffect(() => {
    const events = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click'
    ]

    events.forEach((event) => {
      window.addEventListener(
        event,
        resetTimers
      )
    })

    resetTimers()

    return () => {
      clearTimers()

      events.forEach((event) => {
        window.removeEventListener(
          event,
          resetTimers
        )
      })
    }
  }, [])

  return {
    logout,
    resetTimers
  }
}

export default useSessionTimeout