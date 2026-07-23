from app.core.database import Base


class BaseModel(Base):
    __abstract__ = True
