FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Compile Prisma client definitions
RUN npx prisma generate

# Build Next.js application
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
