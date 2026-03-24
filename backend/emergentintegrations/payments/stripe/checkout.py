"""Stub for emergentintegrations.payments.stripe.checkout (not available on PyPI)."""

from pydantic import BaseModel
from typing import Optional, Dict


class CheckoutSessionRequest(BaseModel):
    amount: float
    currency: str = "usd"
    success_url: str = ""
    cancel_url: str = ""
    metadata: Dict = {}


class CheckoutSessionResponse(BaseModel):
    session_id: str = ""
    url: str = ""


class CheckoutStatusResponse(BaseModel):
    status: str = ""
    payment_status: str = ""
    amount_total: int = 0
    currency: str = "usd"
    session_id: str = ""
    metadata: Dict = {}


class StripeCheckout:
    def __init__(self, api_key: str = "", webhook_url: str = ""):
        self.api_key = api_key
        self.webhook_url = webhook_url

    async def create_checkout_session(self, request: CheckoutSessionRequest) -> CheckoutSessionResponse:
        raise NotImplementedError("emergentintegrations package not available; Stripe checkout is disabled")

    async def get_checkout_status(self, session_id: str) -> CheckoutStatusResponse:
        raise NotImplementedError("emergentintegrations package not available; Stripe checkout is disabled")

    async def handle_webhook(self, body: bytes, signature: Optional[str] = None) -> CheckoutStatusResponse:
        raise NotImplementedError("emergentintegrations package not available; Stripe checkout is disabled")
