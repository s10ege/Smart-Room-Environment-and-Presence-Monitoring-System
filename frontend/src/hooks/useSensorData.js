import { useState, useEffect, useCallback } from 'react'
import { POLL_MS } from '../constants'

const defaultSensors = {
  temperature: null, humidity: null, distance: null,
  button: false, led: false, buzzer: false,
  timestamp: null, dht_error: false, ultrasonic_error: false,
}

const defaultStatus = {
  level: 'SAFE', messages: [], led_on: false,
  buzzer_on: false, presence: false, armed: true,
}

export function useSensorData() {
  const [sensors,   setSensors]   = useState(defaultSensors)
  const [status,    setStatus]    = useState(defaultStatus)
  const [connected, setConnected] = useState(false)

  const fetchAll = useCallback(async () => {
    try {
      const [sensorsRes, statusRes] = await Promise.all([
        fetch('/api/sensors'),
        fetch('/api/status'),
      ])
      const [sensorsData, statusData] = await Promise.all([
        sensorsRes.json(),
        statusRes.json(),
      ])
      setSensors(sensorsData)
      setStatus(statusData)
      setConnected(true)
    } catch {
      setConnected(false)
    }
  }, [])

  const sendControl = useCallback(async (action) => {
    await fetch('/api/control', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action }),
    })
    await fetchAll()
  }, [fetchAll])

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, POLL_MS)
    return () => clearInterval(id)
  }, [fetchAll])

  return { sensors, status, connected, sendControl }
}
