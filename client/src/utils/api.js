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

export function analyzeRole(menteeId, roleId, whatIDid, howIDidIt, impact, isRevision = false) {
  return request('/api/analyze-role', {
    method: 'POST',
    body: JSON.stringify({ menteeId, roleId, whatIDid, howIDidIt, impact, isRevision })
  })
}

export function generateNarrative(menteeId, careerThread = '') {
  return request('/api/generate-narrative', {
    method: 'POST',
    body: JSON.stringify({ menteeId, careerThread })
  })
}

export function analyzePSA(menteeId) {
  return request('/api/analyze-psa', {
    method: 'POST',
    body: JSON.stringify({ menteeId })
  })
}

export function getMentees() {
  return request('/api/mentor/mentees')
}

export function createMentee(name, email, pin, branch) {
  return request('/api/mentor/mentees', {
    method: 'POST',
    body: JSON.stringify({ name, email, pin, militaryBranch: branch || '' })
  })
}

export function updateMenteePin(menteeId, pin) {
  return request(`/api/mentor/mentee/${menteeId}/pin`, {
    method: 'PUT',
    body: JSON.stringify({ pin })
  })
}

export function login(email, password) {
  return request('/api/mentor/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  })
}

export function getMentors() {
  return request('/api/mentor/mentors')
}

export function assignMentee(menteeId, mentorId) {
  return request(`/api/mentor/mentee/${menteeId}/assign`, {
    method: 'PUT',
    body: JSON.stringify({ mentorId })
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

export function generateResumeBullets(menteeId) {
  return request('/api/generate-resume-bullets', {
    method: 'POST',
    body: JSON.stringify({ menteeId })
  })
}

export function regenerateSummary(menteeId) {
  return request('/api/regenerate-summary', {
    method: 'POST',
    body: JSON.stringify({ menteeId })
  })
}

export function evaluateJobPosting(menteeId, jobPostingText) {
  return request('/api/evaluate-job-posting', {
    method: 'POST',
    body: JSON.stringify({ menteeId, jobPostingText })
  })
}

export function getUsageStats() {
  return request('/api/mentor/usage')
}

export function analyzeTargetRole(menteeId, jobTitle, companyOrIndustry = '') {
  return request('/api/analyze-target-role', {
    method: 'POST',
    body: JSON.stringify({ menteeId, jobTitle, companyOrIndustry })
  })
}

export function generateTargetRolePattern(menteeId) {
  return request('/api/generate-target-role-pattern', {
    method: 'POST',
    body: JSON.stringify({ menteeId })
  })
}

export function deleteTargetRole(menteeId, roleId) {
  return request(`/api/mentee/${menteeId}/target-roles/${roleId}`, {
    method: 'DELETE'
  })
}
