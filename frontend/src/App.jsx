import React, { useEffect, useState } from 'react'
import WelcomeScreen from './components/WelcomeScreen.jsx'
import ProfileScreen from './components/ProfileScreen.jsx'
import HomeScreen from './components/HomeScreen.jsx'
import ChatWindow from './components/ChatWindow.jsx'
import SendInviteModal from './components/SendInviteModal.jsx'
import InvitesPanel from './components/InvitesPanel.jsx'
import GroupChatModal from './components/GroupChatModal.jsx'
import DiscoverScreen from './components/DiscoverScreen.jsx'
import LocationPromptScreen from './components/LocationPromptScreen.jsx'
import { clearToken, fetchMe, getToken, login, setToken, signup } from './api.js'

export default function App() {
  // 'checking' | 'welcome' | 'profile-setup' | 'location-prompt' | 'home' | 'profile-edit' | 'chat' | 'discover'
  const [view, setView] = useState('checking')
  const [user, setUser] = useState(null)
  const [conversationId, setConversationId] = useState(null)
  const [conversationTitle, setConversationTitle] = useState('Chat')
  const [welcomeError, setWelcomeError] = useState(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [showSendInvite, setShowSendInvite] = useState(false)
  const [showInvites, setShowInvites] = useState(false)
  const [showGroupChat, setShowGroupChat] = useState(false)

  // On load: if a session token is already stored, try to restore it
  // instead of showing the welcome screen — this is what makes "log in
  // once, stay logged in" actually work across refreshes/new tabs.
  useEffect(() => {
    const token = getToken()
    if (!token) {
      setView('welcome')
      return
    }
    fetchMe(token)
      .then((u) => {
        setUser(u)
        setView('home')
      })
      .catch(() => {
        clearToken()
        setView('welcome')
      })
  }, [])

  function goHomeOrPromptLocation(u) {
    // Only ask if this account hasn't already shared a location — avoids
    // re-nagging a returning user every login once they've decided once
    // (whether they granted it or explicitly skipped, latitude stays null
    // only in the "skipped" case, so skipping does mean being asked again
    // next login — that's an acceptable, low-friction tradeoff here).
    if (u.latitude == null || u.longitude == null) {
      setView('location-prompt')
    } else {
      setView('home')
    }
  }

  async function handleSignup(username, password, displayName) {
    setWelcomeError(null)
    setAuthLoading(true)
    try {
      const { token, user: u } = await signup(username, password, displayName)
      setToken(token)
      setUser(u)
      setView('profile-setup') // brand new account — walk through profile setup
    } catch (err) {
      setWelcomeError(err.message)
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleLogin(username, password) {
    setWelcomeError(null)
    setAuthLoading(true)
    try {
      const { token, user: u } = await login(username, password)
      setToken(token)
      setUser(u)
      goHomeOrPromptLocation(u)
    } catch (err) {
      setWelcomeError(err.message)
    } finally {
      setAuthLoading(false)
    }
  }

  function handleLogout() {
    clearToken()
    setUser(null)
    setConversationId(null)
    setView('welcome')
  }

  function handleProfileSaved(updatedUser) {
    setUser(updatedUser)
    goHomeOrPromptLocation(updatedUser)
  }

  function handleLocationPromptDone(updatedUser) {
    if (updatedUser) setUser(updatedUser)
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

  function handleGroupCreated(newConversationId) {
    setShowGroupChat(false)
    setConversationId(newConversationId)
    setConversationTitle('New group')
    setView('chat')
  }

  function handleBackToHome() {
    setConversationId(null)
    setView('home')
  }

  if (view === 'checking') {
    return (
      <div className="welcome-screen">
        <div className="welcome-orb" />
      </div>
    )
  }

  if (view === 'welcome') {
    return (
      <WelcomeScreen
        onSignup={handleSignup}
        onLogin={handleLogin}
        error={welcomeError}
        loading={authLoading}
      />
    )
  }

  if (view === 'profile-setup' || view === 'profile-edit') {
    return (
      <ProfileScreen
        user={user}
        mode={view === 'profile-setup' ? 'setup' : 'edit'}
        onSaved={view === 'profile-setup' ? handleProfileSaved : (u) => { setUser(u); setView('home') }}
        onBack={() => setView('home')}
        onLogout={view === 'profile-edit' ? handleLogout : undefined}
      />
    )
  }

  if (view === 'location-prompt') {
    return <LocationPromptScreen user={user} onDone={handleLocationPromptDone} />
  }

  if (view === 'home') {
    return (
      <>
        <HomeScreen
          user={user}
          onOpenConversation={handleOpenConversation}
          onOpenProfile={() => setView('profile-edit')}
          onOpenInvites={() => setShowInvites(true)}
          onOpenSendInvite={() => setShowSendInvite(true)}
          onOpenGroupChat={() => setShowGroupChat(true)}
          onOpenSearch={() => setView('discover')}
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
        {showGroupChat && (
          <GroupChatModal
            currentUser={user}
            onClose={() => setShowGroupChat(false)}
            onCreated={handleGroupCreated}
          />
        )}
      </>
    )
  }

  if (view === 'discover') {
    return <DiscoverScreen currentUser={user} onBack={() => setView('home')} />
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
