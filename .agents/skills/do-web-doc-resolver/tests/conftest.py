import pytest


@pytest.fixture
def sample_url():
    return "https://docs.python.org/3/library/json.html"


@pytest.fixture
def sample_query():
    return "Python json module documentation"


@pytest.fixture
def max_chars():
    return 8000
