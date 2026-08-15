import Image from 'next/image'

interface Props {
  size?: number
  text?: string
  fullScreen?: boolean
}

export default function LogoLoader({
  size = 48,
  text = 'Loading Asaheeb CRM...',
  fullScreen = false,
}: Props) {
  const content = (
    <div className="logo-loader-wrap">
      <div className="logo-loader-ring" style={{ width: size, height: size }}>
        <div className="logo-loader-spinner" />
        <Image
          src="/Favicon.png"
          alt="Asaheeb Logo"
          width={size}
          height={size}
          className="logo-pulse"
          style={{ objectFit: 'contain', borderRadius: '50%' }}
          priority
        />
      </div>
      {text && (
        <span
          style={{
            fontSize: '12.5px',
            fontWeight: 600,
            color: '#64748B',
            letterSpacing: '0.01em',
          }}
        >
          {text}
        </span>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div
        style={{
          minHeight: '100vh',
          width: '100vw',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F8FAFC',
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
        }}
      >
        {content}
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        width: '100%',
        flex: 1,
        minHeight: 'calc(100vh - 100px)',
      }}
    >
      {content}
    </div>
  )
}
