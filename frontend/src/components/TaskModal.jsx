import { useEffect } from 'react'

const PRIORITY_STYLES = {
  high:   'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  low:    'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
}
const STATUS_LABELS = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed' }

export default function TaskModal({ task, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!task) return null

  const row = (label, value) => (
    <div className="flex gap-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="text-sm text-gray-500 dark:text-gray-400 w-28 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 dark:text-gray-100">{value || '—'}</span>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <div>
            <div className="flex gap-2 mb-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${PRIORITY_STYLES[task.priority]}`}>
                {task.priority}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium">
                {STATUS_LABELS[task.status]}
              </span>
              {task.createdBy === 'assistant' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 font-medium">
                  AI created
                </span>
              )}
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 leading-snug">{task.title}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 mt-1 ml-3">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-5 leading-relaxed">
            {task.description || <span className="italic text-gray-400 dark:text-gray-500">No description</span>}
          </p>
          <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 px-4 py-1">
            {row('Task ID',    task.id)}
            {row('Due Date',   task.dueDate)}
            {row('Created',    new Date(task.createdAt).toLocaleString())}
            {row('Updated',    new Date(task.updatedAt).toLocaleString())}
            {row('Created by', task.createdBy === 'assistant' ? 'AI Assistant' : 'User')}
          </div>
        </div>

        <div className="px-5 pb-5">
          <button onClick={onClose}
            className="w-full py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
