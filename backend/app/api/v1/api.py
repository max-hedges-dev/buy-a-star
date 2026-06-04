from fastapi import APIRouter
from app.api.v1.endpoints import account, auth, checkout, registrations, stars

api_router = APIRouter()
api_router.include_router(account.router, prefix="/account", tags=["account"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(checkout.router, prefix="/checkout", tags=["checkout"])
api_router.include_router(registrations.router, prefix="/registrations", tags=["registrations"])
api_router.include_router(stars.router, prefix="/stars", tags=["stars"])
