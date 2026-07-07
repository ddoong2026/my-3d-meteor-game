import React from 'react'

export default function MainMenu({ onSelectMode }: { onSelectMode: (mode: 'meteor' | 'hoshik') => void }) {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#1a1a2e',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      color: 'white',
      fontFamily: 'sans-serif'
    }}>
      <h1 style={{ fontSize: '5rem', marginBottom: '20px', textShadow: '4px 4px 0 #000' }}>
        MY 3D GAME
      </h1>
      <p style={{ fontSize: '1.5rem', marginBottom: '50px', color: '#aaa' }}>
        플레이할 게임 모드를 선택하세요
      </p>

      <div style={{ display: 'flex', gap: '40px' }}>
        <button
          onClick={() => onSelectMode('meteor')}
          style={{
            width: '300px',
            height: '400px',
            backgroundColor: '#2a2a4e',
            border: '4px solid #4a4a8e',
            borderRadius: '16px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            transition: 'transform 0.2s, borderColor 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)'
            e.currentTarget.style.borderColor = '#8a8aff'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.borderColor = '#4a4a8e'
          }}
        >
          <div style={{ fontSize: '4rem', marginBottom: '20px' }}>☄️</div>
          <h2 style={{ fontSize: '2.5rem', margin: '0 0 10px 0', color: 'white' }}>운석 피하기</h2>
          <p style={{ fontSize: '1.2rem', color: '#ccc', textAlign: 'center', padding: '0 20px' }}>
            하늘에서 떨어지는 운석을 피해<br/>최대한 오래 살아남으세요!
          </p>
        </button>

        <button
          onClick={() => onSelectMode('hoshik')}
          style={{
            width: '300px',
            height: '400px',
            backgroundColor: '#4e2a2a',
            border: '4px solid #8e4a4a',
            borderRadius: '16px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            transition: 'transform 0.2s, borderColor 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)'
            e.currentTarget.style.borderColor = '#ff8a8a'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.borderColor = '#8e4a4a'
          }}
        >
          <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🔫</div>
          <h2 style={{ fontSize: '2.5rem', margin: '0 0 10px 0', color: 'white' }}>호식특공대</h2>
          <p style={{ fontSize: '1.2rem', color: '#ccc', textAlign: 'center', padding: '0 20px' }}>
            사방에서 몰려오는 적을 물리치고<br/>레벨업하여 강해지세요!
          </p>
        </button>
      </div>
    </div>
  )
}
