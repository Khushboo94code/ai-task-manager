const BASE = '/api/tasks'

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || data.detail || 'Request failed')
  return data
}

export const fetchTasks = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v))
  ).toString()
  return request(`${BASE}${qs ? '?' + qs : ''}`)
}

export const fetchTask  = (id)       => request(`${BASE}/${id}`)
export const createTask = (body)     => request(BASE, { method: 'POST', body: JSON.stringify(body) })
export const updateTask = (id, body) => request(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(body) })
export const deleteTask = (id)       => request(`${BASE}/${id}`, { method: 'DELETE' })
