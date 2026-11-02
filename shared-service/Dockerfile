FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914
WORKDIR /app
COPY shared-service/src ./shared-service/src
COPY src/robots/pattern-points.js ./src/robots/pattern-points.js
COPY src/twitch/normalize.js ./src/twitch/normalize.js
COPY website-staging/patterns/catalog.json ./website-staging/patterns/catalog.json
COPY website-staging/shared/sound-library.js ./website-staging/shared/sound-library.js
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "const h=require('node:http');const r=h.get({hostname:'127.0.0.1',port:process.env.PORT||8080,path:'/healthz',timeout:3000},x=>{x.resume();process.exit(x.statusCode===204?0:1)});r.on('timeout',()=>r.destroy());r.on('error',()=>process.exit(1))"
CMD ["node", "shared-service/src/start.js"]
