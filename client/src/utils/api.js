const BASE_URL = ''

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || `Request failed with status ${res.status}`)
  }

  return res.json()
}

export function getMentee(id) {
  return request(`/api/mentee/${id}`)
}

export function updateMentee(id, data) {
  return request(`/api/mentee/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export function addRole(menteeId) {
  return request(`/api/mentee/${menteeId}/roles`, {
    method: 'POST'
  })
}

export function deleteRole(menteeId, roleId) {
  return request(`/api/mentee/${menteeId}/roles/${roleId}`, {
    method: 'DELETE'
  })
}

export function analyzeRole(menteeId, roleId, whatIDid, howIDidIt, impact) {
  return request('/api/analyze-role', {
    method: 'POST',
    body: JSON.stringify({ menteeId, roleId, whatIDid, howIDidIt, impact })
  })
}

export function generateNarrative(menteeId) {
  return request('/api/generate-narrative', {
    method: 'POST',
    body: JSON.stringify({ menteeId })
  })
}

export function getMentees() {
  return request('/api/mentor/mentees')
}

export function createMentee(name, email) {
  return request('/api/mentor/mentees', {
    method: 'POST',
    body: JSON.stringify({ name, email })
  })
}

export function login(password) {
  return request('/api/mentor/login', {
    method: 'POST',
    body: JSON.stringify({ password })
  })
}

export function logout() {
  return request('/api/mentor/logout', {
    method: 'POST'
  })
}

export function checkAuth() {
  return request('/api/mentor/check')
}

export function addComment(menteeId, section, comment) {
  return request(`/api/mentor/mentee/${menteeId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ section, comment })
  })
}

export function updateComment(menteeId, commentId, comment) {
  return request(`/api/mentor/mentee/${menteeId}/comments/${commentId}`, {
    method: 'PUT',
    body: JSON.stringify({ comment })
  })
}

export function deleteComment(menteeId, commentId) {
  return request(`/api/mentor/mentee/${menteeId}/comments/${commentId}`, {
    method: 'DELETE'
  })
}
