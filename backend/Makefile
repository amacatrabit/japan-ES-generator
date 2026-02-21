VENV := .venv
PYTHON := $(VENV)/bin/python
PIP := $(VENV)/bin/pip

.PHONY: venv install test run

venv:
	python3 -m venv $(VENV)

install: venv
	-$(PIP) install --upgrade pip
	-$(PIP) install -r requirements-dev.txt

test:
	PYTHONPATH=. python3 -m pytest -q

run: install
	PYTHONPATH=. $(PYTHON) -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
