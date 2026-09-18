export interface Toast {
  id: number
  tag: string
  text: string
  tone: 'info' | 'good' | 'warn' | 'bloom' | 'growth'
}

export default function ToastSystem({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-stack">
      {toasts.slice(-5).map(t => (
        <div key={t.id} className={`toast toast--${t.tone}`}>
          <span className="toast-tag">{t.tag}</span>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  )
}
