import { useState, useCallback, useEffect } from 'react'
import styles from './Toast.module.css'

let _setToasts = null

export function useToast() {
  const show = useCallback((message, type = 'info') => {
    if (_setToasts) {
      const id = Date.now()
      _setToasts(prev => [...prev, { id, message, type }])
      setTimeout(() => {
        _setToasts(prev => prev.filter(t => t.id !== id))
      }, 4000)
    }
  }, [])
  return { show }
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([])
  useEffect(() => { _setToasts = setToasts }, [])

  return (
    <div className={styles.container}>
      {toasts.map(t => (
        <div key={t.id} className={`${styles.toast} ${styles[t.type]}`}>
          {t.message}
        </div>
      ))}
    </div>
  )
}
