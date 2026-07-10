import React, { useEffect, useState } from 'react'
import { supabase } from '../utils/supabase'

interface AdminOverlayProps {
  children: React.ReactNode
}

export default function AdminOverlay({ children }: AdminOverlayProps) {
  const [isPaused, setIsPaused] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  
  // Admin console state
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [showAdminConsole, setShowAdminConsole] = useState(false)
  const [adminPasswordInput, setAdminPasswordInput] = useState('')

  const DEV_PASSWORD = 'Endtlr'

  useEffect(() => {
    // Initial fetch
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('maintenance_mode')
        .eq('id', 2)
        .single()
      
      if (data) {
        setIsPaused(data.maintenance_mode)
      } else if (error) {
        console.error('Error fetching settings:', error)
      }
    }

    fetchSettings()

    // Realtime subscription
    const channel = supabase
      .channel('app_settings_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings', filter: 'id=eq.2' },
        (payload) => {
          const newData = payload.new as Record<string, any>
          if (newData && typeof newData.maintenance_mode === 'boolean') {
            setIsPaused(newData.maintenance_mode)
            // If it becomes paused again, lock it locally
            if (newData.maintenance_mode) {
              setIsUnlocked(false)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordInput === DEV_PASSWORD) {
      setIsUnlocked(true)
      setPasswordInput('')
    } else {
      alert('비밀번호가 틀렸습니다.')
    }
  }

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (adminPasswordInput === DEV_PASSWORD) {
      setShowAdminConsole(true)
      setShowAdminLogin(false)
      setAdminPasswordInput('')
    } else {
      alert('비밀번호가 틀렸습니다.')
    }
  }

  const togglePause = async () => {
    const newStatus = !isPaused
    const { error } = await supabase
      .from('app_settings')
      .upsert({ id: 2, maintenance_mode: newStatus })
    
    if (error) {
      console.error('Error updating status:', error)
      alert('상태 업데이트에 실패했습니다: ' + error.message)
    }
  }

  // Styles
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'black',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  }

  const adminBtnStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    padding: '10px 15px',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: 'white',
    borderRadius: '8px',
    cursor: 'pointer',
    zIndex: 10000,
    fontSize: '0.9rem',
    backdropFilter: 'blur(4px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    transition: 'opacity 0.2s',
  }

  const adminConsoleStyle: React.CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: '#333',
    padding: '2rem',
    borderRadius: '8px',
    color: 'white',
    zIndex: 10001,
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  }

  return (
    <>
      {/* Button to open admin login */}
      {!showAdminConsole && !showAdminLogin && (
        <div 
          style={adminBtnStyle} 
          onClick={() => setShowAdminLogin(true)} 
        >
          ⚙️ 관리자
        </div>
      )}

      {/* The main app, only shown if not paused or if locally unlocked */}
      {(!isPaused || isUnlocked) && children}

      {/* Pause Block Overlay */}
      {isPaused && !isUnlocked && (
        <div style={overlayStyle}>
          <h1 style={{ fontSize: '3rem', marginBottom: '2rem' }}>게임하지 마시오.</h1>
          <form onSubmit={handleUnlock} style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="password" 
              placeholder="개발자 암호 입력"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              style={{ padding: '0.5rem', fontSize: '1.2rem', borderRadius: '4px', border: 'none' }}
            />
            <button type="submit" style={{ padding: '0.5rem 1rem', fontSize: '1.2rem', cursor: 'pointer' }}>
              해제
            </button>
          </form>
        </div>
      )}

      {/* Admin Login Modal */}
      {showAdminLogin && (
        <div style={overlayStyle}>
          <div style={adminConsoleStyle}>
            <h2>관리자 콘솔 접속</h2>
            <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input 
                type="password" 
                placeholder="관리자 암호 입력"
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                style={{ padding: '0.5rem', fontSize: '1rem', borderRadius: '4px', border: 'none' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAdminLogin(false)} style={{ padding: '0.5rem' }}>취소</button>
                <button type="submit" style={{ padding: '0.5rem' }}>확인</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Console Modal */}
      {showAdminConsole && (
        <div style={overlayStyle}>
          <div style={adminConsoleStyle}>
            <h2>관리자 콘솔</h2>
            <p>현재 상태: <strong>{isPaused ? '일시 배포 중지 됨' : '정상 동작 중'}</strong></p>
            <button 
              onClick={togglePause}
              style={{
                padding: '1rem',
                fontSize: '1.2rem',
                backgroundColor: isPaused ? '#4CAF50' : '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {isPaused ? '일시 배포 중지 비활성화 (정상화)' : '일시 배포 중지 활성화 (차단)'}
            </button>
            <button 
              onClick={() => setShowAdminConsole(false)}
              style={{ padding: '0.5rem', marginTop: '1rem' }}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  )
}
