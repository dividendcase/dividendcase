# DividendCase in a container: the same app as `uv tool install dividendcase`.
#
#   docker run -d --name dividendcase -p 127.0.0.1:8765:8765 -v dividendcase-data:/data \
#     ghcr.io/dividendcase/dividendcase
#
# Publish the port on 127.0.0.1 so only this computer can reach it; your data lives in the
# `dividendcase-data` volume.

# 1. The interface (Next.js static export)
FROM node:22-bookworm-slim AS web
WORKDIR /src
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY site/package.json site/
COPY packages/brand/package.json packages/brand/
RUN npm ci --no-audit --no-fund
COPY packages packages
COPY frontend frontend
RUN npm run build --workspace frontend

# 2. The wheel, with the interface inside
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS wheel
WORKDIR /src
COPY pyproject.toml uv.lock README.md LICENSE ./
COPY src src
COPY --from=web /src/frontend/out src/dividendcase/web
RUN uv build --wheel --out-dir /dist

# 3. The app
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim
LABEL org.opencontainers.image.title="DividendCase" \
      org.opencontainers.image.description="A free, open-source dividend tracker that runs on your own computer" \
      org.opencontainers.image.source="https://github.com/dividendcase/dividendcase" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later"
COPY --from=wheel /dist /tmp/dist
RUN uv pip install --system --no-cache /tmp/dist/*.whl \
    && rm -rf /tmp/dist \
    && useradd --create-home --uid 1000 dividendcase \
    && mkdir /data && chown dividendcase:dividendcase /data
# Listen inside the container; the port is published on the host's loopback only (see above)
ENV DIVIDENDCASE_DATA_DIR=/data \
    DIVIDENDCASE_HOST=0.0.0.0 \
    DIVIDENDCASE_INSTALL_METHOD=docker \
    PYTHONUNBUFFERED=1
USER dividendcase
VOLUME /data
EXPOSE 8765
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8765/health', timeout=4)"
CMD ["dividendcase", "--no-browser"]
