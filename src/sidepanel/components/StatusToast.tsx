import { useEffect, useState } from 'react'

interface StatusToastProps {
  message: string | null
  isSuccess: boolean
  duration?: number
}

export function StatusToast({ message, isSuccess, duration = 3000 }: StatusToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (message) {
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [message, duration])

  if (!visible || !message) return null

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg px-4 py-2 text-sm shadow-lg transition-all ${
        isSuccess ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
      }`}
    >
      {message}
    </div>
  )
}

