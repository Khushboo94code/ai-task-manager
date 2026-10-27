const PRIORITY_STYLES = {
  high:   'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-400 dark:border-yellow-800',
  low:    'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800',
}

const STATUS_STYLES = {
  pending:     'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  completed:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
}

const STATUS_LABELS = {
  pending:     'Pending',
  in_progress: 'In Progress',
  completed:   'Completed',
}

function isOverdue(task) {
  if (!task.dueDate || task.status === 'completed') return false
  return new Date(task.dueDate) < new Date(new Date().toDateString())
}

export default function TaskCard({ task, onView, onEdit, onDelete }) {
  const overdue = isOverdue(task)

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border shadow-sm p-4 hover:shadow-md transition-shadow
      ${overdue ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'}`}>

      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wide ${PRIORITY_STYLES[task.priority]}`}>
            {task.priority}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[task.status]}`}>
            {STATUS_LABELS[task.status]}
          </span>
          {task.createdBy === 'assistant' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 font-medium">
              AI
            </span>
          )}
        </div>
        {overdue && (
          <span className="text-xs font-semibold text-red-600 dark:text-red-400 shrink-0">OVERDUE</span>
        )}
      </div>

      {/* Title */}
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-snug mb-1 line-clamp-2">
        {task.title}
      </h3>

      {/* Description */}
      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
        {task.description || <span className="italic">No description</span>}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400 dark:text-gray-500">
          {task.dueDate
            ? <span className={overdue ? 'text-red-500 dark:text-red-400 font-medium' : ''}>Due {task.dueDate}</span>
            : <span>No due date</span>
          }
        </div>
        <div className="flex gap-1">
          <button onClick={() => onView(task)}
            className="text-xs px-2 py-1 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 font-medium transition-colors">
            View
          </button>
          <button onClick={() => onEdit(task)}
            className="text-xs px-2 py-1 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium transition-colors">
            Edit
          </button>
          <button onClick={() => onDelete(task)}
            className="text-xs px-2 py-1 rounded-lg text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 font-medium transition-colors">
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
