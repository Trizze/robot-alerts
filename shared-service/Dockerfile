FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY shared-service/src ./shared-service/src
COPY src/robots/pattern-points.js ./src/robots/pattern-points.js
COPY src/twitch/normalize.js ./src/twitch/normalize.js
COPY website-staging/patterns/catalog.json ./website-staging/patterns/catalog.json
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8080
CMD ["node", "shared-service/src/start.js"]
