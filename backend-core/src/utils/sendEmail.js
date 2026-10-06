import process from 'node:process';

const RESEND_API_URL = 'https://api.resend.com/emails';

const sendEmail = async (options) => {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim() || process.env.EMAIL_FROM?.trim();
  const to = typeof options.email === 'string' ? options.email.trim() : '';

  if (!apiKey || !from || !to) {
    const error = new Error('Resend email delivery is not configured.');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }

  let response;
  try {
    response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: options.subject,
        text: options.message,
        ...(options.html ? { html: options.html } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (cause) {
    const error = new Error(`Could not reach Resend: ${cause.message}`);
    error.code = 'RESEND_NETWORK_ERROR';
    error.cause = cause;
    throw error;
  }

  const bodyText = await response.text();
  let body;
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    body = { message: bodyText };
  }

  if (!response.ok) {
    const error = new Error(body.message || `Resend rejected the email request (${response.status}).`);
    error.code = 'RESEND_API_ERROR';
    error.status = response.status;
    error.response = body;
    throw error;
  }

  return body;
};

export default sendEmail;
