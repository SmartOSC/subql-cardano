# Build stage
FROM node:18-alpine as builder
ENV TZ ='UTC'
# Set working directory
WORKDIR /app
RUN apk add curl git 
RUN npm i -g typescript

COPY package*.json ./
COPY packages ./
RUN yarn install && \
    yarn build

# RUN cd packages/node
# Set Entry point and command
# RUN cd packages/node && yarn start:dev
ENTRYPOINT ["start.sh"]

# ENTRYPOINT ["/bin/sh","-c","sleep infinity"]
# CMD ["yarn", "start:dev"]
