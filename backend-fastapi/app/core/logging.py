import logging

# Referenced in the original architecture diagram (core/logging.py) but no
# implementation was given in the chat — this is a minimal, sane default.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
