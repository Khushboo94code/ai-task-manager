import { useState, useEffect } from 'react'
import LoadingSpinner from './LoadingSpinner'

const EMPTY = { title: '', description: '', status: 'pending', priority: 'medium', dueDate: '' }

export default function TaskForm({ initial = null, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (initial) {
      setForm({
        title:       initial.title       || '',
        description: initial.description || '',
        status:      initial.status      || 'pending',
        priority:    initial.priority    || 'medium',
        dueDate:     initial.dueDate     || '',
      })
    } else {
      setForm(EMPTY)
    }
    setErrors({})
  }, [initial])

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  function validate() {
    const errs = {}
    if (!form.title.trim()) errs.title = 'Title is required'
    return errs
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    onSubmit({ ...form, dueDate: form.dueDate || null })
  }

  const field = 'block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500'
  const label = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div>
        <label className={label}>Title <span className="text-red-500">*</span></label>
        <input className={`${field} ${errors.title ? 'border-red-400' : ''}`}
          value={form.title} onChange={set('title')} placeholder="Fix login button on mobile Safari" />
        {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
      </div>

      {/* Description */}
      <div>
        <label className={label}>Description <span className="text-gray-400 dark:text-gray-500 text-xs font-normal">(optional)</span></label>
        <textarea rows={3} className={`${field} resize-none`}
          value={form.description} onChange={set('description')}
          placeholder="What needs to be done and why..." />
      </div>

      {/* Status + Priority */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Status</label>
          <select className={field} value={form.status} onChange={set('status')}>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div>
          <label className={label}>Priority</label>
          <select className={field} value={form.priority} onChange={set('priority')}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      {/* Due date */}
      <div>
        <label className={label}>Due Date</label>
        <input type="date" className={field} value={form.dueDate} onChange={set('dueDate')} />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors">
          {loading && <LoadingSpinner size="sm" />}
          {initial ? 'Save Changes' : 'Create Task'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}
