import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY || '')

export async function sendAgentInviteEmail(
  email: string,
  name: string,
  inviteLink: string,
  role: string = 'AGENT',
  specialization?: string | null,
  isReset: boolean = false
) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.includes('YOUR_')) {
    console.log(`[Email Mock] ${isReset ? 'Reset' : 'Invite'} link for ${email}: ${inviteLink}`)
    return
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Asaheeb CRM <info@adonixdigital.com>'

  let subject = 'You have been invited to Asaheeb CRM'
  if (isReset) {
    subject = `Reset Your Password — Asaheeb CRM`
  } else {
    subject = `Welcome to Asaheeb Real Estate CRM, ${name}`
  }

  let roleLabel = 'a Sales Agent'
  if (role === 'ADMIN') {
    roleLabel = 'an Administrator'
  } else if (role === 'SALES_MANAGER') {
    roleLabel = 'a Sales Manager'
  } else if (role === 'AGENT') {
    roleLabel = specialization ? `a Real Estate Agent (${specialization})` : 'a Real Estate Sales Agent'
  } else if (role === 'EMPLOYEE') {
    roleLabel = specialization ? `an Operations Specialist (${specialization})` : 'an Operations Team Member'
  }

  let htmlContent = ''

  if (isReset) {
    htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 24px 12px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px 24px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);">
          
          <div style="margin-bottom: 20px;">
            <span style="background-color: #1e3a8a; color: #ffffff; padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 13px; display: inline-block; letter-spacing: 0.3px;">
              Asaheeb Real Estate
            </span>
          </div>

          <h2 style="color: #0f172a; margin: 0 0 12px 0; font-size: 20px; font-weight: 700;">Password Reset Request</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.5; margin: 0 0 12px 0;">Hi <strong>${name}</strong>,</p>
          <p style="color: #334155; font-size: 14px; line-height: 1.5; margin: 0 0 16px 0;">
            We received a request to reset your password for your <strong>Asaheeb Real Estate CRM</strong> account.
          </p>

          <p style="color: #475569; font-size: 13.5px; line-height: 1.5; background: #f1f5f9; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 0 0 24px 0;">
            Click the button below to set up a new secure password and log into your sales dashboard.
          </p>

          <div style="margin: 24px 0; text-align: center;">
            <a href="${inviteLink}" style="background-color: #1e3a8a; color: #ffffff; padding: 12px 26px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block; box-shadow: 0 2px 8px rgba(30, 58, 138, 0.25);">
              Reset Password &amp; Access CRM
            </a>
          </div>

          <p style="color: #94a3b8; font-size: 12px; line-height: 1.4; margin: 24px 0 0 0; border-top: 1px solid #f1f5f9; padding-top: 16px;">
            If you did not request a password reset, you can safely ignore this email. Your account password will remain unchanged.
          </p>
        </div>
      </body>
      </html>
    `
  } else {
    htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 24px 12px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px 24px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);">
          
          <div style="margin-bottom: 20px;">
            <span style="background-color: #1e3a8a; color: #ffffff; padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 13px; display: inline-block; letter-spacing: 0.3px;">
              Asaheeb Real Estate
            </span>
          </div>

          <h2 style="color: #0f172a; margin: 0 0 12px 0; font-size: 20px; font-weight: 700;">Welcome to Asaheeb CRM</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.5; margin: 0 0 12px 0;">Hi <strong>${name}</strong>,</p>
          <p style="color: #334155; font-size: 14px; line-height: 1.5; margin: 0 0 16px 0;">
            You have been invited to join the <strong>Asaheeb Real Estate CRM</strong> as <strong>${roleLabel}</strong>.
          </p>

          <p style="color: #475569; font-size: 13.5px; line-height: 1.5; background: #f1f5f9; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 0 0 24px 0;">
            Through your dashboard, you can manage client leads, schedule follow-ups, view off-plan &amp; villa projects, and track monthly payslips.
          </p>

          <div style="margin: 24px 0; text-align: center;">
            <a href="${inviteLink}" style="background-color: #1e3a8a; color: #ffffff; padding: 12px 26px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block; box-shadow: 0 2px 8px rgba(30, 58, 138, 0.25);">
              Set Up Your Password &amp; Get Started
            </a>
          </div>

          <p style="color: #94a3b8; font-size: 12px; line-height: 1.4; margin: 24px 0 0 0; border-top: 1px solid #f1f5f9; padding-top: 16px;">
            If you did not expect this invitation, please contact your Asaheeb CRM administrator.
          </p>
        </div>
      </body>
      </html>
    `
  }

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: subject,
      html: htmlContent,
    })
    return result
  } catch (error) {
    console.error('Failed to send invite email via Resend:', error)
  }
}

export async function sendFollowupReminderEmail({
  agentEmail,
  agentName,
  leadName,
  leadPhone,
  followupNote,
  scheduledAt,
  leadId,
}: {
  agentEmail: string
  agentName: string
  leadName: string
  leadPhone?: string
  followupNote?: string
  scheduledAt: string
  leadId: string
}) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.includes('YOUR_')) {
    console.log(`[Email Mock] Follow-up reminder for ${agentEmail} regarding lead ${leadName}`)
    return
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Asaheeb CRM <info@adonixdigital.com>'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const leadUrl = `${appUrl}/leads/${leadId}`

  // Format dual timezone (Saudi Arabia KSA & India IST)
  let ksaTime = scheduledAt
  let istTime = scheduledAt
  try {
    const d = new Date(scheduledAt)
    if (!isNaN(d.getTime())) {
      const opts: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }
      ksaTime = new Intl.DateTimeFormat('en-US', { ...opts, timeZone: 'Asia/Riyadh' }).format(d)
      istTime = new Intl.DateTimeFormat('en-US', { ...opts, timeZone: 'Asia/Kolkata' }).format(d)
    }
  } catch {}

  try {
    await resend.emails.send({
      from: fromEmail,
      to: agentEmail,
      subject: `⏰ Lead Follow-up Reminder: ${leadName} — Asaheeb CRM`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 20px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);">
            <div style="margin-bottom: 16px;">
              <span style="background-color: #1e3a8a; color: #ffffff; padding: 4px 10px; border-radius: 4px; font-weight: 700; font-size: 12px; display: inline-block;">
                Asaheeb CRM
              </span>
            </div>
            
            <h2 style="color: #0f172a; margin: 0 0 8px 0; font-size: 18px; font-weight: 700;">Upcoming Lead Follow-up</h2>
            <p style="color: #475569; font-size: 14px; margin: 0 0 16px 0;">Hi <strong>${agentName}</strong>, you have a scheduled follow-up:</p>
            
            <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
              <div style="font-size: 16px; font-weight: 700; color: #0f172a;">${leadName}</div>
              ${leadPhone ? `<div style="font-size: 13px; color: #64748b; margin-top: 4px;">Phone: <strong>${leadPhone}</strong></div>` : ''}
              
              <div style="margin-top: 12px; font-size: 13px;">
                <div style="font-weight: 600; color: #0f172a; margin-bottom: 6px;">Scheduled Time:</div>
                <div style="padding-left: 8px; border-left: 3px solid #1e3a8a;">
                  <div style="color: #1e293b; margin-bottom: 3px;">🇸🇦 <strong>Saudi Arabia (KSA):</strong> ${ksaTime}</div>
                  <div style="color: #1e293b;">🇮🇳 <strong>India (IST):</strong> ${istTime}</div>
                </div>
              </div>

              ${followupNote ? `<div style="font-size: 13px; color: #334155; margin-top: 12px; padding-top: 10px; border-top: 1px solid #cbd5e1; font-style: italic;">"${followupNote}"</div>` : ''}
            </div>

            <div style="text-align: center; margin-top: 20px;">
              <a href="${leadUrl}" style="background-color: #1e3a8a; color: #ffffff; padding: 10px 22px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13.5px; display: inline-block;">
                Open Lead in Asaheeb CRM
              </a>
            </div>
          </div>
        </body>
        </html>
      `,
    })
  } catch (error) {
    console.error('Failed to send follow-up reminder email:', error)
  }
}
