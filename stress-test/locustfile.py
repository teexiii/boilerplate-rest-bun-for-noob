"""
Stress test: Full user flow for 500 CCU
Flow: register by phone → verify OTP → create session → upload 2 videos → view session detail
"""

import os
import time
import uuid
import hashlib
import random
import logging
from pathlib import Path
from dotenv import load_dotenv
from locust import HttpUser, task, between, events, SequentialTaskSet

# Load .env from stress-test dir, then fall back to project root
load_dotenv(Path(__file__).parent / ".env")
load_dotenv(Path(__file__).parent.parent / ".env")

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
HASH_SECRET = os.getenv("HASH_SECRET", "")

# Use real video files if available, otherwise fall back to fake data
SAMPLE_VIDEO_PATH = os.getenv("SAMPLE_VIDEO_PATH", "")
SAMPLE_CANVAS_PATH = os.getenv("SAMPLE_CANVAS_PATH", "")

def _load_sample_file(path: str, fallback_size: int = 5 * 1024 * 1024) -> bytes:
    """Load a real file from disk, or generate fake webm bytes as fallback."""
    if path and os.path.exists(path):
        with open(path, "rb") as f:
            logger.info(f"Loaded sample file: {path} ({os.path.getsize(path)} bytes)")
            return f.read()
    return bytes([0x1A, 0x45, 0xDF, 0xA3] + [0x00] * (fallback_size - 4))

SAMPLE_VIDEO = _load_sample_file(SAMPLE_VIDEO_PATH)
SAMPLE_CANVAS = _load_sample_file(SAMPLE_CANVAS_PATH)


# ---------------------------------------------------------------------------
# Hash helper — replicates requireHash middleware signature
# ---------------------------------------------------------------------------
def make_hash_header() -> str:
    """Generate `uuid.sha256(uuid + secret)` header value."""
    uid = str(uuid.uuid4())
    digest = hashlib.sha256(f"{uid}{HASH_SECRET}".encode()).hexdigest()
    return f"{uid}.{digest}"


def get_error_msg(resp) -> str:
    """Extract error message from response (JSON body or raw text)."""
    if resp.status_code == 0:
        return f"Connection failed: {resp.error or 'no response from server'}"
    try:
        data = resp.json()
        return data.get("message", data.get("error", resp.text[:300]))
    except Exception:
        return resp.text[:300] or "empty response"


# ---------------------------------------------------------------------------
# Full user flow as a sequential task set
# ---------------------------------------------------------------------------
class UserSessionFlow(SequentialTaskSet):
    """
    Each virtual user runs this flow once, then loops:
    1. Register by phone (login-by-phone)
    2. Verify OTP
    3. Create app session
    4. Upload video + canvas
    5. View session detail
    """

    access_token: str = ""
    session_id: str = ""
    phone: str = ""
    otp: str = ""

    # -- Step 1: Register by phone -------------------------------------------
    @task
    def register_by_phone(self):
        # Generate fresh phone each loop to avoid "user already exists" on repeat
        suffix = uuid.uuid4().int % 10_000_000_000
        self.phone = f"09{suffix:010d}"

        headers = {"hash": make_hash_header()}
        payload = {
            "phone": self.phone,
            "name": f"User {self.phone[-6:]}",
            "address": "Stress Test",
        }

        with self.client.post(
            "/api/auth/login-by-phone",
            json=payload,
            headers=headers,
            name="1. Register by phone",
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"Register failed ({resp.status_code}): {get_error_msg(resp)}")
                self.interrupt()
                return

            data = resp.json().get("data", {})

            # If user already exists and needs password login, fail gracefully
            if data.get("needPassword"):
                resp.failure("User already exists, needs password")
                self.interrupt()
                return

            self.otp = data.get("otp", "")
            if not self.otp:
                resp.failure("No OTP in response")
                self.interrupt()

    # -- Step 2: Verify OTP --------------------------------------------------
    @task
    def verify_otp(self):
        headers = {"hash": make_hash_header()}
        payload = {"phone": self.phone, "otp": self.otp}

        with self.client.post(
            "/api/auth/verify-otp",
            json=payload,
            headers=headers,
            name="2. Verify OTP",
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"Verify OTP failed ({resp.status_code}): {get_error_msg(resp)}")
                self.interrupt()
                return

            data = resp.json().get("data", {})
            session = data.get("session", {})
            self.access_token = session.get("accessToken", "")

            if not self.access_token:
                resp.failure("No accessToken in response")
                self.interrupt()

    # -- Step 3: Create app session ------------------------------------------
    @task
    def create_session(self):
        headers = {
            "hash": make_hash_header(),
            "Authorization": f"Bearer {self.access_token}",
        }

        with self.client.post(
            "/api/app-sessions",
            json={"data": {"source": "stress-test"}},
            headers=headers,
            name="3. Create session",
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"Create session failed ({resp.status_code}): {get_error_msg(resp)}")
                self.interrupt()
                return

            data = resp.json().get("data", {})
            self.session_id = data.get("id", "")

            if not self.session_id:
                resp.failure("No session id in response")
                self.interrupt()

    # -- Step 4: Upload video + canvas ---------------------------------------
    @task
    def upload_videos(self):
        headers = {"Authorization": f"Bearer {self.access_token}"}
        ts = int(time.time() * 1000)

        files = {
            "video": (f"{ts}-video.webm", SAMPLE_VIDEO, "video/webm"),
            "canvas": (f"{ts}-canvas.webm", SAMPLE_CANVAS, "video/webm"),
        }

        with self.client.post(
            f"/api/app-sessions/{self.session_id}/upload-videos",
            files=files,
            headers=headers,
            name="4. Upload videos",
            catch_response=True,
            timeout=600,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"Upload failed ({resp.status_code}): {get_error_msg(resp)}")
                return

    # -- Step 5: View session detail -----------------------------------------
    @task
    def view_session(self):
        headers = {
            "hash": make_hash_header(),
            "Authorization": f"Bearer {self.access_token}",
        }

        with self.client.get(
            f"/api/app-sessions/{self.session_id}",
            headers=headers,
            name="5. View session",
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"View failed ({resp.status_code}): {get_error_msg(resp)}")
                return

            # data = resp.json().get("data", {})
            # session_data = data.get("data") or {}

            # # Verify upload URLs are present
            # if not session_data.get("videoUrl") or not session_data.get("canvasUrl"):
            #     resp.failure("Missing videoUrl or canvasUrl in session data")


# ---------------------------------------------------------------------------
# User class
# ---------------------------------------------------------------------------
class AppUser(HttpUser):
    """
    Simulates a full user session flow.
    Target: 500 CCU with spawn rate ~50/s
    """

    wait_time = between(1, 3)
    host = os.getenv("TARGET_HOST", "http://localhost:3085")
    tasks = [UserSessionFlow]


# ---------------------------------------------------------------------------
# Event hooks
# ---------------------------------------------------------------------------
@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    print("=" * 60)
    print("Starting stress test — full user flow (500 CCU target)")
    print(f"Target host: {environment.host}")
    print(f"Hash secret configured: {'yes' if HASH_SECRET else 'no (local mode)'}")
    print("=" * 60)


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    print("=" * 60)
    print("Stress test completed!")
    print("=" * 60)
