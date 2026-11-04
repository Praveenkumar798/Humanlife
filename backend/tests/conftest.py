"""
Pytest configuration for Human Legacy AI tests.
"""
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Import all models to configure SQLAlchemy relationships
import app.models  # noqa: F401
