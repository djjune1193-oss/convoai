// Relative path — Vite's dev proxy forwards this to the local backend,
// and in production Nginx routes /api/* to the backend on the same
// domain. No hardcoded host, so the same build works everywhere.
const API_BASE = '/api'
export { API_BASE }

export async function fetchMessages(conversationId) {
  const res = await fetch(`${API_BASE}/conversations/${conversationId}/messages`)
  return res.json()
}

export async function createUser(displayName) {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ display_name: displayName }),
  })
  if (!res.ok) throw new Error((await res.json()).detail || 'Could not create account')
  return res.json()
}

export async function updateProfile(userId, fields) {
  const res = await fetch(`${API_BASE}/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
  if (!res.ok) throw new Error((await res.json()).detail || 'Could not save profile')
  return res.json()
}

export async function uploadAvatar(userId, file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_BASE}/users/${userId}/avatar`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) throw new Error((await res.json()).detail || 'Could not upload photo')
  return res.json()
}

export async function createConversation(userIds, name = null) {
  const res = await fetch(`${API_BASE}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_ids: userIds, name }),
  })
  return res.json()
}

export async function fetchUserConversations(userId) {
  const res = await fetch(`${API_BASE}/users/${userId}/conversations`)
  return res.json()
}

export async function sendInvite(fromUserId, toConvoaiId) {
  const res = await fetch(`${API_BASE}/invites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from_user_id: fromUserId, to_convoai_id: toConvoaiId }),
  })
  if (!res.ok) throw new Error((await res.json()).detail || 'Could not send invite')
  return res.json()
}

export async function fetchInvites(userId) {
  const res = await fetch(`${API_BASE}/users/${userId}/invites`)
  return res.json()
}

export async function respondInvite(inviteId, userId, action) {
  const res = await fetch(`${API_BASE}/invites/${inviteId}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, action }),
  })
  if (!res.ok) throw new Error((await res.json()).detail || 'Could not respond to invite')
  return res.json()
}

export async function searchPeople(keyword, excludeUserId) {
  const params = new URLSearchParams({ keyword, exclude_user_id: excludeUserId })
  const res = await fetch(`${API_BASE}/users/search?${params.toString()}`)
  if (!res.ok) throw new Error((await res.json()).detail || 'Search failed')
  return res.json()
}

export async function createGroupChat(creatorId, name, convoaiIds) {
  const res = await fetch(`${API_BASE}/conversations/group`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creator_id: creatorId, name, convoai_ids: convoaiIds }),
  })
  if (!res.ok) throw new Error((await res.json()).detail || 'Could not create group chat')
  return res.json()
}
