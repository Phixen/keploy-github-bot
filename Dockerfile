FROM node:20-slim
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm install
RUN npm cache clean --force
ENV NODE_ENV="production"
COPY . .
EXPOSE 3000
RUN npm run build
CMD [ "npm", "start" ]
ENTRYPOINT [ "npm", "start" ]
