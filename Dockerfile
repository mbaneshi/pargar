# nexus-platform-ir is a fully static build (@sveltejs/adapter-static) —
# no Node runtime needed at serve time, just the built files behind nginx.

FROM node:22-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
      curl build-essential pkg-config ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain stable
ENV PATH="/root/.cargo/bin:${PATH}"
RUN rustup target add wasm32-unknown-unknown && cargo install wasm-pack

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app
COPY . .
# The root `prepare` script wires git hooks (`git config core.hooksPath ...`).
# The image has neither git nor a .git directory, so drop it for this build only.
RUN npm pkg delete scripts.prepare && pnpm install --frozen-lockfile
RUN pnpm build

FROM nginx:1.27-alpine
COPY --from=build /app/packages/app/build /usr/share/nginx/html
EXPOSE 80
