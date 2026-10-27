import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchTasks, createTask, updateTask, deleteTask } from '../api/tasks'
import TaskCard       from '../components/TaskCard'
import TaskForm       from '../components/TaskForm'
import TaskModal      from '../components/TaskModal'
import ChatPanel      from '../components/ChatPanel'
import EmptyState     from '../components/EmptyState'
import ErrorBanner    from '../components/ErrorBanner'
import LoadingSpinner from '../components/LoadingSpinner'

const SESSION_ID = crypto.randomUUID()

const STATUS_FILTERS = [
  { label: 'All',         value: '' },
  { label: 'Pending',     value: 'pending' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed',   value: 'completed' },
]

export default function Dashboard({ dark, onToggleDark }) {
  const [tasks,        setTasks]        = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search,       setSearch]       = useState('')
  const [searchInput,  setSearchInput]  = useState('')
  const [formModal,    setFormModal]    = useState(null)
  const [formLoading,  setFormLoading]  = useState(false)
  const [formError,    setFormError]    = useState('')
  const [viewTask,     setViewTask]     = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const searchTimer = useRef(null)

  const loadTasks = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchTasks({ status: statusFilter, q: search })
      setTasks(res.data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => { loadTasks() }, [loadTasks])

  function handleSearchInput(e) {
    const val = e.target.value
    setSearchInput(val)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setSearch(val), 400)
  }

  async function handleFormSubmit(data) {
    setFormLoading(true)
    setFormError('')
    try {
      if (formModal === 'create') await createTask(data)
      else await updateTask(formModal.id, data)
      setFormModal(null)
      loadTasks()
    } catch (e) {
      setFormError(e.message)
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    try {
      await deleteTask(deleteTarget.id)
      setDeleteTarget(null)
      loadTasks()
    } catch (e) {
      setError(e.message)
      setDeleteTarget(null)
    }
  }

  const modalOverlay = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40'
  const modalBox     = 'bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full'

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">AI Task Manager</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Dark mode toggle */}
          <button onClick={onToggleDark}
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
            {dark ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          <button onClick={() => { setFormModal('create'); setFormError('') }}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Task
          </button>
        </div>
      </header>

      {/* Split layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

        {/* Task list */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex gap-1 flex-wrap">
              {STATUS_FILTERS.map(f => (
                <button key={f.value} onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                    ${statusFilter === f.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <input
              value={searchInput}
              onChange={handleSearchInput}
              placeholder="Search tasks..."
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <ErrorBanner message={error} onDismiss={() => setError('')} />

          {!loading && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''}
              {statusFilter ? ` · ${statusFilter.replace('_', ' ')}` : ''}
              {search ? ` · "${search}"` : ''}
            </p>
          )}

          {loading ? (
            <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
          ) : tasks.length === 0 ? (
            <EmptyState
              message="No tasks found"
              sub={search || statusFilter ? 'Try changing your filters' : 'Create your first task or ask the AI assistant'}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {tasks.map(task => (
                <TaskCard key={task.id} task={task}
                  onView={setViewTask}
                  onEdit={(t) => { setFormModal(t); setFormError('') }}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          )}
        </div>

        {/* Chat panel */}
        <div className="lg:w-96 xl:w-[420px] border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700 p-4 flex flex-col h-[50vh] lg:h-auto">
          <ChatPanel sessionId={SESSION_ID} onTaskMutation={loadTasks} />
        </div>
      </div>

      {/* Create / Edit modal */}
      {formModal !== null && (
        <div className={modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setFormModal(null) }}>
          <div className={`${modalBox} max-w-md p-6`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {formModal === 'create' ? 'Create Task' : 'Edit Task'}
              </h2>
              <button onClick={() => setFormModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {formError && <ErrorBanner message={formError} onDismiss={() => setFormError('')} />}
            <TaskForm
              initial={formModal === 'create' ? null : formModal}
              onSubmit={handleFormSubmit}
              onCancel={() => setFormModal(null)}
              loading={formLoading}
            />
          </div>
        </div>
      )}

      {/* Task detail modal */}
      {viewTask && <TaskModal task={viewTask} onClose={() => setViewTask(null)} />}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className={modalOverlay}>
          <div className={`${modalBox} max-w-sm p-6`}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Delete Task?</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
              "<span className="font-medium">{deleteTarget.title}</span>" will be permanently removed.
            </p>
            <div className="flex gap-2">
              <button onClick={handleDeleteConfirm}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
                Delete
              </button>
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
