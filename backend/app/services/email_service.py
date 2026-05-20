import os


class EmailService:
    """Small email boundary.

    In development this logs emails. In production, replace `send_email` internals
    with SendGrid, SES, Mailgun, or your existing provider.
    """

    FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@tripai.local")

    @classmethod
    def send_email(cls, to_email: str, subject: str, html_body: str, text_body: str = "") -> None:
        print(f"[email] from={cls.FROM_EMAIL} to={to_email} subject={subject}")
        print(text_body or html_body)

    @classmethod
    def send_trip_invitation(cls, to_email: str, trip_name: str, inviter_name: str, invite_link: str) -> None:
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
        cls.send_email(to_email, subject, html_body, text_body)

    @classmethod
    def send_notification(cls, to_email: str, title: str, message: str) -> None:
        cls.send_email(to_email, title, f"<p>{message}</p>", message)
