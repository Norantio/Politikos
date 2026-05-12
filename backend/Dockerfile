FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install .

COPY politikos ./politikos

EXPOSE 8090

CMD ["uvicorn", "politikos.main:app", "--host", "0.0.0.0", "--port", "8090"]
