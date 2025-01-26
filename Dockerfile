FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm i
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/build ./
CMD [ "npm", "run", "start" ]
