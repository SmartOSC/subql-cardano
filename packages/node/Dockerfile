# Build stage
FROM node:18-alpine as builder
ENV TZ ='UTC'
# Set working directory
WORKDIR /app
RUN apk add curl git 
RUN npm install -g --force yarn@latest && npm i -g typescript

COPY . .
RUN yarn install && \
    yarn build

RUN cd packages/cardano-ibc && \
    yarn install && \
    yarn codegen && yarn build

# RUN cd packages/node
# Set Entry point and command
# RUN cd packages/node && yarn start:dev
ENTRYPOINT ["/bin/sh","-c","cd packages/node && yarn start:dev"]

# ENTRYPOINT ["/bin/sh","-c","sleep infinity"]
# CMD ["yarn", "start:dev"]