# Copyright (C) 2021 Edge Network Technologies Limited
# Use of this source code is governed by a GNU GPL-style license
# that can be found in the LICENSE.md file. All rights reserved.

FROM node:lts AS build

WORKDIR /cli

ARG NETWORK=mainnet
ARG NODE=node14
ARG ARCH=x64

ENV PKG_CACHE_PATH=/pkg-cache

# Pre-fetch Node base binaries to avoid build time issues
RUN npm install -g pkg-fetch
RUN pkg-fetch -n ${NODE} -p linux -a $ARCH
RUN pkg-fetch -n ${NODE} -p macos -a $ARCH
RUN pkg-fetch -n ${NODE} -p win -a $ARCH

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
  --target $NODE-linux-$ARCH,$NODE-macos-$ARCH,$NODE-win-$ARCH \
  --output /cli/bin/edge \
  --debug

RUN ls -al /cli/bin

# Sign MacOS binaries
FROM registry.edge.network/edge/alpine-ldid AS ldid
ARG ARCH=x64
COPY --from=build /cli/bin/edge-macos-$ARCH /cli/bin/edge-macos-$ARCH
RUN /root/ldid/ldid -S /cli/bin/edge-macos-$ARCH

# Copy binaries to empty image, being sure to
# rename win to windows for consistency
FROM alpine:latest
ARG ARCH=x64
RUN apk add bash
COPY --from=build /cli/bin/edge-linux-$ARCH /cli/bin/edge-linux-$ARCH
COPY --from=build /cli/bin/edge-win-$ARCH.exe /cli/bin/edge-windows-$ARCH.exe
COPY --from=ldid /cli/bin/edge-macos-$ARCH /cli/bin/edge-macos-$ARCH
COPY ./entrypoint.sh ./entrypoint.sh
CMD ["bash", "./entrypoint.sh"]
