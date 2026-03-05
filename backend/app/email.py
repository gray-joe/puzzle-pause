import os

import httpx


async def send_otac_email(to: str, code: str) -> None:
    base_url = os.environ.get("BASE_URL", "https://puzzlepause.app")

    if os.environ.get("PUZZLE_ENV", "dev") != "prod":
        print("\n==============================================")
        print(f"Login code for {to}: {code}")
        print("==============================================\n")
        return

    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        raise RuntimeError("RESEND_API_KEY not set in production")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "from": f"Puzzle Pause <noreply@{_domain(base_url)}>",
                "to": [to],
                "subject": "Your Puzzle Pause login code",
                "html": (
                    f"<p>Your login code is: <strong>{code}</strong></p>"
                    f"<p>Happy Puzzling!!!</p>"
                    f"<p>This code expires in 15 minutes.</p>"
                    f"<p>If you didn't request this, you can ignore this email.</p>"
                ),
            },
        )
        resp.raise_for_status()


def _domain(base_url: str) -> str:
    return base_url.replace("https://", "").replace("http://", "").split("/")[0]
