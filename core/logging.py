"""
Logging Configuration - Linus Style
"Logging should be simple, consistent, and useful" - Linus Torvalds
"""
import logging
import sys

_initialized = False

def get_logger(name: str) -> logging.Logger:
    """Get logger instance - Linus style: simple and explicit"""
    global _initialized
    if not _initialized:
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S',
            handlers=[logging.StreamHandler(sys.stdout)]
        )
        _initialized = True
    return logging.getLogger(name)
