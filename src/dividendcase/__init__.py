"""DividendCase: a free, open-source dividend tracker that runs on your own computer."""
from importlib.metadata import PackageNotFoundError, version

try:
    __version__ = version("dividendcase")
except PackageNotFoundError:  # running from a source checkout without installing
    __version__ = "0.0.0+local"
