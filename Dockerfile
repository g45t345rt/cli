# Copyright (C) 2021 Edge Network Technologies Limited
# Use of this source code is governed by a GNU GPL-style license
# that can be found in the LICENSE.md file. All rights reserved.

FROM node:lts AS build

WORKDIR /cli

ARG NETWORK=mainnet
ARG NODE=node14

ENV PKG_CACHE_PATH=/pkg-cache

# Prepare the build environment
RUN dpkg --add-architecture i386
RUN apt-get update -qy
RUN apt-get install -qy libc6:i386 libstdc++6:i386 qemu qemu-user-binfmt

# Pre-fetch Node base binaries to avoid
# issues with pulling during build
RUN npm install -g pkg-fetch
RUN pkg-fetch -n ${NODE} -p linux -a x64
RUN pkg-fetch -n ${NODE} -p linux -a arm64
RUN pkg-fetch -n ${NODE} -p macos -a x64
RUN pkg-fetch -n ${NODE} -p macos -a arm64
RUN pkg-fetch -n ${NODE} -p win -a x64

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source files in
COPY src ./src
COPY tsconfig.json ./
COPY .eslint* ./

# Run linting & tests, then build app
RUN npm run lint && npm run test
RUN npm run $NETWORK:build:src

# Using pkg build packages for all platforms and architectures
RUN npx pkg out/src/main-$NETWORK.js \
  --target $NODE-linux-x64,$NODE-linux-arm64,$NODE-macos-x64,$NODE-macos-arm64,$NODE-win-x64 \
  --output /cli/bin/edge \
  --debug

# Sign MacOS binaries
FROM registry.edge.network/edge/alpine-ldid AS ldid
COPY --from=build /cli/bin/edge-macos-x64 /cli/bin/edge-macos-x64
COPY --from=build /cli/bin/edge-macos-arm64 /cli/bin/edge-macos-arm64
RUN /root/ldid/ldid -S /cli/bin/edge-macos-x64
RUN /root/ldid/ldid -S /cli/bin/edge-macos-arm64

# Copy binaries to empty image, being sure to
# rename win to windows for consistency
FROM alpine:latest
RUN apk add bash
COPY --from=build /cli/bin/edge-linux-x64 /cli/bin/edge-linux-x64
COPY --from=build /cli/bin/edge-linux-arm64 /cli/bin/edge-linux-arm64
COPY --from=build /cli/bin/edge-win-x64.exe /cli/bin/edge-windows-x64.exe
COPY --from=ldid /cli/bin/edge-macos-x64 /cli/bin/edge-macos-x64
COPY --from=ldid /cli/bin/edge-macos-arm64 /cli/bin/edge-macos-arm64
COPY ./entrypoint.sh ./entrypoint.sh
CMD ["bash", "./entrypoint.sh"]