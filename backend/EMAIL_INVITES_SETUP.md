# Email Invite Setup

Trip invitation emails are sent through SMTP when these environment variables are configured:

```env
FRONTEND_BASE_URL=http://127.0.0.1:5173
FROM_EMAIL=your-email@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password
SMTP_USE_TLS=true
```

For Gmail, use an App Password, not your normal Google password:

1. Turn on 2-Step Verification in your Google Account.
2. Create an App Password for Mail.
3. Put that app password in `SMTP_PASSWORD`.
4. Restart the FastAPI server.

If SMTP is not configured, invites are still created and the frontend shows a copyable invite link. This keeps local development usable while making production email delivery explicit.
