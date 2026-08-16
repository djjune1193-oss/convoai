// Same-origin, protocol-aware: wss:// on an https:// page, ws:// on http://.
// In dev this hits Vite's proxy (see vite.config.js); in prod, Nginx routes
// /ws/* to the backend. No hardcoded host, so one build works everywhere.
const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const WS_BASE = `${WS_PROTOCOL}//${window.location.host}`

export function connectSocket(conversationId, { onMessage, onTyping, onError, onLikeUpdate, onDelete, onUpdate }) {
  const ws = new WebSocket(`${WS_BASE}/ws/${conversationId}`)

  ws.onmessage = (evt) => {
    const data = JSON.parse(evt.data)
    if (data.type === 'message') onMessage(data)
    if (data.type === 'ai_typing') onTyping(data)
    if (data.type === 'places_searching') onTyping({ message_id: null, kind: 'places' })
    if (data.type === 'web_searching') onTyping({ message_id: null, kind: 'web' })
    if (data.type === 'ai_error') onError?.(data)
    if (data.type === 'message_liked') onLikeUpdate?.(data)
    if (data.type === 'message_deleted') onDelete?.(data)
    if (data.type === 'message_updated') onUpdate?.(data)
  }

  return {
    sendMessage(senderId, content, parentMessageId = null) {
      ws.send(JSON.stringify({
        type: 'message',
        sender_id: senderId,
        content,
        parent_message_id: parentMessageId,
      }))
    },
    requestAI(messageId) {
      ws.send(JSON.stringify({ type: 'swipe_ai', message_id: messageId }))
    },
    findNearby(requesterId, { query, lat, lng, address }) {
      ws.send(JSON.stringify({
        type: 'find_nearby',
        requester_id: requesterId,
        query,
        lat,
        lng,
        address,
      }))
    },
    askWeb(requesterId, query) {
      ws.send(JSON.stringify({ type: 'web_search', requester_id: requesterId, query }))
    },
    toggleLike(messageId, userId) {
      ws.send(JSON.stringify({ type: 'toggle_like', message_id: messageId, user_id: userId }))
    },
    deleteMessage(messageId, requesterId) {
      ws.send(JSON.stringify({ type: 'delete_message', message_id: messageId, requester_id: requesterId }))
    },
    createPoll(messageId, requesterId, question, options) {
      ws.send(JSON.stringify({
        type: 'create_poll',
        message_id: messageId,
        requester_id: requesterId,
        question,
        options,
      }))
    },
    votePoll(messageId, userId, optionId) {
      ws.send(JSON.stringify({ type: 'vote_poll', message_id: messageId, user_id: userId, option_id: optionId }))
    },
    close() {
      ws.close()
    },
  }
}
