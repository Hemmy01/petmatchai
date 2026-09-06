import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_LOGIN,
    pass: process.env.BREVO_SMTP_KEY,
  },
})

const FROM = `PetMatchAI <${process.env.BREVO_SENDER_EMAIL ?? 'famhemmy3@gmail.com'}>`
const BRAND = '#4f46e5'

function wrap(body: string) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f9fafb;padding:32px 0;margin:0">
<div style="max-width:520px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
  <div style="background:${BRAND};padding:20px 24px">
    <span style="color:white;font-size:18px;font-weight:700">🐾 PetMatchAI</span>
  </div>
  <div style="padding:24px">${body}</div>
  <div style="padding:16px 24px;border-top:1px solid #f3f4f6;font-size:12px;color:#9ca3af">
    Hemmy Kennel, Lagos · <a href="https://petmatchai-nine.vercel.app/privacy" style="color:#9ca3af">Privacy Policy</a>
  </div>
</div>
</body></html>`
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!process.env.BREVO_SMTP_LOGIN || !process.env.BREVO_SMTP_KEY) return
  try {
    await transporter.sendMail({ from: FROM, to, subject, html: wrap(html) })
  } catch (e) {
    console.error('[email]', e)
  }
}

export function emailNewMessage(recipientEmail: string, senderName: string, petName: string, preview: string) {
  return sendEmail(
    recipientEmail,
    `New message about ${petName}`,
    `<p style="color:#111827;font-size:16px;margin:0 0 8px"><strong>${senderName}</strong> sent you a message about <strong>${petName}</strong>:</p>
     <div style="background:#f3f4f6;border-radius:8px;padding:14px;color:#374151;font-size:14px;margin:0 0 20px">${preview}</div>
     <a href="https://petmatchai-nine.vercel.app/messages" style="background:${BRAND};color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Reply in PetMatchAI</a>`
  )
}

export function emailNewOffer(sellerEmail: string, buyerName: string, petName: string, amount: number) {
  return sendEmail(
    sellerEmail,
    `New offer on ${petName}`,
    `<p style="color:#111827;font-size:16px;margin:0 0 16px"><strong>${buyerName}</strong> made an offer of <strong style="color:${BRAND}">₦${amount.toLocaleString()}</strong> on your listing <strong>${petName}</strong>.</p>
     <a href="https://petmatchai-nine.vercel.app/offers" style="background:${BRAND};color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Review Offer</a>`
  )
}

export function emailWeeklyReport(
  sellerEmail: string,
  sellerName: string,
  stats: { totalViews: number; weeklyInquiries: number; activeListings: number }
) {
  return sendEmail(
    sellerEmail,
    "Your Weekly PetMatchAI Summary",
    `<p style="color:#111827;font-size:16px;margin:0 0 16px">Hi <strong>${sellerName}</strong>, here's your performance summary for the past 7 days:</p>
     <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
       <tr style="background:#f9fafb">
         <td style="padding:12px;font-size:14px;color:#374151;border-radius:6px 0 0 0">Total Listing Views</td>
         <td style="padding:12px;font-size:18px;font-weight:700;color:${BRAND};text-align:right">${stats.totalViews.toLocaleString()}</td>
       </tr>
       <tr>
         <td style="padding:12px;font-size:14px;color:#374151">New Inquiries This Week</td>
         <td style="padding:12px;font-size:18px;font-weight:700;color:#059669;text-align:right">${stats.weeklyInquiries}</td>
       </tr>
       <tr style="background:#f9fafb">
         <td style="padding:12px;font-size:14px;color:#374151">Active Listings</td>
         <td style="padding:12px;font-size:18px;font-weight:700;color:#111827;text-align:right">${stats.activeListings}</td>
       </tr>
     </table>
     <a href="https://petmatchai-nine.vercel.app/analytics" style="background:${BRAND};color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;display:inline-block">View Full Analytics →</a>`
  )
}

export function emailAccountStatus(
  email: string,
  name: string | null,
  status: "suspended" | "disabled" | "active"
) {
  const hi = name ? `Hi ${name},` : "Hi,"
  if (status === "active") {
    return sendEmail(
      email,
      "Your PetMatchAI account has been reactivated",
      `<p style="color:#111827;font-size:16px;margin:0 0 12px">${hi}</p>
       <p style="color:#374151;font-size:14px;margin:0 0 18px">Good news — your PetMatchAI account has been <strong style="color:#059669">reactivated</strong>. You can now sign in and continue using the platform.</p>
       <a href="https://petmatchai-nine.vercel.app/auth/login" style="background:#059669;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Sign in</a>`
    )
  }
  const disabled = status === "disabled"
  return sendEmail(
    email,
    `Your PetMatchAI account has been ${disabled ? "disabled" : "suspended"}`,
    `<p style="color:#111827;font-size:16px;margin:0 0 12px">${hi}</p>
     <p style="color:#374151;font-size:14px;margin:0 0 16px">Your PetMatchAI account has been <strong style="color:#b91c1c">${disabled ? "permanently disabled" : "suspended"}</strong>${disabled ? " following a violation of our community guidelines" : ""}. ${disabled ? "You will no longer be able to sign in." : "You won’t be able to sign in until it is reactivated."}</p>
     <p style="color:#6b7280;font-size:13px;margin:0">If you believe this was a mistake, please reply to this email to contact our support team.</p>`
  )
}

export function emailOfferAccepted(buyerEmail: string, petName: string, amount: number) {
  return sendEmail(
    buyerEmail,
    `Your offer on ${petName} was accepted! 🎉`,
    `<p style="color:#111827;font-size:16px;margin:0 0 16px">Great news! Your offer of <strong style="color:#059669">₦${amount.toLocaleString()}</strong> for <strong>${petName}</strong> has been <strong>accepted</strong> by the seller.</p>
     <p style="color:#6b7280;font-size:14px;margin:0 0 20px">Visit the offers page to contact the seller and arrange the handover.</p>
     <a href="https://petmatchai-nine.vercel.app/offers" style="background:#059669;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">View Offer</a>`
  )
}
