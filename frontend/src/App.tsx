import { useState } from 'react'
import FIDO2Page from '@pages/FIDO2Page.tsx'
import PIVPage from '@pages/PIVPage.tsx'
import OTPPage from '@pages/OTPPage.tsx'
import InterfacesPage from '@pages/InterfacesPage.tsx'
import DiagnosticsPage from '@pages/DiagnosticsPage.tsx'

type PageType = 'fido2' | 'piv' | 'otp' | 'interfaces' | 'diagnostics';

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('fido2')

  const renderPage = () => {
    switch (currentPage) {
      case 'fido2':
        return <FIDO2Page />
      case 'piv':
        return <PIVPage />
      case 'otp':
        return <OTPPage />
      case 'interfaces':
        return <InterfacesPage />
      case 'diagnostics':
        return <DiagnosticsPage />
      default:
        return <FIDO2Page />
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--color-border)',
        padding: 'var(--spacing-md)',
      }}>
        <h1 style={{ 
          fontSize: 'var(--font-size-xl)', 
          fontWeight: 600,
          textAlign: 'center',
        }}>
          Feitian SK Manager
        </h1>
      </header>

      {/* Navigation */}
      <nav style={{
        borderBottom: '1px solid var(--color-border)',
        padding: 'var(--spacing-sm) var(--spacing-md)',
        display: 'flex',
        gap: 'var(--spacing-sm)',
        justifyContent: 'center',
      }}>
        <button
          onClick={() => setCurrentPage('fido2')}
          style={{
            fontWeight: currentPage === 'fido2' ? 600 : 400,
          }}
        >
          FIDO2
        </button>
        <button
          onClick={() => setCurrentPage('piv')}
          style={{
            fontWeight: currentPage === 'piv' ? 600 : 400,
          }}
        >
          PIV
        </button>
        <button
          onClick={() => setCurrentPage('otp')}
          style={{
            fontWeight: currentPage === 'otp' ? 600 : 400,
          }}
        >
          OTP
        </button>
        <button
          onClick={() => setCurrentPage('interfaces')}
          style={{
            fontWeight: currentPage === 'interfaces' ? 600 : 400,
          }}
        >
          Interfaces
        </button>
        <button
          onClick={() => setCurrentPage('diagnostics')}
          style={{
            fontWeight: currentPage === 'diagnostics' ? 600 : 400,
          }}
        >
          Diagnostics
        </button>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1 }}>
        {renderPage()}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--color-border)',
        padding: 'var(--spacing-md)',
        textAlign: 'center',
        fontSize: 'var(--font-size-sm)',
      }}>
        <p>USB Status: Disconnected</p>
      </footer>
    </div>
  )
}

export default App
