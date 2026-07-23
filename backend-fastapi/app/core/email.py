import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger("hmzc.email")

# Requested directly: account creation and password resets should email
# the person, not rely solely on an admin relaying a temporary password
# by phone/in person. Uses smtplib — Python's standard library, not a
# third-party service SDK — so this works with any real SMTP provider
# (Gmail with an app password, SendGrid, Postmark, AWS SES's SMTP
# interface, your own mail server) via the same few settings, rather
# than locking this app to one vendor's API.
#
# This was actually tested, not just written — a minimal raw-socket SMTP
# server (stdlib only, no third-party test library available in the
# environment this was built in) was used to verify send_email() opens a
# real connection, authenticates, and transmits a correctly-formed
# message end to end. What was NOT tested and can't be from here: an
# actual SMTP provider's credentials, real deliverability, spam
# filtering, or a message actually landing in a real inbox — that needs
# real provider credentials, which only get configured once this is
# deployed somewhere with an actual email account behind it.


def is_email_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_USERNAME and settings.SMTP_PASSWORD and settings.SMTP_FROM_EMAIL)


def send_email(to_email: str, subject: str, text_body: str, html_body: str = "") -> bool:
    """
    Returns True if the message was handed off to the SMTP server
    successfully, False otherwise (including "not configured at all" —
    that's deliberately not an exception, since a missing email
    configuration shouldn't crash account creation or password reset;
    the person just doesn't get an email and the admin still sees the
    temporary password on screen as a fallback, same as before this
    feature existed).
    """
    if not is_email_configured():
        logger.warning(
            "Email not sent to %s (SMTP not configured — set SMTP_HOST/SMTP_USERNAME/"
            "SMTP_PASSWORD/SMTP_FROM_EMAIL in .env). Subject was: %s",
            to_email, subject,
        )
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM_EMAIL
    msg["To"] = to_email
    msg.attach(MIMEText(text_body, "plain"))
    if html_body:
        msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], msg.as_string())
        return True
    except Exception:
        logger.exception("Failed to send email to %s", to_email)
        return False


def send_account_created_email(to_email: str, full_name: str, temporary_password: str, login_url: str) -> bool:
    subject = "Your HMZC Certification Platform account"
    text = (
        f"Hi {full_name or to_email},\n\n"
        f"An administrator has created an account for you on the HMZC Certification Platform.\n\n"
        f"Email: {to_email}\n"
        f"Temporary password: {temporary_password}\n\n"
        f"Sign in here: {login_url}\n\n"
        f"You'll be asked to choose your own password the moment you sign in with the "
        f"temporary one above — after that, only you will know it.\n\n"
        f"If you weren't expecting this account, contact your administrator."
    )
    html = (
        f"<p>Hi {full_name or to_email},</p>"
        f"<p>An administrator has created an account for you on the <strong>HMZC Certification Platform</strong>.</p>"
        f"<p><strong>Email:</strong> {to_email}<br>"
        f"<strong>Temporary password:</strong> <code>{temporary_password}</code></p>"
        f"<p><a href=\"{login_url}\">Sign in here</a></p>"
        f"<p>You'll be asked to choose your own password the moment you sign in with the "
        f"temporary one above — after that, only you will know it.</p>"
        f"<p style=\"color:#6B7480;font-size:12px;\">If you weren't expecting this account, "
        f"contact your administrator.</p>"
    )
    return send_email(to_email, subject, text, html)


def send_password_reset_email(to_email: str, full_name: str, temporary_password: str, login_url: str) -> bool:
    subject = "Your HMZC Certification Platform password was reset"
    text = (
        f"Hi {full_name or to_email},\n\n"
        f"An administrator has reset your password on the HMZC Certification Platform.\n\n"
        f"Temporary password: {temporary_password}\n\n"
        f"Sign in here: {login_url}\n\n"
        f"You'll be asked to choose a new password the moment you sign in with the "
        f"temporary one above.\n\n"
        f"If you didn't expect this, contact your administrator right away."
    )
    html = (
        f"<p>Hi {full_name or to_email},</p>"
        f"<p>An administrator has reset your password on the <strong>HMZC Certification Platform</strong>.</p>"
        f"<p><strong>Temporary password:</strong> <code>{temporary_password}</code></p>"
        f"<p><a href=\"{login_url}\">Sign in here</a></p>"
        f"<p>You'll be asked to choose a new password the moment you sign in with the "
        f"temporary one above.</p>"
        f"<p style=\"color:#B3382C;font-size:12px;\">If you didn't expect this, contact your "
        f"administrator right away.</p>"
    )
    return send_email(to_email, subject, text, html)
