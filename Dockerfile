FROM node:12-alpine AS updated-node-alpine

RUN apk update && apk upgrade

#
# The preparation stage for use during the installation
# of app dependencies.
#
FROM updated-node-alpine AS build-ready

RUN apk add --no-cache git openssh

#
# Install depencencies from package.json
#
FROM build-ready AS app-js-depencencies

WORKDIR /build

COPY package*.json ./

RUN npm config set unsafe-perm true
RUN npm i --silent --quiet

#
# Transpiling (development).
#
FROM app-js-depencencies AS app-development-build

COPY tsconfig.json ./
COPY ./src ./src
COPY .env.example ./.env

RUN npm run build:dev

#
# Transpiling (production).
#
FROM app-js-depencencies AS app-production-build

COPY tsconfig.prod.json ./
COPY ./src ./src
COPY .env.production ./.env

RUN npm run build

#
# Removing non-production dependencies from node_modules.
#
FROM app-production-build AS production-js-dependencies

RUN npm prune --production

#
# Building game server image (development).
#
FROM updated-node-alpine AS development-image

# Install uWebSockets deps.
RUN apk add --no-cache gcompat
RUN rm -rf /var/cache/apk/*

WORKDIR /app

RUN mkdir logs && chown -R node: logs
RUN mkdir cache && chown -R node: cache
RUN mkdir certs && chown -R node: certs

COPY --from=app-development-build /build/dist ./dist
COPY --from=app-js-depencencies /build/node_modules ./node_modules
COPY --chown=node:node ./admin ./admin
COPY --chown=node:node ./data ./data
COPY package.json ./

ENV SU_PASSWORD=""

ENV NODE_ENV="development"
ENV LOG_LEVEL="debug"
ENV LOG_TO_CONSOLE=true
ENV LOG_PERFORMANCE_SAMPLES=true
ENV HOST="127.0.0.1"
ENV PORT=3501
ENV ENDPOINTS_TLS=false
ENV SERVER_TYPE="FFA"
ENV SERVER_ROOM="ab-ffa-d"
ENV SERVER_BOT_NAME="Server"
ENV SERVER_BOT_FLAG="JOLLY"
ENV ALLOW_NON_ASCII_USERNAMES=false
ENV PROWLERS_ALWAYS_VISIBLE_FOR_TEAMMATES=true

ENV MODERATION_PANEL=true
ENV MODERATION_PANEL_URL_ROUTE=admin

ENV MAX_PLAYERS_PER_IP=3
ENV BOTS_IP="127.0.0.1"
ENV USER_ACCOUNTS=false

ENV STATS_SYNC=false

ENV AUTH_LOGIN_SERVER_KEY_URL=""

ENV PACKETS_FLOODING_AUTOBAN=true

ENV AFK_DISCONNECT_TIMEOUT=""

ENV WEBSOCKETS_COMPRESSION=true
ENV EXPERIMENTAL_FASTCALL=1

EXPOSE ${PORT}

USER node

CMD [ "node", "./dist/app.js" ]

#
# Building game server image (production).
#
FROM updated-node-alpine AS production-image

# Install uWebSockets deps.
RUN apk add --no-cache gcompat
RUN rm -rf /var/cache/apk/*

WORKDIR /app

RUN mkdir logs && chown -R node: logs
RUN mkdir cache && chown -R node: cache
RUN mkdir certs && chown -R node: certs

COPY --from=app-production-build /build/dist ./dist
COPY --from=production-js-dependencies /build/node_modules ./node_modules
COPY --chown=node:node ./admin ./admin
COPY --chown=node:node ./data ./data
COPY package.json ./

ENV SU_PASSWORD=""

ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV LOG_TO_CONSOLE=true
ENV LOG_PERFORMANCE_SAMPLES=true
ENV HOST="127.0.0.1"
ENV PORT=3501
ENV ENDPOINTS_TLS=false
ENV SERVER_TYPE="FFA"
ENV SERVER_ROOM="ab-ffa-d"
ENV SERVER_BOT_NAME="Server"
ENV SERVER_BOT_FLAG="JOLLY"
ENV ALLOW_NON_ASCII_USERNAMES=false
ENV MODERATION_PANEL=true
ENV MODERATION_PANEL_URL_ROUTE="admin"
ENV MAX_PLAYERS_PER_IP=3
ENV BOTS_IP="127.0.0.1"
ENV USER_ACCOUNTS=false
ENV AUTH_LOGIN_SERVER_KEY_URL=""
ENV PACKETS_FLOODING_AUTOBAN=true
ENV AFK_DISCONNECT_TIMEOUT=0
ENV WEBSOCKETS_COMPRESSION=true
ENV EXPERIMENTAL_FASTCALL=1

EXPOSE ${PORT}

USER node

CMD [ "node", "./dist/app.js" ]
