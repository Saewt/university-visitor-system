import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'
import TeacherV1 from './TeacherV1'
import TeacherV2 from './TeacherV2'
import TeacherV3 from './TeacherV3'
import DesignSwitcher, { getDesignVersion, setDesignVersion } from '../components/DesignSwitcher'

function Teacher({ user: initialUser, onLogout }) {
  const [user, setUser] = useState(initialUser)
  const [designVersion, setDesignVersionState] = useState(() => getDesignVersion())
  const navigate = useNavigate()

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await authAPI.me()
        setUser(userData)
      } catch (err) {
        navigate('/login')
      }
    }
    if (!initialUser) {
      loadUser()
    }
  }, [initialUser, navigate])

  const handleDesignChange = (version) => {
    setDesignVersion(version)
    setDesignVersionState(version)
  }

  const handleToggleNext = () => {
    const designs = ['v1', 'v2', 'v3']
    const currentIndex = designs.indexOf(designVersion)
    const nextIndex = (currentIndex + 1) % designs.length
    handleDesignChange(designs[nextIndex])
  }

  const renderDesign = () => {
    switch (designVersion) {
      case 'v2':
        return <TeacherV2 user={user} onLogout={onLogout} />
      case 'v3':
        return <TeacherV3 user={user} onLogout={onLogout} />
      case 'v1':
      default:
        return <TeacherV1 user={user} onLogout={onLogout} />
    }
  }

  return (
    <>
      {renderDesign()}
      <DesignSwitcher
        currentDesign={designVersion}
        onDesignChange={handleDesignChange}
        onToggleNext={handleToggleNext}
      />
    </>
  )
}

export default Teacher
