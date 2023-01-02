# This default may be swapped for any compatible base image
ARG BASE_IMAGE=renovate/renovate@sha256:8b9c5733a4b7a478a431cf43145720fb3333ab536cbdbafd8560e535f0641c9c

# mc root dir
ARG APP_ROOT=/usr/src/app/mc

# --------------------------------------------------------------
# Stage 1 - compile
# --------------------------------------------------------------
FROM ${BASE_IMAGE} AS builder

USER root

ARG APP_ROOT

WORKDIR ${APP_ROOT}

COPY . .

RUN yarn install && \
    yarn build


# --------------------------------------------------------------
# Stage 2 - build prod
# --------------------------------------------------------------
FROM ${BASE_IMAGE} AS prod

USER root

ARG APP_ROOT

ENV LOG_LEVEL=debug

WORKDIR ${APP_ROOT}

COPY --from=builder ${APP_ROOT}/dist ./dist
COPY --from=builder ${APP_ROOT}/tools ./tools
COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

CMD ["node", "./dist/renovate.js"]
# must be numeric if this should work with openshift
USER 1000
