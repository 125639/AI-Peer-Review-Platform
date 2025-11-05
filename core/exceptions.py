"""
Exception Hierarchy - Linus Style
"Make your error conditions obvious and explicit" - Linus Torvalds
"""

class AppError(Exception):
    """Base exception - all app errors inherit from this
    
    Linus principle: "Good taste is about removing special cases"
    - All errors follow same pattern
    - No magic, no surprises
    """
    def __init__(self, message: str, code: str = "UNKNOWN"):
        self.message = message
        self.code = code
        super().__init__(self.message)

# Model errors
class ModelError(AppError):
    """Model-related errors"""
    def __init__(self, message: str):
        super().__init__(message, "MODEL_ERROR")

class ModelTimeoutError(ModelError):
    """Model timeout"""
    def __init__(self, model_name: str, timeout: int):
        super().__init__(f"Model {model_name} timed out after {timeout}s")

class ModelConfigError(ModelError):
    """Invalid model configuration"""
    pass

# Database errors
class DatabaseError(AppError):
    """Database-related errors"""
    def __init__(self, message: str):
        super().__init__(message, "DB_ERROR")

class ProviderNotFoundError(DatabaseError):
    """Provider not found"""
    def __init__(self, name: str):
        super().__init__(f"Provider '{name}' not found")

class ProviderExistsError(DatabaseError):
    """Provider already exists"""
    def __init__(self, name: str):
        super().__init__(f"Provider '{name}' already exists")

# API errors
class APIError(AppError):
    """API-related errors"""
    def __init__(self, message: str):
        super().__init__(message, "API_ERROR")

class ValidationError(APIError):
    """Input validation error"""
    pass

class AuthError(APIError):
    """Authentication/Authorization error"""
    pass
