ARG WORKER_IMAGE=lexiflow-media-worker:local
FROM ${WORKER_IMAGE}
RUN apt-get update && apt-get install -y --no-install-recommends espeak-ng libespeak-ng1 libsndfile1 libgomp1 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements-linux.lock requirements-linux-full.lock ./
RUN --mount=type=cache,id=lexiflow-speech-pip,target=/root/.cache/pip \
    pip install --timeout 120 torch==2.3.1+cpu torchaudio==2.3.1+cpu --index-url https://download.pytorch.org/whl/cpu && pip install --timeout 120 -r requirements-linux-full.lock
COPY speech_bridge ./speech_bridge
ENV LEXIFLOW_MODEL_CACHE=/models LEXIFLOW_SPEECH_TMP_DIR=/tmp/lexiflow-speech LEXIFLOW_SPEECH_UPLOAD_DIR=/tmp/lexiflow-uploads
ENV HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 TOKENIZERS_PARALLELISM=false OMP_NUM_THREADS=2
EXPOSE 8100
CMD ["python", "-m", "uvicorn", "speech_bridge.app:app", "--host", "0.0.0.0", "--port", "8100", "--workers", "1"]
