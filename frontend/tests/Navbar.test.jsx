/**
 * Tests for Navbar component
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Navbar from '../src/components/Navbar'

const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('Navbar Component', () => {
  const mockUser = { id: 1, username: 'testuser', role: 'admin' }
  const mockLogout = vi.fn()
  const mockTabChange = vi.fn()

  it('renders user information', () => {
    renderWithRouter(
      <Navbar
        user={mockUser}
        onLogout={mockLogout}
        activeTab="dashboard"
        onTabChange={mockTabChange}
      />
    )

    expect(screen.getByText('testuser')).toBeInTheDocument()
  })

  it('renders logout button', () => {
    renderWithRouter(
      <Navbar
        user={mockUser}
        onLogout={mockLogout}
        activeTab="dashboard"
        onTabChange={mockTabChange}
      />
    )

    expect(screen.getByText('Çıkış')).toBeInTheDocument()
  })

  it('calls logout when logout button is clicked', () => {
    renderWithRouter(
      <Navbar
        user={mockUser}
        onLogout={mockLogout}
        activeTab="dashboard"
        onTabChange={mockTabChange}
      />
    )

    const logoutButton = screen.getByText('Çıkış')
    fireEvent.click(logoutButton)

    expect(mockLogout).toHaveBeenCalledTimes(1)
  })

  it('renders dashboard and students tabs for admin', () => {
    renderWithRouter(
      <Navbar
        user={mockUser}
        onLogout={mockLogout}
        activeTab="dashboard"
        onTabChange={mockTabChange}
        showHistoryTab={true}
      />
    )

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Öğrenciler')).toBeInTheDocument()
  })

  it('renders history tab when showHistoryTab is true', () => {
    renderWithRouter(
      <Navbar
        user={mockUser}
        onLogout={mockLogout}
        activeTab="dashboard"
        onTabChange={mockTabChange}
        showHistoryTab={true}
      />
    )

    expect(screen.getByText('Geçmiş')).toBeInTheDocument()
  })

  it('calls tab change when tab is clicked', () => {
    renderWithRouter(
      <Navbar
        user={mockUser}
        onLogout={mockLogout}
        activeTab="dashboard"
        onTabChange={mockTabChange}
        showHistoryTab={true}
      />
    )

    const studentsTab = screen.getByText('Öğrenciler')
    fireEvent.click(studentsTab)

    expect(mockTabChange).toHaveBeenCalledWith('students')
  })

  it('renders custom tab labels when provided', () => {
    const customLabels = {
      dashboard: 'Ana Sayfa',
      students: 'Tüm Öğrenciler',
      history: 'Tarihçe'
    }

    renderWithRouter(
      <Navbar
        user={mockUser}
        onLogout={mockLogout}
        activeTab="dashboard"
        onTabChange={mockTabChange}
        tabLabels={customLabels}
        showHistoryTab={true}
      />
    )

    expect(screen.getByText('Ana Sayfa')).toBeInTheDocument()
    expect(screen.getByText('Tüm Öğrenciler')).toBeInTheDocument()
    expect(screen.getByText('Tarihçe')).toBeInTheDocument()
  })

  it('does not render tabs when showTabs is false', () => {
    renderWithRouter(
      <Navbar
        user={mockUser}
        onLogout={mockLogout}
        activeTab="dashboard"
        onTabChange={mockTabChange}
        showTabs={false}
      />
    )

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
  })

  it('shows admin tab for admin user', () => {
    const adminUser = { id: 1, username: 'admin', role: 'admin' }

    renderWithRouter(
      <Navbar
        user={adminUser}
        onLogout={mockLogout}
        activeTab="dashboard"
        onTabChange={mockTabChange}
        showHistoryTab={true}
      />
    )

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })
})
