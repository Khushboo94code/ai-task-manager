export default function EmptyState({ message = 'No tasks found', sub = '' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
      <svg className="w-16 h-16 mb-4 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      <p className="text-lg font-medium text-gray-500 dark:text-gray-400">{message}</p>
      {sub && <p className="text-sm mt-1">{sub}</p>}
    </div>
  )
}
