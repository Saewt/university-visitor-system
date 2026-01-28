import { useState, useEffect } from 'react'

const DESIGN_STORAGE_KEY = 'teacher_design_version'

// Map old design IDs to new ones
const OLD_TO_NEW_MAP = {
  'original': 'v1',
  'design3': 'v2',
  'mix': 'v3'
}

export const getDesignVersion = () => {
  const stored = localStorage.getItem(DESIGN_STORAGE_KEY)
  if (stored && OLD_TO_NEW_MAP[stored]) {
    localStorage.setItem(DESIGN_STORAGE_KEY, OLD_TO_NEW_MAP[stored])
    return OLD_TO_NEW_MAP[stored]
  }
  return stored || 'v1'
}

export const setDesignVersion = (version) => {
  localStorage.setItem(DESIGN_STORAGE_KEY, version)
}

export const designs = [
  { id: 'v1', name: 'V1 - Orijinal', icon: '📋' },
  { id: 'v2', name: 'V2 - Modern', icon: '✨' },
  { id: 'v3', name: 'V3 - Dark', icon: '🌙' }
]

export default function DesignSwitcher({ currentDesign, onDesignChange, onToggleNext }) {
  const currentDesignInfo = designs.find(d => d.id === currentDesign) || designs[0]
  const nextIndex = (designs.findIndex(d => d.id === currentDesign) + 1) % designs.length
  const nextDesign = designs[nextIndex]

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      alignItems: 'flex-end'
    }}>
      {/* Current Design Badge */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.9)',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: '600',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <span style={{ fontSize: '14px' }}>{currentDesignInfo.icon}</span>
        <span>Teacher: {currentDesignInfo.name}</span>
      </div>

      {/* Switch Button */}
      <button
        onClick={onToggleNext}
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          border: 'none',
          padding: '12px 20px',
          borderRadius: '25px',
          fontSize: '13px',
          fontWeight: '600',
          cursor: 'pointer',
          boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.3s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)'
        }}
      >
        <span style={{ fontSize: '14px' }}>➜</span>
        <span>{nextDesign.name}</span>
      </button>

      {/* Quick Select */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        {designs.map(design => (
          <button
            key={design.id}
            onClick={() => onDesignChange(design.id)}
            style={{
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: '500',
              color: design.id === currentDesign ? 'white' : '#475569',
              background: design.id === currentDesign ? '#667eea' : 'transparent',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <span>{design.icon}</span>
            {design.name}
          </button>
        ))}
      </div>
    </div>
  )
}
