# Bước 1: Chọn base image Node.js (bản alpine cho nhẹ)
FROM node:18-alpine

# Bước 2: Tạo thư mục làm việc trong container
WORKDIR /usr/src/app

# Bước 3: Copy file quản lý thư viện vào trước để tận dụng cache của Docker
COPY package*.json ./

# Bước 4: Cài đặt thư viện (chỉ cài các thư viện cần thiết cho production)
RUN npm install --production

# Bước 5: Copy toàn bộ mã nguồn vào container
COPY . .

# Bước 6: Thiết lập múi giờ Việt Nam (quan trọng để Cron chạy đúng 8h sáng)
RUN apk add --no-cache tzdata
ENV TZ=Asia/Ho_Chi_Minh

# Bước 7: Lệnh chạy ứng dụng
CMD [ "node", "index.js" ]