import os
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from html import unescape
from typing import Optional


@dataclass
class EmailDeliveryResult:
    sent: bool
    error: Optional[str] = None


class EmailService:
    """SMTP email boundary with a development fallback."""

    FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@tripai.local")
    SMTP_HOST = os.getenv("SMTP_HOST")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME = os.getenv("SMTP_USERNAME")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
    SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

    @classmethod
    def is_configured(cls) -> bool:
        return bool(cls.SMTP_HOST and cls.SMTP_USERNAME and cls.SMTP_PASSWORD)

    @classmethod
    def send_email(cls, to_email: str, subject: str, html_body: str, text_body: str = "") -> EmailDeliveryResult:
        if not cls.is_configured():
            print(f"[email:not-configured] from={cls.FROM_EMAIL} to={to_email} subject={subject}")
            print(text_body or html_body)
            return EmailDeliveryResult(sent=False, error="Email is not configured. Use the invite link below or configure SMTP.")

        message = EmailMessage()
        message["From"] = cls.FROM_EMAIL
        message["To"] = to_email
        message["Subject"] = subject
        message.set_content(text_body or unescape(html_body))
        message.add_alternative(html_body, subtype="html")

        try:
            with smtplib.SMTP(cls.SMTP_HOST, cls.SMTP_PORT, timeout=15) as smtp:
                if cls.SMTP_USE_TLS:
                    smtp.starttls()
                smtp.login(cls.SMTP_USERNAME, cls.SMTP_PASSWORD)
                smtp.send_message(message)
            return EmailDeliveryResult(sent=True)
        except Exception as exc:
            print(f"[email:failed] to={to_email} subject={subject} error={exc}")
            return EmailDeliveryResult(sent=False, error=f"Email delivery failed: {exc}")

    @classmethod
    def send_trip_invitation(cls, to_email: str, trip_name: str, inviter_name: str, invite_link: str) -> EmailDeliveryResult:
        subject = f"{inviter_name} invited you to plan {trip_name}"
        text_body = (
            f"{inviter_name} invited you to collaborate on the trip '{trip_name}'.\n"
            f"Open this secure invite link within 7 days: {invite_link}"
        )
        html_body = f"""
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#17202a">
          <h2>Plan {trip_name} together</h2>
          <p><strong>{inviter_name}</strong> invited you to collaborate on this trip.</p>
          <p><a href="{invite_link}" style="background:#2563eb;color:white;padding:10px 16px;border-radius:6px;text-decoration:none">Accept invite</a></p>
          <p>This invite expires in 7 days.</p>
        </div>
        """
        return cls.send_email(to_email, subject, html_body, text_body)

    @classmethod
    def send_notification(cls, to_email: str, title: str, message: str) -> EmailDeliveryResult:
        return cls.send_email(to_email, title, f"<p>{message}</p>", message)
