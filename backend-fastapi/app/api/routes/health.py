from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health_check():
    return {
        "system": "HMZC Marine Inspection System",
        "status": "running",
    }
