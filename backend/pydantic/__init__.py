from __future__ import annotations

from typing import Any


def Field(default: Any = None, **_: Any) -> Any:
    return default


class BaseModel:
    def __init__(self, **data: Any) -> None:
        annotations = getattr(self, "__annotations__", {})
        for name in annotations:
            if name in data:
                setattr(self, name, data[name])
            elif hasattr(type(self), name):
                setattr(self, name, getattr(type(self), name))
            else:
                setattr(self, name, None)

    @classmethod
    def model_validate(cls, value: dict[str, Any] | "BaseModel") -> "BaseModel":
        if isinstance(value, cls):
            return value
        if not isinstance(value, dict):
            raise TypeError("Expected dict for model validation")
        return cls(**value)

    def model_dump(self) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for name in getattr(self, "__annotations__", {}):
            value = getattr(self, name)
            if isinstance(value, BaseModel):
                out[name] = value.model_dump()
            elif isinstance(value, list):
                out[name] = [item.model_dump() if isinstance(item, BaseModel) else item for item in value]
            else:
                out[name] = value
        return out
