FROM node:20-slim
WORKDIR /usr/src/app
COPY package.json  bun.lockb ./
RUN npm ci --production
RUN npm cache clean --force
ENV NODE_ENV="production"
COPY . .
CMD [ "npm", "start" ]
