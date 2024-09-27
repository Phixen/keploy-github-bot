FROM imbios/bun-node:18-slim
WORKDIR /usr/src/app
COPY package.json  bun.lockb ./
RUN bun i
ENV NODE_ENV="production"
ENV WEBHOOK_PROXY_URL="https://smee.io/UBu6oNt71qeBK4Nw"
ENV APP_ID="998984"
COPY . .
EXPOSE 3000 
CMD [ "bun", "start" ]
