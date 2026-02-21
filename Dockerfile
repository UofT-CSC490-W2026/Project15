FROM ubuntu:22.04

# Base deps
ENV DEBIAN_FRONTEND=noninteractive

# Install core tools
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    jq \
    unzip \
    wget \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install .NET 8 SDK (required by Dafny)
RUN apt-get update \
    && apt-get install -y --no-install-recommends dotnet-sdk-8.0 \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js (LTS) and TypeScript
ARG NODE_MAJOR=22
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash - \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g typescript \
    && rm -rf /var/lib/apt/lists/*

# Install Bun
ENV BUN_INSTALL=/opt/bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="${BUN_INSTALL}/bin:${PATH}"

# Install Dafny (latest release, Linux binary)
RUN set -e; \
    meta="$(curl -fsSL https://api.github.com/repos/dafny-lang/dafny/releases/latest)"; \
    if printf '%s' "$meta" | jq -e '.message? | test("rate limit"; "i")' >/dev/null; then \
    meta=""; \
    fi; \
    url=""; \
    if [ -n "$meta" ]; then \
    url="$(printf '%s' "$meta" \
    | jq -r '.assets[].browser_download_url' \
    | grep -E '\.(zip|tar\.gz|tgz|tar\.xz)$' \
    | grep -Eiv 'win|windows|mac|osx|darwin|src|source|symbols' \
    | head -n 1 || true)"; \
    fi; \
    if [ -z "$url" ]; then \
    html="$(curl -fsSL https://github.com/dafny-lang/dafny/releases/latest)"; \
    url="$(printf '%s' "$html" \
    | grep -Eo '/dafny-lang/dafny/releases/download/[^"]+\.(zip|tar\.gz|tgz|tar\.xz)' \
    | grep -Eiv 'win|windows|mac|osx|darwin|src|source|symbols' \
    | head -n 1 || true)"; \
    if [ -n "$url" ]; then url="https://github.com${url}"; fi; \
    fi; \
    if [ -z "$url" ]; then \
    echo "Dafny asset not found for Linux in latest release" >&2; \
    if [ -n "$meta" ]; then \
    echo "Assets found:" >&2; \
    printf '%s' "$meta" | jq -r '.assets[].name' >&2 || true; \
    fi; \
    exit 1; \
    fi; \
    mkdir -p /opt/dafny; \
    case "$url" in \
    *.zip) curl -fsSL "$url" -o /tmp/dafny.zip; unzip /tmp/dafny.zip -d /opt/dafny; rm /tmp/dafny.zip ;; \
    *.tar.gz|*.tgz) curl -fsSL "$url" -o /tmp/dafny.tar.gz; tar -xzf /tmp/dafny.tar.gz -C /opt/dafny; rm /tmp/dafny.tar.gz ;; \
    *.tar.xz) curl -fsSL "$url" -o /tmp/dafny.tar.xz; tar -xJf /tmp/dafny.tar.xz -C /opt/dafny; rm /tmp/dafny.tar.xz ;; \
    *) echo "Unexpected Dafny asset type: $url" >&2; exit 1 ;; \
    esac

ENV DAFNY_HOME=/opt/dafny/dafny
ENV PATH="$DAFNY_HOME:$PATH"

WORKDIR /workspace
COPY . /workspace
RUN bun install
