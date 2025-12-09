from fastapi import APIRouter
from app.api.v1.endpoints import stars

api_router = APIRouter()
api_router.include_router(stars.router, prefix="/stars", tags=["stars"])
