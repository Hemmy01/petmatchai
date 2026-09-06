const TERMII_KEY = process.env.TERMII_API_KEY ?? ""
const SENDER_ID  = process.env.TERMII_SENDER_ID ?? "PetMatch"

function normalise(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.startsWith("0") && digits.length === 11) return "234" + digits.slice(1)
  if (digits.startsWith("234")) return digits
  return digits
}

export async function sendSMS(to: string, text: string): Promise<void> {
  if (!TERMII_KEY || !to) return
  const number = normalise(to)
  try {
    await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: number,
        from: SENDER_ID,
        sms: text,
        type: "plain",
        channel: "generic",
        api_key: TERMII_KEY,
      }),
    })
  } catch (e) {
    console.error("[sms]", e)
  }
}

export function smsNewMessage(phone: string, senderName: string, petName: string) {
  return sendSMS(phone, `PetMatchAI: ${senderName} sent you a message about ${petName}. Reply at petmatchai-nine.vercel.app/messages`)
}

export function smsNewOffer(phone: string, buyerName: string, petName: string, amount: number) {
  return sendSMS(phone, `PetMatchAI: ${buyerName} made an offer of ₦${amount.toLocaleString()} on ${petName}. Review at petmatchai-nine.vercel.app/offers`)
}

export function smsOfferAccepted(phone: string, petName: string, amount: number) {
  return sendSMS(phone, `PetMatchAI: Your offer of ₦${amount.toLocaleString()} for ${petName} was accepted! Visit petmatchai-nine.vercel.app/offers`)
}
