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

RUN cd packages/node && \
    yarn install

# Set Entry point and command
# ENTRYPOINT ["/sbin/tini", "--", "/bin/run"]
# ENTRYPOINT ["/bin/sh","-c","sleep infinity"]
CMD ["yarn", "start:dev"]
