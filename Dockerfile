# Node.js base image
FROM node:20-alpine

# Çalışma dizinini oluştur
WORKDIR /app

# package.json ve package-lock.json dosyalarını kopyala
COPY package*.json ./

# Bağımlılıkları yükle
RUN npm install

# Uygulama kodunu kopyala
COPY . .

# Uygulama portunu aç
EXPOSE 3000

# Uygulamayı başlat
CMD ["npm", "start"] 