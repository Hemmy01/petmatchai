// Unit tests for email utility helpers
// nodemailer is mocked so no real emails are sent.

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'mock-id' })

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}))

describe('email utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('sendEmail is a no-op when SMTP credentials are missing', async () => {
    const originalLogin = process.env.BREVO_SMTP_LOGIN
    const originalKey = process.env.BREVO_SMTP_KEY
    delete process.env.BREVO_SMTP_LOGIN
    delete process.env.BREVO_SMTP_KEY

    jest.resetModules()
    const { sendEmail } = require('../lib/email')
    await sendEmail('test@example.com', 'Subject', '<p>Body</p>')
    expect(mockSendMail).not.toHaveBeenCalled()

    process.env.BREVO_SMTP_LOGIN = originalLogin
    process.env.BREVO_SMTP_KEY = originalKey
  })

  it('emailNewOffer calls sendMail with the seller as recipient', async () => {
    jest.resetModules()
    const { emailNewOffer } = require('../lib/email')
    await emailNewOffer('seller@example.com', 'John', 'Buddy', 250000)

    expect(mockSendMail).toHaveBeenCalledTimes(1)
    const [args] = mockSendMail.mock.calls[0]
    expect(args.to).toBe('seller@example.com')
    expect(args.subject).toContain('Buddy')
  })

  it('emailOfferAccepted calls sendMail with the buyer as recipient', async () => {
    jest.resetModules()
    const { emailOfferAccepted } = require('../lib/email')
    await emailOfferAccepted('buyer@example.com', 'Buddy', 150000)

    expect(mockSendMail).toHaveBeenCalledTimes(1)
    const [args] = mockSendMail.mock.calls[0]
    expect(args.to).toBe('buyer@example.com')
  })

  it('emailNewMessage calls sendMail with the message preview in the body', async () => {
    jest.resetModules()
    const { emailNewMessage } = require('../lib/email')
    await emailNewMessage('user@example.com', 'Alice', 'Buddy', 'Hello!')

    expect(mockSendMail).toHaveBeenCalledTimes(1)
    const [args] = mockSendMail.mock.calls[0]
    expect(args.to).toBe('user@example.com')
    expect(args.html).toContain('Hello!')
  })
})
