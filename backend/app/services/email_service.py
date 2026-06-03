import os
import smtplib
import traceback
from dataclasses import dataclass
from email.message import EmailMessage
from html import unescape
from typing import Optional
from dotenv import load_dotenv


@dataclass
class EmailDeliveryResult:
    sent: bool
    error: Optional[str] = None


class EmailService:
    """SMTP email boundary with a development fallback."""

    @classmethod
    def get_config(cls):
        # Dynamically load env variables at call-time
        load_dotenv()
        from_email = os.getenv("FROM_EMAIL", "noreply@tripai.local")
        smtp_host = os.getenv("SMTP_HOST")
        smtp_port_str = os.getenv("SMTP_PORT", "587")
        smtp_port = int(smtp_port_str) if smtp_port_str.isdigit() else 587
        smtp_username = os.getenv("SMTP_USERNAME")
        smtp_password = os.getenv("SMTP_PASSWORD")
        smtp_use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
        return {
            "FROM_EMAIL": from_email,
            "SMTP_HOST": smtp_host,
            "SMTP_PORT": smtp_port,
            "SMTP_USERNAME": smtp_username,
            "SMTP_PASSWORD": smtp_password,
            "SMTP_USE_TLS": smtp_use_tls
        }

    @classmethod
    def is_configured(cls) -> bool:
        config = cls.get_config()
        has_resend = bool(os.getenv("RESEND_API_KEY"))
        has_smtp = bool(config["SMTP_HOST"] and config["SMTP_USERNAME"] and config["SMTP_PASSWORD"])
        return has_resend or has_smtp

    @classmethod
    def _execute_smtp_send(cls, message: EmailMessage) -> None:
        config = cls.get_config()
        smtp_host = config["SMTP_HOST"]
        smtp_port = config["SMTP_PORT"]
        smtp_username = config["SMTP_USERNAME"]
        smtp_password = config["SMTP_PASSWORD"]
        smtp_use_tls = config["SMTP_USE_TLS"]

        print(f"[SMTP-LOG] Preparing email delivery to {message['To']}")
        print(f"[SMTP-LOG] Configuration: SMTP_HOST={smtp_host}, SMTP_PORT={smtp_port}, SMTP_USERNAME={smtp_username}, SMTP_USE_TLS={smtp_use_tls}")

        if not smtp_host:
            raise ValueError("SMTP_HOST is not set")

        print(f"[SMTP-LOG] Attempting connection to {smtp_host}:{smtp_port}...")
        if smtp_port == 465:
            print("[SMTP-LOG] Using smtplib.SMTP_SSL connection")
            smtp_conn = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15)
        else:
            print("[SMTP-LOG] Using smtplib.SMTP connection")
            smtp_conn = smtplib.SMTP(smtp_host, smtp_port, timeout=15)

        with smtp_conn as smtp:
            print(f"[SMTP-LOG] Successfully connected to {smtp_host}:{smtp_port}")
            
            ehlo_resp = smtp.ehlo()
            print(f"[SMTP-LOG] EHLO response: {ehlo_resp}")
            
            if smtp_use_tls and smtp_port != 465:
                print("[SMTP-LOG] Starting TLS session (starttls)...")
                tls_resp = smtp.starttls()
                print(f"[SMTP-LOG] STARTTLS response: {tls_resp}")
                ehlo_resp_post_tls = smtp.ehlo()
                print(f"[SMTP-LOG] EHLO response after STARTTLS: {ehlo_resp_post_tls}")
                
            if smtp_username and smtp_password:
                print(f"[SMTP-LOG] Attempting authentication for user: {smtp_username}...")
                login_resp = smtp.login(smtp_username, smtp_password)
                print(f"[SMTP-LOG] Authentication response: {login_resp}")
            else:
                print("[SMTP-LOG] No username/password provided. Skipping authentication.")
                
            print(f"[SMTP-LOG] Sending email message from {message['From']} to {message['To']}...")
            smtp.send_message(message)
            print("[SMTP-LOG] Email message sent successfully!")

    @classmethod
    def send_email(cls, to_email: str, subject: str, html_body: str, text_body: str = "") -> EmailDeliveryResult:
        config = cls.get_config()
        if not cls.is_configured():
            print(f"[email:not-configured] from={config['FROM_EMAIL']} to={to_email} subject={subject}")
            print(text_body or html_body)
            return EmailDeliveryResult(sent=False, error="Email is not configured. Configure RESEND_API_KEY or SMTP parameters.")

        # Check for Resend API fallback
        resend_api_key = os.getenv("RESEND_API_KEY")
        if resend_api_key:
            print(f"[EMAIL-LOG] RESEND_API_KEY is configured. Using Resend HTTP API for delivery to {to_email}...")
            try:
                from_email = config["FROM_EMAIL"]
                if from_email == "noreply@tripai.local":
                    from_email = "onboarding@resend.dev"
                
                import requests
                url = "https://api.resend.com/emails"
                headers = {
                    "Authorization": f"Bearer {resend_api_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "from": from_email,
                    "to": to_email,
                    "subject": subject,
                    "html": html_body,
                    "text": text_body or unescape(html_body)
                }
                print(f"[EMAIL-LOG] Posting payload to Resend: from={from_email}, to={to_email}, subject={subject}")
                res = requests.post(url, json=payload, headers=headers, timeout=15)
                print(f"[EMAIL-LOG] Resend API Response Status Code: {res.status_code}")
                print(f"[EMAIL-LOG] Resend API Response Body: {res.text}")
                
                if res.status_code in (200, 201):
                    return EmailDeliveryResult(sent=True)
                else:
                    return EmailDeliveryResult(sent=False, error=f"Resend API error (HTTP {res.status_code}): {res.text}")
            except Exception as exc:
                print(f"[EMAIL-LOG] Resend API call failed: {exc}")
                traceback.print_exc()
                return EmailDeliveryResult(sent=False, error=f"Resend API delivery failed: {exc}")

        # Fallback to standard SMTP
        message = EmailMessage()
        message["From"] = config["FROM_EMAIL"]
        message["To"] = to_email
        message["Subject"] = subject
        message.set_content(text_body or unescape(html_body))
        message.add_alternative(html_body, subtype="html")

        try:
            cls._execute_smtp_send(message)
            return EmailDeliveryResult(sent=True)
        except Exception as exc:
            print(f"[email:failed] to={to_email} subject={subject} error={exc}")
            traceback.print_exc()
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

    @classmethod
    def send_verification_otp(cls, to_email: str, otp_code: str) -> EmailDeliveryResult:
        subject = "Verify your email for TripAI Travel"
        text_body = f"Your 6-digit verification code is: {otp_code}"
        html_body = f"""
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#17202a;max-width:500px;margin:auto;border:1px solid #e2e8f0;padding:20px;border-radius:8px">
          <h2 style="color:#2563eb;text-align:center">Verify Your Email</h2>
          <p>Thank you for signing up with <strong>TripAI Travel</strong>!</p>
          <p>Please enter the following 6-digit verification code to complete your registration:</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:12px;font-size:24px;font-weight:bold;letter-spacing:4px;text-align:center;color:#1e3a8a;border-radius:6px;margin:20px 0">
            {otp_code}
          </div>
          <p style="font-size:12px;color:#64748b">If you did not request this code, you can safely ignore this email.</p>
        </div>
        """
        return cls.send_email(to_email, subject, html_body, text_body)

    @classmethod
    def send_password_reset_otp(cls, to_email: str, reset_token: str) -> EmailDeliveryResult:
        subject = "Reset your password for TripAI Travel"
        text_body = f"Your password reset code is: {reset_token}"
        html_body = f"""
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#17202a;max-width:500px;margin:auto;border:1px solid #e2e8f0;padding:20px;border-radius:8px">
          <h2 style="color:#2563eb;text-align:center">Reset Your Password</h2>
          <p>We received a request to reset the password for your <strong>TripAI Travel</strong> account.</p>
          <p>Please enter the following reset code in the app to proceed with resetting your password:</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:12px;font-size:24px;font-weight:bold;letter-spacing:4px;text-align:center;color:#1e3a8a;border-radius:6px;margin:20px 0">
            {reset_token}
          </div>
          <p>This code will expire in 15 minutes.</p>
          <p style="font-size:12px;color:#64748b">If you did not request a password reset, you can safely ignore this email.</p>
        </div>
        """
        return cls.send_email(to_email, subject, html_body, text_body)

    @classmethod
    def send_collaboration_otp(cls, to_email: str, trip_name: str, inviter_name: str, otp_code: str) -> EmailDeliveryResult:
        subject = f"Verification Code to join trip to {trip_name}"
        text_body = (
            f"{inviter_name} invited you to join the trip '{trip_name}' as a buddy.\n"
            f"Your 6-digit verification code is: {otp_code}"
        )
        html_body = f"""
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#17202a;max-width:500px;margin:auto;border:1px solid #e2e8f0;padding:20px;border-radius:8px">
          <h2 style="color:#2563eb;text-align:center">Join Trip Collaboration</h2>
          <p><strong>{inviter_name}</strong> has invited you to join their trip to <strong>{trip_name}</strong>!</p>
          <p>Please enter the following 6-digit verification code in the app to join the trip:</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:12px;font-size:24px;font-weight:bold;letter-spacing:4px;text-align:center;color:#1e3a8a;border-radius:6px;margin:20px 0">
            {otp_code}
          </div>
          <p>This code will expire in 7 days.</p>
        </div>
        """
        return cls.send_email(to_email, subject, html_body, text_body)
