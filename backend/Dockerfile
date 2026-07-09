FROM node:22-bookworm

# Toolchain để chấm code sinh viên: python3 (Python), g++ (C++), JDK (Java)
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 \
      g++ \
      default-jdk-headless \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cài dependencies trước (tận dụng cache)
COPY package.json ./
RUN npm install

# Copy toàn bộ mã nguồn backend
COPY . .

ENV PYTHON_CMD=python3
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["npx", "tsx", "src/index.ts"]