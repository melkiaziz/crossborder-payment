FROM node:20-alpine

WORKDIR /app/blockchain2

COPY blockchain2/package*.json ./
RUN npm ci

COPY blockchain2/ ./
