import React, { useState } from 'react'
import WelcomeScreen from './components/WelcomeScreen.jsx'
import ProfileScreen from './components/ProfileScreen.jsx'
import HomeScreen from './components/HomeScreen.jsx'
import ChatWindow from './components/ChatWindow.jsx'
import SendInviteModal from './components/SendInviteModal.jsx'
import InvitesPanel from './components/InvitesPanel.jsx'
import { createUser } from './api.js'

export default function App() {
  const [view, setView] = useState('welcome') // 'welcome' | 'profile-setup' | 'home' | 'profile-edit' | 'chat'
  const [user, setUser] = useState(null)
  const [conversationId, setConversationId] = useState(null)
  const [conversationTitle, setConversationTitle] = useState('Chat')
  const [welcomeError, setWelcomeError] = useState(null)
  const [showSendInvite, setShowSendInvite] = useState(false)
  const [showInvites, setShowInvites] = useState(false)

  async function handleWelcomeSubmit(name) {
    setWelcomeError(null)
    try {
      const u = await createUser(name)
      setUser(u)
      setView('profile-setup')
    } catch (err) {
      setWelcomeError(err.message)
    }
  }

  function handleProfileSaved(updatedUser) {
    setUser(updatedUser)
    setView('home')
  }

  function handleOpenConversation(id, title) {
    setConversationId(id)
    setConversationTitle(title || 'Chat')
    setView('chat')
  }

  function handleInviteAccepted(newConversationId) {
    setShowInvites(false)
    setConversationId(newConversationId)
    setConversationTitle('Chat')
    setView('chat')
  }

  function handleBackToHome() {
    setConversationId(null)
    setView('home')
  }

  if (view === 'welcome') {
    return <WelcomeScreen onSubmit={handleWelcomeSubmit} error={welcomeError} />
  }

  if (view === 'profile-setup' || view === 'profile-edit') {
    return (
      <ProfileScreen
        user={user}
        mode={view === 'profile-setup' ? 'setup' : 'edit'}
        onSaved={view === 'profile-setup' ? handleProfileSaved : (u) => { setUser(u); setView('home') }}
        onBack={() => setView('home')}
      />
    )
  }

  if (view === 'home') {
    return (
      <>
        <HomeScreen
          user={user}
          onOpenConversation={handleOpenConversation}
          onNewChat={() => setShowSendInvite(true)}
          onOpenProfile={() => setView('profile-edit')}
          onOpenInvites={() => setShowInvites(true)}
        />
        {showSendInvite && (
          <SendInviteModal currentUser={user} onClose={() => setShowSendInvite(false)} />
        )}
        {showInvites && (
          <InvitesPanel
            currentUser={user}
            onClose={() => setShowInvites(false)}
            onAccepted={handleInviteAccepted}
          />
        )}
      </>
    )
  }

  return (
    <ChatWindow
      conversationId={conversationId}
      conversationTitle={conversationTitle}
      currentUser={user}
      onBack={handleBackToHome}
    />
  )
}
